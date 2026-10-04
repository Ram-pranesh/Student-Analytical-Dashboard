import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "reward_points.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check student count before migration
    cursor.execute("SELECT COUNT(*) FROM students")
    total_before = cursor.fetchone()[0]
    print(f"Total students before migration: {total_before}")

    # Create new table with INTEGER point fields
    cursor.execute("""
    CREATE TABLE students_new (
        roll_no TEXT PRIMARY KEY,
        student_name TEXT,
        course_code TEXT,
        year TEXT,
        department TEXT,
        total_count INTEGER,
        total_points INTEGER,
        initial_points INTEGER,
        negative_count INTEGER,
        negative_points INTEGER,
        cumulative_points INTEGER,
        redeemed_points INTEGER,
        balance_points INTEGER,
        diversity_score REAL,
        balance_score REAL,
        engagement_group TEXT,
        mentor_id TEXT,
        email TEXT,
        email_verified INTEGER DEFAULT 0
    )
    """)

    # Copy data with CAST(ROUND(...) AS INTEGER)
    cursor.execute("""
    INSERT INTO students_new (
        roll_no, student_name, course_code, year, department,
        total_count, total_points, initial_points, negative_count, negative_points,
        cumulative_points, redeemed_points, balance_points,
        diversity_score, balance_score, engagement_group,
        mentor_id, email, email_verified
    )
    SELECT
        roll_no, student_name, course_code, year, department,
        CAST(ROUND(COALESCE(total_count, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(total_points, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(initial_points, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(negative_count, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(negative_points, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(cumulative_points, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(redeemed_points, 0)) AS INTEGER),
        CAST(ROUND(COALESCE(balance_points, 0)) AS INTEGER),
        diversity_score, balance_score, engagement_group,
        mentor_id, email, email_verified
    FROM students
    """)

    cursor.execute("SELECT COUNT(*) FROM students_new")
    total_after = cursor.fetchone()[0]
    print(f"Total students in students_new: {total_after}")
    assert total_before == total_after, "Student counts must match!"

    # Drop old table and rename new table
    cursor.execute("DROP TABLE students")
    cursor.execute("ALTER TABLE students_new RENAME TO students")

    conn.commit()

    # Verify column types and data types
    cursor.execute("SELECT roll_no, total_points, balance_points FROM students LIMIT 5")
    samples = cursor.fetchall()
    print("Sample rows:")
    for s in samples:
        print(f"  {s['roll_no']}: total_points={s['total_points']} ({type(s['total_points'])}), balance_points={s['balance_points']} ({type(s['balance_points'])})")
        assert isinstance(s['total_points'], int), f"total_points must be int, got {type(s['total_points'])}"
        assert isinstance(s['balance_points'], int), f"balance_points must be int, got {type(s['balance_points'])}"

    conn.close()
    print("Migration successful.")

if __name__ == '__main__':
    migrate()
