import re
import sqlite3
from db import get_db_connection

def parse_natural_language_query(query: str, context_role: str = None, context_dept: str = None):
    """
    Parses a natural language query from the admin and translates it into:
    1. Interpreted Filters (JSON) — structured chips for the UI
    2. A SQLite query and parameters
    3. An explanation of filters applied
    4. A friendly conversational answer text
    5. Summary metrics
    6. Chart data (if applicable)
    """
    q = query.lower().strip()
    
    where_clauses = []
    params = []
    interpreted = {}
    
    answer_type = "text"
    chart_data = None
    
    if context_role == 'mentor' and context_dept:
        where_clauses.append("department = ?")
        params.append(context_dept)
        interpreted["mentor_scope"] = {"label": "Scope", "op": "=", "value": f"My Pod ({context_dept})"}
    
    # ── 1. Department detection ────────────────────────────────────────────────
    dept_map = {
        "cse": "COMPUTER SCIENCE AND ENGINEERING",
        "computer science and engineering": "COMPUTER SCIENCE AND ENGINEERING",
        "computer science": "COMPUTER SCIENCE AND ENGINEERING",
        "cs": "COMPUTER SCIENCE AND ENGINEERING",
        "computer science and business systems": "COMPUTER SCIENCE AND BUSINESS SYSTEMS",
        "computer science and business": "COMPUTER SCIENCE AND BUSINESS SYSTEMS",
        "csbs": "COMPUTER SCIENCE AND BUSINESS SYSTEMS",
        "cb": "COMPUTER SCIENCE AND BUSINESS SYSTEMS",
        "information technology": "INFORMATION TECHNOLOGY",
        "it": "INFORMATION TECHNOLOGY",
        "information science & engineering": "INFORMATION SCIENCE & ENGINEERING",
        "information science and engineering": "INFORMATION SCIENCE & ENGINEERING",
        "information science": "INFORMATION SCIENCE & ENGINEERING",
        "ise": "INFORMATION SCIENCE & ENGINEERING",
        "is": "INFORMATION SCIENCE & ENGINEERING",
        "ig": "INFORMATION SCIENCE & ENGINEERING",
        "electronics and communication engineering": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "electronics and communication": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "ece": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "ec": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "electronics": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "electrical and electronics engineering": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "electrical and electronics": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "eee": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "ee": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "electrical": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "electronics and instrumentation engineering": "ELECTRONICS AND INSTRUMENTATION ENGINEERING",
        "electronics and instrumentation": "ELECTRONICS AND INSTRUMENTATION ENGINEERING",
        "eie": "ELECTRONICS AND INSTRUMENTATION ENGINEERING",
        "ei": "ELECTRONICS AND INSTRUMENTATION ENGINEERING",
        "biomedical engineering": "BIOMEDICAL ENGINEERING",
        "biomedical": "BIOMEDICAL ENGINEERING",
        "bm": "BIOMEDICAL ENGINEERING",
        "aeronautical engineering": "AERONAUTICAL ENGINEERING",
        "aeronautical": "AERONAUTICAL ENGINEERING",
        "aero": "AERONAUTICAL ENGINEERING",
        "ae": "AERONAUTICAL ENGINEERING",
        "mechanical engineering": "MECHANICAL ENGINEERING",
        "mechanical": "MECHANICAL ENGINEERING",
        "mech": "MECHANICAL ENGINEERING",
        "me": "MECHANICAL ENGINEERING",
        "civil engineering": "CIVIL ENGINEERING",
        "civil": "CIVIL ENGINEERING",
        "ce": "CIVIL ENGINEERING",
        "fashion technology": "FASHION TECHNOLOGY",
        "fashion": "FASHION TECHNOLOGY",
        "ft": "FASHION TECHNOLOGY",
        "textile technology": "TEXTILE TECHNOLOGY",
        "textile": "TEXTILE TECHNOLOGY",
        "tx": "TEXTILE TECHNOLOGY",
        "artificial intelligence and data science": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "artificial intelligence & data science": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "artificial intelligence": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "aids": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "ai and ds": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "ai & ds": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "ad": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "biotechnology": "BIOTECHNOLOGY",
        "biotech": "BIOTECHNOLOGY",
        "bt": "BIOTECHNOLOGY",
        "automobile engineering": "AUTOMOBILE ENGINEERING",
        "automobile": "AUTOMOBILE ENGINEERING",
        "au": "AUTOMOBILE ENGINEERING",
        "agriculture engineering": "AGRICULTURE ENGINEERING",
        "agriculture": "AGRICULTURE ENGINEERING",
        "ag": "AGRICULTURE ENGINEERING",
        "mechatronics engineering": "MECHATRONICS",
        "mechatronics": "MECHATRONICS",
        "mc": "MECHATRONICS",
        "computer technology": "COMPUTER TECHNOLOGY",
        "ct": "COMPUTER TECHNOLOGY",
        "food technology": "FOOD TECHNOLOGY",
        "food": "FOOD TECHNOLOGY",
        "fd": "FOOD TECHNOLOGY",
        "software engineering": "SOFTWARE ENGINEERING",
        "se": "SOFTWARE ENGINEERING"
    }
    
    matched_dept = None
    # Sort by length descending so longer phrases match first
    for key in sorted(dept_map.keys(), key=len, reverse=True):
        if re.search(r'\b' + re.escape(key) + r'\b', q):
            matched_dept = dept_map[key]
            break
            
    if matched_dept:
        where_clauses.append("department = ?")
        params.append(matched_dept)
        interpreted["department"] = {"label": "Department", "op": "=", "value": matched_dept}
        
    # ── 2. Year detection ─────────────────────────────────────────────────────
    year_patterns = [
        (r"\b1st\s+year\b", "I"), (r"\bfirst\s+year\b", "I"),
        (r"\byear\s+1\b", "I"), (r"\byear\s+i\b", "I"),
        (r"\b2nd\s+year\b", "II"), (r"\bsecond\s+year\b", "II"),
        (r"\byear\s+2\b", "II"), (r"\byear\s+ii\b", "II"),
        (r"\b3rd\s+year\b", "III"), (r"\bthird\s+year\b", "III"),
        (r"\byear\s+3\b", "III"), (r"\byear\s+iii\b", "III"),
        (r"\b4th\s+year\b", "IV"), (r"\bfourth\s+year\b", "IV"),
        (r"\byear\s+4\b", "IV"), (r"\byear\s+iv\b", "IV"),
    ]
    
    matched_year = None
    for pattern, roman in year_patterns:
        if re.search(pattern, q):
            matched_year = roman
            break
    # Fallback — bare roman numeral (only if no year matched yet)
    if not matched_year:
        roman_match = re.search(r"\b(iv|iii|ii|i)\b", q)
        if roman_match:
            matched_year = roman_match.group(1).upper()
            
    if matched_year:
        where_clauses.append("year = ?")
        params.append(matched_year)
        interpreted["year"] = {"label": "Year", "op": "=", "value": matched_year}
 
    # ── 3. Engagement group ───────────────────────────────────────────────────
    if re.search(r"\blow\s+engagement\b|\blow\s+performers?\b|\blow\s+participation\b|\bat\s+risk\b|\brisk\b", q):
        where_clauses.append("engagement_group = 'Low'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "Low"}
    elif re.search(r"\bmedium\s+engagement\b|\bmedium\s+performers?\b|\baverage\s+performers?\b|\bmoderate\b", q):
        where_clauses.append("engagement_group = 'Medium'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "Medium"}
    elif re.search(r"\bhigh\s+engagement\b|\bhigh\s+performers?\b|\btop\s+performers?\b|\boverachievers?\b|\bhigh\s+participation\b", q):
        where_clauses.append("engagement_group = 'High'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "High"}
 
    # ── 4. Numeric point constraints ──────────────────────────────────────────
    field_name = "total_points"
    field_label = "Total Points"
    if re.search(r"\bbalance\b", q):
        field_name = "balance_points"
        field_label = "Balance Points"
    elif re.search(r"\bnegative\b|\bpenalty\b|\bpenalties\b", q):
        field_name = "negative_points"
        field_label = "Negative Points"
    elif re.search(r"\bredeemed\b", q):
        field_name = "redeemed_points"
        field_label = "Redeemed Points"
    elif re.search(r"\bcumulative\b", q):
        field_name = "cumulative_points"
        field_label = "Cumulative Points"

    # Operator + number patterns (handles >=, <=, >, <, =, and integers)
    op_map_explicit = [
        (r"(>=|=>)\s*(\d+(?:\.\d+)?)", ">="),
        (r"(<=|=<)\s*(\d+(?:\.\d+)?)", "<="),
        (r">(?!=)\s*(\d+(?:\.\d+)?)", ">"),
        (r"<(?!=)\s*(\d+(?:\.\d+)?)", "<"),
        (r"=\s*(\d+(?:\.\d+)?)", "="),
    ]
    
    point_matched = False
    for pattern, op in op_map_explicit:
        m = re.search(pattern, q)
        if m:
            val = float(m.group(len(m.groups())))
            where_clauses.append(f"{field_name} {op} ?")
            params.append(val)
            interpreted["points"] = {
                "label": field_label,
                "op": op,
                "value": str(int(val) if val == int(val) else val)
            }
            point_matched = True
            break
 
    if not point_matched:
        # Natural language operators
        gt_match = re.search(r"(greater\s+than|more\s+than|above|over)\s+(\d+(?:\.\d+)?)\s*(points|pts)?", q)
        if gt_match:
            val = float(gt_match.group(2))
            where_clauses.append(f"{field_name} > ?")
            params.append(val)
            interpreted["points"] = {"label": field_label, "op": ">", "value": str(int(val) if val == int(val) else val)}
            point_matched = True
 
        if not point_matched:
            lt_match = re.search(r"(less\s+than|below|under)\s+(\d+(?:\.\d+)?)\s*(points|pts)?", q)
            if lt_match:
                val = float(lt_match.group(2))
                where_clauses.append(f"{field_name} < ?")
                params.append(val)
                interpreted["points"] = {"label": field_label, "op": "<", "value": str(int(val) if val == int(val) else val)}
                point_matched = True
 
        if not point_matched:
            between_match = re.search(r"between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)", q)
            if between_match:
                v1 = float(between_match.group(1))
                v2 = float(between_match.group(2))
                where_clauses.append(f"{field_name} BETWEEN ? AND ?")
                params.extend([v1, v2])
                interpreted["points"] = {"label": field_label, "op": "between", "value": f"{int(v1)}-{int(v2)}"}
                point_matched = True
                
        # Handle just a bare number at the end, e.g. "student < 1000" or "points 1000"
        if not point_matched:
            bare_num_match = re.search(r"\b(points|pts|balance|total|negative|redeemed|cumulative)\s*(?:points|pts)?\s*(\d+(?:\.\d+)?)\b", q)
            if bare_num_match:
                val = float(bare_num_match.group(2))
                where_clauses.append(f"{field_name} >= ?")
                params.append(val)
                interpreted["points"] = {"label": field_label, "op": ">=", "value": str(int(val) if val == int(val) else val)}
                point_matched = True

    # ── 5. Category-specific filters ──────────────────────────────────────────
    category_keywords = [
        (r"\blab\s+initiatives?\b", "Lab Initiatives"),
        (r"\bspecial\s+lab\b", "Special Lab Initiatives"),
        (r"\bhackathon\b|\btechnical\s+events?\b", "Technical Events"),
        (r"\binternship\b|\binterviews?\b|\binterview\s+prep\b", "Interviews"),
        (r"\bskills?\b|\bprogramming\b|\bcoding\b", "Skills"),
        (r"\bextra.?curricular\b|\bclub\b", "Extra-Curricular"),
        (r"\bexternal\s+events?\b", "External Events"),
        (r"\bstudent\s+initiatives?\b", "Student Initiatives"),
        (r"\bfaculty\s+initiatives?\b", "Faculty Initiatives"),
        (r"\bexams?\b|\bassessments?\b", "Exams"),
        (r"\bassignments?\b", "Assignments"),
    ]
    
    matched_category = None
    for pattern, cat_name in category_keywords:
        if re.search(pattern, q):
            matched_category = cat_name
            where_clauses.append(
                "roll_no IN (SELECT roll_no FROM points_breakdown WHERE category = ? AND points_earned > 0)"
            )
            params.append(cat_name)
            interpreted["category"] = {"label": "Category", "op": "=", "value": cat_name}
            break

    # ── 6. Department Comparisons & Complex Extremes ─────────────────────────
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Handle global comparisons (e.g. "which department has highest average points?")
    if re.search(r"\b(which|what)\s+department\b.*\bhighest\b.*\b(average|avg)\b", q) or re.search(r"\btop\s+department\b", q):
        cursor.execute("""
            SELECT department, AVG(total_points) as avg_pts, COUNT(*) as student_cnt 
            FROM students 
            GROUP BY department 
            ORDER BY avg_pts DESC 
            LIMIT 1
        """)
        row = cursor.fetchone()
        conn.close()
        if row:
            dept = row['department']
            avg_pts = round(float(row['avg_pts']), 2)
            cnt = row['student_cnt']
            ans = f"Based on the analysis, **{dept}** is the top-performing department, leading with an average of **{avg_pts:,} total points** across {cnt} students."
            return {
                "query": query,
                "interpreted_filters": {"comparison": {"label": "Comparison", "op": "Top Dept", "value": dept}},
                "explanation": "Calculated highest average total points by department.",
                "answer": ans,
                "summary_metrics": {"total_count": cnt, "average_points": avg_pts},
                "results": []
            }
            
    if re.search(r"\b(which|what)\s+department\b.*\blowest\b.*\b(average|avg)\b", q) or re.search(r"\blowest\s+performing\s+department\b", q):
        cursor.execute("""
            SELECT department, AVG(total_points) as avg_pts, COUNT(*) as student_cnt 
            FROM students 
            GROUP BY department 
            ORDER BY avg_pts ASC 
            LIMIT 1
        """)
        row = cursor.fetchone()
        conn.close()
        if row:
            dept = row['department']
            avg_pts = round(float(row['avg_pts']), 2)
            cnt = row['student_cnt']
            ans = f"The department with the lowest average total points is **{dept}** at **{avg_pts:,} total points** across {cnt} students."
            return {
                "query": query,
                "interpreted_filters": {"comparison": {"label": "Comparison", "op": "Bottom Dept", "value": dept}},
                "explanation": "Calculated lowest average total points by department.",
                "answer": ans,
                "summary_metrics": {"total_count": cnt, "average_points": avg_pts},
                "results": []
            }

    # ── 7. Build SQL & Run query ──────────────────────────────────────────────
    sql_where = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # Check if we want a custom LIMIT or sorting order
    limit_val = 200
    order_by_col = field_name
    order_dir = "DESC"
    
    # Handle "top 5 students" or similar
    top_match = re.search(r"\btop\s+(\d+)\b", q)
    if top_match:
        limit_val = int(top_match.group(1))
    elif re.search(r"\bwho\s+has\s+the\s+(highest|most|max)\b|\bhighest\b|\bmax\b", q):
        limit_val = 1
        
    if re.search(r"\blowest\b|\bleast\b|\bmin\b", q):
        order_dir = "ASC"
        if re.search(r"\bwho\s+has\s+the\s+lowest\b", q):
            limit_val = 1
            
    sql_query = f"SELECT * FROM students WHERE {sql_where} ORDER BY {order_by_col} {order_dir} LIMIT {limit_val}"
    
    cursor.execute(sql_query, params)
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        # Round numeric point fields to whole integers
        for field in ['total_points', 'balance_points', 'redeemed_points', 'cumulative_points', 'negative_points']:
            if field in d and d[field] is not None:
                d[field] = int(round(float(d[field])))
        results.append(d)
        
    # Calculate aggregate values for the matching filters
    agg_query = f"""
        SELECT 
            COUNT(*) as total_count,
            AVG(total_points) as avg_total,
            AVG(balance_points) as avg_balance,
            SUM(total_points) as sum_total,
            SUM(balance_points) as sum_balance,
            SUM(CASE WHEN engagement_group = 'Low' THEN 1 ELSE 0 END) as low_count
        FROM students 
        WHERE {sql_where}
    """
    cursor.execute(agg_query, params)
    agg_row = cursor.fetchone()
    conn.close()
    
    total_count = agg_row['total_count'] or 0
    avg_total = round(agg_row['avg_total'] or 0.0, 2)
    avg_balance = round(agg_row['avg_balance'] or 0.0, 2)
    sum_total = round(agg_row['sum_total'] or 0.0, 2)
    sum_balance = round(agg_row['sum_balance'] or 0.0, 2)
    low_count = agg_row['low_count'] or 0
    
    summary_metrics = {
        "total_count": total_count,
        "average_points": avg_total,
        "average_balance": avg_balance,
        "total_points_sum": sum_total,
        "total_balance_sum": sum_balance,
        "at_risk_count": low_count
    }
    
    # ── 8. Formulate Explanations and Conversational Answers ──────────────────
    # Explanation
    if interpreted:
        parts = []
        for k, v in interpreted.items():
            parts.append(f"{v['label']} {v['op']} {v['value']}")
        explanation = "Filters applied: " + " & ".join(parts)
    else:
        explanation = f"No specific filters. Displaying top {len(results)} students overall."

    # Conversational Answer
    dept_str = f" in **{matched_dept}**" if matched_dept else ""
    year_str = f" in Year **{matched_year}**" if matched_year else ""
    cat_str = f" for **{matched_category}**" if matched_category else ""
    
    is_average_query = re.search(r"\b(average|avg)\b", q)
    is_count_query = re.search(r"\b(how\s+many|count|number\s+of)\b", q)
    is_sum_query = re.search(r"\b(sum|total\s+points\s+sum|cumulative\s+sum)\b", q)
    is_extreme_query = re.search(r"\b(highest|lowest|top\s+\d+|who\s+has)\b", q)
    
    if is_average_query:
        if "balance" in q:
            answer = f"The average balance points for students{dept_str}{year_str} is **{avg_balance:,} points** (calculated across {total_count} students)."
        else:
            answer = f"The average total points earned by students{dept_str}{year_str} is **{avg_total:,} points** (calculated across {total_count} students)."
            
    elif is_count_query:
        if "at risk" in q or "low engagement" in q:
            answer = f"There are **{low_count}** students classified as At Risk (Low engagement){dept_str}{year_str}."
        else:
            answer = f"I found **{total_count}** students matching your search filters{dept_str}{year_str}."
            
    elif is_sum_query:
        if "balance" in q:
            answer = f"The sum of all balance points for students{dept_str}{year_str} is **{sum_balance:,} points**."
        else:
            answer = f"The cumulative reward points earned by students{dept_str}{year_str} is **{sum_total:,} points**."
            
    elif is_extreme_query and len(results) > 0:
        if limit_val == 1:
            student = results[0]
            val = student['balance_points'] if "balance" in q else student['total_points']
            val_type = "balance" if "balance" in q else "total"
            extreme_label = "lowest" if order_dir == "ASC" else "highest"
            answer = f"The student with the **{extreme_label}** {val_type} points{dept_str}{year_str} is **{student['student_name']}** ({student['roll_no']}) with **{val:,} points**."
        else:
            extreme_label = "lowest" if order_dir == "ASC" else "highest"
            answer = f"Here are the top **{len(results)}** students with the {extreme_label} points{dept_str}{year_str}:"
            
    else:
        answer = f"Found **{total_count}** student record(s) matching your criteria{dept_str}{year_str}{cat_str}. Ordered by total points descending."

    # ── 9. Chart Generation ───────────────────────────────────────────────────
    if re.search(r"\bcompare\b", q) and re.search(r"\b(departments?|branches?)\b", q):
        answer_type = "chart"
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT department, AVG(total_points) as avg_pts FROM students GROUP BY department ORDER BY avg_pts DESC")
        chart_rows = c.fetchall()
        chart_data = {
            "chartType": "bar",
            "dataKey": "avg_pts",
            "nameKey": "department",
            "data": [{"department": r['department'], "avg_pts": round(r['avg_pts'], 2)} for r in chart_rows]
        }
        conn.close()
        answer = "Here is the comparison of average points across departments:"
        
    elif re.search(r"\b(trend|distribution)\b", q) and re.search(r"\bcategor(y|ies)\b", q):
        answer_type = "chart"
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT category, SUM(points_earned) as total FROM points_breakdown GROUP BY category ORDER BY total DESC")
        chart_rows = c.fetchall()
        chart_data = {
            "chartType": "pie",
            "dataKey": "total",
            "nameKey": "category",
            "data": [{"category": r['category'], "total": round(r['total'], 2)} for r in chart_rows]
        }
        conn.close()
        answer = "Here is the point distribution across all categories:"

    return {
        "query": query,
        "interpreted_filters": interpreted,
        "explanation": explanation,
        "answer_type": answer_type,
        "chart_data": chart_data,
        "answer": answer,
        "summary_metrics": summary_metrics,
        "results": results
    }
        
    return {
        "query": query,
        "interpreted_filters": interpreted,
        "explanation": explanation,
        "results": results
    }


def get_student_recommendations(roll_no: str):
    """
    Computes explainable prescriptive recommendations for a student.
    Compares the student's breakdown points with the department average.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM students WHERE roll_no = ?", (roll_no,))
    student_row = cursor.fetchone()
    if not student_row:
        conn.close()
        return []
        
    dept = student_row['department']
    
    cursor.execute("SELECT category, points_earned FROM points_breakdown WHERE roll_no = ?", (roll_no,))
    student_pts = {r['category']: r['points_earned'] for r in cursor.fetchall()}
    
    cursor.execute("""
        SELECT pb.category, AVG(pb.points_earned) as avg_pts
        FROM points_breakdown pb
        JOIN students s ON pb.roll_no = s.roll_no
        WHERE s.department = ?
        GROUP BY pb.category
    """, (dept,))
    dept_avgs = {r['category']: r['avg_pts'] for r in cursor.fetchall()}
    
    conn.close()
    
    recommendations = []
    
    lab_pts = student_pts.get('Lab Initiatives', 0)
    dept_lab_avg = dept_avgs.get('Lab Initiatives', 0)
    if lab_pts == 0:
        recommendations.append({
            "category": "Lab Initiatives",
            "priority": "High",
            "title": "Complete your first Lab Initiative",
            "description": f"You haven't earned points for Lab Initiatives yet. The average for {dept} is {round(dept_lab_avg, 2)} points. Participating in lab projects is critical for practical skill development.",
            "impact": "+150 Points"
        })
    elif lab_pts < dept_lab_avg * 0.6:
        recommendations.append({
            "category": "Lab Initiatives",
            "priority": "Medium",
            "title": "Boost Lab Initiative engagement",
            "description": f"Your Lab Initiative points ({round(lab_pts, 2)}) are below the department average ({round(dept_lab_avg, 2)}). Participate in special initiatives to raise your score.",
            "impact": "+100 Points"
        })

    skill_pts = student_pts.get('Skills', 0)
    dept_skill_avg = dept_avgs.get('Skills', 0)
    if skill_pts < dept_skill_avg * 0.5:
        recommendations.append({
            "category": "Skills",
            "priority": "High",
            "title": "Bridge Programming Skill Gap",
            "description": f"Your programming skill points are currently {round(skill_pts, 2)}, whereas the department average is {round(dept_skill_avg, 2)}. Complete language modules (Python Level 3 or Java Level 2) to improve your technical readiness.",
            "impact": "+200 Points"
        })
        
    tech_pts = student_pts.get('Technical Events', 0)
    if tech_pts == 0:
        recommendations.append({
            "category": "Technical Events",
            "priority": "High",
            "title": "Register for a Hackathon",
            "description": "Earn technical event points by participating in local or national hackathons. Extracurricular technical activity has a significant impact on placement readiness.",
            "impact": "+300 Points"
        })
        
    balance_score = student_row['balance_score']
    if balance_score < 0.4:
        recommendations.append({
            "category": "Profile Balance",
            "priority": "Medium",
            "title": "Improve Profile Diversity",
            "description": "Your reward profile is skewed towards one activity type. Broaden participation across technical events, lab initiatives, and student activities to improve your balance score.",
            "impact": "+15% Profile Balance"
        })

    if not recommendations:
        recommendations.append({
            "category": "General",
            "priority": "Low",
            "title": "Maintain Consistent Activity",
            "description": "You are currently meeting or exceeding department benchmarks in all core categories. Maintain a steady pace to qualify for semester internship honors.",
            "impact": "Maintain Top 10%"
        })
        
    return recommendations


def detect_policy_alerts(ip_date: str = None):
    """
    Policy Detector for Admins. Detects anomalies and policy integrity issues using adaptive thresholds.
    """
    import math
    from datetime import datetime
    
    conn = get_db_connection()
    cursor = conn.cursor()
    alerts = []
    
    # 1. Easy Module / Points Inflation Detector
    cursor.execute("""
        SELECT category, 
               COUNT(DISTINCT roll_no) as student_count, 
               SUM(points_earned) as total_points, 
               SUM(activity_count) as total_count,
               (SUM(points_earned) / (SUM(activity_count) + 1)) as pts_ratio
        FROM points_breakdown
        WHERE activity_count > 0
        GROUP BY category
    """)
    rows = cursor.fetchall()
    
    if rows:
        ratios = [r['pts_ratio'] for r in rows]
        avg_ratio = sum(ratios) / len(ratios)
        variance_ratio = sum((x - avg_ratio) ** 2 for x in ratios) / len(ratios)
        std_dev_ratio = math.sqrt(variance_ratio)
        
        cursor.execute("SELECT COUNT(*) FROM students")
        total_students = cursor.fetchone()[0]
        
        for r in rows:
            pct_completed = (r['student_count'] / total_students) * 100
            # Adaptive threshold: > 1.5 std_dev above mean
            if r['pts_ratio'] > avg_ratio + 1.5 * std_dev_ratio:
                alerts.append({
                    "type": "Policy Alert",
                    "severity": "Warning",
                    "title": f"Potential points inflation in {r['category']}",
                    "description": f"Students earn an average of {round(r['pts_ratio'], 2)} points per action (category average is {round(avg_ratio, 2)}). Root-cause: Point allocation for these activities may be disproportionately high compared to effort required. Consider reviewing the scoring rubric.",
                    "metric": f"{round(r['pts_ratio'], 0)} pts/activity"
                })
            # Adaptive threshold: > 80% completion
            if pct_completed > 80:
                alerts.append({
                    "type": "Curriculum Review",
                    "severity": "Info",
                    "title": f"Module '{r['category']}' might be too accessible",
                    "description": f"Over {round(pct_completed, 1)}% of enrolled students have completed activities in '{r['category']}'. Root-cause: The activities might be mandatory or have too low a barrier to entry. Evaluate if this aligns with intended difficulty.",
                    "metric": f"{round(pct_completed, 0)}% completion"
                })

    # 2. Risk Detection: high negative points (relative)
    cursor.execute("SELECT AVG(negative_points) FROM students WHERE negative_points > 0")
    avg_neg_row = cursor.fetchone()[0]
    avg_neg = avg_neg_row if avg_neg_row else 0
    
    cursor.execute(f"""
        SELECT roll_no, student_name, department, negative_points, total_points, mentor_id
        FROM students
        WHERE negative_points > {max(500, avg_neg * 3)} OR (negative_points > total_points * 0.3 AND total_points > 0)
        LIMIT 5
    """)
    risk_rows = cursor.fetchall()
    for r in risk_rows:
        alerts.append({
            "type": "Student Risk",
            "severity": "High",
            "title": f"High penalty risk: {r['student_name']}",
            "description": f"Student from {r['department']} has accumulated {round(r['negative_points'], 2)} penalty points. Root-cause: Consistent behavioral infractions or missed deadlines. Mentor intervention is urgently needed to address the underlying issues.",
            "metric": f"{round(r['negative_points'], 2)} penalty pts",
            "roll_no": r['roll_no'],
            "student_name": r['student_name'],
            "department": r['department'],
            "mentor_id": r['mentor_id'] or 'meena',
            "total_points": round(r['total_points'], 2),
            "points_required": 2000,
            "days_left": 30,
            "points_needed_per_day": 0.0
        })
        
    # 3. Anomaly: High points but zero lab initiative (relative to top 10%)
    cursor.execute("SELECT total_points FROM students ORDER BY total_points DESC")
    all_pts = [r[0] for r in cursor.fetchall()]
    if all_pts:
        top_10_threshold = all_pts[max(0, int(len(all_pts) * 0.1) - 1)]
        cursor.execute(f"""
            SELECT s.roll_no, s.student_name, s.department, s.total_points, s.mentor_id
            FROM students s
            WHERE s.total_points >= {top_10_threshold} 
              AND s.roll_no NOT IN (SELECT roll_no FROM points_breakdown WHERE category = 'Lab Initiatives' AND points_earned > 0)
            LIMIT 5
        """)
        unbalanced_rows = cursor.fetchall()
        for r in unbalanced_rows:
            alerts.append({
                "type": "Engagement Anomaly",
                "severity": "Medium",
                "title": f"Unbalanced High Performer: {r['student_name']}",
                "description": f"Student is in the top 10% ({round(r['total_points'], 2)} pts) but has 0 Lab Initiative points. Root-cause: The student might be over-optimizing for easily attainable points in other categories. Guidance recommended.",
                "metric": "0 Lab Points",
                "roll_no": r['roll_no'],
                "student_name": r['student_name'],
                "department": r['department'],
                "mentor_id": r['mentor_id'] or 'meena'
            })
            
    # 4. Predictive At-Risk Flagging (Velocity vs IP Redemption)
    if ip_date:
        try:
            target = datetime.strptime(ip_date, "%Y-%m-%d")
            days_left = (target - datetime.now()).days
            
            if 0 < days_left <= 45:
                # Find students with very low points who are far from an assumed IP threshold (e.g., 2000 pts)
                cursor.execute("""
                    SELECT roll_no, student_name, total_points, department, mentor_id
                    FROM students 
                    WHERE total_points < 1000 
                    ORDER BY total_points ASC 
                    LIMIT 3
                """)
                low_pts_rows = cursor.fetchall()
                for r in low_pts_rows:
                    req_velocity = max(0.0, (2000 - r['total_points'])) / days_left
                    alerts.append({
                        "type": "Predictive Risk",
                        "severity": "High",
                        "title": f"IP Redemption Risk: {r['student_name']}",
                        "description": f"Student has only {round(r['total_points'], 2)} pts with {days_left} days left until IP Redemption. Root-cause: Point velocity is too low to meet the 2000pt requirement ({round(req_velocity, 1)} pts/day needed). Immediate mentor check-in required.",
                        "metric": f"{days_left} days left",
                        "roll_no": r['roll_no'],
                        "student_name": r['student_name'],
                        "department": r['department'],
                        "mentor_id": r['mentor_id'] or 'meena',
                        "total_points": round(r['total_points'], 2),
                        "points_required": 2000,
                        "days_left": days_left,
                        "points_needed_per_day": round(req_velocity, 1)
                    })
        except ValueError:
            pass

    conn.close()
    return alerts


def generate_ai_insights():
    """
    Generates structured insight objects for the Executive Insights panel.
    Each insight has: icon, label, text.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Highest performing department
    cursor.execute("SELECT department, AVG(total_points) as avg_pts FROM students GROUP BY department ORDER BY avg_pts DESC LIMIT 1")
    top_dept = cursor.fetchone()
    
    # Lowest performing department
    cursor.execute("SELECT department, AVG(total_points) as avg_pts FROM students GROUP BY department ORDER BY avg_pts ASC LIMIT 1")
    bottom_dept = cursor.fetchone()
    
    # Most active category
    cursor.execute("SELECT category, SUM(points_earned) as total_pts FROM points_breakdown GROUP BY category ORDER BY total_pts DESC LIMIT 1")
    top_cat = cursor.fetchone()
    
    # Lab initiative total
    cursor.execute("SELECT SUM(points_earned) FROM points_breakdown WHERE category = 'Lab Initiatives'")
    total_lab_pts = cursor.fetchone()[0] or 0.0
    
    # At-risk student count
    cursor.execute("SELECT COUNT(*) FROM students WHERE engagement_group = 'Low'")
    at_risk_count = cursor.fetchone()[0]
    
    conn.close()
    
    insights = [
        {
            "icon": "Building2",
            "label": "Top Department",
            "text": f"{top_dept['department']} leads with an average of {round(top_dept['avg_pts'], 2)} reward points per student."
        },
        {
            "icon": "TriangleAlert",
            "label": "Participation Alert",
            "text": f"{bottom_dept['department']} records the lowest average at {round(bottom_dept['avg_pts'], 2)} pts. {at_risk_count} students institution-wide are classified as At Risk (Low engagement)."
        },
        {
            "icon": "Code2",
            "label": "Dominant Activity",
            "text": f"'{top_cat['category']}' is the highest-earning category, representing the largest share of cumulative reward points institution-wide."
        },
        {
            "icon": "FlaskConical",
            "label": "Lab Initiatives",
            "text": f"Lab Initiatives have generated {round(total_lab_pts, 2):,.2f} reward points to date across all enrolled students."
        },
        {
            "icon": "UserCog",
            "label": "Mentor Note",
            "text": "High-performing students consistently maintain activity across technical events and lab modules. Encourage mid-tier students to register for upcoming hackathons."
        }
    ]
    
    return insights
