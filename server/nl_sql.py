import json
import os
import re
from typing import Any, Dict, List, Optional

import ai
import db

try:
    import sqlglot
    from sqlglot import exp
    HAS_SQLGLOT = True
except ImportError:
    sqlglot = None
    exp = None
    HAS_SQLGLOT = False


ALLOWED_TABLES = {"students", "points_breakdown"}
MAX_RESULT_ROWS = 200


def _get_schema_snapshot() -> Dict[str, Any]:
    conn = db.get_db_connection()
    cursor = conn.cursor()
    tables = {}
    for table_name in ["students", "points_breakdown"]:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [{"name": row[1], "type": row[2]} for row in cursor.fetchall()]
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 2")
        examples = [dict(row) for row in cursor.fetchall()]
        tables[table_name] = {"columns": columns, "examples": examples}
    conn.close()
    return tables


def _build_prompt(query: str, schema: Dict[str, Any], context_role: Optional[str], context_dept: Optional[str]) -> str:
    return (
        "You generate exactly one SQLite SELECT statement and nothing else.\n"
        "Use only the tables and columns in the schema below.\n"
        "Do not use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, ATTACH, DETACH, PRAGMA, or multiple statements.\n"
        f"Limit results to at most {MAX_RESULT_ROWS} rows.\n"
        "Return raw SQL only.\n\n"
        f"Context role: {context_role or 'none'}\n"
        f"Context department: {context_dept or 'none'}\n"
        f"User query: {query}\n\n"
        f"Schema JSON: {json.dumps(schema, ensure_ascii=True)}"
    )


def _call_llm(prompt: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    model = os.getenv("NL_SQL_MODEL", "gpt-4o-mini")
    base_url = os.getenv("OPENAI_BASE_URL")
    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": "You return only valid SQLite SELECT statements."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content or ""
    return content.strip()


def _normalize_sql(sql_text: str) -> str:
    cleaned = sql_text.strip().strip("`")
    cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip().rstrip(";")


def _validate_sql(sql_text: str) -> str:
    cleaned = _normalize_sql(sql_text)
    lowered = cleaned.lower()
    if not lowered.startswith("select") and not lowered.startswith("with"):
        raise ValueError("Only SELECT statements are allowed")
    for forbidden in ["insert ", "update ", "delete ", "drop ", "alter ", "truncate ", "attach ", "detach ", "pragma ", "vacuum "]:
        if forbidden in lowered:
            raise ValueError("Write operations are not allowed")
    if ";" in cleaned:
        raise ValueError("Multiple statements are not allowed")

    if HAS_SQLGLOT:
        parsed = sqlglot.parse_one(cleaned, read="sqlite")
        if parsed is None:
            raise ValueError("Could not parse SQL")
        if isinstance(parsed, (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter, exp.Create, exp.Command)):
            raise ValueError("Only SELECT statements are allowed")
        tables = {table.name.lower() for table in parsed.find_all(exp.Table)}
        if not tables.issubset(ALLOWED_TABLES):
            raise ValueError("Query references unexpected tables")
        return parsed.sql(dialect="sqlite")

    tables = set(re.findall(r"\bfrom\s+([a-zA-Z_][\w]*)|\bjoin\s+([a-zA-Z_][\w]*)", lowered))
    flattened = {name.lower() for pair in tables for name in pair if name}
    if flattened and not flattened.issubset(ALLOWED_TABLES):
        raise ValueError("Query references unexpected tables")
    return cleaned


def _cap_rows(sql_text: str, max_rows: int = MAX_RESULT_ROWS) -> str:
    match = re.search(r"\blimit\s+(\d+)\b", sql_text, flags=re.IGNORECASE)
    if match:
        limit_value = int(match.group(1))
        if limit_value > max_rows:
            return re.sub(r"\blimit\s+\d+\b", f"LIMIT {max_rows}", sql_text, count=1, flags=re.IGNORECASE)
        return sql_text
    return f"SELECT * FROM ({sql_text}) AS nlq LIMIT {max_rows}"


def _execute_readonly_sql(sql_text: str) -> List[Dict[str, Any]]:
    conn = db.get_readonly_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_text)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def run_nl_sql_search(query: str, context_role: Optional[str] = None, context_dept: Optional[str] = None):
    schema = _get_schema_snapshot()
    prompt = _build_prompt(query, schema, context_role, context_dept)
    llm_sql = _call_llm(prompt)

    if llm_sql:
        try:
            validated_sql = _validate_sql(llm_sql)
            capped_sql = _cap_rows(validated_sql)
            results = _execute_readonly_sql(capped_sql)
            columns = list(results[0].keys()) if results else []
            return {
                "answer": f"Returned {len(results)} row(s).",
                "answer_type": "table",
                "results": results,
                "columns": columns,
                "sql": validated_sql,
                "query": query,
                "mode": "llm-sql",
            }
        except Exception:
            pass

    fallback = ai.parse_natural_language_query(query, context_role, context_dept)
    results = fallback.get("results", []) if isinstance(fallback, dict) else []
    columns = list(results[0].keys()) if results else []
    return {
        "answer": fallback.get("answer", "Couldn't understand that search — try rephrasing") if isinstance(fallback, dict) else "Couldn't understand that search — try rephrasing",
        "answer_type": fallback.get("answer_type", "table") if isinstance(fallback, dict) else "table",
        "results": results,
        "columns": columns,
        "sql": None,
        "query": query,
        "mode": "fallback",
    }
