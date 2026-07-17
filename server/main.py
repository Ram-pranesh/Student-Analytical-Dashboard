from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn

import db
import ai

app = FastAPI(title="Student Reward Intelligence API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/login")
def login(username: str, role: str):
    """
    Mock login validation.
    For admin, username must be 'admin'.
    For student, username must be a valid Roll Number in the SQLite database.
    """
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
    """Returns avg balance points per department, optionally filtered by year (I/II/III/IV/All)."""
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
    # Map empty query params to None
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

@app.get("/api/student/{roll_no}/extended")
def get_student_extended(roll_no: str):
    """Extended student profile for the admin Inspect panel."""
    data = db.get_student_extended_profile(roll_no.upper())
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@app.get("/api/student/{roll_no}/recommendations")
def get_recommendations(roll_no: str):
    recs = ai.get_student_recommendations(roll_no.upper())
    return recs

@app.get("/api/query")
def query_assistant(q: str = Query(..., description="Natural language search query from admin")):
    return ai.parse_natural_language_query(q)

@app.get("/api/alerts")
def get_alerts():
    return ai.detect_policy_alerts()

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
