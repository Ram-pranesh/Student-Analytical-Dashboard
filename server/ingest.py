import os
import pandas as pd
import numpy as np
import sqlite3
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

EXCEL_PATH = r"C:\Users\ram pranesh\Desktop\web\S5\Reward Points Data.xlsx"
DB_PATH = r"C:\Users\ram pranesh\Desktop\web\S5\server\reward_points.db"

def clean_and_ingest():
    print("Reading Excel file...")
    xl = pd.ExcelFile(EXCEL_PATH)
    df = xl.parse(xl.sheet_names[0])
    
    # Drop rows that are completely empty (like the first row in the spreadsheet)
    # We drop row 0 if it contains NaNs in critical columns like Roll No.
    df = df.dropna(subset=['Roll No.'])
    df = df.reset_index(drop=True)
    
    print(f"Loaded {len(df)} records.")
    
    # Standardize column names to be sql-friendly (lowercase, no spaces, clean spelling)
    # But let's map them from their raw names.
    # Raw Names map:
    # 'Roll No.', 'Student Name', 'Course Code', 'Year', 'Department'
    # 'Technical Events Count', 'Technical Events Points'
    # 'Skill Count', 'Skill Points'
    # 'Assignement Count', 'Assignment Points' (Note the raw spelling)
    # 'Interview Count', 'Interview Points'
    # 'Exam Count', 'Exam Points'
    # 'Faculty Initiatives Count', 'Faculty Initiatives Points'
    # 'Lab Initiatives Count', 'Lab Initiatives Points'
    # 'Special Lab Initiatives Count', 'Special Lab Initiatives Points'
    # 'EXTRA-CURRICULAR ACTIVITIES COUNT', 'EXTRA-CURRICULAR ACTIVITIES POINTS'
    # 'STUDENT INITIATIVES COUNT', 'STUDENT INITIATIVES POINTS'
    # 'EXTERNAL EVENTS COUNT', 'EXTERNAL EVENTS POINTS'
    # 'Total Count', 'Total Points'
    # 'Initial Points', 'Negative Count', 'Negative Points', 'Cumulative Points', 'Redeemed Points', 'Balance Points'
    
    # Fill NaN values in counts and points with 0
    num_cols = [
        'Technical Events Count', 'Technical Events Points',
        'Skill Count', 'Skill Points',
        'Assignement Count', 'Assignment Points',
        'Interview Count', 'Interview Points',
        'Exam Count', 'Exam Points',
        'Faculty Initiatives Count', 'Faculty Initiatives Points',
        'Lab Initiatives Count', 'Lab Initiatives Points',
        'Special Lab Initiatives Count', 'Special Lab Initiatives Points',
        'EXTRA-CURRICULAR ACTIVITIES COUNT', 'EXTRA-CURRICULAR ACTIVITIES POINTS',
        'STUDENT INITIATIVES COUNT', 'STUDENT INITIATIVES POINTS',
        'EXTERNAL EVENTS COUNT', 'EXTERNAL EVENTS POINTS',
        'Total Count', 'Total Points',
        'Initial Points', 'Negative Count', 'Negative Points',
        'Cumulative Points', 'Redeemed Points', 'Balance Points'
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0.0)
            
    # Clean text columns
    text_cols = ['Roll No.', 'Student Name', 'Course Code', 'Year', 'Department']
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            
    # Correct departments based on roll number abbreviations
    print("Correcting student departments based on roll number prefixes...")
    import re
    dept_map = {
        'CS': 'COMPUTER SCIENCE AND ENGINEERING',
        'CB': 'COMPUTER SCIENCE AND BUSINESS SYSTEMS',
        'IT': 'INFORMATION TECHNOLOGY',
        'IS': 'INFORMATION SCIENCE & ENGINEERING',
        'IG': 'INFORMATION SCIENCE & ENGINEERING',
        'EC': 'ELECTRONICS AND COMMUNICATION ENGINEERING',
        'EE': 'ELECTRICAL AND ELECTRONICS ENGINEERING',
        'EI': 'ELECTRONICS AND INSTRUMENTATION ENGINEERING',
        'BM': 'BIOMEDICAL ENGINEERING',
        'AE': 'AERONAUTICAL ENGINEERING',
        'ME': 'MECHANICAL ENGINEERING',
        'CE': 'CIVIL ENGINEERING',
        'FT': 'FASHION TECHNOLOGY',
        'TX': 'TEXTILE TECHNOLOGY',
        'AD': 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE',
        'BT': 'BIOTECHNOLOGY',
        'AU': 'AUTOMOBILE ENGINEERING',
        'AG': 'AGRICULTURE ENGINEERING',
        'MC': 'MECHATRONICS',
        'CT': 'COMPUTER TECHNOLOGY',
        'FD': 'FOOD TECHNOLOGY',
        'SE': 'SOFTWARE ENGINEERING'
    }
    
    def get_corrected_dept(row):
        roll_no = str(row['Roll No.']).strip()
        current_dept = str(row['Department']).strip()
        match = re.search(r'[A-Za-z]+', roll_no)
        if match:
            code = match.group().upper()
            if len(code) == 3 and code.startswith('U'):
                code = code[1:]
            if code in dept_map:
                return dept_map[code]
        return current_dept

    if 'Roll No.' in df.columns and 'Department' in df.columns:
        df['Department'] = df.apply(get_corrected_dept, axis=1)
            
    # Calculate derived metrics
    print("Computing derived metrics...")
    
    # 1. Diversity Score: number of categories where student earned points > 0 / total categories
    categories = [
        'Technical Events Points', 'Skill Points', 'Assignment Points', 
        'Interview Points', 'Exam Points', 'Faculty Initiatives Points', 
        'Lab Initiatives Points', 'Special Lab Initiatives Points', 
        'EXTRA-CURRICULAR ACTIVITIES POINTS', 'STUDENT INITIATIVES POINTS', 
        'EXTERNAL EVENTS POINTS'
    ]
    
    # Note: 'Assignment Points' in df might be 'Assignment Points', let's make sure we match the keys.
    # In df columns: 'Assignment Points' is present, and count is 'Assignement Count'.
    active_categories_count = 0
    for cat in categories:
        col_name = cat
        if col_name in df.columns:
            df[cat + '_active'] = df[col_name] > 0
            
    df['diversity_score'] = df[[c + '_active' for c in categories if c in df.columns]].sum(axis=1) / len(categories)
    
    # Clean temporary active columns
    df = df.drop(columns=[c + '_active' for c in categories if c in df.columns])
    
    # 2. Balance Score: balance between technical (skills, assignment, exam, lab) and events/extra-curricular
    tech_points_cols = ['Skill Points', 'Assignment Points', 'Exam Points', 'Lab Initiatives Points', 'Special Lab Initiatives Points']
    event_points_cols = ['Technical Events Points', 'Interview Points', 'EXTRA-CURRICULAR ACTIVITIES POINTS', 'STUDENT INITIATIVES POINTS', 'EXTERNAL EVENTS POINTS']
    
    df['tech_total'] = df[[c for c in tech_points_cols if c in df.columns]].sum(axis=1)
    df['event_total'] = df[[c for c in event_points_cols if c in df.columns]].sum(axis=1)
    
    # Balance score: 1 - abs(tech - event) / (tech + event + 1)
    df['balance_score'] = 1.0 - (abs(df['tech_total'] - df['event_total']) / (df['tech_total'] + df['event_total'] + 1.0))
    
    # 3. K-Means Clustering for Engagement Groups (Low, Medium, High)
    print("Running K-Means clustering...")
    scaler = StandardScaler()
    # Features for clustering: normalized total points, diversity score, balance score
    cluster_features = df[['Total Points', 'diversity_score', 'balance_score']].copy()
    scaled_features = scaler.fit_transform(cluster_features)
    
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(scaled_features)
    
    # Order clusters so that 0 = Low, 1 = Medium, 2 = High based on mean Total Points
    cluster_means = df.groupby('cluster')['Total Points'].mean().sort_values()
    cluster_map = {old_label: new_label for new_label, old_label in enumerate(cluster_means.index)}
    df['cluster_ordered'] = df['cluster'].map(cluster_map)
    
    engagement_labels = {0: 'Low', 1: 'Medium', 2: 'High'}
    df['engagement_group'] = df['cluster_ordered'].map(engagement_labels)
    
    # Drop temp cluster columns
    df = df.drop(columns=['cluster', 'cluster_ordered', 'tech_total', 'event_total'])
    
    # Save to SQLite
    print("Saving to SQLite database...")
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Drop existing tables if they exist
    cursor.execute("DROP TABLE IF EXISTS students")
    cursor.execute("DROP TABLE IF EXISTS points_breakdown")
    
    # Create students table
    cursor.execute("""
    CREATE TABLE students (
        roll_no TEXT PRIMARY KEY,
        student_name TEXT,
        course_code TEXT,
        year TEXT,
        department TEXT,
        total_count REAL,
        total_points REAL,
        initial_points REAL,
        negative_count REAL,
        negative_points REAL,
        cumulative_points REAL,
        redeemed_points REAL,
        balance_points REAL,
        diversity_score REAL,
        balance_score REAL,
        engagement_group TEXT
    )
    """)
    
    # Create points_breakdown table
    cursor.execute("""
    CREATE TABLE points_breakdown (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_no TEXT,
        category TEXT,
        activity_count REAL,
        points_earned REAL,
        FOREIGN KEY (roll_no) REFERENCES students (roll_no)
    )
    """)
    
    # Insert students
    students_data = []
    points_breakdown_data = []
    
    category_pairs = [
        ('Technical Events', 'Technical Events Count', 'Technical Events Points'),
        ('Skills', 'Skill Count', 'Skill Points'),
        ('Assignments', 'Assignement Count', 'Assignment Points'),
        ('Interviews', 'Interview Count', 'Interview Points'),
        ('Exams', 'Exam Count', 'Exam Points'),
        ('Faculty Initiatives', 'Faculty Initiatives Count', 'Faculty Initiatives Points'),
        ('Lab Initiatives', 'Lab Initiatives Count', 'Lab Initiatives Points'),
        ('Special Lab Initiatives', 'Special Lab Initiatives Count', 'Special Lab Initiatives Points'),
        ('Extra-Curricular', 'EXTRA-CURRICULAR ACTIVITIES COUNT', 'EXTRA-CURRICULAR ACTIVITIES POINTS'),
        ('Student Initiatives', 'STUDENT INITIATIVES COUNT', 'STUDENT INITIATIVES POINTS'),
        ('External Events', 'EXTERNAL EVENTS COUNT', 'EXTERNAL EVENTS POINTS')
    ]
    
    for idx, row in df.iterrows():
        students_data.append((
            row['Roll No.'],
            row['Student Name'],
            row['Course Code'],
            row['Year'],
            row['Department'],
            row['Total Count'],
            row['Total Points'],
            row['Initial Points'],
            row['Negative Count'],
            row['Negative Points'],
            row['Cumulative Points'],
            row['Redeemed Points'],
            row['Balance Points'],
            row['diversity_score'],
            row['balance_score'],
            row['engagement_group']
        ))
        
        for label, count_col, points_col in category_pairs:
            points_breakdown_data.append((
                row['Roll No.'],
                label,
                row[count_col],
                row[points_col]
            ))
            
    cursor.executemany("""
    INSERT INTO students (
        roll_no, student_name, course_code, year, department,
        total_count, total_points, initial_points, negative_count, negative_points,
        cumulative_points, redeemed_points, balance_points, diversity_score, balance_score, engagement_group
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, students_data)
    
    cursor.executemany("""
    INSERT INTO points_breakdown (roll_no, category, activity_count, points_earned)
    VALUES (?, ?, ?, ?)
    """, points_breakdown_data)
    
    conn.commit()
    conn.close()
    
    print("Ingestion complete. Database created successfully.")

if __name__ == '__main__':
    clean_and_ingest()
