import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "reward_points.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_extra_tables():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        subject TEXT,
        body TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT,
        details TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mentor_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mentor_id TEXT,
        title TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    # Add mentor_id to students table
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN mentor_id TEXT")
    except sqlite3.OperationalError:
        pass

    # Seed mentor_id if null
    cursor.execute("SELECT COUNT(*) FROM students WHERE mentor_id IS NULL")
    if cursor.fetchone()[0] > 0:
        cursor.execute("SELECT roll_no FROM students")
        student_rolls = [r[0] for r in cursor.fetchall()]
        mentors = ['meena', 'arjun', 'priya', 'rajesh', 'sita', 'balan', 'anita', 'kumar', 'suresh', 'kavitha', 'mohan', 'divya']
        for idx, roll in enumerate(student_rolls):
            cursor.execute("UPDATE students SET mentor_id = ? WHERE roll_no = ?", (mentors[idx % len(mentors)], roll))

    # Insert default templates if empty
    cursor.execute("SELECT COUNT(*) FROM notification_templates")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO notification_templates (name, subject, body) VALUES (?, ?, ?)
        """, [
            ("IP Redemption Risk", "Action needed: {student_name} — {department} — IP Redemption Risk", "Action needed: {student_name} ({roll_no}, {department}) has {points_earned} pts with {days_left} days left ({points_needed_per_day} pts/day needed to close the gap). Please check in — a follow-up from admin is on its way."),
            ("Manual check-in", "Check-in request for {student_name}", "Hi {mentor_name}, please follow up with {student_name} ({roll_no}) in {department} regarding their recent activity.")
        ])
    conn.commit()
    conn.close()

init_extra_tables()

def get_overall_kpis():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total students
    cursor.execute("SELECT COUNT(*) FROM students")
    total_students = cursor.fetchone()[0]
    
    # Active students (points > 0)
    cursor.execute("SELECT COUNT(*) FROM students WHERE total_points > 0")
    active_students = cursor.fetchone()[0]
    
    # Average points per student
    cursor.execute("SELECT AVG(total_points) FROM students")
    avg_points = cursor.fetchone()[0] or 0.0
    
    # Top department (by average points)
    cursor.execute("""
        SELECT department, AVG(total_points) as avg_pts 
        FROM students 
        GROUP BY department 
        ORDER BY avg_pts DESC 
        LIMIT 1
    """)
    top_dept_row = cursor.fetchone()
    top_dept = top_dept_row['department'] if top_dept_row else "N/A"
    
    # Students at risk (Low engagement)
    cursor.execute("SELECT COUNT(*) FROM students WHERE engagement_group = 'Low'")
    at_risk_students = cursor.fetchone()[0]
    
    # Lab initiatives count & points
    cursor.execute("""
        SELECT SUM(activity_count), SUM(points_earned) 
        FROM points_breakdown 
        WHERE category IN ('Lab Initiatives', 'Special Lab Initiatives')
    """)
    lab_metrics = cursor.fetchone()
    total_lab_count = lab_metrics[0] or 0.0
    total_lab_points = lab_metrics[1] or 0.0
    
    # Hackathon count (Technical Events Points > 0 count)
    cursor.execute("SELECT COUNT(*) FROM students WHERE roll_no IN (SELECT roll_no FROM points_breakdown WHERE category = 'Technical Events' AND points_earned > 0)")
    hackathon_active = cursor.fetchone()[0]

    conn.close()
    
    return {
        "total_students": total_students,
        "active_students": active_students,
        "avg_points": round(avg_points, 2),
        "top_department": top_dept,
        "at_risk_students": at_risk_students,
        "total_lab_count": int(total_lab_count),
        "total_lab_points": round(total_lab_points, 2),
        "hackathon_active": hackathon_active
    }

def get_department_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT department, 
               COUNT(*) as student_count, 
               AVG(total_points) as avg_points,
               AVG(balance_points) as avg_balance_points,
               SUM(total_points) as total_points,
               SUM(CASE WHEN engagement_group = 'Low' THEN 1 ELSE 0 END) as low_count,
               SUM(CASE WHEN engagement_group = 'Medium' THEN 1 ELSE 0 END) as med_count,
               SUM(CASE WHEN engagement_group = 'High' THEN 1 ELSE 0 END) as high_count
        FROM students 
        GROUP BY department
        ORDER BY avg_points DESC
    """)
    rows = cursor.fetchall()
    
    # Category average points per department
    cursor.execute("""
        SELECT s.department, pb.category, AVG(pb.points_earned) as avg_points
        FROM points_breakdown pb
        JOIN students s ON pb.roll_no = s.roll_no
        GROUP BY s.department, pb.category
    """)
    pb_rows = cursor.fetchall()
    
    dept_pb = {}
    for r in pb_rows:
        dept = r['department']
        cat = r['category']
        val = r['avg_points']
        if dept not in dept_pb:
            dept_pb[dept] = {}
        dept_pb[dept][cat] = round(val, 2)
        
    stats = []
    for row in rows:
        dept = row['department']
        stats.append({
            "department": dept,
            "student_count": row['student_count'],
            "avg_points": round(row['avg_points'], 2),
            "avg_balance_points": round(row['avg_balance_points'] or 0.0, 2),
            "total_points": round(row['total_points'], 2),
            "low_count": row['low_count'],
            "med_count": row['med_count'],
            "high_count": row['high_count'],
            "category_averages": dept_pb.get(dept, {})
        })
    conn.close()
    return stats

def get_department_balance_by_year(year=None):
    """Returns avg balance points per department, optionally filtered by year."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if year and year != "All":
        cursor.execute("""
            SELECT department,
                   AVG(balance_points) as avg_balance_points,
                   COUNT(*) as student_count
            FROM students
            WHERE year = ?
            GROUP BY department
            ORDER BY avg_balance_points DESC
        """, (year,))
    else:
        cursor.execute("""
            SELECT department,
                   AVG(balance_points) as avg_balance_points,
                   COUNT(*) as student_count
            FROM students
            GROUP BY department
            ORDER BY avg_balance_points DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "department": r['department'],
            "avg_balance_points": round(r['avg_balance_points'] or 0.0, 2),
            "student_count": r['student_count']
        }
        for r in rows
    ]

def get_student_profile(roll_no):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE roll_no = ?", (roll_no,))
    student_row = cursor.fetchone()
    
    if not student_row:
        conn.close()
        return None
        
    cursor.execute("SELECT category, activity_count, points_earned FROM points_breakdown WHERE roll_no = ?", (roll_no,))
    breakdown_rows = cursor.fetchall()
    
    # Calculate overall ranking
    cursor.execute("SELECT COUNT(*) + 1 FROM students WHERE total_points > ?", (student_row['total_points'],))
    rank = cursor.fetchone()[0]
    
    # Calculate department ranking
    cursor.execute(
        "SELECT COUNT(*) + 1 FROM students WHERE department = ? AND total_points > ?",
        (student_row['department'], student_row['total_points'])
    )
    dept_rank = cursor.fetchone()[0]
    
    breakdown = []
    for r in breakdown_rows:
        breakdown.append({
            "category": r['category'],
            "count": r['activity_count'],
            "points": round(r['points_earned'], 2)
        })
        
    student_dict = dict(student_row)
    student_dict['rank'] = rank
    student_dict['dept_rank'] = dept_rank
    student_dict['breakdown'] = breakdown
    
    # Round numeric fields
    for field in ['total_points', 'balance_points', 'redeemed_points', 'cumulative_points', 'initial_points']:
        if field in student_dict and student_dict[field] is not None:
            student_dict[field] = round(float(student_dict[field]), 2)
    
    conn.close()
    return student_dict

def get_student_peers(roll_no, filter_type='branch'):
    """Returns top 10 and a centered window (4 above, self, 4 below) for the student's cohort."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM students WHERE roll_no = ?", (roll_no,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        return None
        
    dept = student['department']
    yr = student['year']
    
    if filter_type == 'branch':
        cond = "department = ? AND year = ?"
        params = (dept, yr)
    else:
        cond = "year = ?"
        params = (yr,)
        
    cursor.execute(f"SELECT * FROM students WHERE {cond} ORDER BY total_points DESC", params)
    all_students = [dict(r) for r in cursor.fetchall()]
    
    student_idx = next((i for i, s in enumerate(all_students) if s['roll_no'] == roll_no), -1)
    
    if student_idx == -1:
        conn.close()
        return {"top_10": all_students[:10], "window": [], "student_rank": 0, "total_in_cohort": len(all_students)}
        
    start_idx = max(0, student_idx - 4)
    end_idx = min(len(all_students), student_idx + 5)
    window = all_students[start_idx:end_idx]
    
    for idx, s in enumerate(window):
        s['computed_rank'] = start_idx + idx + 1
        
    top_10 = all_students[:10]
    for idx, s in enumerate(top_10):
        s['computed_rank'] = idx + 1
        
    conn.close()
    return {
        "top_10": top_10,
        "window": window,
        "student_rank": student_idx + 1,
        "total_in_cohort": len(all_students)
    }

def get_student_performance(roll_no):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM students WHERE roll_no = ?", (roll_no,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        return None
        
    pts = student['total_points']
    dept = student['department']
    yr = student['year']
    
    cursor.execute("SELECT AVG(total_points) FROM students WHERE department = ?", (dept,))
    dept_avg = cursor.fetchone()[0] or 0.0
    
    cursor.execute("SELECT AVG(total_points) FROM students WHERE year = ?", (yr,))
    year_avg = cursor.fetchone()[0] or 0.0
    
    cursor.execute("SELECT COUNT(*) FROM students WHERE department = ?", (dept,))
    dept_total = cursor.fetchone()[0] or 1
    
    cursor.execute("SELECT COUNT(*) FROM students WHERE department = ? AND total_points > ?", (dept, pts))
    dept_higher = cursor.fetchone()[0] or 0
    percentile = int(round((1 - (dept_higher / dept_total)) * 100))
    if percentile == 100 and dept_higher > 0: percentile = 99
    
    cursor.execute("SELECT total_points FROM students WHERE department = ? AND year = ?", (dept, yr))
    cohort_points = [r[0] for r in cursor.fetchall()]
    
    buckets = {"0-1k": 0, "1k-2k": 0, "2k-3k": 0, "3k-4k": 0, "4k-5k": 0, "5k-6k": 0, "6k+": 0}
    for cp in cohort_points:
        if cp < 1000: buckets["0-1k"] += 1
        elif cp < 2000: buckets["1k-2k"] += 1
        elif cp < 3000: buckets["2k-3k"] += 1
        elif cp < 4000: buckets["3k-4k"] += 1
        elif cp < 5000: buckets["4k-5k"] += 1
        elif cp < 6000: buckets["5k-6k"] += 1
        else: buckets["6k+"] += 1
        
    histogram = [{"bucket": k, "count": v} for k,v in buckets.items()]
    conn.close()
    
    # Mocking term_delta (e.g. they improved by 15% since last term)
    term_delta = round(pts * 0.15, 2)
    
    return {
        "student_points": round(pts, 2),
        "dept_avg": round(dept_avg, 2),
        "year_avg": round(year_avg, 2),
        "percentile": percentile,
        "histogram": histogram,
        "term_delta": term_delta
    }

def get_student_extended_profile(roll_no):
    """Returns extended data for the admin Inspect panel."""
    import random
    
    student = get_student_profile(roll_no)
    if not student:
        return None
    
    breakdown = student['breakdown']
    engagement = student.get('engagement_group', 'Low')
    
    # Year-wise simulated points
    year_map = {"I": 1, "II": 2, "III": 3, "IV": 4}
    current_year_num = year_map.get(student['year'], 1)
    
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(roll_no))
    rng = random.Random(seed)
    
    total_pts = student['total_points']
    yearly_data = []
    if current_year_num == 1:
        yearly_data.append({"year": "Year I", "points": total_pts})
    else:
        shares = [rng.uniform(0.5, 1.5) for _ in range(current_year_num)]
        total_shares = sum(shares)
        distributed_pts = [round((s / total_shares) * total_pts, 2) for s in shares]
        diff = total_pts - sum(distributed_pts)
        distributed_pts[-1] = round(distributed_pts[-1] + diff, 2)
        romans = ["I", "II", "III", "IV"]
        for idx, pts in enumerate(distributed_pts):
            yearly_data.append({"year": f"Year {romans[idx]}", "points": pts})
    
    # Monthly trend (same logic as analytics)
    months = ["July", "August", "September", "October", "November", "December",
              "January", "February", "March", "April", "May", "June"]
    monthly_trend = {m: 0.0 for m in months}
    
    # Distribute total points across months deterministically
    month_shares = [rng.uniform(0.2, 1.8) for _ in months]
    total_month_shares = sum(month_shares)
    for i, m in enumerate(months):
        monthly_trend[m] = round((month_shares[i] / total_month_shares) * total_pts, 2)
    
    monthly_data = [{"month": m, "points": monthly_trend[m]} for m in months]
    most_active_month = max(monthly_data, key=lambda x: x['points'])['month']
    
    # Specialization (only for High/Medium engagement)
    specialization = []
    if engagement in ('High', 'Medium'):
        active_cats = [b for b in breakdown if b['points'] > 0]
        active_cats_sorted = sorted(active_cats, key=lambda x: x['points'], reverse=True)
        top_cats = active_cats_sorted[:3]
        total_active_pts = sum(b['points'] for b in active_cats)
        for cat in top_cats:
            pct = round((cat['points'] / total_active_pts * 100), 1) if total_active_pts > 0 else 0
            specialization.append({
                "category": cat['category'],
                "points": cat['points'],
                "percentage": pct
            })
    
    return {
        "student": student,
        "yearly_data": yearly_data,
        "monthly_data": monthly_data,
        "most_active_month": most_active_month,
        "specialization": specialization
    }

def get_leaderboard(limit=15, offset=0, department=None, year=None, engagement_group=None, sort_order="desc"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM students WHERE 1=1"
    params = []
    
    if department:
        query += " AND department = ?"
        params.append(department)
    if year:
        query += " AND year = ?"
        params.append(year)
    if engagement_group:
        query += " AND engagement_group = ?"
        params.append(engagement_group)
        
    order_dir = "ASC" if sort_order == "asc" else "DESC"
    query += f" ORDER BY balance_points {order_dir} LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    leaderboard = []
    for i, r in enumerate(rows):
        # Calculate absolute rank (always by total_points desc)
        cursor.execute("SELECT COUNT(*) + 1 FROM students WHERE total_points > ?", (r['total_points'],))
        rank = cursor.fetchone()[0]
        
        d = dict(r)
        d['rank'] = rank
        # Round numeric fields
        for field in ['total_points', 'balance_points', 'redeemed_points', 'cumulative_points']:
            if field in d and d[field] is not None:
                d[field] = round(float(d[field]), 2)
        leaderboard.append(d)
        
    conn.close()
    return leaderboard

def get_category_distribution(year=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if year and year != "All":
        cursor.execute("""
            SELECT pb.category, SUM(pb.points_earned) as total_points, SUM(pb.activity_count) as total_count, AVG(pb.points_earned) as avg_points
            FROM points_breakdown pb
            JOIN students s ON pb.roll_no = s.roll_no
            WHERE s.year = ?
            GROUP BY pb.category
            ORDER BY total_points DESC
        """, (year,))
    else:
        cursor.execute("""
            SELECT category, SUM(points_earned) as total_points, SUM(activity_count) as total_count, AVG(points_earned) as avg_points
            FROM points_breakdown
            GROUP BY category
            ORDER BY total_points DESC
        """)
        
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def generate_deterministic_transactions(roll_no, breakdown):
    import random
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(roll_no))
    rng = random.Random(seed)
    
    transactions = []
    
    category_descriptions = {
        'Technical Events': [
            "National Hackathon Runner Up", "Web Development Hackathon Participation",
            "Coding Contest Tier-1", "Datathon Contest Merit", "Cybersecurity Capture The Flag"
        ],
        'Skills': [
            "Cleared Python Level 1", "Cleared Python Level 2", "Cleared Python Level 3",
            "Cleared Java Level 1", "Cleared Java Level 2", "Cleared C++ Level 4",
            "SQL Querying Level 2 Completion", "Data Structures module validation"
        ],
        'Assignments': [
            "Data Structures Assignment #1", "Database Design Lab Submission",
            "Algorithms Analysis Assignment #3", "Object-Oriented Programming Task",
            "Operating Systems Practice Set"
        ],
        'Interviews': [
            "Mock Technical Interview Round 1", "Mock Coding Interview Round 2",
            "HR Assessment Simulation", "System Design Interview Practice"
        ],
        'Exams': [
            "Mid-Semester Code Assessment", "End-Semester Practical Exam",
            "Weekly MCQ Assessment", "Continuous Internal Evaluation #2"
        ],
        'Faculty Initiatives': [
            "Assisted in Department Workshop", "Faculty Research Project Assistance",
            "Coordinated Technical Seminar"
        ],
        'Lab Initiatives': [
            "IoT Lab Setup Initiative", "Linux Server Maintenance Task",
            "Data Science Lab Benchmark Project", "Networking Simulation Initiative"
        ],
        'Special Lab Initiatives': [
            "Smart Campus Project Development", "AI Sandbox Environment Deployment",
            "Cloud Cluster Resource Optimization"
        ],
        'Extra-Curricular': [
            "Technical Club Meeting Coordination", "Volunteered in Placement Cell",
            "Inter-college Coding Event Lead"
        ],
        'Student Initiatives': [
            "Peer Mentoring Session: Python basics", "Git/GitHub Basics Student Seminar",
            "Web Dev Study Group Lead"
        ],
        'External Events': [
            "AWS Community Day Participation", "Google DevFest Tech Attendee",
            "Open Source Contribution PR Approval"
        ]
    }
    
    start_time = 1751328000
    time_span = 30000000
    
    for item in breakdown:
        cat = item['category']
        count = int(item['count'])
        points = float(item['points'])
        
        if count <= 0 or points <= 0:
            continue
            
        point_distribution = []
        if count == 1:
            point_distribution = [points]
        else:
            parts = [rng.randint(5, 15) for _ in range(count)]
            total_parts = sum(parts)
            point_distribution = [round((p / total_parts) * points, 2) for p in parts]
            diff = points - sum(point_distribution)
            point_distribution[-1] = round(point_distribution[-1] + diff, 2)
            
        for i in range(count):
            t = start_time + rng.randint(0, time_span)
            descs = category_descriptions.get(cat, ["Reward Point Credit"])
            desc = rng.choice(descs) + f" (Task #{i+1})"
            
            transactions.append({
                "timestamp": t,
                "category": cat,
                "description": desc,
                "points": point_distribution[i],
                "status": "Credited"
            })
            
    transactions.sort(key=lambda x: x['timestamp'], reverse=True)
    return transactions

def get_student_analytics_data(roll_no):
    from datetime import datetime, timezone
    
    student = get_student_profile(roll_no)
    if not student:
        return None
        
    breakdown = student['breakdown']
    transactions = generate_deterministic_transactions(roll_no, breakdown)
    
    formatted_transactions = []
    for tx in transactions:
        dt = datetime.fromtimestamp(tx['timestamp'], tz=timezone.utc)
        formatted_transactions.append({
            "date": dt.strftime("%Y-%m-%d"),
            "day": dt.strftime("%A"),
            "month": dt.strftime("%B"),
            "year": dt.year,
            "category": tx['category'],
            "description": tx['description'],
            "points": round(tx['points'], 2),
            "status": tx['status']
        })
        
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekly_trend = {d: 0.0 for d in days_of_week}
    for tx in formatted_transactions:
        day = tx['day']
        weekly_trend[day] = round(weekly_trend[day] + tx['points'], 2)
        
    weekly_data = [{"day": d, "points": weekly_trend[d]} for d in days_of_week]
    
    months = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]
    monthly_trend = {m: 0.0 for m in months}
    for tx in formatted_transactions:
        month = tx['month']
        if month in monthly_trend:
            monthly_trend[month] = round(monthly_trend[month] + tx['points'], 2)
            
    monthly_data = [{"month": m, "points": monthly_trend[m]} for m in months]
    
    current_year_roman = student['year']
    year_map = {"I": 1, "II": 2, "III": 3, "IV": 4}
    current_year_num = year_map.get(current_year_roman, 1)
    
    import random
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(roll_no))
    rng = random.Random(seed)
    
    yearly_data = []
    total_pts = student['total_points']
    
    if current_year_num == 1:
        yearly_data.append({"year": "Year I", "points": total_pts})
    else:
        shares = [rng.uniform(0.5, 1.5) for _ in range(current_year_num)]
        total_shares = sum(shares)
        distributed_pts = [round((s / total_shares) * total_pts, 2) for s in shares]
        diff = total_pts - sum(distributed_pts)
        distributed_pts[-1] = round(distributed_pts[-1] + diff, 2)
        
        romans = ["I", "II", "III", "IV"]
        for idx, pts in enumerate(distributed_pts):
            yearly_data.append({"year": f"Year {romans[idx]}", "points": pts})
            
    heatmap_dict = {}
    for tx in formatted_transactions:
        date_str = tx['date']
        heatmap_dict[date_str] = round(heatmap_dict.get(date_str, 0.0) + tx['points'], 2)
        
    heatmap_data = [{"date": k, "points": v} for k, v in heatmap_dict.items()]
    
    # Most active month
    most_active_month = max(monthly_data, key=lambda x: x['points'])['month'] if monthly_data else "N/A"
    
    return {
        "transactions": [],
        "weekly_trend": weekly_data,
        "monthly_trend": monthly_data,
        "yearly_trend": yearly_data,
        "heatmap": heatmap_data,
        "most_active_month": most_active_month
    }

def get_admin_hierarchy():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT DISTINCT department FROM students ORDER BY department")
    depts = [r['department'] for r in cursor.fetchall()]
    
    hierarchy = []
    for dept in depts:
        cursor.execute("""
            SELECT COUNT(*) as student_count, AVG(total_points) as avg_points
            FROM students WHERE department = ?
        """, (dept,))
        dept_sum = cursor.fetchone()
        
        years_list = []
        for yr in ["I", "II", "III", "IV"]:
            cursor.execute("""
                SELECT COUNT(*) as count, AVG(total_points) as avg_points,
                       SUM(CASE WHEN engagement_group = 'Low' THEN 1 ELSE 0 END) as low_count,
                       SUM(CASE WHEN engagement_group = 'Medium' THEN 1 ELSE 0 END) as med_count,
                       SUM(CASE WHEN engagement_group = 'High' THEN 1 ELSE 0 END) as high_count
                FROM students WHERE department = ? AND year = ?
            """, (dept, yr))
            yr_sum = cursor.fetchone()
            
            if yr_sum['count'] > 0:
                cursor.execute("""
                    SELECT roll_no, student_name, total_points, engagement_group
                    FROM students WHERE department = ? AND year = ?
                    ORDER BY total_points DESC LIMIT 5
                """, (dept, yr))
                top_students = [dict(s) for s in cursor.fetchall()]
                # Round points in top_students
                for s in top_students:
                    s['total_points'] = round(float(s['total_points']), 2)
                
                years_list.append({
                    "year": yr,
                    "student_count": yr_sum['count'],
                    "avg_points": round(yr_sum['avg_points'] or 0.0, 2),
                    "low_count": yr_sum['low_count'],
                    "med_count": yr_sum['med_count'],
                    "high_count": yr_sum['high_count'],
                    "top_students": top_students
                })
                
        hierarchy.append({
            "department": dept,
            "student_count": dept_sum['student_count'],
            "avg_points": round(dept_sum['avg_points'] or 0.0, 2),
            "years": years_list
        })
        
    conn.close()
    return hierarchy
