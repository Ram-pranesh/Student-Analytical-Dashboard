# Reward Points Platform — Frontend Client

## Overview

The client application of the Reward Points Academic Platform is a single-page React application built with Vite. It delivers a role-aware dashboard for administrators, mentors, and students, providing point tracking, department hierarchies, policy monitoring, and natural language analytics.

---

## Technology Stack

- **Framework**: React 19
- **Build Tool**: Vite 8
- **Language**: JavaScript (JSX)
- **Styling**: Vanilla CSS with custom CSS custom properties (tokens) supporting light and dark themes
- **Icons**: Lucide React
- **Data Visualization**: Recharts (ResponsiveContainer, BarChart, PieChart, AreaChart)
- **Code Quality**: Oxlint

---

## Project Structure

```
client/
├── index.html                  # HTML entry point and font definitions
├── vite.config.js              # Vite configuration and proxy rules
├── package.json                # Project dependencies and script declarations
└── src/
    ├── main.jsx                # Application bootstrap
    ├── App.jsx                 # Core application component and view routing
    ├── App.css                 # Application-specific layouts
    ├── index.css               # Global design tokens, typography, and utility classes
    └── assets/                 # Static graphical assets
```

---

## Design System and Theming

The application utilizes Vanilla CSS design tokens defined in `src/index.css`. The design avoids ad-hoc inline color codes in favor of a centralized color palette supporting both light and dark display modes:

### Core Color Palette
- `--paper`: Primary surface background color (`#ffffff` / `#161b22`)
- `--cloud`: Structural border and divider color (`#e2e8f0` / `#30363d`)
- `--ink`: Primary typography color (`#0f172a` / `#f0f6fc`)
- `--fog`: Muted secondary typography color (`#64748b` / `#8b949e`)
- `--brass`: Academic gold primary accent (`#C49A3C`)
- `--teal`: Positive engagement and status indicator (`#3A7A7A`)
- `--coral`: Critical risk and alert indicator (`#D9534F`)

### Typography
- **Display & Headings**: Fraunces (`--font-display`)
- **Interface & UI**: Inter (`--font-ui`)
- **Numerical & Tabular Data**: JetBrains Mono (`--font-mono`)

---

## Key Views and Features

### 1. Program Overview (`activeTab === 'overview'`)
- **KPI Metrics**: Displays total student headcount, institution-wide average points, and at-risk student counts.
- **Department Mosaic**:
  - Dynamically displays the top 5 most populated departments by default (sorted descending by `student_count`).
  - Interactive "Show more (N remaining)" button expands to display all departments in the same responsive card grid.
  - Clicking "Show less" collapses back to the top 5.
  - Search input (`Search dept...`) operates across all departments.
  - Department sorting options: `Sort: Students`, `Sort: Points`, `Sort: Name`.
  - Department tiles display average points, student counts, sparklines, and open the Department Detail Drawer upon selection.
- **Student Rankings**: Full institution leaderboard with department, year, and engagement filters, CSV export, and pagination.

### 2. AI Assistant (`activeTab === 'assistant'`)
- Natural language query input allowing plain-language data exploration (e.g., *"Show Year II CSE students with balance points > 500"*).
- Displays answers with optional visual chart representations (bar charts and category distribution pies).
- **Matching Students Table**:
  - Displays student records in strict column order:
    `Roll No | Name | Mentor Name | Department | Year | Reward Points | Engagement | Inspect`
  - Numerical fields (including **Reward Points**) are right-aligned with monospace font formatting.
  - Reward Points values are guaranteed whole integers sourced directly from `row.total_points`.
  - Action button opens the student inspection drawer.

### 3. Mentor Portal (`activeTab === 'pods'`)
- Pod management interface organized by mentor (1:20 mentor-to-student ratio).
- Student engagement categorization: High (On Track), Medium (Needs Attention), Low (At Risk).
- Direct trigger for student intervention alerts and template notifications.

### 4. Student Portal (`role === 'student'`)
- Gamified dashboard tracking total points, spendable balance, and tier progression.
- Visual stamp-card milestone ledger.
- Institutional IP Redemption Date warning banner with countdown calculation.

### 5. Student Detail Inspection Drawer
- Slide-over drawer providing comprehensive student data:
  - Total Points, Balance Points, Redeemed Points, and Cumulative Points.
  - Monthly activity trends and weekly attendance logs.
  - Specialization radar/breakdown across all 11 evaluation categories.

---

## Point Formatting Rules

To ensure strict data consistency across all views:
- Point values are rendered via the centralized `fmt()` formatter.
- Integers are formatted with standard thousands separators without decimal fractions (e.g., `17,852`).
- Both `Reward Points` and `Balance Points` are represented as whole numbers across all tables, cards, drawers, and CSV exports.

---

## Development and Build Scripts

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Installation
```bash
cd client
npm install
```

### Run Locally
```bash
npm run dev
```
The local development server starts by default at `http://localhost:5173`.

### Production Build
```bash
npm run build
```
Compiles and bundles the application to the `client/dist/` directory using Vite.

### Linting
```bash
npm run lint
```
Executes Oxlint over all project source files.
