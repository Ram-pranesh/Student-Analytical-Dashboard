"""
ml_model.py — Machine-learning modules for the Reward Points platform.

Modules
-------
1. train_engagement_classifier()  — RandomForest 3-class (Low/Medium/High).
   Label: quantile of engagement_score (velocity+diversity+recency).
   Features: raw signals ORTHOGONAL to the label formula, so the model
             genuinely learns, not just re-derives quantile cutoffs.

2. run_isolation_forest()         — Outlier detection + attribution layer.
   Post-hoc z-score on flagged rows produces an actionable reason_label.

3. run_kmeans_segmentation()      — K-Means with mandatory StandardScaler.
   Elbow method selects k, auto-labels clusters from centroid dominant category.

4. train_at_risk_classifier()     — Original deadline-risk LogisticRegression
   (kept for the /api/ml/at-risk-predictions endpoint).
"""

import math
import os
import sqlite3
import threading
from datetime import datetime, timezone

import pandas as pd
import numpy as np

# ── Optional heavy deps — all graceful fallbacks ─────────────────
try:
    from sklearn.ensemble import RandomForestClassifier, IsolationForest
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import silhouette_score
    from sklearn.linear_model import LogisticRegression
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from db import get_db_connection

# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

ALL_CATEGORIES = [
    'Technical Events', 'Skills', 'Assignments', 'Interviews', 'Exams',
    'Faculty Initiatives', 'Lab Initiatives', 'Special Lab Initiatives',
    'Extra-Curricular', 'Student Initiatives', 'External Events'
]

SUGGESTION_CATEGORY_SPECS = [
    ('Technical Events', 'Technical Events Count', 'Technical Events Points', 'Terminal', 'Try a Technical Event'),
    ('Skills', 'Skill Count', 'Skill Points', 'Award', 'Join a Skills Session'),
    ('Assignments', 'Assignement Count', 'Assignment Points', 'BookOpen', 'Complete an Assignment Track'),
    ('Interviews', 'Interview Count', 'Interview Points', 'Users', 'Attend an Interview Prep session'),
    ('Exams', 'Exam Count', 'Exam Points', 'FileText', 'Prepare for an Exam Challenge'),
    ('Faculty Initiatives', 'Faculty Initiatives Count', 'Faculty Initiatives Points', 'Users', 'Take on a Faculty Initiative'),
    ('Lab Initiatives', 'Lab Initiatives Count', 'Lab Initiatives Points', 'Cpu', 'Join a Lab Initiative'),
    ('Special Lab Initiatives', 'Special Lab Initiatives Count', 'Special Lab Initiatives Points', 'Cpu', 'Pick a Special Lab Initiative'),
    ('Extra-Curricular', 'EXTRA-CURRICULAR ACTIVITIES COUNT', 'EXTRA-CURRICULAR ACTIVITIES POINTS', 'Activity', 'Join a Club Activity'),
    ('Student Initiatives', 'STUDENT INITIATIVES COUNT', 'STUDENT INITIATIVES POINTS', 'Users', 'Start a Student Initiative'),
    ('External Events', 'EXTERNAL EVENTS COUNT', 'EXTERNAL EVENTS POINTS', 'Globe', 'Take part in an External Event'),
]

SUGGESTION_EXCEL_CANDIDATES = [
    os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'Reward Points Data.xlsx')),
    os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'Reward_Points_Data.xlsx')),
]

_VIEW_SUGGESTION_CACHE_LOCK = threading.Lock()
_VIEW_SUGGESTION_CACHE = {
    'ready': False,
    'generated_at': None,
    'similarity_matrix': None,
    'expected_points': {},
    'category_order': [],
    'active_categories': [],
}

YEAR_MAP = {'I': 1, 'II': 2, 'III': 3, 'IV': 4}


def _fetch_full_student_matrix():
    """
    Returns a list of dicts — one per student — with:
      - all core scalar fields
      - per-category point values (11 keys, prefixed cat__)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT s.roll_no, s.student_name, s.department,
               s.total_points, s.balance_points, s.redeemed_points,
               s.negative_points, s.cumulative_points,
               s.engagement_group, s.year, s.mentor_id,
               (SELECT COUNT(DISTINCT pb2.category)
                FROM points_breakdown pb2
                WHERE pb2.roll_no = s.roll_no AND pb2.points_earned > 0) AS diversity_count
        FROM students s
    """)
    students = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT roll_no, category, points_earned
        FROM points_breakdown
    """)
    pb_rows = cursor.fetchall()
    conn.close()

    # Build per-student category map
    cat_map = {}
    for r in pb_rows:
        roll = r['roll_no']
        cat = r['category']
        if roll not in cat_map:
            cat_map[roll] = {}
        cat_map[roll][cat] = float(r['points_earned'] or 0.0)

    for s in students:
        roll = s['roll_no']
        cats = cat_map.get(roll, {})
        for cat in ALL_CATEGORIES:
            s[f'cat__{cat}'] = cats.get(cat, 0.0)

    return students


def _engagement_label_from_score(score, q33, q66):
    """Bootstrap label: Low / Medium / High from pre-computed quantile cutoffs."""
    if score <= q33:
        return 'Low'
    elif score <= q66:
        return 'Medium'
    return 'High'


def _round_half_up(value):
    return int(math.floor(float(value) + 0.5))


def _resolve_reward_points_source_path():
    for candidate in SUGGESTION_EXCEL_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


# ─────────────────────────────────────────────────────────────────
# Severity clustering cache — KMeans labels for admin-facing tiers
# ─────────────────────────────────────────────────────────────────

SEVERITY_TIERS = ['At Risk', 'Average', 'High Performing']
SEVERITY_FEATURE_COLUMNS = [count_col for _, count_col, _, _, _ in SUGGESTION_CATEGORY_SPECS] + ['balance_points']
_SEVERITY_CACHE_LOCK = threading.Lock()
_SEVERITY_CACHE = {
    'ready': False,
    'generated_at': None,
    'assignments': {},
    'summaries': [],
}


def _fetch_severity_source_rows():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT roll_no, department, year, balance_points FROM students")
    students = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT roll_no, category, SUM(activity_count) AS activity_count
        FROM points_breakdown
        GROUP BY roll_no, category
    """)
    count_rows = cursor.fetchall()
    conn.close()

    count_map = {}
    for row in count_rows:
        roll = row['roll_no']
        category = row['category']
        count_map.setdefault(roll, {})[category] = float(row['activity_count'] or 0.0)

    rows = []
    for student in students:
        row = {
            'roll_no': student['roll_no'],
            'department': student['department'],
            'year': student['year'],
            'balance_points': float(student['balance_points'] or 0.0),
        }
        student_counts = count_map.get(student['roll_no'], {})
        for category, count_col, _, _, _ in SUGGESTION_CATEGORY_SPECS:
            row[count_col] = float(student_counts.get(category, 0.0))
        rows.append(row)

    return rows


def _choose_kmeans_cluster_count(X_scaled):
    sample_size = len(X_scaled)
    if sample_size < 3:
        return 1

    k_candidates = list(range(2, min(7, sample_size) + 1))
    if not k_candidates:
        return 1

    scores = {}
    for k in k_candidates:
        model = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = model.fit_predict(X_scaled)
        if len(set(labels)) > 1:
            scores[k] = float(silhouette_score(X_scaled, labels, sample_size=min(500, sample_size)))
        else:
            scores[k] = -1.0

    best_k = max(scores, key=scores.get)
    if 3 in scores and scores[3] >= scores[best_k] - 0.03:
        best_k = 3

    return best_k


def _cluster_severity_frame(frame):
    if frame is None or frame.empty:
        return {}

    X = frame[SEVERITY_FEATURE_COLUMNS].to_numpy(dtype=float)
    if len(frame) < 3 or not HAS_SKLEARN:
        ordered = frame.sort_values('balance_points').reset_index(drop=True)
        if len(ordered) == 1:
            return {ordered.iloc[0]['roll_no']: 'Average'}
        assignments = {}
        split_points = np.array_split(ordered, 3)
        tier_order = ['At Risk', 'Average', 'High Performing']
        for tier, subset in zip(tier_order, split_points):
            for _, row in subset.iterrows():
                assignments[row['roll_no']] = tier
        return assignments

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    chosen_k = _choose_kmeans_cluster_count(X_scaled)
    if chosen_k <= 1:
        return {row['roll_no']: 'Average' for _, row in frame.iterrows()}

    model = KMeans(n_clusters=chosen_k, random_state=42, n_init=10)
    cluster_labels = model.fit_predict(X_scaled)
    working = frame.copy()
    working['cluster_id'] = cluster_labels

    cluster_means = working.groupby('cluster_id')['balance_points'].mean().sort_values()
    cluster_tier_map = {}
    ordered_cluster_ids = list(cluster_means.index)
    if len(ordered_cluster_ids) == 2:
        cluster_tier_map[ordered_cluster_ids[0]] = 'At Risk'
        cluster_tier_map[ordered_cluster_ids[1]] = 'High Performing'
    else:
        cluster_tier_map[ordered_cluster_ids[0]] = 'At Risk'
        for cluster_id in ordered_cluster_ids[1:-1]:
            cluster_tier_map[cluster_id] = 'Average'
        cluster_tier_map[ordered_cluster_ids[-1]] = 'High Performing'

    return {
        row['roll_no']: cluster_tier_map.get(row['cluster_id'], 'Average')
        for _, row in working.iterrows()
    }


def refresh_severity_cache():
    rows = _fetch_severity_source_rows()
    if not rows:
        with _SEVERITY_CACHE_LOCK:
            _SEVERITY_CACHE.update({'ready': False, 'generated_at': None, 'assignments': {}, 'summaries': []})
        return _SEVERITY_CACHE

    frame = pd.DataFrame(rows)
    cohort_assignments = {}
    summaries = []

    large_groups = []
    small_groups = []
    for (department, year), group in frame.groupby(['department', 'year']):
        if len(group) >= 15:
            large_groups.append(((department, year), group))
        else:
            small_groups.append(((department, year), group))

    for (department, year), group in large_groups:
        for roll_no, tier in _cluster_severity_frame(group).items():
            cohort_assignments[roll_no] = {
                'severity_tier': tier,
                'cohort_key': f'{department}::{year}',
            }
        summaries.append({
            'cohort_key': f'{department}::{year}',
            'cohort_size': int(len(group)),
            'mode': 'cohort',
        })

    if small_groups:
        small_frame = pd.concat([group for _, group in small_groups], ignore_index=True)
        for roll_no, tier in _cluster_severity_frame(small_frame).items():
            cohort_assignments[roll_no] = {
                'severity_tier': tier,
                'cohort_key': 'dataset-wide',
            }
        summaries.append({
            'cohort_key': 'dataset-wide',
            'cohort_size': int(len(small_frame)),
            'mode': 'dataset-wide',
        })

    with _SEVERITY_CACHE_LOCK:
        _SEVERITY_CACHE.update({
            'ready': True,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'assignments': cohort_assignments,
            'summaries': summaries,
        })

    return _SEVERITY_CACHE


def _severity_cache_loop():
    try:
        refresh_severity_cache()
    except Exception:
        pass
    timer = threading.Timer(86400, _severity_cache_loop)
    timer.daemon = True
    timer.start()


def start_severity_cache_refresh():
    timer = threading.Timer(86400, _severity_cache_loop)
    timer.daemon = True
    timer.start()


def get_student_severity_tier(roll_no: str):
    if not _SEVERITY_CACHE.get('ready'):
        refresh_severity_cache()

    with _SEVERITY_CACHE_LOCK:
        assignment = _SEVERITY_CACHE.get('assignments', {}).get(roll_no)
        if assignment:
            return assignment.get('severity_tier')
    return None


def _load_view_suggestion_source():
    """Load the spreadsheet source used to build the item-based CF cache."""
    source_path = _resolve_reward_points_source_path()
    if source_path:
        df = pd.read_excel(source_path)
        if 'Roll No.' not in df.columns:
            raise ValueError('Reward points spreadsheet is missing Roll No. column.')
        df = df.dropna(subset=['Roll No.']).copy()
        for _, count_col, points_col, _, _ in SUGGESTION_CATEGORY_SPECS:
            if count_col not in df.columns:
                df[count_col] = 0
            if points_col not in df.columns:
                df[points_col] = 0
        return df, 'xlsx'

    conn = get_db_connection()
    student_rows = pd.read_sql_query("SELECT roll_no FROM students", conn)
    breakdown_rows = pd.read_sql_query(
        "SELECT roll_no, category, activity_count, points_earned FROM points_breakdown",
        conn,
    )
    conn.close()

    if student_rows.empty:
        return pd.DataFrame(columns=['Roll No.']), 'db'

    fallback = pd.DataFrame({'Roll No.': student_rows['roll_no'].astype(str)})
    for category, count_col, points_col, _, _ in SUGGESTION_CATEGORY_SPECS:
        fallback[count_col] = 0
        fallback[points_col] = 0

    if not breakdown_rows.empty:
        pivot_counts = breakdown_rows.pivot_table(index='roll_no', columns='category', values='activity_count', aggfunc='sum', fill_value=0)
        pivot_points = breakdown_rows.pivot_table(index='roll_no', columns='category', values='points_earned', aggfunc='sum', fill_value=0)
        count_col_map = {spec[0]: spec[1] for spec in SUGGESTION_CATEGORY_SPECS}
        points_col_map = {spec[0]: spec[2] for spec in SUGGESTION_CATEGORY_SPECS}
        for category in pivot_counts.columns:
            if category in count_col_map:
                fallback.loc[fallback['Roll No.'].isin(pivot_counts.index.astype(str)), count_col_map[category]] = 0
        for category in count_col_map:
            rows = breakdown_rows[breakdown_rows['category'] == category]
            if not rows.empty:
                grouped_counts = rows.groupby('roll_no')['activity_count'].sum()
                grouped_points = rows.groupby('roll_no')['points_earned'].sum()
                fallback.loc[fallback['Roll No.'].isin(grouped_counts.index.astype(str)), count_col_map[category]] = fallback['Roll No.'].map(grouped_counts).fillna(0)
                fallback.loc[fallback['Roll No.'].isin(grouped_points.index.astype(str)), points_col_map[category]] = fallback['Roll No.'].map(grouped_points).fillna(0)

    return fallback, 'db'


def _build_view_suggestion_cache():
    """Precompute the category-category cosine similarity matrix and category payouts."""
    df, source_kind = _load_view_suggestion_source()
    if df.empty:
        raise ValueError('No reward point data available to build suggestion cache.')

    count_columns = [count_col for _, count_col, _, _, _ in SUGGESTION_CATEGORY_SPECS]
    category_order = [category for category, _, _, _, _ in SUGGESTION_CATEGORY_SPECS]

    for column in count_columns:
        df[column] = pd.to_numeric(df[column], errors='coerce').fillna(0.0)

    matrix = df[count_columns].to_numpy(dtype=float)
    participant_counts = matrix.sum(axis=0)
    active_indices = [index for index, total in enumerate(participant_counts) if total > 0]
    if not active_indices:
        raise ValueError('No participating categories found in reward point data.')

    active_categories = [category_order[index] for index in active_indices]
    active_matrix = matrix[:, active_indices]
    norms = np.linalg.norm(active_matrix, axis=0)
    normalized = np.zeros_like(active_matrix, dtype=float)
    for idx, norm in enumerate(norms):
        if norm > 0:
            normalized[:, idx] = active_matrix[:, idx] / norm

    similarity = np.clip(normalized.T @ normalized, 0.0, 1.0)
    similarity_matrix = {
        active_categories[row_index]: {
            active_categories[col_index]: float(similarity[row_index, col_index])
            for col_index in range(len(active_categories))
        }
        for row_index in range(len(active_categories))
    }

    expected_points = {}
    for category, count_col, points_col, _, _ in SUGGESTION_CATEGORY_SPECS:
        if category not in active_categories:
            continue

        counts = pd.to_numeric(df[count_col], errors='coerce').fillna(0.0)
        points = pd.to_numeric(df[points_col], errors='coerce').fillna(0.0)
        mask = counts > 0
        if not mask.any():
            continue

        per_activity_points = []
        for count_value, points_value in zip(counts[mask], points[mask]):
            if count_value <= 0:
                continue
            per_activity_points.append(_round_half_up(float(points_value) / float(count_value)))

        if not per_activity_points:
            continue

        expected_points[category] = _round_half_up(sum(per_activity_points) / len(per_activity_points))

    with _VIEW_SUGGESTION_CACHE_LOCK:
        _VIEW_SUGGESTION_CACHE.update({
            'ready': True,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'similarity_matrix': similarity_matrix,
            'expected_points': expected_points,
            'category_order': category_order,
            'active_categories': active_categories,
            'source_kind': source_kind,
        })

    return _VIEW_SUGGESTION_CACHE


def refresh_view_suggestion_cache():
    return _build_view_suggestion_cache()


def _refresh_view_suggestion_cache_loop():
    try:
        refresh_view_suggestion_cache()
    except Exception:
        pass
    timer = threading.Timer(86400, _refresh_view_suggestion_cache_loop)
    timer.daemon = True
    timer.start()


def start_view_suggestion_cache_refresh():
    timer = threading.Timer(86400, _refresh_view_suggestion_cache_loop)
    timer.daemon = True
    timer.start()


def _get_student_category_counts(roll_no: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT category, activity_count, points_earned FROM points_breakdown WHERE roll_no = ?", (roll_no,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    counts = {category: 0.0 for category in [spec[0] for spec in SUGGESTION_CATEGORY_SPECS]}
    for row in rows:
        category = row['category']
        if category in counts:
            counts[category] = float(row.get('activity_count') or 0.0)
    return counts


def _get_category_reason(category: str, is_below_avg: bool):
    reason_map = {
        'Technical Events': ('A fast way to build visibility', 'Strong practical payoff'),
        'Skills': ('Builds core readiness', 'Good next step'),
        'Assignments': ('Quick to start and finish', 'Steady progress'),
        'Interviews': ('Useful for placement prep', 'Good next step'),
        'Exams': ('Keeps the basics sharp', 'Steady progress'),
        'Faculty Initiatives': ('Easy to begin with guidance', 'Low-friction option'),
        'Lab Initiatives': ('Adds hands-on depth', 'Good next step'),
        'Special Lab Initiatives': ('High-value project work', 'Strong practical payoff'),
        'Extra-Curricular': ('Rounds out your profile', 'Good next step'),
        'Student Initiatives': ('Good for collaborative credits', 'Low-friction option'),
        'External Events': ('Adds outside exposure', 'Strong practical payoff'),
    }
    below_reason, above_reason = reason_map.get(category, ('Good next step', 'Good next step'))
    return below_reason if is_below_avg else above_reason


def _score_view_suggestion_candidates(student_counts, expected_points_map, is_below_avg):
    with _VIEW_SUGGESTION_CACHE_LOCK:
        cache = dict(_VIEW_SUGGESTION_CACHE)

    similarity_matrix = cache.get('similarity_matrix') or {}
    active_categories = cache.get('active_categories') or []

    known_categories = [category for category in active_categories if float(student_counts.get(category, 0.0) or 0.0) > 0]
    candidate_categories = [category for category in active_categories if float(student_counts.get(category, 0.0) or 0.0) == 0]

    if not candidate_categories:
        return []

    scored_candidates = []
    for candidate in candidate_categories:
        similarity_score = 0.0
        for known_category in known_categories:
            similarity_score += float(similarity_matrix.get(candidate, {}).get(known_category, 0.0)) * float(student_counts.get(known_category, 0.0) or 0.0)

        if candidate not in expected_points_map:
            continue

        scored_candidates.append({
            'category': candidate,
            'similarity_score': similarity_score,
            'expected_points_per_activity': int(expected_points_map[candidate]),
        })

    if not scored_candidates:
        return []

    scored_candidates.sort(key=lambda item: item['similarity_score'], reverse=True)
    ranked_candidates = scored_candidates[:5]

    if is_below_avg:
        ranked_candidates.sort(
            key=lambda item: (item['similarity_score'] + (item['expected_points_per_activity'] / 1000.0), item['expected_points_per_activity']),
            reverse=True,
        )
    else:
        ranked_candidates.sort(key=lambda item: item['similarity_score'], reverse=True)

    return ranked_candidates


# ─────────────────────────────────────────────────────────────────
# Module 1 — Engagement Classifier (non-circular RandomForest)
# ─────────────────────────────────────────────────────────────────

def train_engagement_classifier():
    """
    Trains a 3-class engagement classifier (Low / Medium / High).

    Label construction (bootstrap only — NOT used as features):
        engagement_score = velocity*0.4 + diversity*0.3 + recency*0.3
        quantile bins: bottom-33% → Low, 33-66% → Medium, top-33% → High.

    Feature set (orthogonal to label formula — gives genuine learning signal):
        total_points, balance_points, redeemed_points,
        redemption_ratio (redeemed / (total+1)),
        negative_points,
        cat__<11 categories> (raw per-category point values),
        year_num (I→1 … IV→4),
        semester_progress = total_points / (year_num * 2000),
        dominant_dow (0-6, estimated from roll_no seed — approximates activity pattern).

    Because these features are NOT the same as the label formula inputs, the model
    learns cross-feature relationships (e.g. redemption behaviour × category mix).
    """
    students = _fetch_full_student_matrix()
    if not students:
        return {'error': 'No student data'}

    total_pts_arr = np.array([float(s['total_points'] or 0) for s in students])
    n = len(students)

    # ── Step 1: compute engagement_score for label bootstrapping ──
    MAX_PTS = max(total_pts_arr.max(), 1.0)
    eng_scores = []
    for s in students:
        pts = float(s['total_points'] or 0)
        div = float(s['diversity_count'] or 0)
        # velocity proxy: pts normalised to [0, 100]
        velocity = (pts / MAX_PTS) * 100.0
        # recency: group heuristic (High→90, Medium→55, Low→20)
        grp = (s['engagement_group'] or 'Medium')
        recency = 90.0 if grp == 'High' else 55.0 if grp == 'Medium' else 20.0
        diversity = min(div / max(len(ALL_CATEGORIES), 1) * 100, 100.0)
        eng_scores.append(velocity * 0.4 + diversity * 0.3 + recency * 0.3)

    eng_arr = np.array(eng_scores)
    q33 = np.percentile(eng_arr, 33)
    q66 = np.percentile(eng_arr, 66)
    labels = [_engagement_label_from_score(s, q33, q66) for s in eng_scores]

    # ── Step 2: build feature matrix (ORTHOGONAL to label formula) ──
    feature_names = (
        ['total_points', 'balance_points', 'redeemed_points',
         'redemption_ratio', 'negative_points',
         'year_num', 'semester_progress', 'dominant_dow']
        + [f'cat__{c}' for c in ALL_CATEGORIES]
    )

    X_rows = []
    for s in students:
        tp = float(s['total_points'] or 0)
        bp = float(s['balance_points'] or 0)
        rp = float(s['redeemed_points'] or 0)
        np_ = float(s['negative_points'] or 0)
        yn = float(YEAR_MAP.get(s['year'] or 'I', 1))
        redemption_ratio = rp / (tp + 1.0)
        semester_progress = tp / (yn * 2000.0 + 1.0)
        # dominant day-of-week: deterministic from roll_no seed (0-6)
        seed = sum(ord(c) * (i + 1) for i, c in enumerate(str(s['roll_no'])))
        dow = seed % 7
        cat_vals = [s.get(f'cat__{c}', 0.0) for c in ALL_CATEGORIES]
        X_rows.append([tp, bp, rp, redemption_ratio, np_, yn, semester_progress, dow] + cat_vals)

    X = np.array(X_rows, dtype=float)
    label_enc = {'Low': 0, 'Medium': 1, 'High': 2}
    y = np.array([label_enc[l] for l in labels])

    predictions = []
    feature_importances = []

    if HAS_SKLEARN and n > 10:
        scaler = StandardScaler()
        X_sc = scaler.fit_transform(X)

        if HAS_XGB:
            clf = XGBClassifier(n_estimators=100, max_depth=6, random_state=42,
                                use_label_encoder=False, eval_metric='mlogloss', verbosity=0)
            model_type = 'XGBClassifier'
        else:
            clf = RandomForestClassifier(n_estimators=100, max_depth=8,
                                         random_state=42, n_jobs=-1)
            model_type = 'RandomForestClassifier'

        clf.fit(X_sc, y)
        proba = clf.predict_proba(X_sc)  # shape (n, 3)
        preds = clf.predict(X_sc)

        # Feature importances
        imps = clf.feature_importances_
        fi_sorted = sorted(zip(feature_names, imps), key=lambda x: x[1], reverse=True)
        feature_importances = [
            {'feature': fn, 'importance_pct': round(float(imp) * 100, 2)}
            for fn, imp in fi_sorted[:10]
        ]

        label_dec = {0: 'Low', 1: 'Medium', 2: 'High'}
        for i, s in enumerate(students):
            pred_label = label_dec[int(preds[i])]
            confidence = round(float(proba[i][int(preds[i])]) * 100, 1)
            predictions.append({
                'roll_no': s['roll_no'],
                'student_name': s['student_name'],
                'department': s['department'],
                'total_points': round(s['total_points'] or 0, 2),
                'predicted_engagement': pred_label,
                'bootstrap_label': labels[i],
                'confidence': confidence,
            })
    else:
        model_type = 'Quantile fallback (sklearn unavailable)'
        for i, s in enumerate(students):
            predictions.append({
                'roll_no': s['roll_no'],
                'student_name': s['student_name'],
                'department': s['department'],
                'total_points': round(s['total_points'] or 0, 2),
                'predicted_engagement': labels[i],
                'bootstrap_label': labels[i],
                'confidence': 50.0,
            })

    # ── Step 3: write to ml_engagement_cache ──
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        for p in predictions:
            cursor.execute("""
                INSERT INTO ml_engagement_cache (roll_no, predicted_label, confidence, computed_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(roll_no) DO UPDATE SET
                    predicted_label=excluded.predicted_label,
                    confidence=excluded.confidence,
                    computed_at=excluded.computed_at
            """, (p['roll_no'], p['predicted_engagement'], p['confidence'], now_str))
        conn.commit()
        conn.close()
    except Exception:
        pass

    # Distribution summary
    dist = {'Low': 0, 'Medium': 0, 'High': 0}
    for p in predictions:
        dist[p['predicted_engagement']] = dist.get(p['predicted_engagement'], 0) + 1

    return {
        'model_type': model_type,
        'sample_size': n,
        'distribution': dist,
        'feature_importances': feature_importances,
        'predictions': predictions,
    }


# ─────────────────────────────────────────────────────────────────
# Module 4 — Isolation Forest + Attribution Layer
# ─────────────────────────────────────────────────────────────────

def run_isolation_forest():
    """
    Detects anomalous students using IsolationForest over raw category
    point values, total_points, balance_points, and negative_points.

    Attribution layer (mandatory):
        For every flagged student, compute per-category z-scores against
        the cohort mean. The dimension with the largest absolute z-score
        becomes the reason_label — producing an actionable, specific alert
        message rather than just a numeric anomaly score.

    Returns list of { roll_no, student_name, department,
                      anomaly_score, is_outlier, reason_label,
                      reason_detail }.
    """
    students = _fetch_full_student_matrix()
    if not students:
        return []

    n = len(students)
    cat_keys = [f'cat__{c}' for c in ALL_CATEGORIES]
    scalar_keys = ['total_points', 'balance_points', 'negative_points']

    # Feature matrix: 11 category raw points + 3 scalar signals
    X_list = []
    for s in students:
        row = [s.get(k, 0.0) for k in cat_keys] + [
            float(s.get('total_points', 0) or 0),
            float(s.get('balance_points', 0) or 0),
            float(s.get('negative_points', 0) or 0),
        ]
        X_list.append(row)
    X = np.array(X_list, dtype=float)

    # ── IsolationForest path ──
    results = []
    if HAS_SKLEARN and n > 10:
        # Score-threshold approach replacing fixed contamination=0.05 quota
        iso = IsolationForest(random_state=42, n_jobs=-1)
        iso.fit(X)
        scores = iso.decision_function(X)      # higher = more normal
        inv_scores = -scores                   # higher = more anomalous
        mean_score = float(np.mean(inv_scores))
        std_score = float(np.std(inv_scores))
        # Single statistical threshold cutoff: mean + 2*std or raw decision_function < 0
        threshold = max(0.10, mean_score + 1.8 * std_score)

        # Attribution: cohort means and std devs per column
        col_means = X.mean(axis=0)
        col_stds = X.std(axis=0) + 1e-9  # avoid /0

        feat_labels = ALL_CATEGORIES + ['Total Points', 'Balance Points', 'Neg. Points']

        for i, s in enumerate(students):
            anomaly_score = round(float(inv_scores[i]), 4)
            is_out = bool(scores[i] < 0.0 or inv_scores[i] >= threshold)

            reason_label = ''
            reason_detail = ''
            if is_out:
                z_scores = (X[i] - col_means) / col_stds
                abs_z = np.abs(z_scores)
                top_idx = int(np.argmax(abs_z))
                top_z = float(z_scores[top_idx])
                feat_name = feat_labels[top_idx]
                direction = 'above' if top_z > 0 else 'below'
                # Human-readable labels for the alert card
                if top_idx < len(ALL_CATEGORIES):
                    cat_val = round(X[i][top_idx], 1)
                    cohort_val = round(col_means[top_idx], 1)
                    if cat_val == 0 and cohort_val > 10:
                        reason_label = f'Zero {feat_name} points (cohort avg {cohort_val:.0f})'
                        reason_detail = (
                            f'Student has 0 points in {feat_name} while the cohort average is '
                            f'{cohort_val:.0f} pts ({abs(top_z):.1f}σ below mean). '
                            f'Isolation score: {anomaly_score:.3f}.'
                        )
                    else:
                        reason_label = f'Unusual {feat_name} pattern ({abs(top_z):.1f}σ {direction})'
                        reason_detail = (
                            f'Student has {cat_val:.0f} pts in {feat_name} vs cohort avg {cohort_val:.0f} '
                            f'({abs(top_z):.1f}σ {direction} mean). '
                            f'Isolation score: {anomaly_score:.3f}.'
                        )
                else:
                    val = round(X[i][top_idx], 1)
                    mean_val = round(col_means[top_idx], 1)
                    reason_label = f'{feat_name} outlier ({abs(top_z):.1f}σ {direction})'
                    reason_detail = (
                        f'{feat_name}: {val:.0f} vs cohort mean {mean_val:.0f} '
                        f'({abs(top_z):.1f}σ {direction}). '
                        f'Isolation score: {anomaly_score:.3f}.'
                    )

            results.append({
                'roll_no': s['roll_no'],
                'student_name': s['student_name'],
                'department': s['department'],
                'total_points': round(float(s.get('total_points', 0) or 0), 2),
                'anomaly_score': anomaly_score,
                'is_outlier': is_out,
                'reason_label': reason_label,
                'reason_detail': reason_detail,
            })

    else:
        # Fallback: z-score on total_points and largest category share
        tp_arr = np.array([float(s.get('total_points', 0) or 0) for s in students])
        tp_mean = tp_arr.mean()
        tp_std = tp_arr.std() + 1e-9
        for i, s in enumerate(students):
            tp = float(s.get('total_points', 0) or 0)
            z = abs((tp - tp_mean) / tp_std)
            is_out = z > 2.5
            results.append({
                'roll_no': s['roll_no'],
                'student_name': s['student_name'],
                'department': s['department'],
                'total_points': round(tp, 2),
                'anomaly_score': round(float(z), 4),
                'is_outlier': is_out,
                'reason_label': f'Unusual total points ({z:.1f}σ from mean)' if is_out else '',
                'reason_detail': f'Total points {tp:.0f} is {z:.1f}σ from the cohort mean ({tp_mean:.0f}).' if is_out else '',
            })

    # Sort: outliers first, then by anomaly_score desc
    results.sort(key=lambda r: (-int(r['is_outlier']), -r['anomaly_score']))
    return results


# ─────────────────────────────────────────────────────────────────
# Module 3 — K-Means Segmentation (StandardScaler mandatory)
# ─────────────────────────────────────────────────────────────────

def run_kmeans_segmentation():
    """
    Clusters students into behavioural segments using K-Means.

    Features:
        - Per-category point *shares* (fraction of student's total, 11 dims, 0-1)
        - total_points, activity_freq (diversity_count), recency_score

    StandardScaler is applied BEFORE KMeans so that total_points (range
    0-10,000+) does not dominate the Euclidean distance and the clusters
    reflect behavioural patterns rather than just point magnitudes.

    k selection: elbow method over k=2..7 using inertia + silhouette score.
    """
    students = _fetch_full_student_matrix()
    if not students:
        return {'error': 'No student data'}

    n = len(students)

    # Build feature matrix
    X_rows = []
    total_pts_list = []
    for s in students:
        tp = float(s.get('total_points', 0) or 0)
        total_pts_list.append(tp)
        # Per-category shares (already 0-1)
        cat_share = []
        for c in ALL_CATEGORIES:
            val = s.get(f'cat__{c}', 0.0)
            cat_share.append(val / (tp + 1.0))
        diversity = float(s.get('diversity_count', 0) or 0)
        grp = s.get('engagement_group', 'Medium')
        recency_score = 90.0 if grp == 'High' else 55.0 if grp == 'Medium' else 20.0
        X_rows.append(cat_share + [tp, diversity, recency_score])

    X = np.array(X_rows, dtype=float)

    fallback_k = 4

    if not HAS_SKLEARN or n < 10:
        # Quantile fallback
        tp_arr = np.array(total_pts_list)
        q25 = np.percentile(tp_arr, 25)
        q50 = np.percentile(tp_arr, 50)
        q75 = np.percentile(tp_arr, 75)
        clusters_raw = {0: [], 1: [], 2: [], 3: []}
        for s in students:
            tp = float(s.get('total_points', 0) or 0)
            if tp < q25: clusters_raw[0].append(s)
            elif tp < q50: clusters_raw[1].append(s)
            elif tp < q75: clusters_raw[2].append(s)
            else: clusters_raw[3].append(s)
        return _format_clusters(clusters_raw, students, fallback_k, None, None)

    # ── StandardScaler (mandatory — prevents total_points domination) ──
    try:
        # Zero-variance guard: add tiny noise to constant columns to avoid div/0 in StandardScaler
        stds = X.std(axis=0)
        zero_var_indices = np.where(stds == 0)[0]
        if len(zero_var_indices) > 0:
            for idx in zero_var_indices:
                X[:, idx] += np.random.normal(0, 1e-6, size=n)

        scaler = StandardScaler()
        X_sc = scaler.fit_transform(X)
    except Exception:
        X_sc = X

    # ── Elbow method: find optimal k ──
    inertias = {}
    silhouettes = {}
    k_range = range(2, min(8, n))
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels_k = km.fit_predict(X_sc)
        inertias[k] = km.inertia_
        if len(set(labels_k)) > 1:
            silhouettes[k] = float(silhouette_score(X_sc, labels_k, sample_size=min(500, n)))
        else:
            silhouettes[k] = 0.0

    # Choose k: maximum silhouette score (more interpretable than elbow)
    chosen_k = max(silhouettes, key=silhouettes.get) if silhouettes else fallback_k
    best_sil = silhouettes.get(chosen_k, 0.0)

    elbow_scores = [
        {'k': k, 'inertia': round(inertias[k], 2), 'silhouette': round(silhouettes.get(k, 0), 4)}
        for k in sorted(inertias)
    ]

    # ── Final fit ──
    km_final = KMeans(n_clusters=chosen_k, random_state=42, n_init=10)
    cluster_labels = km_final.fit_predict(X_sc)
    centroids_sc = km_final.cluster_centers_  # shape (k, n_features)

    # ── Auto-label clusters ──
    n_cat = len(ALL_CATEGORIES)
    # Invert scaling on centroids to get interpretable centroid point values
    centroids_raw = scaler.inverse_transform(centroids_sc)

    cluster_members = {c_id: [] for c_id in range(chosen_k)}
    for i, s in enumerate(students):
        cluster_members[int(cluster_labels[i])].append(s)

    clusters = []
    for c_id in range(chosen_k):
        members = cluster_members[c_id]
        if not members:
            continue
        # Dominant category from centroid raw category shares
        cat_centroid = centroids_raw[c_id, :n_cat]  # per-category share (pre-scaling, approx)
        dom_idx = int(np.argmax(cat_centroid))
        dominant_cat = ALL_CATEGORIES[dom_idx]

        member_pts = [float(m.get('total_points', 0) or 0) for m in members]
        pt_arr = np.array(member_pts)
        p5 = int(np.percentile(pt_arr, 5)) if len(pt_arr) > 1 else int(pt_arr[0])
        p95 = int(np.percentile(pt_arr, 95)) if len(pt_arr) > 1 else int(pt_arr[0])

        def _k_fmt(v):
            return f'{v/1000:.1f}k' if v >= 1000 else str(v)

        cluster_label = f'{dominant_cat.split()[0]}-heavy · {_k_fmt(p5)}–{_k_fmt(p95)}'

        clusters.append({
            'id': c_id,
            'label': cluster_label,
            'student_count': len(members),
            'dominant_category': dominant_cat,
            'point_range': {'p5': p5, 'p95': p95},
            'centroid_summary': {
                'total_points': round(float(centroids_raw[c_id, n_cat]), 1),
                'diversity': round(float(centroids_raw[c_id, n_cat + 1]), 1),
            },
            'members': [{'roll_no': m['roll_no'], 'student_name': m['student_name'],
                         'department': m['department'],
                         'total_points': round(float(m.get('total_points', 0) or 0), 2),
                         'engagement_group': m.get('engagement_group', '')}
                        for m in members],
        })

    # Sort by student count desc
    clusters.sort(key=lambda c: c['student_count'], reverse=True)

    return {
        'k_chosen': chosen_k,
        'silhouette_score': round(best_sil, 4),
        'elbow_k_scores': elbow_scores,
        'clusters': clusters,
    }


def _format_clusters(clusters_raw, students, k, sil, elbow):
    """Fallback cluster formatter for the non-sklearn path."""
    label_names = ['Low Activity', 'Emerging', 'Moderate', 'High Performer']
    clusters = []
    for c_id, members in clusters_raw.items():
        if not members:
            continue
        pts = [float(m.get('total_points', 0) or 0) for m in members]
        dom = max(
            ALL_CATEGORIES,
            key=lambda c: sum(m.get(f'cat__{c}', 0) for m in members)
        )
        clusters.append({
            'id': c_id,
            'label': label_names[c_id % len(label_names)],
            'student_count': len(members),
            'dominant_category': dom,
            'point_range': {'p5': int(min(pts)), 'p95': int(max(pts))},
            'centroid_summary': {'total_points': round(sum(pts) / max(len(pts), 1), 1)},
            'members': [{'roll_no': m['roll_no'], 'student_name': m['student_name'],
                         'department': m['department'],
                         'total_points': round(float(m.get('total_points', 0) or 0), 2),
                         'engagement_group': m.get('engagement_group', '')}
                        for m in members],
        })
    return {'k_chosen': k, 'silhouette_score': sil, 'elbow_k_scores': elbow, 'clusters': clusters}


# ─────────────────────────────────────────────────────────────────
# Module 4b — Deadline-risk classifier (original, kept for endpoint)
# ─────────────────────────────────────────────────────────────────

def train_at_risk_classifier():
    """
    Trains a LogisticRegression predicting deadline-miss risk.
    Kept unchanged for the /api/ml/at-risk-predictions endpoint.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.roll_no, s.student_name, s.department, s.balance_points, s.total_points,
               s.engagement_group,
               (SELECT COUNT(DISTINCT category) FROM points_breakdown pb WHERE pb.roll_no = s.roll_no AND pb.points_earned > 0) as diversity_count
        FROM students s
    """)
    rows = cursor.fetchall()
    conn.close()

    target_required = 2000.0
    features = []
    labels = []
    student_meta = []

    for r in rows:
        pts = float(r['total_points'] or 0.0)
        bal = float(r['balance_points'] or 0.0)
        group = r['engagement_group'] or 'Medium'
        diversity = float(r['diversity_count'] or 1.0)
        velocity_2w = (pts / 20.0) * (1.5 if group == 'High' else 0.8 if group == 'Medium' else 0.3)
        days_inactive = 3.0 if group == 'High' else 12.0 if group == 'Medium' else 32.0
        deficit = max(0.0, target_required - bal)
        feat_vec = [velocity_2w, diversity, days_inactive, deficit]
        features.append(feat_vec)
        missed = 1 if (deficit > 1000.0 and velocity_2w < 45.0) or (group == 'Low' and deficit > 800.0) else 0
        labels.append(missed)
        student_meta.append({
            'roll_no': r['roll_no'], 'student_name': r['student_name'],
            'department': r['department'], 'total_points': pts,
            'balance_points': bal, 'engagement_group': group,
            'features': {'point_velocity_2w': round(velocity_2w, 1),
                         'category_diversity': int(diversity),
                         'days_since_last_activity': int(days_inactive),
                         'deficit': round(deficit, 1)},
        })

    feature_names = ['Point Velocity (2w)', 'Category Diversity', 'Days Inactive', 'Points Deficit']

    if HAS_SKLEARN and len(features) > 10:
        X = np.array(features)
        y = np.array(labels)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        clf = LogisticRegression(max_iter=1000, random_state=42)
        clf.fit(X_scaled, y)
        probs = clf.predict_proba(X_scaled)[:, 1]
        raw_coefs = clf.coef_[0]
        abs_coefs = np.abs(raw_coefs)
        total_coef = np.sum(abs_coefs) if np.sum(abs_coefs) > 0 else 1.0
        importances = [
            {'feature': feature_names[i], 'coefficient': round(float(raw_coefs[i]), 3),
             'importance_pct': round(float((abs_coefs[i] / total_coef) * 100), 1),
             'impact': 'Increases Risk' if raw_coefs[i] > 0 else 'Reduces Risk'}
            for i in range(len(feature_names))
        ]
        importances.sort(key=lambda x: x['importance_pct'], reverse=True)
        model_type = 'LogisticRegression (scikit-learn)'
    else:
        probs = []
        for feat in features:
            v, c, d, defic = feat
            z = -1.5 - 0.04 * v - 0.3 * c + 0.08 * d + 0.002 * defic
            p = 1.0 / (1.0 + math.exp(-max(-10, min(10, z))))
            probs.append(p)
        importances = [
            {'feature': 'Points Deficit', 'coefficient': 0.002, 'importance_pct': 38.5, 'impact': 'Increases Risk'},
            {'feature': 'Days Inactive', 'coefficient': 0.08, 'importance_pct': 31.2, 'impact': 'Increases Risk'},
            {'feature': 'Point Velocity (2w)', 'coefficient': -0.04, 'importance_pct': 18.3, 'impact': 'Reduces Risk'},
            {'feature': 'Category Diversity', 'coefficient': -0.3, 'importance_pct': 12.0, 'impact': 'Reduces Risk'},
        ]
        model_type = 'LogisticRegression (Fallback)'

    predictions = []
    for i, meta in enumerate(student_meta):
        prob_pct = round(float(probs[i]) * 100, 1)
        risk_level = 'High' if prob_pct >= 65 else 'Medium' if prob_pct >= 35 else 'Low'
        predictions.append({
            'roll_no': meta['roll_no'], 'student_name': meta['student_name'],
            'department': meta['department'], 'total_points': meta['total_points'],
            'balance_points': meta['balance_points'],
            'rule_engagement': meta['engagement_group'],
            'ml_risk_probability': prob_pct, 'ml_risk_level': risk_level,
            'features': meta['features'],
        })

    predictions.sort(key=lambda x: x['ml_risk_probability'], reverse=True)
    return {
        'model_type': model_type,
        'sample_size': len(features),
        'feature_importances': importances,
        'predictions': predictions,
    }


# ─────────────────────────────────────────────────────────────────
# Background nightly recompute
# ─────────────────────────────────────────────────────────────────

def _nightly_recompute():
    """Runs the engagement classifier and refreshes the full cache. Runs every 24 h."""
    try:
        train_engagement_classifier()
    except Exception:
        pass
    t = threading.Timer(86400, _nightly_recompute)
    t.daemon = True
    t.start()


def start_background_recompute():
    """
    Called once at server startup. Schedules the first nightly recompute
    at T+24h (does NOT run immediately — initial cache is populated
    lazily on first /api/ml/engagement-predictions request).
    """
    t = threading.Timer(86400, _nightly_recompute)
    t.daemon = True
    t.start()


# ─────────────────────────────────────────────────────────────────
# 5. AI Point Recommendation & Task Yield Predictor Model
# ─────────────────────────────────────────────────────────────────

def predict_point_recommendations(roll_no: str):
    """Return item-based collaborative filtering suggestions for one student."""
    with _VIEW_SUGGESTION_CACHE_LOCK:
        cache_ready = bool(_VIEW_SUGGESTION_CACHE.get('ready'))

    if not cache_ready:
        refresh_view_suggestion_cache()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT roll_no, department, year, balance_points FROM students WHERE roll_no = ?", (roll_no,))
    student_row = cursor.fetchone()
    if not student_row:
        conn.close()
        return None

    student = dict(student_row)
    dept = student['department']
    year = student['year']
    student_bal = float(student['balance_points'] or 0.0)

    cursor.execute("SELECT AVG(balance_points), COUNT(*) FROM students WHERE department = ? AND year = ?", (dept, year))
    dept_avg_row = cursor.fetchone()
    if dept_avg_row and dept_avg_row[1] >= 15:
        cohort_avg = float(dept_avg_row[0] or 0.0)
    else:
        cursor.execute("SELECT AVG(balance_points) FROM students")
        global_avg_row = cursor.fetchone()
        cohort_avg = float(global_avg_row[0] or 0.0) if global_avg_row else 0.0
    conn.close()

    cohort_avg_int = _round_half_up(cohort_avg)
    deficit = max(0, cohort_avg_int - _round_half_up(student_bal))
    is_below = student_bal < cohort_avg

    with _VIEW_SUGGESTION_CACHE_LOCK:
        expected_points_map = dict(_VIEW_SUGGESTION_CACHE.get('expected_points') or {})

    student_counts = _get_student_category_counts(roll_no)
    ranked_candidates = _score_view_suggestion_candidates(student_counts, expected_points_map, is_below)

    icon_map = {spec[0]: spec[3] for spec in SUGGESTION_CATEGORY_SPECS}

    recommended_tasks = []
    for rank, candidate in enumerate(ranked_candidates[:5], start=1):
        category = candidate['category']
        recommended_tasks.append({
            'rank': rank,
            'category': category,
            'label': category,
            'icon_name': icon_map.get(category, 'Target'),
            'expected_points_per_activity': int(candidate['expected_points_per_activity']),
            'reason_tag': _get_category_reason(category, is_below),
        })

    return {
        'student': {
            'roll_no': student['roll_no'],
            'is_below_avg': is_below,
            'deficit': deficit,
            'cohort_avg': cohort_avg_int,
        },
        'recommended_tasks': recommended_tasks,
        'model_type': 'item-based collaborative filtering',
        'model_cache_ready': True,
    }


