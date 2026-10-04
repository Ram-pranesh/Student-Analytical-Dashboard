# Reward Points Academic Platform

## Executive Summary

The Reward Points Academic Platform is a comprehensive educational analytics and student achievement tracking system. It incentives student development across academic coursework, technical competitions, professional certifications, and extracurricular initiatives while providing administrators and faculty mentors with actionable institutional intelligence.

The platform replaces text-heavy legacy student records with an interactive, design-forward interface featuring dynamic department hierarchies, student leaderboards, mentor pods, policy alerts, and a natural language AI Assistant.

---

## Architectural Overview

The application follows a decoupled client-server architecture:

```
┌────────────────────────────────────────────────────────┐
│                     Client (React)                     │
│  - Vite 8 + React 19                                   │
│  - Recharts Visualizations & Custom Vanilla CSS Tokens │
│  - Administrator, Mentor, and Student Portals          │
└───────────────────────────▲────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────▼────────────────────────────┐
│                    Backend (FastAPI)                   │
│  - Python 3.10+ & Uvicorn ASGI Server                  │
│  - Natural Language Query Engine (ai.py & nl_sql.py)   │
│  - Machine Learning Severity & Clustering (ml_model.py)│
└───────────────────────────▲────────────────────────────┘
                            │ SQLite Queries
┌───────────────────────────▼────────────────────────────┐
│                   Database (SQLite)                    │
│  - reward_points.db                                    │
│  - Normalized Integer Precision Points Schema          │
└────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
S5/
├── client/                     # Frontend single-page application (React + Vite)
│   ├── src/                    # Components, routing, formatting, and styles
│   ├── package.json            # Node.js dependencies and build scripts
│   └── README.md               # Frontend-specific documentation
│
├── server/                     # Backend API service (FastAPI + SQLite)
│   ├── main.py                 # FastAPI routes and server entry point
│   ├── db.py                   # Database access layer and query aggregations
│   ├── ai.py                   # Natural language processing and summaries
│   ├── nl_sql.py               # Read-only SQL generation and execution
│   ├── ml_model.py             # Machine learning clustering and risk models
│   ├── ingest.py               # Raw Excel data cleaning and ingestion
│   ├── migrate_points_to_int.py# Point precision schema migration
│   ├── reward_points.db        # SQLite database
│   ├── requirements.txt        # Python dependency manifest
│   └── README.md               # Backend-specific documentation
│
├── Reward Points Data.xlsx     # Source institutional dataset
└── README.md                   # Project root documentation
```

---

## Key Features

### 1. Administrator Dashboard
- **Institutional Overview**: Real-time KPI summaries (Total Headcount, Average Points, At-Risk Counts).
- **Department Mosaic**:
  - Dynamically displays the top 5 most populated departments by default.
  - Expandable control ("Show more" / "Show less") to toggle remaining departments without leaving the page.
  - Real-time department search and multi-criteria sorting (Students, Points, Name).
- **Institution Leaderboard**: Filterable by department, year, and engagement tier, with CSV export capabilities.
- **Policy Alerts & Audit Logging**: Automatic detection of negative balance alerts, low performance, and upcoming IP redemption deadlines.

### 2. AI Assistant
- Natural language query interface allowing queries such as:
  > *"Show Year II CSE students with balance points > 500"*
- Returns matching student tables with strict column hierarchy:
  `Roll No | Name | Mentor Name | Department | Year | Reward Points | Engagement | Inspect`
- Generates inline visual charts (bar charts and category distribution pies) when queries involve aggregate distributions.

### 3. Mentor Portal
- Pod-based student management maintaining a 1:20 mentor-to-student ratio.
- Real-time status indicators (On Track, Needs Attention, At Risk).
- Direct email and template communication dispatching.

### 4. Student Portal
- Gamified student overview detailing Total Points, Active Spendable Balance, Redeemed Points, and Cumulative Points.
- Stamp-card milestone tracking and visual tier progression.
- Institutional deadline warning countdown for Intellectual Property redemption.

---

## Data Model and Precision Architecture

### Whole-Number Integer Policy
To guarantee consistency across all institutional reporting, all student point values are enforced as whole integers:
- **Reward Points (`total_points`)**: Whole integer representing total points accrued.
- **Balance Points (`balance_points`)**: Whole integer representing remaining unspent balance.
- **SQLite Typing**: Both columns are defined as `INTEGER` in `students` table.
- **Rounding Standard**: The application applies standard nearest-integer rounding:
  $$\text{points} = \lfloor x + 0.5 \rfloor$$
- **API and UI Alignment**: Decimal points (`.0`, `.5`, etc.) are eliminated from database storage, backend API JSON responses, and UI tables.

---

## Getting Started

### Prerequisites
- **Python**: Version 3.10 or higher
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher

---

### Backend Setup

1. Open a terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Create and activate a Python virtual environment (recommended):
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend service:
   ```bash
   python main.py
   ```
   The backend server will run on `http://127.0.0.1:8000`.

---

### Frontend Setup

1. Open a second terminal and navigate to the `client/` directory:
   ```bash
   cd client
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will be accessible at `http://localhost:5173`.

---

## Build and Quality Verification

### Frontend Build
To compile the frontend client for production:
```bash
cd client
npm run build
```

### Frontend Linting
To run static analysis over client files:
```bash
cd client
npm run lint
```

---

## License and Institutional Usage

This software is developed for institutional academic performance monitoring. All rights reserved.
