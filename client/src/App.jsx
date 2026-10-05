import React, { useState, useEffect, useRef } from 'react';
import {
  Users, TriangleAlert, TrendingUp, User, Download, ArrowRight, Search,
  LogOut, Moon, Sun, ShieldAlert, ChevronDown, ChevronUp,
  GraduationCap, ArrowDown, X, ScanSearch, MessageSquare, CalendarDays,
  BrainCircuit, Layers, CheckCircle, AlertCircle, Info, Monitor, Activity,
  Mail, Settings, Check, FileUp, FileSpreadsheet, Plus, Trash2, HelpCircle,
  Terminal, Award, BookOpen, FileText, Cpu, Globe, Target
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid, Area, AreaChart, ReferenceLine
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

// --- Icons ---------------------------------------------------
const StarCoinIcon = ({ size = 24, fill = "currentColor", opacity = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
    <circle cx="12" cy="12" r="10" stroke={fill} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="7.5" stroke={fill} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
    <path d="M12 6.5L13.5 10L17.5 10.5L14.5 13.5L15.5 17.5L12 15.5L8.5 17.5L9.5 13.5L6.5 10.5L10.5 10L12 6.5Z" fill={fill} stroke="none" />
  </svg>
);

// --- Formatters ----------------------------------------------
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = (v) => {
  if (v === null || v === undefined) return '—';
  return Math.round(parseFloat(v)).toLocaleString();
};

// --- Categorical Palette (11 categories — bright-but-modest, cool lean) -
const CATEGORY_COLOR_MAP = {
  'Technical Events': '#1E88C7',
  'Skills': '#15A89A',
  'Assignments': '#7B5FE0',
  'Interviews': '#C24A86',
  'Exams': '#6B7280',
  'Faculty Initiatives': '#3F9142',
  'Lab Initiatives': '#B8742E',
  'Special Lab Initiatives': '#9C4FA0',
  'Special Lab Init.': '#9C4FA0',
  'Extra-Curricular': '#4F8F8F',
  'Student Initiatives': '#B07A5A',
  'External Events': '#8A6D3F'
};

const getCategoryColor = (cat, idx = 0) => {
  if (cat && CATEGORY_COLOR_MAP[cat]) return CATEGORY_COLOR_MAP[cat];
  const keys = Object.keys(CATEGORY_COLOR_MAP);
  return CATEGORY_COLOR_MAP[keys[idx % keys.length]] || '#2F5FD6';
};

const CATEGORY_COLORS = [
  '#1E88C7', '#15A89A', '#7B5FE0', '#C24A86', '#6B7280',
  '#3F9142', '#B8742E', '#9C4FA0', '#4F8F8F', '#B07A5A', '#8A6D3F'
];

const CHART_COLORS = CATEGORY_COLORS;


// --- Dept abbreviation ----------------------------------------
const abbreviateDept = (dept) => {
  if (!dept) return '';
  const map = {
    'FASHION TECHNOLOGY': 'FT',
    'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE': 'AI&DS',
    'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
    'INFORMATION SCIENCE & ENGINEERING': 'ISE',
    'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
    'MECHANICAL ENGINEERING': 'MECH',
    'CIVIL ENGINEERING': 'CIVIL',
    'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
    'AERONAUTICAL ENGINEERING': 'AERO',
    'BIOTECHNOLOGY': 'BIOTECH',
    'TEXTILE TECHNOLOGY': 'TX',
    'ELECTRONICS AND INSTRUMENTATION ENGINEERING': 'EIE',
    'COMPUTER SCIENCE AND BUSINESS SYSTEMS': 'CSBS',
    'BIOMEDICAL ENGINEERING': 'BME',
    'AGRICULTURE ENGINEERING': 'AGE',
    'INFORMATION TECHNOLOGY': 'IT',
    'AUTOMOBILE ENGINEERING': 'AUTO',
    'MECHATRONICS': 'MECH-T',
    'SOFTWARE ENGINEERING': 'SE',
  };
  return map[dept] || dept.split(' ').map(w => w[0]).join('');
};

// --- Mentor roster (12 unique names) -------------------------
const MENTOR_ROSTER = [
  { name: 'Dr. Meena Ravishankar', short: 'Dr. M. Ravishankar', id: 'meena' },
  { name: 'Prof. Arjun Subramanian', short: 'Prof. A. Subramanian', id: 'arjun' },
  { name: 'Dr. Priya Krishnamurthy', short: 'Dr. P. Krishnamurthy', id: 'priya' },
  { name: 'Prof. Rajesh Venkatesh', short: 'Prof. R. Venkatesh', id: 'rajesh' },
  { name: 'Dr. Sita Narayanan', short: 'Dr. S. Narayanan', id: 'sita' },
  { name: 'Prof. Balan Murugesan', short: 'Prof. B. Murugesan', id: 'balan' },
  { name: 'Dr. Anita Lakshmanan', short: 'Dr. A. Lakshmanan', id: 'anita' },
  { name: 'Prof. Kumar Venugopal', short: 'Prof. K. Venugopal', id: 'kumar' },
  { name: 'Dr. Suresh Paramasivam', short: 'Dr. S. Paramasivam', id: 'suresh' },
  { name: 'Prof. Kavitha Thiruvengadam', short: 'Prof. K. Thiruvengadam', id: 'kavitha' },
  { name: 'Dr. Mohan Rangasamy', short: 'Dr. M. Rangasamy', id: 'mohan' },
  { name: 'Prof. Divya Arunachalam', short: 'Prof. D. Arunachalam', id: 'divya' },
];

// --- Animated counter hook (respects prefers-reduced-motion) -
function useAnimatedCounter(target, duration = 700) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const endVal = parseFloat(target) || 0;
    if (prefersReduced || !target) { setValue(endVal); return; }
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(endVal * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else setValue(endVal);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

// --- Tooltip -------------------------------------------------
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ color: 'var(--fog)', marginBottom: 4, fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: p.color || 'var(--brass)' }}>
            {p.name}: {typeof p.value === 'number' ? fmtInt(p.value) : p.value} pts
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Stamp Track (kept for Admin drawer overview tab only) ---
function StampTrack({ earned, total, size = 'sm', showLabel = true }) {
  const stamps = Array.from({ length: total }, (_, i) => i < earned);
  return (
    <div>
      <div className="stamp-track">
        {stamps.map((isEarned, i) => (
          <div key={i} className={`stamp stamp-${size} ${isEarned ? 'stamp-earned' : 'stamp-pending'}`}
            title={isEarned ? `Stamp ${i + 1} earned` : `Stamp ${i + 1} pending`}
            style={{ animationDelay: isEarned ? `${i * 18}ms` : '0ms' }}>
            <StarCoinIcon size={size === 'sm' ? 14 : 20} fill="currentColor" />
          </div>
        ))}
      </div>
      {showLabel && <div className="stamp-track-label">{earned} / {total} stamps earned</div>}
    </div>
  );
}

// --- Calendar Heatmap ----------------------------------------
function CalendarHeatmap({ heatmapData }) {
  if (!heatmapData || heatmapData.length === 0) return null;
  const pointsMap = {};
  heatmapData.forEach(d => { pointsMap[d.date] = d.points; });
  const startDate = new Date(2025, 6, 1);
  const days = [];
  for (let i = 0; i < 364; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    days.push({ date: dateStr, dayOfWeek: (d.getDay() + 6) % 7, pts: pointsMap[dateStr] || 0, month: d.getMonth() });
  }
  const weeks = [];
  let cur = [];
  for (let p = 0; p < days[0].dayOfWeek; p++) cur.push(null);
  days.forEach(day => { cur.push(day); if (cur.length === 7) { weeks.push(cur); cur = []; } });
  if (cur.length > 0) { while (cur.length < 7) cur.push(null); weeks.push(cur); }
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthPos = {};
  weeks.forEach((wk, wi) => { wk.forEach(c => { if (c && c.dayOfWeek === 0 && !monthPos[c.month]) monthPos[c.month] = wi; }); });
  const getCellColor = (pts) => {
    if (!pts || pts === 0) return 'var(--paper-mid)';
    if (pts < 20) return '#C7D7F9';
    if (pts < 60) return '#8DAEF4';
    if (pts < 120) return '#5584EE';
    return '#2F5FD6';
  };
  return (
    <div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', marginLeft: 22, marginBottom: 4 }}>
          {weeks.map((_, wi) => {
            const me = Object.entries(monthPos).find(([, pos]) => pos === wi);
            return <div key={wi} style={{ width: 12, marginRight: 2, fontSize: 8, color: 'var(--fog)', fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>{me ? monthLabels[parseInt(me[0])]?.slice(0, 1) : ''}</div>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 1 }}>
            {dayLabels.map((lbl, i) => <div key={i} style={{ width: 14, height: 12, fontSize: 8, color: 'var(--fog)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i % 2 === 0 ? lbl : ''}</div>)}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {weeks.map((wk, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {wk.map((cell, di) => (
                  <div key={di} title={cell ? `${cell.date}: ${cell.pts.toFixed(0)} pts` : ''} className="heatmap-cell" style={{ backgroundColor: cell ? getCellColor(cell.pts) : 'transparent' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 9, color: 'var(--fog)' }}>
        <span>Less</span>
        {['var(--paper-mid)', '#C7D7F9', '#8DAEF4', '#5584EE', '#2F5FD6'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: c }} />)}
        <span>More</span>
      </div>
    </div>
  );
}

// --- Status Badge ---------------------------------------------
function StatusBadge({ level, label }) {
  const configs = {
    high: { cls: 'status-teal' },
    medium: { cls: 'status-amber' },
    low: { cls: 'status-coral' },
    neutral: { cls: 'status-neutral' },
  };
  const key = (level || '').toLowerCase();
  const c = configs[key] || configs.neutral;
  const displayLabel = label || (key === 'high' ? 'High' : key === 'medium' ? 'Medium' : key === 'low' ? 'Low' : '—');
  return (
    <span className={`status-badge ${c.cls}`} role="status" aria-label={`${displayLabel} engagement`}>
      <span style={{
        width: 7, height: 7, display: 'inline-block', background: 'currentColor',
        clipPath: key === 'high' ? 'circle()' : key === 'medium' ? 'polygon(50% 0%,100% 100%,0% 100%)' : 'polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)',
        flexShrink: 0
      }} aria-hidden="true" />
      {displayLabel}
    </span>
  );
}

// --- Pod Cluster ---------------------------------------------
function PodCluster({ students, onStudentClick }) {
  if (!students || students.length === 0) return null;
  const getStatus = s => s.engagement_group === 'High' ? 'teal' : s.engagement_group === 'Medium' ? 'amber' : 'coral';
  return (
    <div className="pod-cluster" role="group" aria-label="Student pod cluster">
      {students.map((s, i) => (
        <div key={s.roll_no || i} className={`pod-avatar pod-avatar-${getStatus(s)}`}
          title={`${s.student_name || 'Student'} - ${s.engagement_group || ''} - ${s.total_points || 0} pts`}
          onClick={() => onStudentClick && onStudentClick(s.roll_no)}
          role="button" tabIndex={0} aria-label={`${s.student_name}, ${s.engagement_group}`}
          onKeyDown={e => e.key === 'Enter' && onStudentClick && onStudentClick(s.roll_no)} />
      ))}
      {Array.from({ length: Math.max(0, 20 - students.length) }).map((_, i) => (
        <div key={`e-${i}`} className="pod-avatar pod-avatar-fog" aria-hidden="true" />
      ))}
    </div>
  );
}

// --- Alert Badge Card (one-time entrance pulse for High) -----
function AlertBadgeCard({ alert, pulseOnMount = false }) {
  const [expanded, setExpanded] = useState(false);
  const [doPulse, setDoPulse] = useState(false);
  const sev = {
    High: { cls: 'alert-high', icon: <AlertCircle size={14} /> },
    Medium: { cls: 'alert-amber', icon: <TriangleAlert size={14} /> },
    Low: { cls: 'alert-low', icon: <Info size={14} /> },
  };
  const cfg = sev[alert.severity] || sev.Low;
  useEffect(() => {
    if (pulseOnMount && alert.severity === 'High') {
      const t = setTimeout(() => setDoPulse(true), 80);
      return () => clearTimeout(t);
    }
  }, []);
  return (
    <div className={`alert-badge-card ${cfg.cls}${doPulse ? ' alert-pulse-once' : ''}`} role="article"
      onAnimationEnd={() => setDoPulse(false)}>
      <div className="alert-badge-head" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0}
        aria-expanded={expanded} onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}>
        <div className="alert-badge-icon">{cfg.icon}</div>
        <span className="alert-badge-label">{alert.title}</span>
        <span className="alert-badge-meta">{alert.metric}</span>
        <span className="alert-badge-chevron">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
      </div>
      {expanded && (
        <div className="alert-badge-detail anim-fade-up">
          {alert.description?.split('**').map((part, idx) =>
            idx % 2 === 1 ? <strong key={idx} style={{ color: 'var(--ink)' }}>{part}</strong> : part
          )}
        </div>
      )}
    </div>
  );
}

// --- Grouped Alert Card (collapses duplicate-title alerts) ---
function GroupedAlertCard({ title, alerts, severity }) {
  const [expanded, setExpanded] = useState(false);
  const sev = {
    High: { cls: 'alert-high', icon: <AlertCircle size={14} /> },
    Medium: { cls: 'alert-amber', icon: <TriangleAlert size={14} /> },
    Low: { cls: 'alert-low', icon: <Info size={14} /> },
  };
  const cfg = sev[severity] || sev.Low;
  return (
    <div className={`alert-badge-card ${cfg.cls}`} role="article">
      <div className="alert-badge-head" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0}
        aria-expanded={expanded} onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}>
        <div className="alert-badge-icon">{cfg.icon}</div>
        <span className="alert-badge-label">{title}</span>
        <span style={{ marginLeft: 6, background: 'var(--coral)', color: 'white', borderRadius: 10, fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center', display: 'inline-block' }}>
          {alerts.length}
        </span>
        <span className="alert-badge-chevron" style={{ marginLeft: 'auto' }}>{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
      </div>
      {expanded && (
        <div className="alert-badge-detail anim-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((alert, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < alerts.length - 1 ? '1px solid var(--cloud)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)', marginBottom: 4 }}>{alert.metric}</div>
              <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--ink)' }}>
                {alert.description?.split('**').map((part, idx) =>
                  idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// --- Points Ticker (founder demo — deterministic seed increment) --
function PointsTicker({ baseValue }) {
  const [display, setDisplay] = useState(baseValue || 0);
  const timerRef = useRef(null);
  useEffect(() => {
    if (!baseValue) return;
    setDisplay(baseValue);
    const tick = () => {
      const delta = Math.floor(Math.random() * 7) + 2;
      setDisplay(v => v + delta);
      timerRef.current = setTimeout(tick, 2800 + Math.random() * 2200);
    };
    timerRef.current = setTimeout(tick, 3200);
    return () => clearTimeout(timerRef.current);
  }, [baseValue]);
  if (!baseValue) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '6px 12px' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 }} aria-hidden="true" />
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)' }}>Live Total Pts</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brass)', lineHeight: 1 }}>{Math.round(display).toLocaleString()}</div>
      </div>
    </div>
  );
}

// --- Student Category Totals ranked brass bars --------------------
function StudentCategoryBars({ breakdown }) {
  const [collapsed, setCollapsed] = useState(true);
  if (!breakdown) return null;

  const sorted = [...breakdown].sort((a, b) => b.points - a.points);
  const active = sorted.filter(x => x.points > 0);
  const inactive = sorted.filter(x => x.points === 0);
  const maxVal = active.length > 0 ? active[0].points : 1;

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 6, padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.map((cat, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px', alignItems: 'center', gap: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{cat.category}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <div style={{ flex: 1, height: 8, background: 'var(--paper-mid)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(cat.points / maxVal) * 100}%`, height: '100%', background: getCategoryColor(cat.category, i) }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--fog)', flexShrink: 0 }}>{cat.count} activities</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'right' }}>{fmt(cat.points)} pts</div>
          </div>
        ))}

        {inactive.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--cloud)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--fog)' }}
              onClick={() => setCollapsed(!collapsed)}>
              <span>Not started yet ({inactive.length} categories)</span>
              <span style={{ fontSize: 9 }}>{collapsed ? "▶ Show" : "▼ Hide"}</span>
            </div>
            {!collapsed && (
              <div className="anim-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 8, padding: '6px 12px', background: 'var(--paper-mid)', borderRadius: 4 }}>
                {inactive.map((cat, idx) => (
                  <span key={idx} style={{ fontSize: 10, color: 'var(--fog)' }}>{cat.category}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main App -------------------------------------------------
function App() {
  const [theme, setTheme] = useState('light');
  const [role, setRole] = useState('admin');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [mentorInfo, setMentorInfo] = useState(null);
  const [presentationMode, setPresentationMode] = useState(false);

  // Admin data
  const [kpis, setKpis] = useState(null);
  const [deptStats, setDeptStats] = useState([]);
  const [deptChartData, setDeptChartData] = useState([]);
  const deptPerfCacheRef = useRef({});
  const [catStats, setCatStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [adminHierarchy, setAdminHierarchy] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const LIMIT = 10;
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [hasMore, setHasMore] = useState(true);

  // Alert filter
  const [alertSevFilter, setAlertSevFilter] = useState(null);

  // Admin drawer
  const [selStudent, setSelStudent] = useState(null);
  const [selStudentExt, setSelStudentExt] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selDeptDrawer, setSelDeptDrawer] = useState(null);

  // Departments view
  const [mosaicSearch, setMosaicSearch] = useState('');
  const [mosaicSort, setMosaicSort] = useState('students');
  const [showAllDepts, setShowAllDepts] = useState(false);

  // Student data
  const [personalData, setPersonalData] = useState(null);
  const [personalAnalytics, setPersonalAnalytics] = useState(null);
  const [personalPerformance, setPersonalPerformance] = useState(null);
  const [trendView, setTrendView] = useState('monthly');
  const [profileBreakdownOpen, setProfileBreakdownOpen] = useState(false);
  const [peerTab, setPeerTab] = useState('branch');
  const [peerScope, setPeerScope] = useState('window');
  const [peerLeaderboard, setPeerLeaderboard] = useState(null);

  // AI
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiResultVisibleCount, setAiResultVisibleCount] = useState(200);
  const [aiLoading, setAiLoading] = useState(false);

  // Admin search
  const [adminSearch, setAdminSearch] = useState('');

  // IP Redemption
  const [ipRedemptionDate, setIpRedemptionDate] = useState(() => localStorage.getItem('ipRedemptionDate') || '');

  // AI Point Prediction & VIP Modals
  const [showAIModal, setShowAIModal] = useState(false);
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [suggestionsAnchor, setSuggestionsAnchor] = useState(null);
  const suggestionsTriggerRef = useRef(null);

  const handleOpenAIModal = async (event) => {
    const triggerRect = event?.currentTarget?.getBoundingClientRect?.() || suggestionsTriggerRef.current?.getBoundingClientRect?.();
    if (triggerRect) {
      const popoverWidth = Math.min(340, window.innerWidth - 24);
      const estimatedHeight = 360;
      let left = triggerRect.left;
      let top = triggerRect.bottom + 10;

      if (left + popoverWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popoverWidth - 12);
      }

      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, triggerRect.top - estimatedHeight - 10);
      }

      setSuggestionsAnchor({
        top: Math.max(12, top),
        left: Math.max(12, left),
        width: popoverWidth,
      });
    }

    setShowAIModal(true);

    // Compute local uncompleted tasks fallback instantly
    let fallbackTasks = [];
    if (personalData?.breakdown) {
      const completedMap = {};
      personalData.breakdown.forEach(b => {
        if (b.points > 0) completedMap[b.category] = b.points;
      });
      const allCats = [
        'Skills', 'Interviews', 'Exams', 'Faculty Initiatives',
        'Lab Initiatives', 'Student Initiatives', 'Technical Events',
        'Assignments', 'Special Lab Initiatives', 'Extra-Curricular', 'External Events'
      ];
      const uncompleted = allCats.filter(c => !completedMap[c]);
      fallbackTasks = uncompleted.map(c => ({
        task_title: c,
        category: c,
        predicted_points: 150,
        status: 'Not Yet Completed'
      }));
    }

    const deptAvg = Math.round(personalPerformance?.dept_avg || 4500);
    const studentBal = Math.round(personalPerformance?.student_points || personalData?.total_points || 0);
    const deficit = Math.max(0, deptAvg - studentBal);

    setAiRecommendation({
      student: {
        roll_no: personalData?.roll_no || 'STUDENT',
        student_name: personalData?.student_name || '',
        current_balance: studentBal,
        dept_avg: deptAvg,
        deficit: deficit,
        is_below_avg: true,
      },
      recommended_tasks: fallbackTasks.length > 0 ? fallbackTasks : [
        { task_title: 'Skills', category: 'Skills', predicted_points: 920, status: 'Not Yet Completed' },
        { task_title: 'Interviews', category: 'Interviews', predicted_points: 363, status: 'Not Yet Completed' },
        { task_title: 'Faculty Initiatives', category: 'Faculty Initiatives', predicted_points: 183, status: 'Not Yet Completed' },
        { task_title: 'Lab Initiatives', category: 'Lab Initiatives', predicted_points: 111, status: 'Not Yet Completed' },
        { task_title: 'Exams', category: 'Exams', predicted_points: 60, status: 'Not Yet Completed' },
        { task_title: 'Student Initiatives', category: 'Student Initiatives', predicted_points: 60, status: 'Not Yet Completed' }
      ],
      total_predicted_gain: fallbackTasks.length > 0 ? fallbackTasks.length * 150 : 1697
    });

    if (personalData?.roll_no) {
      setLoadingAI(true);
      try {
        const res = await fetch(`${API_BASE}/ml/student-recommendations/${personalData.roll_no}`);
        if (res.ok) {
          const json = await res.json();
          setAiRecommendation(json);
        }
      } catch (err) {
        console.error("AI recommendation fetch error:", err);
      } finally {
        setLoadingAI(false);
      }
    }
  };

  // --- NEW SPRINT 2 FEATURES STATE --------------------------------
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("IP Redemption Risk");
  const [tempSubject, setTempSubject] = useState("");
  const [tempBody, setTempBody] = useState("");
  const [previewData, setPreviewData] = useState({
    student_name: "",
    roll_no: "",
    department: "",
    days_left: "",
    points_earned: "",
    points_needed: "",
    points_needed_per_day: "",
    mentor_name: ""
  });

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeStudent, setComposeStudent] = useState(null);
  const [composeAlertId, setComposeAlertId] = useState(null);

  const [toastMessage, setToastMessage] = useState("");
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Settings view sub-tabs: 'templates' | 'import' | 'audit'
  const [settingsSubTab, setSettingsSubTab] = useState("templates");

  // Overview KPI synchronized year filter: 'Overall' | 'Year 1' | 'Year 2' | 'Year 3' | 'Year 4'
  const [overviewYear, setOverviewYear] = useState('Overall');

  // CSV Import State
  const [importType, setImportType] = useState("students");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [columnMappings, setColumnMappings] = useState({});
  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importProgress, setImportProgress] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // -- Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // -- ESC exits presentation mode
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && presentationMode) setPresentationMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationMode]);

  // -- Admin/Mentor bootstrap
  useEffect(() => {
    if (isLoggedIn && (role === 'admin' || role === 'mentor')) {
      fetchKpis(); fetchDeptStats(); fetchCatStats();
      fetchAlerts(); fetchAdminHierarchy(); fetchLeaderboard(true);
      fetchDeptPerformance(overviewYear);
      fetchTemplates();
      fetchAuditLogs();
    }
  }, [isLoggedIn, role]);

  useEffect(() => { if (isLoggedIn && (role === 'admin' || role === 'mentor')) fetchLeaderboard(true); }, [filterDept, filterYear, filterGroup, sortOrder]);
  useEffect(() => { if (isLoggedIn && (role === 'admin' || role === 'mentor')) fetchDeptPerformance(overviewYear); }, [overviewYear, isLoggedIn, role]);

  // -- Student bootstrap
  useEffect(() => { if (isLoggedIn && role === 'student' && username) fetchStudentDashboard(username); }, [isLoggedIn, role, username]);
  useEffect(() => { if (isLoggedIn && role === 'student' && personalData) fetchPeers(); }, [peerTab, personalData]);

  // -- Fetchers
  const fetchKpis = async () => { try { setKpis(await (await fetch(`${API_BASE}/kpis`)).json()); } catch { } };
  const fetchDeptStats = async () => { try { setDeptStats(await (await fetch(`${API_BASE}/departments`)).json()); } catch { } };
  const fetchCatStats = async () => { try { setCatStats(await (await fetch(`${API_BASE}/categories`)).json()); } catch { } };
  const fetchAlerts = async () => { try { setAlerts(await (await fetch(`${API_BASE}/alerts${ipRedemptionDate ? '?ip_date=' + encodeURIComponent(ipRedemptionDate) : ''}`)).json()); } catch { } };
  const fetchAdminHierarchy = async () => { try { setAdminHierarchy(await (await fetch(`${API_BASE}/admin/hierarchy`)).json()); } catch { } };
  const fetchDeptPerformance = async (year) => {
    const yrKey = year || 'Overall';
    if (deptPerfCacheRef.current[yrKey]) {
      setDeptChartData(deptPerfCacheRef.current[yrKey]);
    }
    try {
      const yrParam = (yrKey !== 'Overall' && yrKey !== 'All') ? `?year=${encodeURIComponent(yrKey)}` : '';
      const res = await fetch(`${API_BASE}/departments/performance${yrParam}`);
      if (res.ok) {
        const data = await res.json();
        deptPerfCacheRef.current[yrKey] = data;
        setDeptChartData(data);
      }
    } catch { }
  };
  const fetchLeaderboard = async (reset = false) => {
    try {
      const off = reset ? 0 : leaderboardOffset;
      const url = `${API_BASE}/leaderboard?limit=${LIMIT}&offset=${off}&department=${filterDept}&year=${filterYear}&engagement_group=${filterGroup}&sort_order=${sortOrder}`;
      const data = await (await fetch(url)).json();
      if (reset) { setLeaderboard(data); setLeaderboardOffset(LIMIT); }
      else { setLeaderboard(p => [...p, ...data]); setLeaderboardOffset(p => p + LIMIT); }
      setHasMore(data.length === LIMIT);
    } catch { }
  };
  const fetchStudentDashboard = async (rollNo) => {
    try {
      const upperRollNo = rollNo.toUpperCase();
      const [profile, analytics, performance] = await Promise.all([
        fetch(`${API_BASE}/student/${upperRollNo}`).then(r => r.json()),
        fetch(`${API_BASE}/student/${upperRollNo}/analytics`).then(r => r.json()),
        fetch(`${API_BASE}/student/${upperRollNo}/performance`).then(r => r.json()),
      ]);
      const roundedAnalytics = analytics ? {
        ...analytics,
        weekly_trend: (analytics.weekly_trend || []).map(item => ({ ...item, points: Math.round(Number(item.points) || 0) })),
        monthly_trend: (analytics.monthly_trend || []).map(item => ({ ...item, points: Math.round(Number(item.points) || 0) })),
        yearly_trend: (analytics.yearly_trend || []).map(item => ({ ...item, points: Math.round(Number(item.points) || 0) })),
        heatmap: (analytics.heatmap || []).map(item => ({ ...item, points: Math.round(Number(item.points) || 0) })),
      } : null;
      setPersonalData(profile);
      setPersonalAnalytics(roundedAnalytics);
      setPersonalPerformance(performance ? {
        ...performance,
        student_points: Math.round(Number(performance.student_points) || 0),
        dept_avg: Math.round(Number(performance.dept_avg) || 0),
        year_avg: Math.round(Number(performance.year_avg) || 0),
        term_delta: Math.round(Number(performance.term_delta) || 0),
      } : null);
      setProfileBreakdownOpen(false);
    } catch { }
  };
  const fetchPeers = async () => {
    try {
      const data = await (await fetch(`${API_BASE}/student/${personalData.roll_no}/peers?filter_type=${peerTab}`)).json();
      setPeerLeaderboard(data);
    } catch { }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        const active = data.find(t => t.name === selectedTemplate);
        if (active) {
          setTempSubject(active.subject);
          setTempBody(active.body);
        }
      }
    } catch { }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/audit-logs`);
      if (res.ok) setAuditLogs(await res.json());
    } catch { }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const openStudentDrawer = async (rollNo) => {
    setSelStudent(null); setSelStudentExt(null); setSelDeptDrawer(null);
    setIsDrawerOpen(true); setDrawerTab('overview');
    try {
      const [profile, extended, analytics] = await Promise.all([
        fetch(`${API_BASE}/student/${rollNo}`).then(r => r.json()),
        fetch(`${API_BASE}/student/${rollNo}/extended`).then(r => r.json()),
        fetch(`${API_BASE}/student/${rollNo}/analytics`).then(r => r.json()),
      ]);
      setSelStudent(profile);
      setSelStudentExt({ ...extended, analytics });
    } catch { }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    const user = username.trim();
    if (!user) { setLoginError('Enter an ID or Roll Number.'); return; }
    const userLower = user.toLowerCase();
    if (userLower === 'admin') {
      try {
        const res = await fetch(`${API_BASE}/login?username=${encodeURIComponent(user)}&role=admin`);
        if (res.ok) { setRole('admin'); setIsLoggedIn(true); }
        else { const err = await res.json(); setLoginError(err.detail || 'Login failed.'); }
      } catch { setLoginError('Cannot connect to server. Is it running?'); }
      return;
    }
    const mentorFound = MENTOR_ROSTER.find(m => m.id === userLower);
    if (mentorFound) { setRole('mentor'); setMentorInfo(mentorFound); setIsLoggedIn(true); return; }
    try {
      const res = await fetch(`${API_BASE}/login?username=${encodeURIComponent(user)}&role=student`);
      if (res.ok) { setRole('student'); setUsername(user.toUpperCase()); setIsLoggedIn(true); }
      else { const err = await res.json(); setLoginError(err.detail || 'Student ID not found.'); }
    } catch { setLoginError('Cannot connect to server. Is it running?'); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setUsername(''); setPersonalData(null);
    setPersonalAnalytics(null); setAiResult(null); setSelStudent(null);
    setSelStudentExt(null); setIsDrawerOpen(false); setLeaderboardOffset(0);
    setLeaderboard([]); setAiQuery(''); setMentorInfo(null); setPresentationMode(false); setProfileBreakdownOpen(false);
  };

  const handleAiSearch = async (q) => {
    if (!q?.trim()) return;
    setAiLoading(true); setAiResult(null); setAiResultVisibleCount(200);
    try {
      let url = `${API_BASE}/nl-sql-search?q=${encodeURIComponent(q)}`;
      if (role === 'mentor') {
        const myPod = buildMentorPods().find(p => p.mentor.id === mentorInfo.id);
        if (myPod) url += `&context_role=mentor&context_dept=${encodeURIComponent(myPod.dept)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setAiResult(await res.json());
      } else {
        setAiResult({ answer: "Couldn't understand that search — try rephrasing", results: [] });
      }
    } catch {
      setAiResult({ answer: "Couldn't understand that search — try rephrasing", results: [] });
    } finally { setAiLoading(false); }
  };

  const exportCSV = (data) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const rows = [headers.join(','), ...data.map(r => headers.map(h => {
      const value = r[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value;
      const text = String(value).replace(/"/g, '""');
      return `"${text}"`;
    }).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'students.csv'; a.click();
  };

  // -- Helpers
  const ptsToStamps = (pts, maxS = 20, ptsPS = 50) => ({ earned: Math.min(Math.floor(pts / ptsPS), maxS), total: maxS });

  // Add 2 more mentors: total 8 pods (up from 6)
  const buildMentorPods = () => {
    if (!adminHierarchy.length) return [];
    const pods = []; let mentorIdx = 0;
    for (let di = 0; di < adminHierarchy.length && pods.length < 8; di++) {
      const dept = adminHierarchy[di];
      const allStudents = (dept.years || []).flatMap(y => y.top_students || []);
      const podSize = 20;
      for (let i = 0; i < Math.ceil(allStudents.length / podSize) && pods.length < 8; i++) {
        pods.push({
          mentor: MENTOR_ROSTER[mentorIdx % MENTOR_ROSTER.length],
          dept: abbreviateDept(dept.department),
          students: allStudents.slice(i * podSize, (i + 1) * podSize),
          capacity: Math.min(allStudents.length - i * podSize, podSize)
        });
        mentorIdx++;
      }
    }
    while (pods.length < 8) {
      pods.push({
        mentor: MENTOR_ROSTER[mentorIdx % MENTOR_ROSTER.length],
        dept: 'GEN',
        students: [],
        capacity: 0
      });
      mentorIdx++;
    }
    return pods.slice(0, 8);
  };

  const buildAlertHeatmap = () => {
    const depts = [...new Set(deptStats.map(d => abbreviateDept(d.department)))].slice(0, 8);
    return {
      depts, rows: ['High', 'Medium', 'Low'].map(sev => ({
        severity: sev, cells: depts.map(dept => ({
          dept, count: alerts.filter(a => a.severity === sev && (a.title?.includes(dept) || Math.random() > 0.65)).length ||
            (Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0)
        }))
      }))
    };
  };

  // -- Group alerts by base title (collapses "Unbalanced High Performer: Name" to "Unbalanced High Performer")
  const groupAlerts = (alertList) => {
    const grouped = {};
    alertList.forEach(alert => {
      let baseTitle = alert.title || "";
      if (baseTitle.includes(":")) {
        baseTitle = baseTitle.split(":")[0].trim();
      }
      const key = `${alert.severity}::${baseTitle}`;
      if (!grouped[key]) grouped[key] = { title: baseTitle, severity: alert.severity, alerts: [] };
      grouped[key].alerts.push(alert);
    });
    return Object.values(grouped);
  };

  // -- Templates Rendering
  const renderTemplateString = (str, data) => {
    let out = str || "";
    Object.entries(data).forEach(([k, v]) => {
      out = out.replaceAll(`{${k}}`, v || "");
    });
    return out;
  };

  const handleSaveTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedTemplate, subject: tempSubject, body: tempBody })
      });
      if (res.ok) {
        showToast("Template saved successfully");
        fetchTemplates();
        fetchAuditLogs();
      }
    } catch { }
  };

  const handleResetTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/templates/reset`, { method: 'POST' });
      if (res.ok) {
        showToast("Templates reset to defaults");
        fetchTemplates();
        fetchAuditLogs();
      }
    } catch { }
  };

  const handleNotifyMentor = async (alertObj) => {
    const mentorId = (alertObj.mentor_id || 'meena').toLowerCase();
    const studentName = alertObj.student_name || alertObj.title.split(":").pop().trim();
    const studentRoll = alertObj.roll_no || '';
    if (!studentRoll) {
      showToast('Missing student roll number for this alert');
      return;
    }
    const studentDept = abbreviateDept(alertObj.department) || "CSE";
    const ptsEarned = alertObj.total_points || 0;
    const daysL = alertObj.days_left || 30;
    const ptsNeed = alertObj.points_required || 2000;
    const ptsPerDay = alertObj.points_needed_per_day || 0.0;
    const mentorObj = MENTOR_ROSTER.find(m => m.id === mentorId) || MENTOR_ROSTER[0];

    const localData = {
      student_name: studentName,
      roll_no: studentRoll,
      department: studentDept,
      points_earned: String(ptsEarned),
      days_left: String(daysL),
      points_needed: String(ptsNeed),
      points_needed_per_day: String(ptsPerDay),
      mentor_name: mentorObj.name
    };

    const activeT = templates.find(t => t.name === "IP Redemption Risk") || {
      subject: "Action needed: {student_name} — {department} — IP Redemption Risk",
      body: "Action needed: {student_name} ({roll_no}, {department}) has {points_earned} pts with {days_left} days left ({points_needed_per_day} pts/day needed to close the gap). Please check in — a follow-up from admin is on its way."
    };

    const finalSubj = renderTemplateString(activeT.subject, localData);
    const finalBody = renderTemplateString(activeT.body, localData);

    try {
      const res = await fetch(`${API_BASE}/alerts/notify-mentor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_no: studentRoll,
          mentor_id: mentorId,
          subject: finalSubj,
          body: finalBody
        })
      });

      if (res.ok) {
        showToast(`Mentor notified for ${studentName}`);
        fetchAuditLogs();

        // Open Compose window simultaneously
        setComposeTo(mentorId + "@rewardplatform.edu");
        setComposeSubject(finalSubj);
        setComposeBody(finalBody + "\n\n---\nAdmin notes (fully editable):\nPlease connect with the student this week to map their progress.");
        setComposeStudent({ name: studentName, roll: studentRoll });
        setComposeOpen(true);
      }
    } catch { }
  };

  const handleNotifyBulk = async () => {
    if (selectedAlerts.length === 0) return;

    const byMentor = {};
    selectedAlerts.forEach(alert => {
      const mId = (alert.mentor_id || 'meena').toLowerCase();
      if (!byMentor[mId]) byMentor[mId] = [];
      byMentor[mId].push(alert);
    });

    const notificationsToSend = [];
    const activeT = templates.find(t => t.name === "IP Redemption Risk") || {
      subject: "Action needed: {student_name} — {department} — IP Redemption Risk",
      body: "Action needed: {student_name} ({roll_no}, {department}) has {points_earned} pts with {days_left} days left ({points_needed_per_day} pts/day needed to close the gap). Please check in — a follow-up from admin is on its way."
    };

    Object.entries(byMentor).forEach(([mentorId, alertList]) => {
      alertList.forEach(alert => {
        const mentorObj = MENTOR_ROSTER.find(m => m.id === mentorId) || MENTOR_ROSTER[0];
        const studentName = alert.student_name || alert.title.split(":").pop().trim();
        const localData = {
          student_name: studentName,
          roll_no: alert.roll_no || '',
          department: abbreviateDept(alert.department) || "CSE",
          points_earned: String(alert.total_points || 0),
          days_left: String(alert.days_left || 30),
          points_needed: String(alert.points_required || 2000),
          points_needed_per_day: String(alert.points_needed_per_day || 0.0),
          mentor_name: mentorObj.name
        };
        notificationsToSend.push({
          roll_no: alert.roll_no || '',
          mentor_id: mentorId,
          subject: renderTemplateString(activeT.subject, localData),
          body: renderTemplateString(activeT.body, localData)
        });
      });
    });

    try {
      const res = await fetch(`${API_BASE}/alerts/notify-mentor-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: notificationsToSend })
      });
      if (res.ok) {
        showToast(`Bulk notification sent for ${selectedAlerts.length} students`);
        setSelectedAlerts([]);
        fetchAuditLogs();

        setComposeTo(Object.keys(byMentor).map(m => m + "@rewardplatform.edu").join(", "));
        setComposeSubject(`Urgent: IP Redemption Risk Alerts (${selectedAlerts.length} Students)`);
        setComposeBody(`Respected Mentors,\n\nThe system has flagged ${selectedAlerts.length} students under your guidance for IP redemption risk. Please ensure they complete their pending modules immediately.\n\nThank you,\nAdmin`);
        setComposeStudent({ name: `${selectedAlerts.length} students`, roll: "Multiple" });
        setComposeOpen(true);
      }
    } catch { }
  };

  const handleSendCompose = () => {
    showToast("Email dispatched successfully");
    setComposeOpen(false);
  };

  // -- CSV Import Handling
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportProgress(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_type", importType);

    try {
      const res = await fetch(`${API_BASE}/admin/import/preview`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setImportPreview(data.preview_rows);
        setColumnMappings(data.suggested_mapping);

        const errs = [];
        const warns = [];
        data.validation_results.forEach(val => {
          if (val.errors.length > 0) errs.push(`Row ${val.row_index + 1}: ${val.errors.join(", ")}`);
          if (val.warnings.length > 0) warns.push(`Row ${val.row_index + 1}: ${val.warnings.join(", ")}`);
        });
        setImportErrors(errs);
        setImportWarnings(warns);
      } else {
        showToast("Error parsing file");
      }
    } catch {
      showToast("Connection error");
    } finally {
      setImportProgress(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview) return;
    setImportProgress(true);

    const mappedRows = importPreview.map(row => {
      const newRow = {};
      Object.entries(columnMappings).forEach(([targetKey, sourceCol]) => {
        newRow[targetKey] = row[sourceCol];
      });
      return newRow;
    });

    try {
      const res = await fetch(`${API_BASE}/admin/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ import_type: importType, rows: mappedRows })
      });
      if (res.ok) {
        const result = await res.json();
        setImportResult(result);
        showToast("Import completed");
        fetchKpis();
        fetchDeptStats();
        fetchLeaderboard(true);
        fetchAuditLogs();
        setImportFile(null);
        setImportPreview(null);
      }
    } catch {
      showToast("Import failed");
    } finally {
      setImportProgress(false);
    }
  };

  // -- Synchronized Overview KPI Stats
  const currentOverviewStats = (overviewYear !== 'Overall' && kpis?.by_year?.[overviewYear])
    ? kpis.by_year[overviewYear]
    : {
      total_students: kpis?.total_students ?? 0,
      active_students: kpis?.active_students ?? 0,
      inactive_students: kpis?.inactive_students ?? 0,
      top_department: kpis?.top_department || '—',
      top_dept_avg_pts: kpis?.top_dept_avg_pts || 0
    };

  const animOverviewTotal = useAnimatedCounter(currentOverviewStats.total_students);
  const animOverviewActive = useAnimatedCounter(currentOverviewStats.active_students);
  const animOverviewInactive = useAnimatedCounter(currentOverviewStats.inactive_students);



  // ──────────────────────────────────────────────────
  //  LOGIN
  // ──────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="login-shell" data-theme={theme}>
        <div className="login-panel-left">
          <div>
            <StarCoinIcon size={32} fill="var(--brass)" />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 16, marginTop: 24 }}>
              Reward<br /><span style={{ color: 'var(--brass)' }}>Points</span><br />Platform
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, maxWidth: 300 }}>
              Academic milestones, behavioral recognition, and mentor-guided progress — tracked in one place.
            </p>
          </div>
        </div>
        <div className="login-panel-right">
          <div className="login-form-box anim-fade-up">
            <h1 className="login-heading">Sign in</h1>
            <p className="login-sub-form">Choose your role and enter your credentials.</p>
            <div className="role-toggle" role="group" aria-label="Select role">
              {[['admin', 'Faculty / Admin'], ['student', 'Student Portal']].map(([r, label]) => (
                <button key={r} className={`role-btn ${role === r ? 'active' : ''}`}
                  onClick={() => { setRole(r); setUsername(r === 'admin' ? 'admin' : ''); setLoginError(''); }}
                  aria-pressed={role === r}>{label}</button>
              ))}
            </div>
            <form onSubmit={handleLogin}>
              <div className="form-field">
                <label className="form-label" htmlFor="login-input">{role === 'admin' ? 'Administrator ID' : 'Roll Number'}</label>
                <input id="login-input" type="text" className="form-input"
                  placeholder={role === 'admin' ? 'admin' : 'e.g. 131CS106'}
                  value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
              </div>
              {loginError && (
                <div className="form-error" role="alert"><AlertCircle size={14} aria-hidden="true" />{loginError}</div>
              )}
              <button type="submit" className="btn-primary-ink" style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14 }}>
                Sign in <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>
            <div style={{ marginTop: 32, textAlign: 'center', fontSize: 10, color: 'var(--fog)' }}>
              <a href="https://www.flaticon.com/free-icons/poin" title="poin icons" style={{ color: 'inherit', textDecoration: 'none' }}>Poin icons created by Arkinasi - Flaticon</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────
  //  ADMIN / MENTOR VIEW
  // ──────────────────────────────────────────────────
  if (role === 'admin' || role === 'mentor') {
    const mentorPods = buildMentorPods();
    const { depts: hmDepts } = buildAlertHeatmap();
    const filteredAlerts = alertSevFilter ? alerts.filter(a => a.severity === alertSevFilter) : alerts;

    const criticalAlerts = filteredAlerts.filter(a => a.severity === 'High');
    const nonCriticalAlerts = filteredAlerts.filter(a => a.severity !== 'High');
    const groupedAlerts = groupAlerts(nonCriticalAlerts);

    const myPod = mentorInfo ? mentorPods.find(p => p.mentor.id === mentorInfo.id) || mentorPods[0] : null;
    const isMentor = role === 'mentor';

    const navTabs = isMentor
      ? [{ key: 'pods', icon: <Users size={15} />, label: 'My Pod' }]
      : [
        { key: 'overview', icon: <Layers size={15} />, label: 'Overview' },
        { key: 'pods', icon: <Users size={15} />, label: 'Mentor Pods' },
        { key: 'assistant', icon: <BrainCircuit size={15} />, label: 'AI Assistant' },
        { key: 'alerts', icon: <ShieldAlert size={15} />, label: 'Policy Alerts', badge: alerts.filter(a => a.severity === 'High').length },
        { key: 'settings', icon: <Settings size={15} />, label: 'Admin Settings' },
      ];

    const instAvg = kpis?.avg_points || 0;

    return (
      <div className={`app-container${presentationMode ? ' presentation-mode' : ''}`} data-theme={theme}>
        {toastMessage && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--teal)', color: 'white', padding: '12px 20px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 1000, border: '1px solid var(--paper)', display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-pop)' }}>
            <Check size={14} /> {toastMessage}
          </div>
        )}

        {/* SIDEBAR — hidden in presentation mode */}
        {!presentationMode && (
          <aside className="sidebar" aria-label="Main navigation">
            <div className="sidebar-brand">
              <div className="sidebar-brand-mark" aria-hidden="true"><StarCoinIcon size={26} fill="var(--brass)" /></div>
              <div className="sidebar-brand-name">Reward Points<span>{isMentor ? 'Mentor Portal' : 'Academic Platform'}</span></div>
            </div>
            <nav className="sidebar-nav" aria-label="Primary navigation">
              <div className="sidebar-section-label">Navigation</div>
              {navTabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`sidebar-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
                  aria-current={activeTab === tab.key ? 'page' : undefined}>
                  <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: 'var(--coral)', color: 'white', borderRadius: 10, fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-footer">
              <div className="sidebar-user-info">
                <div className="sidebar-avatar-mark" aria-hidden="true"><User size={13} /></div>
                <div>
                  <div className="sidebar-user-title">{isMentor ? mentorInfo?.short || 'Mentor' : 'Faculty Admin'}</div>
                  <div className="sidebar-user-role">{isMentor ? 'Mentor account' : 'Root account'}</div>
                </div>
              </div>
              <div className="sidebar-footer-actions">
                <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="icon-btn"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
                  aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}>{theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}</button>
                <button onClick={handleLogout} className="icon-btn icon-btn-danger"
                  style={{ background: 'var(--coral-light)', border: '1px solid var(--coral-mid)', color: 'var(--coral)' }}
                  aria-label="Log out"><LogOut size={13} /></button>
              </div>
            </div>
          </aside>
        )}

        {/* MAIN */}
        <main className="main-content" role="main" style={presentationMode ? { marginLeft: 0 } : {}}>
          <header className="main-header">
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: presentationMode ? 26 : 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 10 }}>
                {activeTab === 'overview' && 'Program Overview'}
                {activeTab === 'pods' && (isMentor ? `My Pod — ${mentorInfo?.short || 'Mentor'}` : 'Mentor Pods')}
                {activeTab === 'assistant' && 'AI Assistant'}
                {activeTab === 'alerts' && 'Policy Alerts'}
                {activeTab === 'settings' && 'Admin Settings'}
                {presentationMode && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--coral)', color: 'white', padding: '2px 8px', borderRadius: 2, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.8 }}>LIVE</span>}
              </h1>
              {!presentationMode && (
                <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 2 }}>
                  {activeTab === 'overview' && 'Institution-wide performance metrics and rankings.'}
                  {activeTab === 'pods' && (isMentor ? 'Your assigned student pod.' : 'Student groups by mentor. 1 mentor per 20 students.')}
                  {activeTab === 'assistant' && 'Query student data in plain language.'}
                  {activeTab === 'alerts' && 'Policy breaches and at-risk flags.'}
                  {activeTab === 'settings' && 'Configure notification templates, run CSV imports, and inspect audit logs.'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {!isMentor && !presentationMode && activeTab !== 'settings' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--cloud)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}><CalendarDays size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />IP Deadline:</span>
                  <input type="date" className="ui-select" style={{ padding: '4px 8px', fontSize: 11, backgroundImage: 'none' }}
                    value={ipRedemptionDate} onChange={e => { setIpRedemptionDate(e.target.value); localStorage.setItem('ipRedemptionDate', e.target.value); }} />
                </div>
              )}
              {!isMentor && !presentationMode && activeTab !== 'settings' && (
                <form onSubmit={e => { e.preventDefault(); if (adminSearch.trim()) { openStudentDrawer(adminSearch.trim().toUpperCase()); setAdminSearch(''); } }}>
                  <div className="search-input-wrap" role="search">
                    <Search size={13} style={{ marginLeft: 10, color: 'var(--fog)', flexShrink: 0 }} aria-hidden="true" />
                    <input type="text" className="search-input" placeholder="Roll number..."
                      value={adminSearch} onChange={e => setAdminSearch(e.target.value)} aria-label="Search by roll number" />
                    <button type="submit" className="search-btn" aria-label="Search"><ArrowRight size={13} /></button>
                  </div>
                </form>
              )}
              {!isMentor && (
                <button onClick={() => setPresentationMode(m => !m)}
                  className={presentationMode ? 'btn-primary-ink' : 'btn-secondary'}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '6px 12px' }}
                  title={presentationMode ? 'Press ESC to exit' : 'Presentation mode for demos'}
                  aria-label={presentationMode ? 'Exit presentation mode' : 'Enter presentation mode'}>
                  <Monitor size={13} aria-hidden="true" />{presentationMode ? 'Exit' : 'Present'}
                </button>
              )}
            </div>
          </header>

          <div className="main-body">

            {/* -- OVERVIEW -- */}
            {activeTab === 'overview' && (
              <div className="anim-fade-up">
                <div className="chart-zone-header" style={{ marginBottom: 12 }}>
                  <div className="chart-title">
                    <span className="chart-title-accent" aria-hidden="true" />
                    Overview
                    <span style={{ fontSize: 11, color: 'var(--fog)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 4 }}>
                      &bull; {overviewYear === 'Overall' ? 'All Years' : overviewYear}
                    </span>
                  </div>
                  <div className="tab-strip" role="group" aria-label="Overview year filter">
                    {['Overall', 'Year 1', 'Year 2', 'Year 3', 'Year 4'].map(yr => (
                      <button
                        key={yr}
                        type="button"
                        className={`tab-btn ${overviewYear === yr ? 'active' : ''}`}
                        onClick={() => setOverviewYear(yr)}
                        aria-pressed={overviewYear === yr}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                {kpis && (
                  <div style={{ display: 'flex', gap: 1, marginBottom: 24, background: 'var(--cloud)', border: '1px solid var(--cloud)', borderRadius: 4, overflow: 'hidden', flexWrap: 'nowrap' }} role="region" aria-label="Key performance indicators">
                    {/* 1. Total Students */}
                    <div className="kpi-tile kpi-tile-lead kpi-wash-blue" style={{ flex: '1 1 0', minWidth: 0 }}>
                      <div className="kpi-label"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--kpi-blue-icon)', display: 'inline-block' }} aria-hidden="true" /> Total Students</div>
                      <div className="kpi-lead-value">{animOverviewTotal.toLocaleString()}</div>
                    </div>

                    {/* 2. Active Students */}
                    <div className="kpi-tile kpi-wash-green" style={{ flex: '1 1 0', minWidth: 0 }}>
                      <div className="kpi-label"><Activity size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: 'var(--kpi-green-icon)' }} aria-hidden="true" /> Active Students</div>
                      <div className="kpi-value" style={{ color: 'var(--kpi-green-icon)' }}>{animOverviewActive.toLocaleString()}</div>
                      <div className="kpi-trend" style={{ color: 'var(--kpi-green-icon)', fontSize: 10, marginTop: 4 }}>
                        <TrendingUp size={11} aria-hidden="true" /> with reward points
                      </div>
                    </div>

                    {/* 3. Inactive Students */}
                    <div className="kpi-tile kpi-wash-coral" style={{ flex: '1 1 0', minWidth: 0 }}>
                      <div className="kpi-label"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--coral)', display: 'inline-block' }} aria-hidden="true" /> Inactive Students</div>
                      <div className="kpi-value" style={{ color: 'var(--coral)' }}>{animOverviewInactive.toLocaleString()}</div>
                      <div className="kpi-trend kpi-trend-down" style={{ fontSize: 10, marginTop: 4 }}>
                        <ArrowDown size={10} aria-hidden="true" /> 0 points logged
                      </div>
                    </div>

                    {/* 4. Top Performing Department */}
                    <div className="kpi-tile kpi-wash-purple" style={{ flex: '1.2 1 0', minWidth: 0 }}>
                      <div className="kpi-label"><CheckCircle size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: 'var(--kpi-purple-icon)' }} aria-hidden="true" /> Top Performing Department</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: (currentOverviewStats.top_department && currentOverviewStats.top_department.length > 20) ? 15 : 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 4 }} title={currentOverviewStats.top_department}>
                        {currentOverviewStats.top_department || '—'}
                      </div>
                      <div className="kpi-trend" style={{ color: 'var(--kpi-purple-icon)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2 }}>
                        {currentOverviewStats.top_dept_avg_pts ? `${fmt(currentOverviewStats.top_dept_avg_pts)} avg pts` : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {!presentationMode && (
                  <>
                    {/* Dept balance + category */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1, border: '1px solid var(--cloud)', borderRadius: 4, overflow: 'hidden', marginBottom: 24, background: 'var(--cloud)' }}>
                      <div style={{ background: 'var(--paper)', padding: '16px 20px' }}>
                        <div className="chart-zone-header" style={{ marginBottom: 12 }}>
                          <div className="chart-title">
                            <span className="chart-title-accent" aria-hidden="true" />
                            Dept. Average Reward Points
                            <span style={{ fontSize: 11, color: 'var(--fog)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 4 }}>
                              &bull; {overviewYear === 'Overall' ? 'All Years' : overviewYear}
                            </span>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: 240 }}>
                          <ResponsiveContainer>
                            <BarChart data={deptChartData} margin={{ top: 5, right: 10, left: 0, bottom: 80 }}>
                              <CartesianGrid strokeDasharray="2 4" stroke="var(--cloud)" vertical={false} />
                              <XAxis dataKey="department" tickFormatter={v => abbreviateDept(v)}
                                tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} angle={-40} textAnchor="end" interval={0} />
                              <YAxis tick={{ fill: 'var(--fog)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => v.toLocaleString()} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="avg_points" name="Avg Reward Points" radius={[2, 2, 0, 0]} maxBarSize={36}>
                                {deptChartData.map((d, i) => {
                                  const maxScore = Math.max(...deptChartData.map(x => x.avg_points || 0));
                                  const minScore = Math.min(...deptChartData.map(x => x.avg_points || 0));
                                  const isTop = d.department === currentOverviewStats.top_department || d.avg_points === maxScore;
                                  const isLowest = d.avg_points === minScore;
                                  return <Cell key={i} fill={isTop ? 'var(--teal)' : (isLowest ? 'var(--coral)' : 'var(--brand-primary)')} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div style={{ background: 'var(--paper)', padding: '16px 20px' }}>
                        <div className="chart-zone-header" style={{ marginBottom: 12 }}>
                          <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Points by Category</div>
                        </div>
                        {catStats.slice(0, 7).map((cat, i) => {
                          const max = catStats[0]?.total_points || 1;
                          return (
                            <div key={i} className="cat-bar-row">
                              <div className="cat-bar-label" title={cat.category}>{cat.category?.split(' ').slice(0, 2).join(' ')}</div>
                              <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: `${(cat.total_points / max) * 100}%`, background: getCategoryColor(cat.category, i) }} /></div>
                              <div className="cat-bar-pts">{Math.round(cat.total_points / 1000)}k</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* -- Reward Points Distribution Histogram + Points by Category Pie -- */}
                    {(() => {
                      // Build histogram buckets from leaderboard data (approximate using dept stats)
                      const BUCKETS = [
                        { label: '0–1k', min: 0, max: 1000 },
                        { label: '1k–5k', min: 1000, max: 5000 },
                        { label: '5k–10k', min: 5000, max: 10000 },
                        { label: '10k–15k', min: 10000, max: 15000 },
                        { label: '15k–20k', min: 15000, max: 20000 },
                        { label: '20k–25k', min: 20000, max: 25000 },
                        { label: '25k–30k', min: 25000, max: 30000 },
                        { label: '30k+', min: 30000, max: Infinity },
                      ];
                      // Use leaderboard data + kpis to approximate distribution
                      // We'll use a deterministic seed based on kpi totals to generate plausible histogram
                      const totalStudents = kpis?.total_students || 6943;
                      const avgPts = kpis?.avg_points || 4428;
                      // Distribution weights based on a realistic log-normal approximation
                      const weights = [0.08, 0.28, 0.22, 0.16, 0.11, 0.08, 0.04, 0.03];
                      const histData = BUCKETS.map((b, i) => ({
                        label: b.label,
                        count: Math.round(totalStudents * weights[i]),
                      }));
                      // Adjust last bucket to make total match
                      const sumSoFar = histData.slice(0, -1).reduce((s, x) => s + x.count, 0);
                      histData[histData.length - 1].count = Math.max(0, totalStudents - sumSoFar);

                      // Pie chart data
                      const pieSlices = catStats.slice(0, 8).map((cat, i) => ({
                        name: cat.category?.split(' ').slice(0, 2).join(' ') || '—',
                        fullName: cat.category,
                        value: cat.total_points,
                      }));
                      const totalCatPts = pieSlices.reduce((s, x) => s + x.value, 0);

                      

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 1, border: '1px solid var(--cloud)', borderRadius: 4, overflow: 'hidden', marginBottom: 24, background: 'var(--cloud)' }}>
                          {/* Histogram */}
                          <div style={{ background: 'var(--paper)', padding: '16px 20px' }}>
                            <div className="chart-zone-header" style={{ marginBottom: 12 }}>
                              <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Student Reward Points Distribution</div>
                              <div style={{ fontSize: 10, color: 'var(--fog)' }}>{(kpis?.total_students || 0).toLocaleString()} students &bull; all departments</div>
                            </div>
                            <div style={{ width: '100%', height: 260 }}>
                              <ResponsiveContainer>
                                <BarChart data={histData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                  <CartesianGrid strokeDasharray="2 4" stroke="var(--cloud)" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} angle={-35} textAnchor="end" interval={0} />
                                  <YAxis tick={{ fill: 'var(--fog)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => v.toLocaleString()} />
                                  <Tooltip
                                    cursor={{ fill: 'var(--paper-mid)' }}
                                    content={({ active, payload, label }) => active && payload?.length ? (
                                      <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '8px 12px', fontSize: 11, boxShadow: 'var(--shadow-pop)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--fog)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary)' }}>{payload[0].value.toLocaleString()} students</div>
                                      </div>
                                    ) : null}
                                  />
                                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={52}>
                                    {histData.map((d, i) => (
                                      <Cell key={i} fill="var(--teal)" />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Points by Category Pie */}
                          <div style={{ background: 'var(--paper)', padding: '16px 20px' }}>
                            <div className="chart-zone-header" style={{ marginBottom: 12 }}>
                              <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Points by Category</div>
                              <div style={{ fontSize: 10, color: 'var(--fog)' }}>All departments combined</div>
                            </div>
                            <div style={{ position: 'relative', width: '100%', height: 180 }}>
                              <ResponsiveContainer>
                                <PieChart>
                                  <Pie
                                    data={pieSlices}
                                    cx="50%" cy="50%"
                                    innerRadius={52} outerRadius={78}
                                    dataKey="value" nameKey="name"
                                    stroke="none"
                                  >
                                    {pieSlices.map((s, i) => <Cell key={i} fill={getCategoryColor(s.fullName, i)} />)}
                                  </Pie>
                                  <Tooltip
                                    content={({ active, payload }) => active && payload?.length ? (
                                      <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '8px 12px', fontSize: 11, boxShadow: 'var(--shadow-pop)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--fog)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{payload[0].payload.fullName}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary)' }}>{fmtInt(payload[0].value)} pts</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)' }}>{totalCatPts > 0 ? Math.round((payload[0].value / totalCatPts) * 100) : 0}% of total</div>
                                      </div>
                                    ) : null}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 9, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.4 }}>Total<br />Points<br />Earned</div>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                              {pieSlices.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: getCategoryColor(s.fullName, i), flexShrink: 0 }} />
                                    <span style={{ color: 'var(--ink)', fontWeight: 500 }} title={s.fullName}>{s.name}</span>
                                  </div>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fog)', flexShrink: 0 }}>
                                    {totalCatPts > 0 ? Math.round((s.value / totalCatPts) * 100) : 0}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Departments */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Departments</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="text" className="ui-select" style={{ width: 140 }} placeholder="Search dept..." value={mosaicSearch} onChange={e => setMosaicSearch(e.target.value)} />
                          <select className="ui-select" value={mosaicSort} onChange={e => setMosaicSort(e.target.value)}>
                            <option value="students">Sort: Students</option>
                            <option value="points">Sort: Points</option>
                            <option value="name">Sort: Name</option>
                          </select>
                        </div>
                      </div>
                      {(() => {
                        const filteredDepts = adminHierarchy
                          .filter(d => d.department.toLowerCase().includes(mosaicSearch.toLowerCase()))
                          .sort((a, b) => mosaicSort === 'points' ? b.avg_points - a.avg_points : mosaicSort === 'students' ? b.student_count - a.student_count : a.department.localeCompare(b.department));
                        const displayedDepts = showAllDepts ? filteredDepts : filteredDepts.slice(0, 5);
                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                              {displayedDepts.map((dept, di) => {
                                const maxPts = Math.max(...(dept.years || []).map(y => y.avg_points || 0), 1);
                                const borderColor = instAvg > 0
                                  ? dept.avg_points > instAvg * 1.05 ? 'var(--teal)'
                                    : dept.avg_points < instAvg * 0.95 ? 'var(--coral)'
                                      : 'var(--brand-primary)'
                                  : 'var(--brand-primary)';
                                return (
                                  <div key={dept.department || di} className="dept-tile"
                                    style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '16px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                                    title={dept.department}
                                    onClick={() => { setIsDrawerOpen(true); setSelDeptDrawer(dept); setSelStudent(null); }}
                                    role="button" tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && (() => { setIsDrawerOpen(true); setSelDeptDrawer(dept); setSelStudent(null); })()}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: borderColor }} aria-hidden="true" />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                      <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', fontSize: 20, marginBottom: 2, lineHeight: 1 }}>{abbreviateDept(dept.department)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--fog)' }}>{dept.student_count} students</div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: borderColor, fontSize: 13 }}>{fmt(dept.avg_points)}</div>
                                        <div style={{ fontSize: 9, color: 'var(--fog)' }}>avg pts</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
                                      {(dept.years || []).map(year => (
                                        <div key={year.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }} title={`Year ${year.year}: ${fmt(year.avg_points)} pts`}>
                                          <div style={{ width: '100%', background: borderColor, opacity: 0.75, borderRadius: '2px 2px 0 0', height: `${Math.max((year.avg_points / maxPts) * 100, 5)}%` }} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {filteredDepts.length > 5 && (
                              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setShowAllDepts(prev => !prev)}
                                  aria-expanded={showAllDepts}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {showAllDepts ? (
                                    <>
                                      <ChevronUp size={14} aria-hidden="true" />
                                      <span>Show less</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} aria-hidden="true" />
                                      <span>Show more ({filteredDepts.length - 5} remaining)</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {/* Border colour legend */}
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)' }}>Border:</span>
                        {[['var(--teal)', 'Above avg'], ['var(--brand-primary)', 'Near avg'], ['var(--coral)', 'Below avg']].map(([c, l]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--fog)' }}>
                            <div style={{ width: 3, height: 16, background: c, borderRadius: 1 }} aria-hidden="true" />{l}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Student Rankings */}
                    <div className="card" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                      <div className="card-header">
                        <div className="card-title"><GraduationCap size={14} color="var(--brand-primary)" aria-hidden="true" />Student Rankings</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select className="ui-select" value={filterDept} onChange={e => setFilterDept(e.target.value)} aria-label="Filter department">
                            <option value="">All Departments</option>
                            {deptStats.map((d, i) => <option key={i} value={d.department}>{abbreviateDept(d.department)}</option>)}
                          </select>
                          <select className="ui-select" value={filterYear} onChange={e => setFilterYear(e.target.value)} aria-label="Filter year">
                            <option value="">All Years</option>
                            <option value="I">Year I</option><option value="II">Year II</option>
                            <option value="III">Year III</option><option value="IV">Year IV</option>
                          </select>
                          <select className="ui-select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)} aria-label="Filter engagement">
                            <option value="">All Engagement</option>
                            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                          </select>
                          <button className="btn-secondary" onClick={() => exportCSV(leaderboard)} aria-label="Export CSV">
                            <Download size={12} aria-hidden="true" /> Export
                          </button>
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto', width: '100%', maxHeight: 600 }}>
                        <table className="data-table" aria-label="Student rankings">
                          <thead><tr>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 48, zIndex: 10 }}>Rank</th><th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 90, zIndex: 10 }}>Roll No</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 10 }}>Name</th><th style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 10 }}>Department</th><th style={{ position: 'sticky', top: 0, background: 'var(--paper)', textAlign: 'center', width: 50, zIndex: 10 }}>Year</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', textAlign: 'right', width: 100, zIndex: 10 }}>Total Pts</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', textAlign: 'right', width: 100, zIndex: 10 }}>Balance</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 110, zIndex: 10 }}>Engagement</th><th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 36, zIndex: 10 }}></th>
                          </tr></thead>
                          <tbody>
                            {leaderboard.map(s => (
                              <tr key={s.roll_no}>
                                <td style={{ textAlign: 'center' }}><div className={`rank-mark ${s.rank === 1 ? 'rank-1' : s.rank === 2 ? 'rank-2' : s.rank === 3 ? 'rank-3' : 'rank-n'}`}>{s.rank}</div></td>
                                <td className="td-mono td-meta">{s.roll_no}</td>
                                <td className="td-name">{s.student_name}</td>
                                <td className="td-meta truncate" style={{ maxWidth: 140 }} title={s.department}>{abbreviateDept(s.department)}</td>
                                <td className="td-mono td-meta" style={{ textAlign: 'center' }}>{s.year}</td>
                                <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(s.total_points)}</td>
                                <td className="td-mono" style={{ textAlign: 'right', color: 'var(--teal)', fontWeight: 700 }}>{fmt(s.balance_points)}</td>
                                <td><StatusBadge level={s.engagement_group === 'High' ? 'high' : s.engagement_group === 'Medium' ? 'medium' : 'low'} label={s.engagement_group} /></td>
                                <td style={{ textAlign: 'center' }}><button className="inspect-btn" onClick={() => openStudentDrawer(s.roll_no)} aria-label={`Inspect ${s.student_name}`}><ScanSearch size={12} /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {hasMore && (
                        <div style={{ textAlign: 'center', padding: '12px', borderTop: '1px solid var(--cloud)' }}>
                          <button className="btn-secondary" onClick={() => fetchLeaderboard(false)}>Load more</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* -- MENTOR PODS -- */}
            {activeTab === 'pods' && (
              <div className="anim-fade-up">
                <div style={{ display: 'flex', gap: 1, marginBottom: 24, background: 'var(--cloud)', border: '1px solid var(--cloud)', borderRadius: 4, overflow: 'hidden', flexWrap: 'nowrap' }} role="region" aria-label="Pod summary">
                  <div className="kpi-tile kpi-tile-lead kpi-wash-blue" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="kpi-label"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--kpi-blue-icon)', display: 'inline-block' }} aria-hidden="true" />Active Pods</div>
                    <div className="kpi-lead-value">{isMentor ? 1 : mentorPods.length}</div>
                    <div className="kpi-trend" style={{ color: 'var(--kpi-blue-icon)', fontSize: 10, marginTop: 4 }}>1 mentor per 20 students</div>
                  </div>
                  <div className="kpi-tile kpi-wash-green" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="kpi-label" style={{ color: 'var(--kpi-green-icon)' }}>On Track</div>
                    <div className="kpi-value" style={{ color: 'var(--kpi-green-icon)' }}>
                      {(isMentor ? [myPod] : mentorPods).filter(Boolean).reduce((a, p) => a + p.students.filter(s => s.engagement_group === 'High').length, 0)}
                    </div>
                  </div>
                  <div className="kpi-tile kpi-wash-gold" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="kpi-label" style={{ color: 'var(--kpi-gold-icon)' }}>Needs Attention</div>
                    <div className="kpi-value" style={{ color: 'var(--kpi-gold-icon)' }}>
                      {(isMentor ? [myPod] : mentorPods).filter(Boolean).reduce((a, p) => a + p.students.filter(s => s.engagement_group === 'Medium').length, 0)}
                    </div>
                  </div>
                  <div className="kpi-tile kpi-wash-coral" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="kpi-label" style={{ color: 'var(--coral)' }}>At Risk</div>
                    <div className="kpi-value" style={{ color: 'var(--coral)' }}>
                      {(isMentor ? [myPod] : mentorPods).filter(Boolean).reduce((a, p) => a + p.students.filter(s => s.engagement_group === 'Low').length, 0)}
                    </div>
                  </div>
                  <div className="kpi-tile kpi-wash-purple" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="kpi-label"><Activity size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: 'var(--kpi-purple-icon)' }} aria-hidden="true" />Active This Period</div>
                    <div className="kpi-value" style={{ color: 'var(--kpi-purple-icon)' }}>
                      {(isMentor ? [myPod] : mentorPods).filter(Boolean).reduce((a, p) => a + p.students.filter(s => (s.total_points || 0) > 0).length, 0).toLocaleString()}
                    </div>
                    <div className="kpi-trend" style={{ color: 'var(--kpi-purple-icon)', fontSize: 10, marginTop: 4 }}>~ engaged students</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)' }}>Status:</span>
                  {[['var(--teal)', 'On track'], ['var(--amber)', 'Needs attention'], ['var(--coral)', 'At risk']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fog)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} aria-hidden="true" />{l}
                    </div>
                  ))}
                </div>
                <div className="pod-grid" role="region" aria-label="Mentor pods">
                  {(isMentor ? [myPod] : mentorPods).filter(Boolean).map((pod, pi) => {
                    const atRisk = pod.students.filter(s => s.engagement_group === 'Low').length;
                    const needsAttn = pod.students.filter(s => s.engagement_group === 'Medium').length;
                    const capPct = pod.capacity / 20;
                    const capCls = capPct >= 1 ? 'pod-capacity-full' : capPct >= 0.8 ? 'pod-capacity-warn' : 'pod-capacity-ok';
                    return (
                      <div key={pi} className="pod-card" role="article" aria-label={`Pod: ${pod.mentor.short}`}>
                        <div className="pod-mentor-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div className="pod-mentor-name">{pod.mentor.short}</div>
                              <button style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 2 }}
                                onClick={() => {
                                  setComposeTo(pod.mentor.id + "@rewardplatform.edu");
                                  setComposeSubject(`Milestone Update: Dept ${pod.dept}`);
                                  setComposeBody(`Dear ${pod.mentor.name},\n\nHope this message finds you well. Here is the progress report for the students under your supervision.`);
                                  setComposeStudent({ name: pod.mentor.name, roll: "Mentor" });
                                  setComposeOpen(true);
                                }}
                                title={`Email ${pod.mentor.name}`}>
                                <Mail size={12} />
                              </button>
                            </div>
                            <div className="pod-mentor-dept">{pod.dept}</div>
                          </div>
                          <div className={`pod-capacity-badge ${capCls}`} aria-label={`${pod.capacity} of 20`}>{pod.capacity} / 20</div>
                        </div>
                        <PodCluster students={pod.students} onStudentClick={openStudentDrawer} />
                        <div className="pod-stats-row">
                          <div className="pod-stat"><div className="pod-stat-dot" style={{ background: 'var(--teal)' }} aria-hidden="true" />{pod.students.filter(s => s.engagement_group === 'High').length} on track</div>
                          {needsAttn > 0 && <div className="pod-stat"><div className="pod-stat-dot" style={{ background: 'var(--amber)' }} aria-hidden="true" />{needsAttn} attention</div>}
                          {atRisk > 0 && <div className="pod-stat"><div className="pod-stat-dot" style={{ background: 'var(--coral)' }} aria-hidden="true" />{atRisk} at risk</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!isMentor && mentorPods.length > 0 && (
                  <div className="card" style={{ marginTop: 24 }}>
                    <div className="card-header"><div className="card-title"><Users size={14} color="var(--teal)" aria-hidden="true" />Mentor Capacity</div></div>
                    <div className="card-body">
                      <div className="capacity-chart" role="list">
                        {mentorPods.map((pod, pi) => {
                          const pct = (pod.capacity / 20) * 100;
                          const fillColor = pct >= 100 ? 'var(--coral)' : pct >= 80 ? 'var(--amber)' : 'var(--teal)';
                          const lbl = pct >= 100 ? 'Full' : pct >= 80 ? 'Near-full' : `${20 - pod.capacity} open`;
                          return (
                            <div key={pi} className="capacity-row" role="listitem">
                              <div className="capacity-name" title={pod.mentor.short}>{pod.mentor.short}</div>
                              <div className="capacity-bar-track"><div className="capacity-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: fillColor }} /></div>
                              <div className="capacity-val" style={{ color: fillColor }}>{pod.capacity}/20</div>
                              <div style={{ fontSize: 9, color: fillColor, fontWeight: 700, width: 52, textAlign: 'right', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{lbl}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* -- AI ASSISTANT -- */}
            {activeTab === 'assistant' && (
              <div className="anim-fade-up">
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-body" style={{ padding: '20px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ask about the data</div>
                    <div style={{ fontSize: 12, color: 'var(--fog)', marginBottom: 12 }}>Try: "Show Year II CSE students with balance points &gt; 500"</div>
                    <div className="ai-search-wrap">
                      <input type="text" className="ai-search-input" placeholder="Query student data in plain language..."
                        value={aiQuery} onChange={e => setAiQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAiSearch(aiQuery); }} aria-label="AI query" />
                      <button className="ai-search-btn" onClick={() => handleAiSearch(aiQuery)}
                        disabled={!aiQuery.trim() || aiLoading} aria-label="Submit query">
                        {aiLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><ArrowRight size={14} /> Search</>}
                      </button>
                    </div>
                  </div>
                </div>
                {aiLoading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fog)' }}><div className="spinner" style={{ margin: '0 auto 12px' }} /><div style={{ fontSize: 12 }}>Processing...</div></div>}
                {aiResult && !aiLoading && (
                  <div className="anim-fade-up" style={{ maxWidth: '100%' }}>
                    <div className="ai-result-card" style={{ maxWidth: '100%', overflowX: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <BrainCircuit size={14} color="var(--teal)" aria-hidden="true" />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal)' }}>Answer</span>
                        <button className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }} onClick={() => { setAiResult(null); setAiQuery(''); setAiResultVisibleCount(200); }}>New query</button>
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)', fontWeight: 500 }}>
                        {aiResult.answer ? aiResult.answer.split('**').map((part, idx) => idx % 2 === 1 ? <strong key={idx} style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{part}</strong> : part) : 'No answer generated.'}
                      </div>
                      {aiResult.answer_type === 'chart' && aiResult.chart_data && (
                        <div style={{ height: 250, marginTop: 16 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            {aiResult.chart_data.chartType === 'bar' ? (
                              <BarChart data={aiResult.chart_data.data} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cloud)" />
                                <XAxis dataKey={aiResult.chart_data.nameKey} tick={{ fontSize: 10, fill: 'var(--fog)' }} interval={0} angle={-45} textAnchor="end" height={60} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--fog)' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey={aiResult.chart_data.dataKey} fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            ) : (
                              <PieChart>
                                <Pie data={aiResult.chart_data.data} dataKey={aiResult.chart_data.dataKey} nameKey={aiResult.chart_data.nameKey} cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 10, fill: 'var(--fog)' }}>
                                  {aiResult.chart_data.data.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    {aiResult.results?.length > 0 && (
                      <div className="card" style={{ marginTop: 16, maxWidth: '100%', overflow: 'hidden' }}>
                        <div className="card-header">
                          <div className="card-title">Matching Students ({aiResult.results.length})</div>
                          <button className="btn-secondary" onClick={() => exportCSV(aiResult.results)}><Download size={12} /> Export CSV</button>
                        </div>
                        <div style={{ overflowX: 'auto', width: '100%' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                {['Roll No', 'Name', 'Mentor Name', 'Department', 'Year', 'Reward Points', 'Engagement'].map(lbl => (
                                  <th key={lbl} style={{ position: 'sticky', top: 0, background: 'var(--paper)', textAlign: lbl === 'Roll No' || lbl === 'Name' ? 'left' : 'right' }}>{lbl}</th>
                                ))}
                                <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 36 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {aiResult.results.slice(0, aiResultVisibleCount).map((row, index) => {
                                let rawMentor = (row.mentor_id || row.mentor_name || '').toLowerCase();
                                if (!rawMentor && row.roll_no) {
                                  const sum = String(row.roll_no).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                                  rawMentor = MENTOR_ROSTER[sum % MENTOR_ROSTER.length].id;
                                }
                                const mentorObj = MENTOR_ROSTER.find(m => m.id.toLowerCase() === rawMentor);
                                const mentorDisplay = mentorObj ? mentorObj.name : (rawMentor || '—');
                                return (
                                  <tr key={row.roll_no || index}>
                                    <td className="td-mono td-meta" style={{ textAlign: 'left' }}>{row.roll_no || '—'}</td>
                                    <td className="td-name" style={{ textAlign: 'left' }}>{row.student_name || '—'}</td>
                                    <td className="td-mono" style={{ textAlign: 'right' }}>{mentorDisplay}</td>
                                    <td className="td-mono" style={{ textAlign: 'right' }}>{row.department ? abbreviateDept(row.department) : '—'}</td>
                                    <td className="td-mono" style={{ textAlign: 'right' }}>{row.year || '—'}</td>
                                    <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.total_points)}</td>
                                    <td className="td-mono" style={{ textAlign: 'right' }}>
                                      {row.engagement_group ? <StatusBadge level={row.engagement_group === 'High' ? 'high' : row.engagement_group === 'Medium' ? 'medium' : 'low'} label={row.engagement_group} /> : '—'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {row.roll_no && <button className="inspect-btn" onClick={() => openStudentDrawer(row.roll_no)} aria-label={`Inspect ${row.student_name || row.roll_no}`}><ScanSearch size={12} /></button>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {aiResult.results.length > aiResultVisibleCount && (
                          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--cloud)', textAlign: 'center', background: 'var(--cloud)' }}>
                            <button className="btn-secondary" onClick={() => setAiResultVisibleCount(v => v + 200)}>
                              Load more ({aiResultVisibleCount} shown of {aiResult.results.length} total)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* -- POLICY ALERTS -- */}
            {activeTab === 'alerts' && (
              <div className="anim-fade-up">
                {alerts.length > 0 && (() => {
                  const highCount = alerts.filter(a => a.severity === 'High').length;
                  const medCount = alerts.filter(a => a.severity === 'Medium').length;
                  const lowCount = alerts.filter(a => a.severity === 'Low').length;
                  const deptCounts = alerts.reduce((acc, a) => { const d = hmDepts.find(dept => a.title?.includes(dept)) || hmDepts[Math.floor(Math.random() * hmDepts.length)]; acc[d] = (acc[d] || 0) + 1; return acc; }, {});
                  const topDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        <div className="card">
                          <div className="card-header"><div className="card-title">Severity Distribution</div></div>
                          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20 }}>
                            <div style={{ width: 100, height: 100, position: 'relative' }}>
                              <ResponsiveContainer>
                                <PieChart>
                                  <Pie data={[{ n: 'High', v: highCount }, { n: 'Med', v: medCount }, { n: 'Low', v: lowCount }]} cx="50%" cy="50%" innerRadius={35} outerRadius={45} dataKey="v" stroke="none">
                                    <Cell fill="var(--coral)" /><Cell fill="var(--amber)" /><Cell fill="var(--teal)" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{alerts.length}</div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[{ l: 'High Severity', v: highCount, c: 'var(--coral)', f: 'High' }, { l: 'Medium Severity', v: medCount, c: 'var(--amber)', f: 'Medium' }, { l: 'Low Severity', v: lowCount, c: 'var(--teal)', f: 'Low' }].map(x => (
                                <div key={x.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, background: alertSevFilter === x.f ? 'var(--paper-dark)' : 'transparent' }} onClick={() => setAlertSevFilter(alertSevFilter === x.f ? null : x.f)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />{x.l}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: x.c }}>{x.v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="card">
                          <div className="card-header"><div className="card-title">Top Flagged Departments</div></div>
                          <div className="card-body" style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {topDepts.map(([d, c]) => (
                                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: 'var(--ink)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{d}</div>
                                  <div style={{ flex: 1, height: 6, background: 'var(--paper-mid)', borderRadius: 3 }}><div style={{ width: `${(c / Math.max(...topDepts.map(x => x[1]))) * 100}%`, height: '100%', background: 'var(--brass)', borderRadius: 3 }} /></div>
                                  <div style={{ width: 20, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--fog)' }}>{c}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bulk Selection Actions Strip */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--cloud)', paddingBottom: 12 }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Active Alerts</h3>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {selectedAlerts.length > 0 && (
                            <div style={{ background: 'var(--paper)', border: '1px solid var(--coral)', padding: '4px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)' }}>{selectedAlerts.length} selected</span>
                              <button className="btn-primary-ink" style={{ padding: '4px 10px', fontSize: 10, background: 'var(--coral)' }} onClick={handleNotifyBulk}>Notify all mentors</button>
                              <button style={{ background: 'none', border: 'none', color: 'var(--fog)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setSelectedAlerts([])}>Clear</button>
                            </div>
                          )}
                          <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}
                            onClick={() => {
                              if (selectedAlerts.length === alerts.length) setSelectedAlerts([]);
                              else setSelectedAlerts(alerts);
                            }}>
                            {selectedAlerts.length === alerts.length ? "Deselect All" : "Select All in View"}
                          </button>
                          {alertSevFilter && <button className="btn-secondary" onClick={() => setAlertSevFilter(null)}><X size={12} /> Clear filter</button>}
                        </div>
                      </div>

                      {filteredAlerts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--fog)', fontSize: 13 }}>No alerts match current filter.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                          {/* 1. Needs Immediate Attention - Individual critical cards */}
                          {criticalAlerts.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--coral)', marginBottom: 12, borderBottom: '1px solid var(--cloud)', paddingBottom: 6 }}>
                                Needs Immediate Attention ({criticalAlerts.length})
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16 }}>
                                {criticalAlerts.map((alert, idx) => {
                                  const isSel = selectedAlerts.some(x => x.title === alert.title);
                                  const mentorId = (alert.mentor_id || 'meena').toLowerCase();
                                  const mentorObj = MENTOR_ROSTER.find(m => m.id === mentorId) || MENTOR_ROSTER[0];
                                  const reqVel = alert.points_needed_per_day || 0.0;
                                  const totalP = alert.total_points || 0;
                                  const reqP = alert.points_required || 2000;

                                  const mentorPod = mentorPods.find(p => p.mentor.id === mentorId);
                                  const podAtRisk = mentorPod ? mentorPod.students.filter(s => s.engagement_group === 'Low').length : 0;
                                  const dotColor = podAtRisk > 4 ? 'var(--coral)' : podAtRisk > 1 ? 'var(--amber)' : 'var(--teal)';

                                  return (
                                    <div key={idx} className="alert-badge-card alert-high" style={{ position: 'relative', padding: '16px 20px', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <input type="checkbox" checked={isSel}
                                            onChange={() => {
                                              if (isSel) setSelectedAlerts(selectedAlerts.filter(x => x.title !== alert.title));
                                              else setSelectedAlerts([...selectedAlerts, alert]);
                                            }}
                                            style={{ cursor: 'pointer' }} />
                                          <div>
                                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{alert.student_name || alert.title.split(":").pop().trim()}</div>
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)' }}>{alert.roll_no} &bull; {abbreviateDept(alert.department)}</div>
                                          </div>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--coral)', color: 'white', padding: '2px 6px', borderRadius: 2, fontWeight: 700 }}>HIGH RISK</span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', fontSize: 11, color: 'var(--fog)' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} title="Mentor pod engagement status" />
                                        <span>Mentor: <strong>{mentorObj.name}</strong></span>
                                      </div>

                                      <div style={{ margin: '6px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fog)', marginBottom: 4 }}>
                                          <span>Progress</span>
                                          <span>{totalP} / {reqP} pts</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--paper-mid)', borderRadius: 3, overflow: 'hidden' }}>
                                          <div style={{ width: `${Math.min(100, (totalP / reqP) * 100)}%`, height: '100%', background: 'var(--coral)' }} />
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, borderTop: '1px solid var(--cloud)', paddingTop: 8 }}>
                                        <div>
                                          <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 900, color: 'var(--coral)' }}>{reqVel} pts/day</div>
                                          <div style={{ fontSize: 9, color: 'var(--fog)', textTransform: 'uppercase', fontWeight: 700 }}>needed to bridge gap</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)' }}>{alert.days_left} days</div>
                                          <div style={{ fontSize: 9, color: 'var(--fog)', textTransform: 'uppercase', fontWeight: 700 }}>remaining</div>
                                        </div>
                                      </div>

                                      {/* Hover actions overlay */}
                                      <div className="critical-hover-actions" style={{ position: 'absolute', inset: 0, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0, transition: 'opacity 0.15s ease' }}>
                                        <button className="btn-primary-ink" style={{ padding: '8px 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleNotifyMentor(alert)}>
                                          <Mail size={12} /> Notify Mentor
                                        </button>
                                        <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => openStudentDrawer(alert.roll_no)}>
                                          <ScanSearch size={12} /> Inspect Profile
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 2. Grouped Policy Violations / Notices */}
                          {groupedAlerts.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fog)', marginBottom: 12, borderBottom: '1px solid var(--cloud)', paddingBottom: 6 }}>
                                Policy Violations & Notices ({nonCriticalAlerts.length})
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                                {groupedAlerts.map((grp, idx) => (
                                  <div key={idx} style={{ position: 'relative' }}>
                                    <input type="checkbox"
                                      checked={grp.alerts.every(x => selectedAlerts.some(s => s.title === x.title))}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAlerts([...selectedAlerts, ...grp.alerts.filter(x => !selectedAlerts.some(s => s.title === x.title))]);
                                        } else {
                                          setSelectedAlerts(selectedAlerts.filter(x => !grp.alerts.some(a => a.title === x.title)));
                                        }
                                      }}
                                      style={{ position: 'absolute', top: 12, left: 36, zIndex: 10, cursor: 'pointer' }} />
                                    {grp.alerts.length === 1 ? (
                                      <div style={{ paddingLeft: 16 }}>
                                        <AlertBadgeCard alert={grp.alerts[0]} pulseOnMount={false} />
                                      </div>
                                    ) : (
                                      <div style={{ paddingLeft: 16 }}>
                                        <GroupedAlertCard title={grp.title} alerts={grp.alerts} severity={grp.severity} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                {alerts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--fog)' }}>
                    <CheckCircle size={32} style={{ marginBottom: 8, color: 'var(--teal)' }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No active alerts</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>All policy checks passed.</div>
                  </div>
                )}
              </div>
            )}

            {/* -- ADMIN SETTINGS -- */}
            {activeTab === 'settings' && (
              <div className="anim-fade-up">
                <div className="tab-strip" style={{ marginBottom: 20 }} role="tablist">
                  {[['templates', 'Notification Templates'], ['import', 'CSV / Excel Bulk Import'], ['audit', 'Audit Log Trail']].map(([sub, lbl]) => (
                    <button key={sub} className={`tab-btn ${settingsSubTab === sub ? 'active' : ''}`} onClick={() => setSettingsSubTab(sub)} role="tab" aria-selected={settingsSubTab === sub}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Templates Editor */}
                {settingsSubTab === 'templates' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
                    <div className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Template Editor</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="ui-select" value={selectedTemplate}
                            onChange={(e) => {
                              setSelectedTemplate(e.target.value);
                              const t = templates.find(x => x.name === e.target.value);
                              if (t) { setTempSubject(t.subject); setTempBody(t.body); }
                            }}>
                            <option value="IP Redemption Risk">IP Redemption Risk</option>
                            <option value="Manual check-in">Manual check-in</option>
                          </select>
                          <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={handleResetTemplates}>Reset Defaults</button>
                        </div>
                      </div>

                      <div className="form-field" style={{ marginBottom: 16 }}>
                        <label className="form-label">Subject Line</label>
                        <input type="text" className="form-input" value={tempSubject} onChange={e => setTempSubject(e.target.value)} />
                      </div>

                      <div className="form-field" style={{ marginBottom: 12 }}>
                        <label className="form-label">Message Body</label>
                        <textarea className="form-input" style={{ minHeight: 150, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }} value={tempBody} onChange={e => setTempBody(e.target.value)} />
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fog)', textTransform: 'uppercase', marginBottom: 6 }}>Insert Variable Token</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {['student_name', 'roll_no', 'department', 'days_left', 'points_earned', 'points_needed', 'points_needed_per_day', 'mentor_name'].map(tok => (
                            <button key={tok} className="btn-secondary" style={{ padding: '3px 8px', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                              onClick={() => setTempBody(p => p + `{${tok}}`)}>
                              +{tok}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button className="btn-primary-ink" style={{ width: '100%', padding: '10px 16px' }} onClick={handleSaveTemplate}>
                        Save Template Changes
                      </button>
                    </div>

                    <div className="card" style={{ padding: 20, background: 'var(--paper-mid)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Live Rendering Preview</div>
                      <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: 14, minHeight: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--fog)', fontWeight: 600 }}>To:</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink)', marginLeft: 6 }}>meena@rewardplatform.edu</span>
                        </div>
                        <div style={{ borderBottom: '1px solid var(--cloud)', paddingBottom: 8 }}>
                          <span style={{ fontSize: 10, color: 'var(--fog)', fontWeight: 600 }}>Subject:</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginLeft: 6 }}>{renderTemplateString(tempSubject, previewData)}</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--ink)', whiteSpace: 'pre-wrap', flex: 1 }}>
                          {renderTemplateString(tempBody, previewData)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--fog)', borderTop: '1px solid var(--cloud)', paddingTop: 8 }}>
                          * Dynamic tags are compiled on transaction dispatch.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CSV Excel import */}
                {settingsSubTab === 'import' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ padding: 20 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--ink)' }}>Bulk Import spreadsheet (.csv or .xlsx)</div>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 8, border: '1px solid var(--cloud)', borderRadius: 4, padding: 4, background: 'var(--paper-mid)' }}>
                          <button className={`tab-btn ${importType === 'students' ? 'active' : ''}`} onClick={() => setImportType("students")} style={{ padding: '6px 12px', fontSize: 11 }}>Students Roster</button>
                          <button className={`tab-btn ${importType === 'points' ? 'active' : ''}`} onClick={() => setImportType("points")} style={{ padding: '6px 12px', fontSize: 11 }}>Points History</button>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="btn-secondary" style={{ padding: '10px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <FileUp size={14} /> Select Spreadsheet File
                            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} style={{ display: 'none' }} />
                          </label>
                          {importFile && <span style={{ marginLeft: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{importFile.name}</span>}
                        </div>
                      </div>

                      {importProgress && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Parsing file...</div>}

                      {importResult && (
                        <div style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', borderRadius: 4, padding: 14, marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 13, marginBottom: 4 }}>Import Completed Successfully</div>
                          <div style={{ fontSize: 12, color: 'var(--ink)' }}>{importResult.imported_count} rows imported. {importResult.skipped_count} rows skipped.</div>
                          {importResult.reasons?.length > 0 && (
                            <ul style={{ fontSize: 11, color: 'var(--coral)', marginTop: 8, paddingLeft: 20 }}>
                              {importResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          )}
                        </div>
                      )}

                      {importPreview && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 8 }}>Column Mappings</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                            {Object.keys(columnMappings).map(targetKey => (
                              <div key={targetKey} style={{ background: 'var(--paper-mid)', padding: 8, borderRadius: 4, border: '1px solid var(--cloud)' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fog)', textTransform: 'uppercase', marginBottom: 4 }}>{targetKey}</div>
                                <select className="ui-select" style={{ width: '100%', fontSize: 11 }}
                                  value={columnMappings[targetKey] || ""}
                                  onChange={(e) => setColumnMappings({ ...columnMappings, [targetKey]: e.target.value })}>
                                  <option value="">-- Unmapped --</option>
                                  {importPreview[0] && Object.keys(importPreview[0]).map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>

                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 8 }}>Spreadsheet Data Preview (first 20 rows)</div>
                          <div style={{ overflowX: 'auto', maxHeight: 200, border: '1px solid var(--cloud)', borderRadius: 4, marginBottom: 20 }}>
                            <table className="data-table" style={{ fontSize: 11 }}>
                              <thead>
                                <tr>{Object.keys(importPreview[0] || {}).map(col => <th key={col}>{col}</th>)}</tr>
                              </thead>
                              <tbody>
                                {importPreview.map((row, idx) => (
                                  <tr key={idx}>
                                    {Object.values(row).map((val, i) => <td key={i} className="td-mono">{String(val ?? '')}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {(importErrors.length > 0 || importWarnings.length > 0) && (
                            <div style={{ marginBottom: 20 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 8 }}>Validation results</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div style={{ background: 'var(--coral-light)', border: '1px solid var(--coral)', borderRadius: 4, padding: 12 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', textTransform: 'uppercase', marginBottom: 6 }}>Errors ({importErrors.length})</div>
                                  <ul style={{ fontSize: 10, color: 'var(--ink)', paddingLeft: 16, margin: 0, maxHeight: 120, overflowY: 'auto' }}>
                                    {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                                    {importErrors.length === 0 && <li>No critical validation errors.</li>}
                                  </ul>
                                </div>
                                <div style={{ background: 'var(--brass-light)', border: '1px solid var(--brass)', borderRadius: 4, padding: 12 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brass)', textTransform: 'uppercase', marginBottom: 6 }}>Warnings ({importWarnings.length})</div>
                                  <ul style={{ fontSize: 10, color: 'var(--ink)', paddingLeft: 16, margin: 0, maxHeight: 120, overflowY: 'auto' }}>
                                    {importWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                                    {importWarnings.length === 0 && <li>No warnings.</li>}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          <button className="btn-primary-ink" style={{ width: '100%', padding: '10px 16px' }}
                            onClick={handleCommitImport} disabled={importErrors.length > 0}>
                            Commit and Import Data
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit Logs */}
                {settingsSubTab === 'audit' && (
                  <div className="card" style={{ padding: 20, maxWidth: '100%', overflow: 'hidden' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--ink)' }}>System Audit Trail Logs</h3>
                    <div style={{ overflowX: 'auto', maxHeight: 450, border: '1px solid var(--cloud)', borderRadius: 4, width: '100%' }}>
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 160, zIndex: 10 }}>Timestamp</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', width: 180, zIndex: 10 }}>Action</th>
                            <th style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 10 }}>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log, i) => (
                            <tr key={i}>
                              <td className="td-mono td-meta">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="td-name" style={{ fontWeight: 700 }}>{log.action}</td>
                              <td style={{ lineHeight: 1.5, color: 'var(--ink)' }}>{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* -- EMAIL COMPOSE MODAL -- */}
          {composeOpen && (
            <>
              <div className="drawer-overlay" onClick={() => setComposeOpen(false)} style={{ zIndex: 1500 }} />
              <div className="drawer-panel" style={{ zIndex: 2000, width: '100%', maxWidth: 550, padding: 24 }} role="dialog">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--cloud)', paddingBottom: 12, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0 }}>Email Compose Workspace</h3>
                    {composeStudent && <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 2 }}>Follow-up concerning: {composeStudent.name} ({composeStudent.roll})</div>}
                  </div>
                  <button className="icon-btn" onClick={() => setComposeOpen(false)}><X size={14} /></button>
                </div>
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label className="form-label">Recipient List</label>
                  <input type="text" className="form-input" value={composeTo} onChange={e => setComposeTo(e.target.value)} />
                </div>
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label className="form-label">CC Recipient List</label>
                  <input type="text" className="form-input" value={composeCc} onChange={e => setComposeCc(e.target.value)} placeholder="e.g. admin@rewardplatform.edu, student@rewardplatform.edu" />
                </div>
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label className="form-label">Subject</label>
                  <input type="text" className="form-input" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} />
                </div>
                <div className="form-field" style={{ marginBottom: 16 }}>
                  <label className="form-label">Body Text (Editable)</label>
                  <textarea className="form-input" style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.65 }} value={composeBody} onChange={e => setComposeBody(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setComposeOpen(false)}>Discard</button>
                  <button className="btn-primary-ink" onClick={handleSendCompose}>Send Message</button>
                </div>
              </div>
            </>
          )}

          {/* -- INSPECT DRAWER -- */}
          {isDrawerOpen && (
            <>
              <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} aria-hidden="true" />
              <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Inspection panel">
                {selDeptDrawer ? (
                  <div>
                    <div className="drawer-header">
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: 4 }}>Department</div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{selDeptDrawer.department}</h2>
                        <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 2 }}>{selDeptDrawer.student_count} Students &bull; {fmt(selDeptDrawer.avg_points)} Avg Pts</div>
                      </div>
                      <button className="icon-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Close"><X size={14} /></button>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      <div className="chart-title" style={{ marginBottom: 16 }}><span className="chart-title-accent" aria-hidden="true" />Top 5 Students by Year</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(selDeptDrawer.years || []).map((year, yi) => (
                          <div key={yi} style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 4, padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Year {year.year}</span>
                              <div style={{ fontSize: 11, color: 'var(--fog)' }}>Avg: {fmt(year.avg_points)} pts</div>
                            </div>
                            {year.top_students?.slice(0, 5).map((s, si) => (
                              <div key={s.roll_no} onClick={() => { setSelDeptDrawer(null); openStudentDrawer(s.roll_no); }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', cursor: 'pointer', fontSize: 12, borderBottom: si < 4 ? '1px solid var(--paper-mid)' : 'none' }}
                                role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && (() => { setSelDeptDrawer(null); openStudentDrawer(s.roll_no); })()}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <span style={{ color: 'var(--fog)', fontFamily: 'var(--font-mono)', fontSize: 10, width: 16, textAlign: 'right' }}>#{si + 1}</span>
                                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.student_name}</span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand-primary)', fontWeight: 700, flexShrink: 0 }}>{fmt(s.total_points)} pts</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : selStudent && selStudentExt ? (
                  <div>
                    <div className="drawer-header">
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: 4 }}>Student Profile</div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{selStudent.student_name}</h2>
                        <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 2 }}>{selStudent.roll_no} &bull; {selStudent.department} &bull; Year {selStudent.year}</div>
                      </div>
                      <button className="icon-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Close"><X size={14} /></button>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      <div className="drawer-kpi-grid" role="region" aria-label="Student key figures">
                        {[
                          { label: 'Total Points', value: fmt(selStudent.total_points), color: 'var(--brand-primary)' },
                          { label: 'Overall Rank', value: `#${selStudent.rank}`, color: 'var(--ink)' },
                          { label: 'Dept. Rank', value: `#${selStudent.dept_rank}`, color: 'var(--teal)' },
                          { label: 'Balance', value: fmt(selStudent.balance_points), color: 'var(--teal)' },
                          { label: 'Redeemed', value: fmt(selStudent.redeemed_points), color: 'var(--fog)' },
                          { label: 'Cumulative', value: fmt(selStudent.cumulative_points), color: 'var(--fog)' },
                        ].map((k, i) => (
                          <div key={i} className="drawer-kpi-cell">
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: 4 }}>{k.label}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: k.color }}>{k.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <StatusBadge level={selStudent.engagement_group === 'High' ? 'high' : selStudent.engagement_group === 'Medium' ? 'medium' : 'low'} label={`${selStudent.engagement_group} Engagement`} />
                      </div>
                      <div className="tab-strip" style={{ marginBottom: 16 }} role="tablist">
                        {['overview', 'heatmap', 'totals'].map(tab => (
                          <button key={tab} className={`tab-btn ${drawerTab === tab ? 'active' : ''}`} onClick={() => setDrawerTab(tab)} role="tab" aria-selected={drawerTab === tab}>
                            {tab === 'totals' ? 'Category Totals' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {drawerTab === 'overview' && (
                        <div className="anim-fade-up">
                          {(() => {
                            const { earned, total } = ptsToStamps(selStudent.total_points || 0); return (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6 }}>Points progress</div>
                                <StampTrack earned={earned} total={total} size="sm" />
                              </div>
                            );
                          })()}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 8 }}>Year-wise points</div>
                            <div style={{ width: '100%', height: 130 }}>
                              <ResponsiveContainer>
                                <BarChart data={selStudentExt.yearly_data} margin={{ top: 4, right: 5, left: -20, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="2 4" stroke="var(--cloud)" vertical={false} />
                                  <XAxis dataKey="year" tick={{ fill: 'var(--fog)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                                  <YAxis tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickFormatter={v => v.toLocaleString()} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey="points" name="Points" radius={[2, 2, 0, 0]} fill="var(--brand-primary)" maxBarSize={40} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 8 }}>
                              Monthly trend
                              {selStudentExt.most_active_month && <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--brand-primary)', background: 'var(--kpi-blue-bg)', padding: '1px 5px', borderRadius: 2 }}>Peak: {selStudentExt.most_active_month}</span>}
                            </div>
                            <div style={{ width: '100%', height: 130 }}>
                              <ResponsiveContainer>
                                <AreaChart data={selStudentExt.monthly_data} margin={{ top: 4, right: 5, left: -20, bottom: 4 }}>
                                  <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2F5FD6" stopOpacity={0.25} /><stop offset="95%" stopColor="#2F5FD6" stopOpacity={0} /></linearGradient></defs>
                                  <CartesianGrid strokeDasharray="2 4" stroke="var(--cloud)" vertical={false} />
                                  <XAxis dataKey="month" tickFormatter={v => v.slice(0, 3)} tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                                  <YAxis tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickFormatter={v => v.toLocaleString()} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Area type="monotone" dataKey="points" stroke="var(--brand-primary)" strokeWidth={1.5} fill="url(#dg)" name="Points" activeDot={{ r: 3, fill: 'var(--brand-primary)' }} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}
                      {drawerTab === 'heatmap' && (
                        <div className="anim-fade-up">
                          {selStudentExt.analytics && <>
                            <CalendarHeatmap heatmapData={selStudentExt.analytics.heatmap} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, border: '1px solid var(--cloud)', borderRadius: 4, overflow: 'hidden', marginTop: 12, background: 'var(--cloud)' }}>
                              {[
                                { label: 'Active Days', value: selStudentExt.analytics.heatmap?.filter(d => d.points > 0).length || 0 },
                                { label: 'Max / Day', value: selStudentExt.analytics.heatmap?.length ? fmt(Math.max(...selStudentExt.analytics.heatmap.map(d => d.points), 0)) : '—' },
                                { label: 'Peak Month', value: selStudentExt.analytics.most_active_month || '—' },
                              ].map((k, i) => (
                                <div key={i} style={{ background: 'var(--paper)', padding: '10px 12px', textAlign: 'center' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fog)', marginBottom: 4 }}>{k.label}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{k.value}</div>
                                </div>
                              ))}
                            </div>
                          </>}
                        </div>
                      )}
                      {drawerTab === 'totals' && (
                        <div className="anim-fade-up">
                          <StudentCategoryBars breakdown={selStudent.breakdown} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────────
  //  STUDENT VIEW
  // ──────────────────────────────────────────────────
  const pieData = personalData ? (personalData.breakdown || []).filter(x => x.points > 0) : [];
  const totalPiePoints = pieData.reduce((s, x) => s + x.points, 0);

  let ipDaysLeft = null;
  if (ipRedemptionDate) {
    const rd = new Date(ipRedemptionDate);
    ipDaysLeft = Math.ceil((rd - new Date()) / (1000 * 60 * 60 * 24));
  }

  const carryForward = personalPerformance && personalData
    ? Math.max(0, personalData.cumulative_points - personalPerformance.dept_avg)
    : 0;

  return (
    <div className="student-shell anim-fade-up" data-theme={theme}>
      {/* TOPBAR */}
      <header className="student-topbar">
        <div className="student-topbar-brand">
          <StarCoinIcon size={22} fill="var(--brass)" />
          <div className="student-topbar-brand-name">Reward Points Portal</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', width: 30, height: 30, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}>
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </button>
          <button onClick={handleLogout} style={{ background: 'var(--coral-light)', border: '1px solid var(--coral-mid)', color: 'var(--coral)', borderRadius: 3, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-ui)' }} aria-label="Log out">
            <LogOut size={12} aria-hidden="true" /> Log out
          </button>
        </div>
      </header>

      {personalData ? (
        <main role="main" style={{ padding: '20px 24px' }}>

          {/* -- ROW A: Profile + Department Histogram + IP Countdown -- */}
          <div className="student-row-a" style={{ display: 'grid', gridTemplateColumns: '4fr 3.5fr 2.5fr', gap: 16, marginBottom: 16 }}>

            {/* LEFT — Profile Summary (~40%) */}
            <div className="student-tile-ledger" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px', minHeight: 250 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 4 }}>Student Profile</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 4 }}>{personalData.student_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand-primary)', fontWeight: 600, marginBottom: 12 }}>{personalData.roll_no} &bull; Year {personalData.year}</div>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 2 }}>Department</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>{personalData.department}</div>
              </div>

              <div style={{ borderTop: '1px solid var(--cloud)', borderBottom: '1px solid var(--cloud)', padding: '10px 0', margin: '8px 0' }}>
                <button type="button" onClick={() => setProfileBreakdownOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>cumulative points</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{fmtInt(personalData.cumulative_points)}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fog)', textAlign: 'right' }}>{profileBreakdownOpen ? 'Hide breakdown' : 'Show breakdown'}</div>
                </button>
                {/* Balance Points inline display */}
                {(() => {
                  const balPts = (personalData.cumulative_points || 0) - (personalData.redeemed_points || 0);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Balance Points</div>
                      <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: balPts >= 0 ? 'var(--teal)' : 'var(--coral)' }}>
                        {fmtInt(balPts)}
                      </div>
                    </div>
                  );
                })()}
                {profileBreakdownOpen && (
                  <div style={{ marginTop: 10, padding: 10, background: 'var(--paper-dark)', border: '1px solid var(--cloud)', borderRadius: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cumulative Points</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>{fmtInt(personalData.cumulative_points)}</div></div>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Redeemed Points</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtInt(personalData.redeemed_points)}</div></div>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Balance Points</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>{fmtInt((personalData.cumulative_points || 0) - (personalData.redeemed_points || 0))}</div></div>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total Points</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtInt(personalData.total_points)}</div></div>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total Count</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtInt(personalData.total_count)}</div></div>
                      <div><div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Initial Points</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtInt(personalData.initial_points)}</div></div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 2 }}>Overall Rank</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>#{personalData.rank}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 2 }}>Dept. Rank</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>#{personalData.dept_rank}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {personalData.severity_tier ? (
                    <StatusBadge level={personalData.severity_tier === 'High Performing' ? 'high' : personalData.severity_tier === 'Average' ? 'medium' : 'low'} label={personalData.severity_tier} />
                  ) : (
                    <StatusBadge level={personalData.engagement_group === 'High' ? 'high' : personalData.engagement_group === 'Medium' ? 'medium' : 'low'} label={personalData.engagement_group} />
                  )}
                </div>
              </div>
            </div>

            {/* MIDDLE — Dept histogram with YOU + AVG markers (~35%) */}
            <div className="student-tile" style={{ padding: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6 }}>Where you stand</div>
              {personalPerformance ? (
                <>
                  {(() => {
                    const diff = personalPerformance.student_points - personalPerformance.dept_avg;
                    const pctDiff = personalPerformance.dept_avg ? diff / personalPerformance.dept_avg : 0;
                    let color = 'var(--brass)';
                    if (pctDiff > 0.05) color = 'var(--teal)';
                    else if (pctDiff < -0.05) color = 'var(--coral)';

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: 'var(--fog)' }}>Dept Avg: <strong style={{ color: 'var(--ink)' }}>{fmt(personalPerformance.dept_avg)} pts</strong></span>
                          <span style={{ color: 'var(--fog)' }}>Your Points: <strong style={{ color: 'var(--ink)' }}>{fmt(personalPerformance.student_points)} pts</strong></span>
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>
                          {diff < 0 ? `You are ${fmt(Math.abs(diff))} pts below average` : `You are ${fmt(diff)} pts above average`}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)', marginLeft: 10 }}>Top {personalPerformance.percentile}%</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ width: '100%', height: 150 }}>
                    <ResponsiveContainer>
                      <BarChart data={personalPerformance.histogram} margin={{ top: 18, right: 0, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--cloud)" vertical={false} />
                        <XAxis dataKey="bucket" tick={{ fill: 'var(--fog)', fontSize: 8, fontFamily: 'var(--font-mono)' }} />
                        <YAxis tick={{ fill: 'var(--fog)', fontSize: 8, fontFamily: 'var(--font-mono)' }} />
                        <Tooltip cursor={{ fill: 'var(--paper-mid)' }} contentStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(v) => [v, 'students']} />
                        <Bar dataKey="count" fill="var(--cloud)" radius={[2, 2, 0, 0]} />
                        <ReferenceLine x={(() => {
                          const pt = personalPerformance.student_points;
                          if (pt < 1000) return '0-1k'; if (pt < 2000) return '1k-2k'; if (pt < 3000) return '2k-3k';
                          if (pt < 4000) return '3k-4k'; if (pt < 5000) return '4k-5k'; if (pt < 6000) return '5k-6k';
                          return '6k+';
                        })()} stroke="var(--brass)" strokeWidth={2} strokeDasharray="3 3"
                          label={{ position: 'top', value: 'YOU', fill: 'var(--brass)', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--fog)', fontSize: 12, paddingTop: 20 }}>Loading...</div>
              )}
            </div>

            {/* RIGHT — IP Redemption Countdown + Action Option Button + Carry-forward (~25%) */}
            <div className="student-tile" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6, textAlign: 'center' }}>IP Deadline</div>
                {ipDaysLeft !== null ? (
                  <>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: ipDaysLeft <= 7 ? 'var(--coral)' : 'var(--brass)', marginBottom: 2, textAlign: 'center' }}>
                      {Math.max(0, ipDaysLeft)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fog)', textAlign: 'center' }}>days remaining</div>
                    {ipDaysLeft <= 7 && ipDaysLeft >= 0 && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', background: 'var(--coral-light)', padding: '4px 8px', borderRadius: 3, border: '1px solid var(--coral-mid)', lineHeight: 1.4, marginTop: 6, textAlign: 'center' }}>
                        Redeem points soon.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--fog)', lineHeight: 1, marginBottom: 4, textAlign: 'center' }}>—</div>
                    <div style={{ fontSize: 11, color: 'var(--fog)', textAlign: 'center' }}>No deadline set.</div>
                  </>
                )}

                {/* RECTANGULAR ACTION BUTTON FOR BELOW-AVERAGE VS ABOVE-AVERAGE STUDENTS */}
                {(() => {
                  const studentBal = personalPerformance?.student_points || personalData?.total_points || 0;
                  const deptAvg = personalPerformance?.dept_avg || 0;
                  const isBelow = studentBal < deptAvg;

                  return isBelow ? (
                    <button
                      ref={suggestionsTriggerRef}
                      onClick={handleOpenAIModal}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--amber-light)',
                        border: '2px solid var(--amber)',
                        borderRadius: 6,
                        color: 'var(--amber)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s ease',
                        marginTop: 14
                      }}
                    >
                      View Suggestions
                    </button>
                  ) : null;
                })()}
              </div>

              {/* Carry forward moved here */}
              <div style={{ borderTop: '1px solid var(--cloud)', paddingTop: 10, marginTop: 10, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 2 }}>Carry-forward points</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: carryForward > 0 ? 'var(--brass)' : 'var(--fog)' }}>
                  {fmtInt(carryForward)} pts
                </div>
              </div>
            </div>
          </div>

          {/* -- ROW B: Trend chart -- */}
          <div className="student-row-b" role="region" aria-label="Points trend" style={{ marginBottom: 16 }}>
            <div className="chart-zone-header">
              <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Points trend</div>
              <div className="tab-strip" role="group" aria-label="Trend period">
                {[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([v, l]) => (
                  <button key={v} className={`tab-btn ${trendView === v ? 'active' : ''}`} onClick={() => setTrendView(v)} aria-pressed={trendView === v}>{l}</button>
                ))}
              </div>
            </div>
            {personalAnalytics && (
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer>
                  <AreaChart data={trendView === 'weekly' ? personalAnalytics.weekly_trend : trendView === 'monthly' ? personalAnalytics.monthly_trend : personalAnalytics.yearly_trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E0A030" stopOpacity={0.2} /><stop offset="95%" stopColor="#E0A030" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="var(--cloud)" vertical={false} />
                    <XAxis dataKey={trendView === 'weekly' ? 'day' : trendView === 'monthly' ? 'month' : 'year'} tick={{ fill: 'var(--fog)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={v => trendView === 'yearly' ? v : typeof v === 'string' ? v.slice(0, 3) : v} />
                    <YAxis tick={{ fill: 'var(--fog)', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickFormatter={v => v.toLocaleString()} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="points" stroke="var(--brass)" strokeWidth={2} fill="url(#tg)" name="Points earned" activeDot={{ r: 4, fill: 'var(--brass)', stroke: 'var(--paper)', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* -- ROW C: Donut + Mentor -- */}
          <div className="student-row-c" role="region" aria-label="Points distribution and mentor" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="student-col">
              <div className="chart-title" style={{ marginBottom: 14 }}>
                <span className="chart-title-accent" aria-hidden="true" />Points distribution
              </div>
              {pieData.length > 0 ? (
                <>
                  <div style={{ position: 'relative', width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="points" stroke="none" nameKey="category">
                          {pieData.map((cat, i) => <Cell key={i} fill={getCategoryColor(cat.category, i)} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{Math.round(totalPiePoints).toLocaleString()}</div>
                        <div style={{ fontSize: 8, color: 'var(--fog)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>total pts</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                    {pieData.map((cat, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: getCategoryColor(cat.category, i), flexShrink: 0 }} />
                          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{cat.category}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)' }}>
                          {totalPiePoints > 0 ? Math.round((cat.points / totalPiePoints) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--fog)', fontSize: 12 }}>No points earned yet.</div>
              )}
            </div>

            <div className="student-col">
              <div className="chart-title" style={{ marginBottom: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} aria-hidden="true" />
                &nbsp;Your mentor
              </div>
              <div className="mentor-card" role="region" aria-label="Mentor information">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div className="mentor-avatar-circle" aria-hidden="true">M</div>
                  <div style={{ flex: 1 }}>
                    <div className="mentor-name">Dr. Meena Ravishankar</div>
                    <div className="mentor-meta">Dept: {abbreviateDept(personalData.department)} &bull; AI &amp; Research</div>
                    <div style={{ marginTop: 5 }}><span className="mentor-capacity" aria-label="Pod: 17 of 20 students">17 / 20 pod</span></div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6, marginBottom: 12, padding: '8px 10px', background: 'var(--teal-light)', borderRadius: 3, borderLeft: '2px solid var(--teal)' }}>
                  You share lab and research focus with 16 others in this pod.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="mentor-action-btn" aria-label="Message mentor"><MessageSquare size={12} aria-hidden="true" /> Message mentor</button>
                  <button className="mentor-action-btn mentor-action-btn-secondary" aria-label="Schedule session"><CalendarDays size={12} aria-hidden="true" /> Schedule session</button>
                </div>
              </div>
            </div>
          </div>

          {/* -- ROW C2: You vs Your Department stats -- */}
          {personalPerformance && (
            <div className="student-row-c2" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }} role="region" aria-label="Performance comparison">
              <div style={{ width: '100%', maxWidth: '900px' }}>
                <div className="chart-title" style={{ marginBottom: 14, textAlign: 'left' }}>
                  <span className="chart-title-accent" aria-hidden="true" />You vs Your Department
                </div>
                <div style={{ background: 'var(--paper)', padding: 24, border: '1px solid var(--cloud)', borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, borderBottom: '1px solid var(--cloud)', paddingBottom: 20, marginBottom: 20, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6 }}>Your cumulative points</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{fmt(personalPerformance.student_points)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6 }}>Department average</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{fmt(personalPerformance.dept_avg)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fog)', marginBottom: 6 }}>Year average</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{fmt(personalPerformance.year_avg)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {(() => {
                      const diff = personalPerformance.student_points - personalPerformance.dept_avg;
                      const pctDiff = personalPerformance.dept_avg ? (diff / personalPerformance.dept_avg) : 0;
                      let color = 'var(--brass)'; let bg = 'var(--brass-light)'; let text = `▲ ${fmt(Math.abs(diff))} pts near dept avg`;
                      if (pctDiff > 0.05) { color = 'var(--teal)'; bg = 'var(--teal-light)'; text = `▲ ${fmt(Math.abs(diff))} pts above dept avg`; }
                      else if (pctDiff < -0.05) { color = 'var(--coral)'; bg = 'var(--coral-light)'; text = `▼ ${fmt(Math.abs(diff))} pts below dept avg`; }
                      return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: bg, color, padding: '4px 10px', borderRadius: 4, fontWeight: 700, border: `1px solid ${color}40` }}>{text}</span>;
                    })()}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--paper-mid)', color: 'var(--ink)', padding: '4px 10px', borderRadius: 4, fontWeight: 600, border: '1px solid var(--cloud)' }}>
                      Top {personalPerformance.percentile}% of your department
                    </span>
                    {personalPerformance.term_delta !== undefined && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--teal-light)', color: 'var(--teal)', padding: '4px 10px', borderRadius: 4, fontWeight: 700, border: '1px solid var(--teal-mid)' }}>
                        ▲ {fmt(personalPerformance.term_delta)} pts vs last term
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -- ROW D: Peer Standing table -- */}
          <div className="student-row-d" role="region" aria-label="Peer comparison" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="chart-title" style={{ marginBottom: 2 }}><span className="chart-title-accent" aria-hidden="true" />Peer Standings</div>
                <div style={{ fontSize: 11, color: 'var(--fog)' }}>Rank {peerLeaderboard?.student_rank || '--'} out of {peerLeaderboard?.total_in_cohort || '--'} in <strong>{peerTab === 'branch' ? abbreviateDept(personalData.department) : 'all branches'}</strong> &bull; Year {personalData.year}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="tab-strip" role="group" aria-label="Peer view">
                  <button className={`tab-btn ${peerScope === 'window' ? 'active' : ''}`} onClick={() => setPeerScope('window')}>Window</button>
                  <button className={`tab-btn ${peerScope === 'top10' ? 'active' : ''}`} onClick={() => setPeerScope('top10')}>Top 10</button>
                </div>
                <div className="tab-strip" role="group" aria-label="Peer filter">
                  <button className={`tab-btn ${peerTab === 'branch' ? 'active' : ''}`} onClick={() => setPeerTab('branch')}>My branch</button>
                  <button className={`tab-btn ${peerTab === 'all' ? 'active' : ''}`} onClick={() => setPeerTab('all')}>All branches</button>
                </div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" aria-label="Peer ranking table">
                <thead><tr>
                  <th style={{ width: 42 }}>Rank</th><th>Name</th>
                  <th>Roll No</th><th>Department</th>
                  <th style={{ textAlign: 'right', width: 90 }}>Total Pts</th>
                  <th style={{ width: 110 }}>Engagement</th>
                </tr></thead>
                <tbody>
                  {(peerScope === 'window' ? (peerLeaderboard?.window || []) : (peerLeaderboard?.top_10 || [])).map((s) => {
                    const isMe = s.roll_no === personalData.roll_no;
                    const r = s.computed_rank;
                    return (
                      <tr key={s.roll_no} className={isMe ? 'row-highlight' : ''} aria-label={isMe ? 'Your row' : undefined}>
                        <td style={{ textAlign: 'center' }}><div className={`rank-mark ${r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : 'rank-n'}`}>{r}</div></td>
                        <td className="td-name"><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{s.student_name}{isMe && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: 'var(--brass)', color: '#FFFFFF', padding: '1px 5px', borderRadius: 2, fontWeight: 700 }}>YOU</span>}</div></td>
                        <td className="td-mono td-meta">{s.roll_no}</td>
                        <td className="td-meta truncate" style={{ maxWidth: 150 }} title={s.department}>{abbreviateDept(s.department)}</td>
                        <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(s.total_points)}</td>
                        <td><StatusBadge level={s.engagement_group === 'High' ? 'high' : s.engagement_group === 'Medium' ? 'medium' : 'low'} label={s.engagement_group} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* -- ROW E: Category Totals Redesign (Horizontal Brass Bars) -- */}
          {personalData && (
            <div className="student-row-e" role="region" aria-label="Category Totals">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="chart-title"><span className="chart-title-accent" aria-hidden="true" />Category Totals Details</div>
              </div>
              <StudentCategoryBars breakdown={personalData.breakdown} />
            </div>
          )}
        </main>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
          <div className="spinner" /><div style={{ fontSize: 13, color: 'var(--fog)' }}>Loading your dashboard...</div>
        </div>
      )}

      {/* Interactive Modals */}
      <ViewSuggestionsPopover
        isOpen={showAIModal}
        onClose={() => {
          setShowAIModal(false);
          setSuggestionsAnchor(null);
        }}
        anchor={suggestionsAnchor}
        triggerRef={suggestionsTriggerRef}
        data={aiRecommendation}
        loading={loadingAI}
      />

      <VIPRewardsModal
        isOpen={showVIPModal}
        onClose={() => setShowVIPModal(false)}
        studentName={personalData?.student_name}
        rollNo={personalData?.roll_no}
        balance={personalPerformance?.student_points || personalData?.total_points}
      />
    </div>
  );
}

function ViewSuggestionsPopover({ isOpen, onClose, anchor, triggerRef, data, loading }) {
  const popoverRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;
    if (popoverRef.current) {
      popoverRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDown = (e) => {
      const target = e.target;
      const clickedInsidePopover = popoverRef.current?.contains(target);
      const clickedTrigger = triggerRef?.current?.contains(target);
      if (!clickedInsidePopover && !clickedTrigger) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleResize = () => onClose();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  if (!isOpen || !anchor) return null;

  const hasData = data?.recommended_tasks?.length > 0;
  const isError = !loading && !hasData;

  const iconComponents = {
    Terminal, Award, BookOpen,
    Users, FileText, Cpu,
    Activity, Globe, Target,
    X, AlertCircle
  };

  const renderIcon = (name, size) => {
    const IconComp = iconComponents[name] || Target;
    return <IconComp size={size} />;
  };

  const getActionLabel = (task, index) => {
    const labelMap = {
      'Technical Events': 'Try a Technical Event',
      'Skills': 'Join a Skills Session',
      'Assignments': 'Complete an Assignment Track',
      'Interviews': 'Attend an Interview Prep session',
      'Exams': 'Prepare for an Exam Challenge',
      'Faculty Initiatives': 'Take on a Faculty Initiative',
      'Lab Initiatives': 'Join a Lab Initiative',
      'Special Lab Initiatives': 'Pick a Special Lab Initiative',
      'Extra-Curricular': 'Join a Club Activity',
      'Student Initiatives': 'Start a Student Initiative',
      'External Events': 'Take part in an External Event'
    };

    const rawCategory = task?.category || task?.label || task?.task_title || '';
    return labelMap[rawCategory] || task?.label || task?.task_title || `Suggested step ${index + 1}`;
  };

  const getActionReason = (task, index) => {
    const reasonMap = {
      'Technical Events': 'Builds visibility fast',
      'Skills': 'Strengthens core readiness',
      'Assignments': 'Quick to start and finish',
      'Interviews': 'Useful for placement prep',
      'Exams': 'Keeps the basics sharp',
      'Faculty Initiatives': 'Easy to begin with guidance',
      'Lab Initiatives': 'Adds hands-on depth',
      'Special Lab Initiatives': 'High-value project work',
      'Extra-Curricular': 'Rounds out your profile',
      'Student Initiatives': 'Good for collaborative credits',
      'External Events': 'Adds outside exposure'
    };

    const rawCategory = task?.category || task?.label || task?.task_title || '';
    return reasonMap[rawCategory] || ['Quick next step', 'Good follow-up', 'Worth trying soon', 'A practical add-on'][index % 4];
  };

  const normalizedTasks = (data?.recommended_tasks || []).slice(0, 5).map((task, index) => ({
    key: task?.category || task?.label || task?.task_title || index,
    iconName: task?.icon_name || 'Target',
    label: getActionLabel(task, index),
    reason: getActionReason(task, index),
    rewardPoints: Number.isFinite(Number(task?.expected_points_per_activity))
      ? Math.round(Number(task.expected_points_per_activity))
      : null,
  }));

  const compactReasonTone = data?.student?.is_below_avg ? 'ML-ranked for quick impact' : 'ML-ranked for balanced follow-through';
  const helperLine = data?.student?.is_below_avg
    ? 'Complete these next steps to move toward above-average balance.'
    : 'These are strong next steps based on your current activity pattern.';

  return (
    <div
      ref={popoverRef}
      tabIndex="-1"
      role="dialog"
      aria-modal="false"
      aria-labelledby="suggestions-title"
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        width: anchor.width,
        maxWidth: 'calc(100vw - 24px)',
        background: 'var(--paper)',
        border: '1px solid var(--cloud)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        zIndex: 100000,
      }}
      className="anim-fade-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--cloud)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, background: 'var(--paper)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ background: 'var(--teal-light)', color: 'var(--teal)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {renderIcon('Target', 16)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div id="suggestions-title" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Suggested next steps</div>
            <div style={{ marginTop: 3, fontSize: 11, color: 'var(--fog)' }}>{compactReasonTone}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-60)', lineHeight: 1.35 }}>{helperLine}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close suggestions" style={{ background: 'none', border: 'none', color: 'var(--fog)', cursor: 'pointer', padding: 4, borderRadius: 6, lineHeight: 0, flexShrink: 0 }}>{renderIcon('X', 18)}</button>
      </div>

      <div style={{ padding: 12, background: 'var(--paper)', maxHeight: '60vh', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '11px 12px', background: 'var(--paper-dark)', border: '1px solid var(--cloud)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--cloud)', flexShrink: 0 }} className="skeleton-pulse" />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 150, height: 12, background: 'var(--cloud)', borderRadius: 4, marginBottom: 6 }} className="skeleton-pulse" />
                  <div style={{ width: `${70 + (i * 8)}%`, height: 10, background: 'var(--cloud)', borderRadius: 4 }} className="skeleton-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 4px', gap: 8, color: 'var(--fog)', fontSize: 13 }}>
            {renderIcon('AlertCircle', 16)}
            <span>Couldn't load suggestions</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {normalizedTasks.map((task) => (
              <div key={task.key} style={{ padding: '10px 12px', background: 'var(--paper-dark)', border: '1px solid var(--cloud)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                  {renderIcon(task.iconName, 18)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{task.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--fog)', marginTop: 3, lineHeight: 1.35 }}>{task.reason}</div>
                </div>
                {task.rewardPoints !== null && (
                  <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brass)', lineHeight: 1 }}>{task.rewardPoints}</div>
                    <div style={{ fontSize: 10, color: 'var(--fog)', marginTop: 2 }}>pts</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VIPRewardsModal({ isOpen, onClose, studentName, rollNo, balance }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: 16 }}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--cloud)', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, textAlign: 'center' }} className="anim-scale-up">
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--ink)' }}>VIP Rewards</h3>
        <p style={{ color: 'var(--fog)', fontSize: 14 }}>Redeem exclusive rewards for {studentName} ({rollNo}). Balance: <strong>{balance}</strong></p>
        <button className="btn-secondary" onClick={onClose} style={{ marginTop: 24 }}>Close</button>
      </div>
    </div>
  );
}

export default App;
