from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import uvicorn
import io
import json
import pandas as pd
from datetime import datetime

import db
import ai
import nl_sql
import ml_model

app = FastAPI(title="Student Reward Intelligence API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def initialize_ml_caches():
    ml_model.refresh_view_suggestion_cache()
    ml_model.start_view_suggestion_cache_refresh()
    ml_model.refresh_severity_cache()
    ml_model.start_severity_cache_refresh()
    ml_model.start_background_recompute()

# ─── Pydantic Models ──────────────────────────────────────────
class TemplateUpdate(BaseModel):
    name: str
    subject: str
    body: str

class NotificationPayload(BaseModel):
    roll_no: str
    mentor_id: str
    subject: str
    body: str
    is_bulk: Optional[bool] = False

class BulkNotificationPayload(BaseModel):
    notifications: List[NotificationPayload]

class CommitImportPayload(BaseModel):
    import_type: str
    rows: List[Dict[str, Any]]

# ─── Standard Auth & KPIs ──────────────────────────────────────
@app.get("/api/login")
def login(username: str, role: str):
    if role == "admin":
        if username.lower() == "admin":
            return {"status": "success", "username": "admin", "role": "admin"}
        else:
            raise HTTPException(status_code=400, detail="Invalid admin credentials.")
    elif role == "student":
        student = db.get_student_profile(username.upper())
        if student:
            return {
                "status": "success",
                "username": username.upper(),
                "name": student["student_name"],
                "role": "student"
            }
        else:
            raise HTTPException(status_code=404, detail="Student Roll Number not found in database.")
    else:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

@app.get("/api/kpis")
def get_kpis():
    return db.get_overall_kpis()

@app.get("/api/departments")
def get_departments():
    return db.get_department_stats()

@app.get("/api/departments/balance")
def get_department_balance(year: Optional[str] = None):
    if year == "" or year == "All":
        year = None
    return db.get_department_balance_by_year(year)

@app.get("/api/categories")
def get_categories(year: Optional[str] = None):
    if year == "" or year == "All":
        year = None
    return db.get_category_distribution(year)

@app.get("/api/leaderboard")
def get_leaderboard(
    limit: int = 15,
    offset: int = 0,
    department: Optional[str] = None,
    year: Optional[str] = None,
    engagement_group: Optional[str] = None,
    sort_order: Optional[str] = "desc"
):
    if department == "": department = None
    if year == "": year = None
    if engagement_group == "": engagement_group = None
    if sort_order not in ("asc", "desc"): sort_order = "desc"
    
    return db.get_leaderboard(
        limit=limit,
        offset=offset,
        department=department,
        year=year,
        engagement_group=engagement_group,
        sort_order=sort_order
    )

@app.get("/api/student/{roll_no}")
def get_student(roll_no: str):
    student = db.get_student_profile(roll_no.upper())
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student

@app.get("/api/student/{roll_no}/peers")
def get_student_peers(roll_no: str, filter_type: str = "branch"):
    data = db.get_student_peers(roll_no.upper(), filter_type)
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@app.get("/api/student/{roll_no}/performance")
def get_student_performance(roll_no: str):
    data = db.get_student_performance(roll_no.upper())
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@app.get("/api/student/{roll_no}/extended")
def get_student_extended(roll_no: str):
    data = db.get_student_extended_profile(roll_no.upper())
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@app.get("/api/student/{roll_no}/recommendations")
def get_recommendations(roll_no: str):
    return ai.get_student_recommendations(roll_no.upper())

@app.get("/api/query")
def query_assistant(
    q: str = Query(..., description="Natural language search query from admin/mentor"),
    context_role: Optional[str] = None,
    context_dept: Optional[str] = None
):
    return ai.parse_natural_language_query(q, context_role, context_dept)


@app.get("/api/nl-sql-search")
def nl_sql_search(
    q: str = Query(..., description="Natural language search query from admin/mentor"),
    context_role: Optional[str] = None,
    context_dept: Optional[str] = None
):
    return nl_sql.run_nl_sql_search(q, context_role, context_dept)

@app.get("/api/alerts")
def get_alerts(ip_date: Optional[str] = None):
    return ai.detect_policy_alerts(ip_date)

@app.get("/api/insights")
def get_insights():
    return ai.generate_ai_insights()

@app.get("/api/student/{roll_no}/analytics")
def get_student_analytics(roll_no: str):
    data = db.get_student_analytics_data(roll_no.upper())
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@app.get("/api/admin/hierarchy")
def get_admin_hierarchy():
    return db.get_admin_hierarchy()


@app.get("/api/ml/severity-tiers")
def get_severity_tiers():
    cache = ml_model.refresh_severity_cache() if not ml_model._SEVERITY_CACHE.get('ready') else ml_model._SEVERITY_CACHE
    return {
        "generated_at": cache.get("generated_at"),
        "summaries": cache.get("summaries", []),
        "assignments": cache.get("assignments", {}),
    }


# ─── New Notification Templates Endpoints ────────────────────────
@app.get("/api/admin/templates")
def get_templates():
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, subject, body FROM notification_templates")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/admin/templates")
def update_template(payload: TemplateUpdate):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO notification_templates (name, subject, body)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET subject=excluded.subject, body=excluded.body
    """, (payload.name, payload.subject, payload.body))
    
    # Log to audit trail
    cursor.execute("""
        INSERT INTO audit_log (action, details)
        VALUES (?, ?)
    """, ("Update Template", f"Updated template: {payload.name}"))
    
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/admin/templates/reset")
def reset_templates():
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notification_templates")
    cursor.executemany("""
        INSERT INTO notification_templates (name, subject, body) VALUES (?, ?, ?)
    """, [
        ("IP Redemption Risk", "Action needed: {student_name} — {department} — IP Redemption Risk", "Action needed: {student_name} ({roll_no}, {department}) has {points_earned} pts with {days_left} days left ({points_needed_per_day} pts/day needed to close the gap). Please check in — a follow-up from admin is on its way."),
        ("Manual check-in", "Check-in request for {student_name}", "Hi {mentor_name}, please follow up with {student_name} ({roll_no}) in {department} regarding their recent activity.")
    ])
    
    # Log to audit trail
    cursor.execute("""
        INSERT INTO audit_log (action, details)
        VALUES (?, ?)
    """, ("Reset Templates", "Reset all notification templates to defaults"))
    
    conn.commit()
    conn.close()
    return {"status": "success"}


# ─── New Mentor Notifications & In-App Pings ──────────────────────
@app.get("/api/mentor/{mentor_id}/notifications")
def get_mentor_notifications(mentor_id: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, mentor_id, title, message, is_read, timestamp
        FROM mentor_notifications
        WHERE mentor_id = ? OR mentor_id = 'all'
        ORDER BY timestamp DESC
    """, (mentor_id.lower(),))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/mentor/{mentor_id}/notifications/read")
def mark_mentor_notifications_read(mentor_id: str, notification_id: Optional[int] = None):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    if notification_id:
        cursor.execute("UPDATE mentor_notifications SET is_read = 1 WHERE id = ? AND (mentor_id = ? OR mentor_id = 'all')", (notification_id, mentor_id.lower()))
    else:
        cursor.execute("UPDATE mentor_notifications SET is_read = 1 WHERE mentor_id = ? OR mentor_id = 'all'", (mentor_id.lower(),))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ─── New Notify Mentor Endpoints ─────────────────────────────────
@app.post("/api/alerts/notify-mentor")
def notify_mentor(payload: NotificationPayload):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    
    student = db.get_student_profile(payload.roll_no.upper())
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")
        
    cursor.execute("""
        INSERT INTO mentor_notifications (mentor_id, title, message)
        VALUES (?, ?, ?)
    """, (payload.mentor_id.lower(), payload.subject, payload.body))
    
    details = f"Notified mentor '{payload.mentor_id}' for student {payload.roll_no}. Subject: {payload.subject}"
    cursor.execute("""
        INSERT INTO audit_log (action, details)
        VALUES (?, ?)
    """, ("Notify Mentor", details))
    
    conn.commit()
    conn.close()
    
    # Simulate sending email
    print(f"STUB EMAIL SENT TO MENTOR {payload.mentor_id}:")
    print(f"Subject: {payload.subject}")
    print(f"Body: {payload.body}")
    
    return {"status": "success", "message": "Mentor notified successfully"}

@app.post("/api/alerts/notify-mentor-bulk")
def notify_mentor_bulk(payload: BulkNotificationPayload):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    
    logged_count = 0
    by_mentor = {}
    
    for item in payload.notifications:
        student = db.get_student_profile(item.roll_no.upper())
        if not student:
            continue
            
        cursor.execute("""
            INSERT INTO mentor_notifications (mentor_id, title, message)
            VALUES (?, ?, ?)
        """, (item.mentor_id.lower(), item.subject, item.body))
        
        if item.mentor_id.lower() not in by_mentor:
            by_mentor[item.mentor_id.lower()] = []
        by_mentor[item.mentor_id.lower()].append(item)
        logged_count += 1

    details = f"Bulk notified mentors for {logged_count} students. Mentors involved: {list(by_mentor.keys())}"
    cursor.execute("""
        INSERT INTO audit_log (action, details)
        VALUES (?, ?)
    """, ("Bulk Notify Mentors", details))
    
    conn.commit()
    conn.close()
    
    for mentor, items in by_mentor.items():
        print(f"STUB COMBINED EMAIL SENT TO MENTOR {mentor}:")
        student_list = ", ".join([f"{x.roll_no}" for x in items])
        print(f"Subject: Action Needed: Multiple Students IP Redemption Risk ({len(items)} students)")
        print(f"Body: Please check in with the following students under your mentorship: {student_list}.")
        
    return {"status": "success", "notified_count": logged_count}


# ─── New Audit Log Endpoint ──────────────────────────────────────
@app.get("/api/admin/audit-logs")
def get_audit_logs():
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, action, details FROM audit_log ORDER BY timestamp DESC LIMIT 100")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── New CSV / Excel Bulk Import ──────────────────────────────────
@app.post("/api/admin/import/preview")
async def import_preview(file: UploadFile = File(...), import_type: str = Form(...)):
    contents = await file.read()
    try:
        if file.filename.endswith(".xlsx") or file.filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Replace NaN with None so JSON serialization works
    df = df.replace({pd.NA: None, float('nan'): None})
    rows = df.to_dict(orient="records")
    columns = list(df.columns)
    
    # Simple mapping heuristics
    suggested_mapping = {}
    if import_type == "students":
        targets = ["roll_no", "student_name", "department", "year", "mentor_id"]
        for target in targets:
            for col in columns:
                c_low = col.lower().replace("_", "").replace(" ", "").replace(".", "")
                t_low = target.lower().replace("_", "")
                if t_low in c_low or c_low in t_low or (t_low == "rollno" and "roll" in c_low):
                    suggested_mapping[target] = col
                    break
    else:
        targets = ["roll_no", "category", "points_earned", "activity_count"]
        for target in targets:
            for col in columns:
                c_low = col.lower().replace("_", "").replace(" ", "").replace(".", "")
                t_low = target.lower().replace("_", "")
                if t_low in c_low or c_low in t_low or (t_low == "points" and "pts" in c_low):
                    suggested_mapping[target] = col
                    break

    # Get current state from database for validation
    conn = db.get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT roll_no, department, mentor_id FROM students")
    db_students = {r['roll_no'].upper(): dict(r) for r in cursor.fetchall()}
    
    cursor.execute("SELECT mentor_id, COUNT(*) as cnt FROM students GROUP BY mentor_id")
    mentor_capacities = {r['mentor_id'].lower(): r['cnt'] for r in cursor.fetchall() if r['mentor_id']}
    
    conn.close()

    # Pre-validate rows using suggested mapping
    validation_results = []
    file_roll_nos = set()
    
    roll_col = suggested_mapping.get("roll_no")
    name_col = suggested_mapping.get("student_name")
    dept_col = suggested_mapping.get("department")
    year_col = suggested_mapping.get("year")
    mentor_col = suggested_mapping.get("mentor_id")
    
    cat_col = suggested_mapping.get("category")
    pts_col = suggested_mapping.get("points_earned")
    
    valid_depts = [
        'COMPUTER SCIENCE AND ENGINEERING', 'COMPUTER SCIENCE AND BUSINESS SYSTEMS',
        'INFORMATION TECHNOLOGY', 'INFORMATION SCIENCE & ENGINEERING',
        'ELECTRONICS AND COMMUNICATION ENGINEERING', 'ELECTRICAL AND ELECTRONICS ENGINEERING',
        'ELECTRONICS AND INSTRUMENTATION ENGINEERING', 'BIOMEDICAL ENGINEERING',
        'AERONAUTICAL ENGINEERING', 'MECHANICAL ENGINEERING', 'CIVIL ENGINEERING',
        'FASHION TECHNOLOGY', 'TEXTILE TECHNOLOGY', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE',
        'BIOTECHNOLOGY', 'AUTOMOBILE ENGINEERING', 'AGRICULTURE ENGINEERING', 'MECHATRONICS',
        'COMPUTER TECHNOLOGY', 'FOOD TECHNOLOGY', 'SOFTWARE ENGINEERING'
    ]

    for idx, r in enumerate(rows[:20]):
        row_errors = []
        row_warnings = []
        
        # Roll No Check
        val_roll = str(r.get(roll_col) or "").strip().upper() if roll_col else ""
        if not val_roll:
            row_errors.append("Missing Roll Number")
        else:
            if val_roll in file_roll_nos:
                row_errors.append(f"Duplicate Roll Number in file: {val_roll}")
            file_roll_nos.add(val_roll)
            
            if import_type == "students" and val_roll in db_students:
                row_warnings.append(f"Roll Number {val_roll} already exists in DB (will overwrite)")
            elif import_type == "points" and val_roll not in db_students:
                row_errors.append(f"Roll Number {val_roll} does not exist in database")

        if import_type == "students":
            # Name Check
            val_name = str(r.get(name_col) or "").strip() if name_col else ""
            if not val_name:
                row_errors.append("Missing Student Name")
                
            # Dept Check
            val_dept = str(r.get(dept_col) or "").strip().upper() if dept_col else ""
            if val_dept and val_dept not in valid_depts:
                row_warnings.append(f"Department '{val_dept}' is not standard")
                
            # Year Check
            val_year = str(r.get(year_col) or "").strip().upper() if year_col else ""
            if val_year not in ["I", "II", "III", "IV"]:
                row_errors.append("Year must be I, II, III, or IV")
                
            # Mentor Check & Capacity
            val_mentor = str(r.get(mentor_col) or "").strip().lower() if mentor_col else ""
            if val_mentor:
                current_cnt = mentor_capacities.get(val_mentor, 0)
                if current_cnt >= 20:
                    row_warnings.append(f"Mentor '{val_mentor}' is at/above capacity ({current_cnt}/20)")
        else:
            # Category Check
            val_cat = str(r.get(cat_col) or "").strip() if cat_col else ""
            if not val_cat:
                row_errors.append("Missing Category")
            # Points Check
            val_pts = r.get(pts_col)
            try:
                float(val_pts) if val_pts is not None else 0.0
            except ValueError:
                row_errors.append("Points must be a number")

        validation_results.append({
            "row_index": idx,
            "errors": row_errors,
            "warnings": row_warnings
        })

    return {
        "columns": columns,
        "suggested_mapping": suggested_mapping,
        "preview_rows": rows[:20],
        "validation_results": validation_results
    }

@app.post("/api/admin/import/commit")
def import_commit(payload: CommitImportPayload):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    
    success_count = 0
    skipped_count = 0
    skipped_reasons = []
    
    if payload.import_type == "students":
        for r in payload.rows:
            roll = str(r.get("roll_no") or "").strip().upper()
            name = str(r.get("student_name") or "").strip()
            dept = str(r.get("department") or "").strip()
            year = str(r.get("year") or "").strip().upper()
            mentor = str(r.get("mentor_id") or "").strip().lower()
            
            if not roll or not name:
                skipped_count += 1
                skipped_reasons.append(f"Row skipped: missing roll number or name")
                continue
                
            # Perform upsert
            cursor.execute("""
                INSERT INTO students (
                    roll_no, student_name, course_code, year, department, mentor_id,
                    total_count, total_points, initial_points, negative_count, negative_points,
                    cumulative_points, redeemed_points, balance_points, diversity_score, balance_score, engagement_group
                ) VALUES (?, ?, 'GEN', ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Medium')
                ON CONFLICT(roll_no) DO UPDATE SET
                    student_name=excluded.student_name,
                    department=excluded.department,
                    year=excluded.year,
                    mentor_id=excluded.mentor_id
            """, (roll, name, year, dept, mentor))
            success_count += 1
            
        details = f"Imported {success_count} students from roster file, skipped {skipped_count}."
        cursor.execute("INSERT INTO audit_log (action, details) VALUES (?, ?)", ("Import Students", details))
        
    else:
        # Points History Import
        for r in payload.rows:
            roll = str(r.get("roll_no") or "").strip().upper()
            category = str(r.get("category") or "").strip()
            pts = r.get("points_earned")
            cnt = r.get("activity_count") or 1
            
            try:
                pts = int(round(float(pts))) if pts is not None else 0
                cnt = int(round(float(cnt))) if cnt is not None else 1
            except (ValueError, TypeError):
                skipped_count += 1
                skipped_reasons.append(f"Row skipped: non-numeric points or count for {roll}")
                continue
                
            # Verify student exists
            cursor.execute("SELECT COUNT(*) FROM students WHERE roll_no = ?", (roll,))
            if cursor.fetchone()[0] == 0:
                skipped_count += 1
                skipped_reasons.append(f"Row skipped: Roll number {roll} does not exist")
                continue
                
            # Insert into breakdown
            cursor.execute("""
                INSERT INTO points_breakdown (roll_no, category, activity_count, points_earned)
                VALUES (?, ?, ?, ?)
            """, (roll, category, cnt, pts))
            
            # Update student total/balance points as whole integers
            cursor.execute("""
                UPDATE students 
                SET total_points = CAST(ROUND(total_points + ?) AS INTEGER),
                    balance_points = CAST(ROUND(balance_points + ?) AS INTEGER)
                WHERE roll_no = ?
            """, (pts, pts, roll))
            
            success_count += 1
            
        details = f"Imported {success_count} points records from history file, skipped {skipped_count}."
        cursor.execute("INSERT INTO audit_log (action, details) VALUES (?, ?)", ("Import Points History", details))

    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "imported_count": success_count,
        "skipped_count": skipped_count,
        "reasons": skipped_reasons[:20]
    }


@app.get("/api/ml/student-recommendations/{roll_no}")
def get_student_recommendations(roll_no: str):
    res = ml_model.predict_point_recommendations(roll_no.upper())
    if not res:
        raise HTTPException(status_code=404, detail="Student not found for AI recommendation model.")
    return res


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
