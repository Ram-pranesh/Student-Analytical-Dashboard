import re
import sqlite3
from db import get_db_connection

def parse_natural_language_query(query: str):
    """
    Parses a natural language query from the admin and translates it into:
    1. Interpreted Filters (JSON) — structured chips for the UI
    2. A SQL WHERE clause and parameters
    3. Explanation text
    """
    q = query.lower().strip()
    
    where_clauses = []
    params = []
    interpreted = {}
    
    # ── 1. Department detection ────────────────────────────────────────────────
    dept_map = {
        "cse": "COMPUTER SCIENCE AND ENGINEERING",
        "computer science": "COMPUTER SCIENCE AND ENGINEERING",
        "cs": "COMPUTER SCIENCE AND ENGINEERING",
        "it": "INFORMATION TECHNOLOGY",
        "information technology": "INFORMATION TECHNOLOGY",
        "aeronautical": "AERONAUTICAL ENGINEERING",
        "aero": "AERONAUTICAL ENGINEERING",
        "ece": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "electronics": "ELECTRONICS AND COMMUNICATION ENGINEERING",
        "eee": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "electrical": "ELECTRICAL AND ELECTRONICS ENGINEERING",
        "mech": "MECHANICAL ENGINEERING",
        "mechanical": "MECHANICAL ENGINEERING",
        "civil": "CIVIL ENGINEERING",
        "biomedical": "BIOMEDICAL ENGINEERING",
        "bio medical": "BIOMEDICAL ENGINEERING",
        "artificial intelligence": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "aids": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
        "ai and ds": "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
    }
    
    matched_dept = None
    # Sort by length descending so longer phrases match first
    for key in sorted(dept_map.keys(), key=len, reverse=True):
        if key in q:
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

    # ── 3. Numeric point constraints ──────────────────────────────────────────
    # Detect which field: total_points or balance_points
    field_name = "total_points"
    if re.search(r"\bbalance\s+(points|pts)\b", q):
        field_name = "balance_points"
    elif re.search(r"\btotal\s+(points|pts)\b", q):
        field_name = "total_points"

    # Operator + number patterns (handles >=, <=, >, <, =)
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
                "label": "Balance Points" if field_name == "balance_points" else "Total Points",
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
            interpreted["points"] = {"label": "Total Points", "op": ">", "value": str(int(val) if val == int(val) else val)}
            point_matched = True

        if not point_matched:
            lt_match = re.search(r"(less\s+than|below|under)\s+(\d+(?:\.\d+)?)\s*(points|pts)?", q)
            if lt_match:
                val = float(lt_match.group(2))
                where_clauses.append(f"{field_name} < ?")
                params.append(val)
                interpreted["points"] = {"label": "Total Points", "op": "<", "value": str(int(val) if val == int(val) else val)}
                point_matched = True

        if not point_matched:
            between_match = re.search(r"between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)", q)
            if between_match:
                v1 = float(between_match.group(1))
                v2 = float(between_match.group(2))
                where_clauses.append(f"{field_name} BETWEEN ? AND ?")
                params.extend([v1, v2])
                interpreted["points"] = {"label": "Total Points", "op": "between", "value": f"{int(v1)}-{int(v2)}"}

    # ── 4. Engagement group ───────────────────────────────────────────────────
    if re.search(r"\blow\s+engagement\b|\blow\s+performers?\b|\blow\s+participation\b|\bat\s+risk\b", q):
        where_clauses.append("engagement_group = 'Low'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "Low"}
    elif re.search(r"\bmedium\s+engagement\b|\bmedium\s+performers?\b|\baverage\s+performers?\b|\bmoderate\b", q):
        where_clauses.append("engagement_group = 'Medium'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "Medium"}
    elif re.search(r"\bhigh\s+engagement\b|\bhigh\s+performers?\b|\btop\s+performers?\b|\boverachievers?\b|\bhigh\s+participation\b", q):
        where_clauses.append("engagement_group = 'High'")
        interpreted["activity"] = {"label": "Activity Level", "op": "=", "value": "High"}

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
    
    for pattern, cat_name in category_keywords:
        if re.search(pattern, q):
            where_clauses.append(
                "roll_no IN (SELECT roll_no FROM points_breakdown WHERE category = ? AND points_earned > 0)"
            )
            params.append(cat_name)
            interpreted["category"] = {"label": "Category", "op": "=", "value": cat_name}
            break  # one category filter at a time

    # ── Build SQL ─────────────────────────────────────────────────────────────
    sql_where = " AND ".join(where_clauses) if where_clauses else "1=1"
    sql_query = f"SELECT * FROM students WHERE {sql_where} ORDER BY total_points DESC LIMIT 200"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql_query, params)
    rows = cursor.fetchall()
    
    results = []
    for r in rows:
        d = dict(r)
        # Round numeric fields
        for field in ['total_points', 'balance_points', 'redeemed_points', 'cumulative_points']:
            if field in d and d[field] is not None:
                d[field] = round(float(d[field]), 2)
        results.append(d)
        
    conn.close()
    
    # Explanation text
    if interpreted:
        parts = []
        for k, v in interpreted.items():
            parts.append(f"{v['label']} {v['op']} {v['value']}")
        explanation = "Filtered by: " + " | ".join(parts) + f". {len(results)} matching record(s) found."
    else:
        explanation = f"No specific filters identified — showing all {len(results)} students ordered by total points."
        
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


def detect_policy_alerts():
    """
    Policy Detector for Admins. Detects anomalies and policy integrity issues.
    """
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
        ORDER BY pts_ratio DESC
    """)
    rows = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(*) FROM students")
    total_students = cursor.fetchone()[0]
    
    for r in rows:
        pct_completed = (r['student_count'] / total_students) * 100
        if r['pts_ratio'] > 150:
            alerts.append({
                "type": "Policy Alert",
                "severity": "Warning",
                "title": f"Potential points inflation in {r['category']}",
                "description": f"Students earn an average of {round(r['pts_ratio'], 2)} points per action in '{r['category']}'. Consider reviewing points allocation to keep achievements balanced.",
                "metric": f"{round(r['pts_ratio'], 0)} pts/activity"
            })
        if pct_completed > 85:
            alerts.append({
                "type": "Curriculum Review",
                "severity": "Info",
                "title": f"Module '{r['category']}' might be too accessible",
                "description": f"Over {round(pct_completed, 1)}% of enrolled students ({r['student_count']}/{total_students}) have completed activities in '{r['category']}'. Completion rate is unusually high.",
                "metric": f"{round(pct_completed, 0)}% completion"
            })

    # 2. Risk Detection: high negative points
    cursor.execute("""
        SELECT roll_no, student_name, department, negative_points, total_points
        FROM students
        WHERE negative_points > 1000 OR (negative_points > total_points * 0.3 AND total_points > 0)
        LIMIT 5
    """)
    risk_rows = cursor.fetchall()
    for r in risk_rows:
        alerts.append({
            "type": "Student Risk",
            "severity": "High",
            "title": f"High penalty risk: {r['student_name']}",
            "description": f"Student from {r['department']} has accumulated {round(r['negative_points'], 2)} penalty points (representing over 30% of active balance). Mentor review is recommended.",
            "metric": f"{round(r['negative_points'], 2)} penalty pts"
        })
        
    # 3. Anomaly: High points but zero lab initiative
    cursor.execute("""
        SELECT s.roll_no, s.student_name, s.department, s.total_points
        FROM students s
        WHERE s.total_points > 3000 
          AND s.roll_no NOT IN (SELECT roll_no FROM points_breakdown WHERE category = 'Lab Initiatives' AND points_earned > 0)
        LIMIT 5
    """)
    unbalanced_rows = cursor.fetchall()
    for r in unbalanced_rows:
        alerts.append({
            "type": "Engagement Anomaly",
            "severity": "Medium",
            "title": f"Unbalanced High Performer: {r['student_name']}",
            "description": f"Student has high total points ({round(r['total_points'], 2)}) but has not participated in Lab Initiatives. Guidance recommended to cover lab modules.",
            "metric": "0 Lab Points"
        })
        
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
