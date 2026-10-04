# Reward Points Platform — Backend Service

## Overview

The backend service for the Reward Points Academic Platform is built with FastAPI and SQLite. It provides high-performance RESTful APIs for student point analytics, natural language query processing, automated risk detection, machine learning-driven clustering, and administrative data management.

---

## Technology Stack

- **Framework**: FastAPI (Python 3.10+)
- **Server**: Uvicorn (ASGI)
- **Database**: SQLite (`reward_points.db`) with read-only connection pooling for analytics
- **Data Processing**: Pandas, NumPy
- **Machine Learning**: Scikit-Learn (K-Means Clustering, Isolation Forest, StandardScaler)
- **SQL Analysis**: Sqlglot (read-only AST query validation)

---

## Architecture and Core Modules

```
server/
├── main.py                     # FastAPI application endpoints, routing, and lifecycle
├── db.py                       # Database connection management and analytical queries
├── ai.py                       # Natural language query parsing and statistical summaries
├── nl_sql.py                   # LLM/SQL translator with read-only execution guardrails
├── ml_model.py                 # Severity tiers, anomaly detection, and clustering models
├── ingest.py                   # Excel dataset cleaning, normalization, and ingestion pipeline
├── migrate_points_to_int.py    # Database schema migration ensuring integer point precision
└── requirements.txt            # Python package dependencies
```

### Module Responsibilities

1. **`main.py`**
   - Implements public and administrative endpoints.
   - Manages CORS middleware, error handling, and audit logging.
   - Handles roster CSV and points history batch imports with transactional validation.

2. **`db.py`**
   - Handles SQLite connections (`get_db_connection` and read-only `get_readonly_db_connection`).
   - Implements high-volume aggregations: institutional KPIs, department hierarchies, student leaderboards, and peer cohort windows.
   - Enforces integer representation on all point fields (`total_points`, `balance_points`, `cumulative_points`, `redeemed_points`).

3. **`ai.py`**
   - Natural language query parser translating administrator inquiries into structured SQLite queries.
   - Computes query aggregate statistics (totals, averages, distributions) and returns structured response payloads.
   - Detects policy violations and calculates IP redemption risk deadlines.

4. **`nl_sql.py`**
   - Schema snapshot generation for LLM context.
   - AST validation using `sqlglot` to enforce read-only `SELECT` queries with table whitelisting and row caps.
   - Automatic fallback to deterministic regex parsing in `ai.py` when OpenAI credentials are not configured.

5. **`ml_model.py`**
   - **Severity Tiers**: Tiers students into risk groups based on cumulative balance points, attendance, and activity recency.
   - **Behavioral Clustering**: K-Means clustering over normalized activity vectors to identify student engagement patterns.
   - **Anomaly Detection**: Isolation Forest identifies atypical patterns across activity counts and point balances.

6. **`ingest.py`**
   - Cleans the raw institutional Excel sheet (`Reward Points Data.xlsx`).
   - Resolves department codes using student roll-number prefixes.
   - Derives diversity and category balance scores.
   - Enforces integer typing across all points and count columns.

---

## Database Schema

The database resides in `reward_points.db` and contains the following primary tables:

### 1. `students`
Stores canonical student records and point totals:

| Column | Type | Description |
| :--- | :--- | :--- |
| `roll_no` | `TEXT PRIMARY KEY` | Unique student registration identifier |
| `student_name` | `TEXT` | Full name of the student |
| `course_code` | `TEXT` | Degree program (e.g., B.E., B.Tech.) |
| `year` | `TEXT` | Academic year (I, II, III, IV) |
| `department` | `TEXT` | Full department name |
| `total_count` | `INTEGER` | Total number of point-bearing activities |
| `total_points` | `INTEGER` | Cumulative reward points earned (whole integer) |
| `initial_points` | `INTEGER` | Carryover points from previous academic cycle |
| `negative_count` | `INTEGER` | Count of disciplinary/negative point events |
| `negative_points` | `INTEGER` | Disciplinary deductions |
| `cumulative_points`| `INTEGER` | Total points plus initial points |
| `redeemed_points` | `INTEGER` | Points redeemed for incentives/benefits |
| `balance_points` | `INTEGER` | Active remaining spendable balance (whole integer) |
| `diversity_score` | `REAL` | Activity distribution index across categories |
| `balance_score` | `REAL` | Technical vs. extracurricular engagement ratio |
| `engagement_group`| `TEXT` | Classification: `'High'`, `'Medium'`, or `'Low'` |
| `mentor_id` | `TEXT` | Assigned faculty mentor identifier |
| `email` | `TEXT` | Contact email address |
| `email_verified` | `INTEGER` | Verification status flag (`0` or `1`) |

### 2. `points_breakdown`
Granular category-level point distribution per student:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing identifier |
| `roll_no` | `TEXT` | Foreign key referencing `students.roll_no` |
| `category` | `TEXT` | Activity category (e.g., Skills, Technical Events, Lab) |
| `activity_count` | `REAL` | Number of activities completed in this category |
| `points_earned` | `REAL` | Points accrued in this category |

### 3. Auxiliary Tables
- `notification_templates`: Custom email/alert templates with variable placeholders.
- `audit_log`: System action history tracking user modifications and batch imports.
- `mentor_notifications`: Message dispatch queue for assigned student pod mentors.

---

## Point Precision and Rounding Policy

To maintain complete consistency across institutional reporting:
1. **Integer Storage**: `total_points` and `balance_points` are typed and stored as `INTEGER` in SQLite.
2. **Rounding Rule**: Any floating-point calculation or decimal source value is converted using standard round-half-up:
   ```python
   int(round(float(value)))
   ```
3. **API Serialization**: All JSON endpoints return native Python integers for student point properties:
   ```json
   {
     "total_points": 17852,
     "balance_points": 14895
   }
   ```
4. **Data Import Safety**: The CSV points-import handler in `server/main.py` rounds imported point additions and executes `CAST(ROUND(total_points + ?) AS INTEGER)` to prevent decimal reintroduction.

---

## Installation and Execution

### Prerequisites
- Python 3.10 or higher
- pip package manager

### Setup

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. (Optional) Run database migration if starting with a legacy schema:
   ```bash
   python migrate_points_to_int.py
   ```

4. Start the development server:
   ```bash
   python main.py
   ```
   The API server will listen on `http://127.0.0.1:8000`.

---

## Primary API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/kpis` | Institutional metrics (student counts, averages, risk counts) |
| `GET` | `/api/admin/hierarchy` | Department listing with student counts, averages, and year distributions |
| `GET` | `/api/leaderboard` | Paginated student rankings with department and engagement filters |
| `GET` | `/api/student/{roll_no}` | Comprehensive single-student profile, ledger, and breakdown |
| `GET` | `/api/student/{roll_no}/peers` | Cohort rank window (4 above, self, 4 below) and top 10 branch peers |
| `GET` | `/api/nl-sql-search` | Natural language query search returning matching student records |
| `GET` | `/api/query` | Fallback deterministic natural language search endpoint |
| `GET` | `/api/alerts` | Policy alerts (low balance, negative points, IP redemption risk) |
| `POST`| `/api/admin/import` | Bulk roster or points-history CSV import |
| `GET` | `/api/admin/audit-logs` | Chronological audit log of administrative actions |
