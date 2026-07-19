import sqlite3
import re

conn = sqlite3.connect('reward_points.db')
c = conn.cursor()

c.execute('SELECT roll_no, department FROM students')
students = c.fetchall()

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

updates = []
for roll_no, current_dept in students:
    match = re.search(r'[A-Za-z]+', roll_no)
    if match:
        code = match.group().upper()
        # Handle 'U' prefix like 'UCS'
        if len(code) == 3 and code.startswith('U'):
            code = code[1:]
        
        if code in dept_map:
            new_dept = dept_map[code]
            if new_dept != current_dept:
                updates.append((new_dept, roll_no))

print(f"Updating {len(updates)} records...")
c.executemany("UPDATE students SET department = ? WHERE roll_no = ?", updates)
conn.commit()
conn.close()
print("Done.")
