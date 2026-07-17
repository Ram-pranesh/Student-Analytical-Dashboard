import React, { useState, useEffect } from 'react';
import {
  Award, Users, TriangleAlert, FlaskConical, TrendingUp, Layers,
  User, Download, ArrowRight, Search, LogOut, Moon, Sun,
  ShieldAlert, RefreshCw, BarChart2, Calendar, Clock, Grid,
  ChevronDown, ChevronUp, Trophy, Zap, Target, BrainCircuit,
  Building2, Code2, UserCog, ScanSearch, Medal, GraduationCap,
  ArrowUp, ArrowDown, Star, Plus, X, Filter
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, CartesianGrid, Area, AreaChart
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = (v) => {
  if (v === null || v === undefined) return '—';
  return Math.round(parseFloat(v)).toLocaleString();
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 13px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || 'var(--brand-color)', fontWeight: 700 }}>
            {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value} pts
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Insight icon map ─────────────────────────────────────────────────────────
const INSIGHT_ICON_MAP = {
  Building2:     <Building2 size={16} />,
  TriangleAlert: <TriangleAlert size={16} />,
  Code2:         <Code2 size={16} />,
  FlaskConical:  <FlaskConical size={16} />,
  UserCog:       <UserCog size={16} />,
  BrainCircuit:  <BrainCircuit size={16} />,
};
const INSIGHT_COLOR_MAP = {
  Building2: '#4f46e5', TriangleAlert: '#dc2626', Code2: '#7c3aed',
  FlaskConical: '#0284c7', UserCog: '#059669', BrainCircuit: '#4f46e5',
};

const COLORS = ['#6366f1','#0284c7','#059669','#d97706','#dc2626','#7c3aed','#a855f7','#db2777','#f97316','#0d9488','#65a30d'];

// ─── Abbreviate Dept helper ──────────────────────────────────────────────
const abbreviateDept = (dept) => {
  if (!dept) return "";
  const specialCases = {
    "FASHION TECHNOLOGY": "FT",
    "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": "AI&DS",
    "COMPUTER SCIENCE AND ENGINEERING": "CSE",
    "INFORMATION SCIENCE & ENGINEERING": "ISE",
    "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
    "MECHANICAL ENGINEERING": "MECH",
    "CIVIL ENGINEERING": "CIVIL",
    "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
    "AERONAUTICAL ENGINEERING": "AERO",
    "BIOTECHNOLOGY": "BIOTECH",
    "TEXTILE TECHNOLOGY": "TX",
    "ELECTRONICS AND INSTRUMENTATION ENGINEERING": "EIE",
    "COMPUTER SCIENCE AND BUSINESS SYSTEMS": "CSBS",
  };
  if (specialCases[dept]) return specialCases[dept];
  return dept.split(' ').map(w => w[0]).join('');
};

// ─── Structured AI Query Builder ──────────────────────────────────────────────
function QueryBuilder({ onSearch, deptOptions, initialBlocks }) {
  const FIELD_OPTIONS = [
    { value: 'department', label: 'DEPARTMENT', type: 'select' },
    { value: 'year', label: 'YEAR', type: 'select' },
    { value: 'balance_points', label: 'BALANCE POINTS', type: 'number' },
  ];
  const DEPT_YEAR_OPS = ['=', '!='];
  const NUM_OPS = ['=', '!=', '>', '<', '>=', '<='];
  const YEAR_VALUES = ['I', 'II', 'III', 'IV'];

  const [blocks, setBlocks] = useState(() => {
    if (initialBlocks) {
      const newBlocks = [];
      let id = 1;
      if (initialBlocks.department && initialBlocks.department.value) {
        // Find full dept name based on abbreviation/partial
        const p = initialBlocks.department.value.toLowerCase();
        const match = deptOptions.find(d => d.toLowerCase().includes(p) || d.split(' ').map(w => w[0]).join('').toLowerCase() === p);
        newBlocks.push({ id: id++, conjunction: newBlocks.length ? 'AND' : null, field: 'department', operator: '=', value: match || '' });
      }
      if (initialBlocks.year && initialBlocks.year.value) {
        let yr = initialBlocks.year.value.replace(/st year|nd year|rd year|th year/gi, '').trim().toUpperCase();
        const yrMap = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
        const parsedYr = yrMap[yr] || yr;
        newBlocks.push({ id: id++, conjunction: newBlocks.length ? 'AND' : null, field: 'year', operator: '=', value: parsedYr });
      }
      if (initialBlocks.points && initialBlocks.points.value) {
        newBlocks.push({ id: id++, conjunction: newBlocks.length ? 'AND' : null, field: 'balance_points', operator: initialBlocks.points.op || '>=', value: initialBlocks.points.value });
      }
      if (newBlocks.length > 0) return newBlocks;
    }
    return [{ id: 1, conjunction: null, field: 'department', operator: '=', value: '' }];
  });
  
  const [sortField, setSortField] = useState('total_points');
  const [sortDir, setSortDir] = useState('desc');

  const addBlock = (conjunction) => {
    if (blocks.length >= 3) return;
    setBlocks(prev => [...prev, { id: Date.now(), conjunction, field: 'year', operator: '=', value: '' }]);
  };

  const removeBlock = (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlock = (id, key, val) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b;
      const updated = { ...b, [key]: val };
      if (key === 'field') {
        const fieldDef = FIELD_OPTIONS.find(f => f.value === val);
        updated.operator = fieldDef?.type === 'number' ? '>=' : '=';
        updated.value = '';
      }
      return updated;
    }));
  };

  const buildQueryString = () => {
    const parts = [];
    blocks.forEach((b, idx) => {
      if (!b.value) return;
      let part = '';
      if (idx > 0 && b.conjunction) part = `${b.conjunction} `;
      if (b.field === 'department') {
        const shortName = b.value.split(' ')[0].toLowerCase();
        part += `${shortName} students`;
      } else if (b.field === 'year') {
        const yearMap = { I: '1st year', II: '2nd year', III: '3rd year', IV: '4th year' };
        part += yearMap[b.value] || b.value;
      } else if (b.field === 'balance_points') {
        part += `balance points ${b.operator} ${b.value}`;
      }
      parts.push(part);
    });
    return parts.join(' ');
  };

  const handleSearch = () => {
    const q = buildQueryString();
    if (!q.trim()) return;
    onSearch(q);
  };

  const getValueOptions = (field) => {
    if (field === 'year') return YEAR_VALUES.map(v => ({ value: v, label: `Year ${v}` }));
    if (field === 'department') return deptOptions.map(d => ({ value: d, label: d }));
    return [];
  };

  return (
    <div>
      <div className="espacenet-container mb-3" style={{ padding: '24px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '12px' }}>
        {blocks.map((b, idx) => {
          const fieldDef = FIELD_OPTIONS.find(f => f.value === b.field);
          const ops = fieldDef?.type === 'number' ? NUM_OPS : DEPT_YEAR_OPS;
          const valOpts = getValueOptions(b.field);

          return (
            <React.Fragment key={b.id}>
              {idx > 0 && (
                <div className="espacenet-operator">
                  <select
                    value={b.conjunction || 'AND'}
                    onChange={e => updateBlock(b.id, 'conjunction', e.target.value)}
                    style={{ background: 'transparent', border: 'none', fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                    <option value="NOT">NOT</option>
                  </select>
                </div>
              )}
              <div className="espacenet-block" style={{ minWidth: 220, position: 'relative', overflow: 'visible' }}>
                <div className="espacenet-header" style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.08)' }}>
                  <select
                    value={b.field}
                    onChange={e => updateBlock(b.id, 'field', e.target.value)}
                    style={{ background: 'transparent', border: 'none', fontSize: 11, fontWeight: 800, color: 'var(--brand-color)', textTransform: 'uppercase', cursor: 'pointer', outline: 'none', width: 'auto', appearance: 'none' }}
                  >
                    {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select
                    value={b.operator}
                    onChange={e => updateBlock(b.id, 'operator', e.target.value)}
                    style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 800, color: 'var(--brand-color)', cursor: 'pointer', outline: 'none', appearance: 'none', textAlign: 'right' }}
                  >
                    {ops.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div className="espacenet-value" style={{ padding: 0 }}>
                  {fieldDef?.type === 'number' ? (
                    <input
                      type="number"
                      placeholder="Enter points..."
                      value={b.value}
                      onChange={e => updateBlock(b.id, 'value', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '12px', fontSize: 14, fontWeight: 600, outline: 'none', background: 'transparent' }}
                    />
                  ) : (
                    <select
                      value={b.value}
                      onChange={e => updateBlock(b.id, 'value', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '12px', fontSize: 14, fontWeight: 600, outline: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      <option value="">— Select —</option>
                      {valOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </div>
                {blocks.length > 1 && (
                  <button onClick={() => removeBlock(b.id)} style={{ position: 'absolute', top: -8, right: -8, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
        {blocks.length < 3 && (
          <button onClick={() => addBlock('AND')} style={{ background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '12px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Add block
          </button>
        )}
      </div>

      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <div className="d-flex align-items-center gap-1 ms-auto">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Sort:</span>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value)}
            className="form-select form-select-sm"
            style={{ width: 120, fontSize: 11, borderRadius: 6 }}
          >
            <option value="total_points">Total Points</option>
            <option value="balance_points">Balance Points</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="sort-toggle-btn"
            style={{ height: 30, padding: '0 8px', fontSize: 11 }}
          >
            {sortDir === 'desc' ? <><ArrowDown size={11} /> Desc</> : <><ArrowUp size={11} /> Asc</>}
          </button>
        </div>
      </div>

      <button
        onClick={handleSearch}
        className="btn btn-primary d-flex align-items-center gap-2 px-4 fw-semibold"
        style={{ borderRadius: 8, fontSize: 13 }}
      >
        <Search size={14} /> Search Records
      </button>
    </div>
  );
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────
function CalendarHeatmap({ heatmapData, theme }) {
  if (!heatmapData || heatmapData.length === 0) return null;
  const pointsMap = {};
  heatmapData.forEach(d => { pointsMap[d.date] = d.points; });

  const startDate = new Date(2025, 6, 1);
  const days = [];
  for (let i = 0; i < 364; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    days.push({ date: dateStr, dayOfWeek: (d.getDay() + 6) % 7, pts: pointsMap[dateStr] || 0, month: d.getMonth() });
  }

  const weeks = [];
  let currentWeek = [];
  const firstDow = days[0].dayOfWeek;
  for (let p = 0; p < firstDow; p++) currentWeek.push(null);
  days.forEach(day => {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthPositions = {};
  weeks.forEach((week, wi) => {
    week.forEach(cell => {
      if (cell && cell.dayOfWeek === 0 && !monthPositions[cell.month]) {
        monthPositions[cell.month] = wi;
      }
    });
  });

  const getCellColor = (pts) => {
    if (!pts || pts === 0) return theme === 'dark' ? '#21262d' : '#eef0f5';
    if (pts < 20) return '#bbf7d0';
    if (pts < 60) return '#4ade80';
    if (pts < 120) return '#16a34a';
    return '#065f46';
  };

  return (
    <div className="glass-card mb-3">
      <div className="d-flex align-items-center mb-3">
        <Calendar className="me-2" size={14} color="var(--brand-color)" />
        <h6 className="fw-bold m-0" style={{ fontSize: 13 }}>Activity Heatmap</h6>
        <span className="text-muted text-xs ms-auto">Points per day · Jul 2025 – Jun 2026</span>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ display: 'flex', marginLeft: 22, marginBottom: 4 }}>
          {weeks.map((_, wi) => {
            const monthEntry = Object.entries(monthPositions).find(([, pos]) => pos === wi);
            return (
              <div key={wi} style={{ width: 13, marginRight: 2, fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
                {monthEntry ? monthLabels[parseInt(monthEntry[0])]?.slice(0, 3) : ''}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 1 }}>
            {dayLabels.map((lbl, i) => (
              <div key={i} style={{ width: 14, height: 13, fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i % 2 === 0 ? lbl : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {week.map((cell, di) => (
                  <div key={di}
                    title={cell ? `${cell.date}: ${fmt(cell.pts)} pts` : ''}
                    style={{ width: 13, height: 13, borderRadius: 2, backgroundColor: cell ? getCellColor(cell.pts) : 'transparent', transition: 'opacity 0.15s' }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 mt-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span>Less</span>
        {['#eef0f5', '#bbf7d0', '#4ade80', '#16a34a', '#065f46'].map((c, i) => (
          <div key={i} style={{ width: 13, height: 13, borderRadius: 2, backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState("light");
  const [role, setRole] = useState("admin");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [loginError, setLoginError] = useState("");

  // Admin states
  const [kpis, setKpis] = useState(null);
  const [deptStats, setDeptStats] = useState([]);
  const [deptBalanceData, setDeptBalanceData] = useState([]);
  const [deptYearFilter, setDeptYearFilter] = useState("All");
  const [catStats, setCatStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [adminHierarchy, setAdminHierarchy] = useState([]);
  const [expandedDeptIndex, setExpandedDeptIndex] = useState(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const LEADERBOARD_LIMIT = 10;
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [hasMoreLeaderboard, setHasMoreLeaderboard] = useState(true);

  // Overview search
  const [overviewSearch, setOverviewSearch] = useState("");
  const [overviewSearchResult, setOverviewSearchResult] = useState(null);
  const [overviewSearchLoading, setOverviewSearchLoading] = useState(false);

  // Pie year filter (student profile)
  const [pieYearFilter, setPieYearFilter] = useState("All");
  const [pieYearData, setPieYearData] = useState(null); // {All: [...], I: [...], ...}

  // Admin drawer
  const [selectedStudentData, setSelectedStudentData] = useState(null);
  const [selectedStudentExtended, setSelectedStudentExtended] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [expandedDeepCategory, setExpandedDeepCategory] = useState(null);

  // Student view
  const [personalData, setPersonalData] = useState(null);
  const [personalAnalytics, setPersonalAnalytics] = useState(null);
  const [trendView, setTrendView] = useState("monthly");
  const [peerTab, setPeerTab] = useState("branch");
  const [peerYearTab, setPeerYearTab] = useState("my_year");
  const [peerLeaderboard, setPeerLeaderboard] = useState([]);
  const [txLimit, setTxLimit] = useState(10);
  const [isStudentInspectModalOpen, setIsStudentInspectModalOpen] = useState(false);
  const [studentInspectCategory, setStudentInspectCategory] = useState(null);

  // AI Assistant
  const [aiQueryResult, setAiQueryResult] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");

  // Sidebar nav
  const [activeTab, setActiveTab] = useState("overview");

  // ── Theme: apply to <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Admin bootstrap
  useEffect(() => {
    if (isLoggedIn && role === "admin") {
      fetchKpis(); fetchDeptStats(); fetchCatStats("All");
      fetchAlerts(); fetchAiInsights(); fetchAdminHierarchy();
      fetchLeaderboard(true);
      fetchDeptBalance("All");
    }
  }, [isLoggedIn, role]);

  useEffect(() => {
    if (isLoggedIn && role === "admin") fetchLeaderboard(true);
  }, [filterDept, filterYear, filterGroup, sortOrder]);

  useEffect(() => {
    if (isLoggedIn && role === "admin") {
      fetchDeptBalance(deptYearFilter);
    }
  }, [deptYearFilter]);

  useEffect(() => {
    if (isLoggedIn && role === "admin") {
      fetchCatStats(pieYearFilter);
    }
  }, [pieYearFilter]);

  // ── Student bootstrap
  useEffect(() => {
    if (isLoggedIn && role === "student" && username) fetchStudentDashboard(username);
  }, [isLoggedIn, role, username]);

  useEffect(() => {
    if (isLoggedIn && role === "student" && personalData) fetchStudentPeers();
  }, [peerTab, peerYearTab, personalData]);

  const fetchKpis = async () => { try { const d = await (await fetch(`${API_BASE}/kpis`)).json(); setKpis(d); } catch (e) {} };
  const fetchDeptStats = async () => { try { const d = await (await fetch(`${API_BASE}/departments`)).json(); setDeptStats(d); } catch (e) {} };
  const fetchCatStats = async (year) => { 
    try { 
      const url = year && year !== "All" ? `${API_BASE}/categories?year=${encodeURIComponent(year)}` : `${API_BASE}/categories`;
      const d = await (await fetch(url)).json(); 
      setCatStats(d); 
    } catch (e) {} 
  };
  const fetchAlerts = async () => { try { const d = await (await fetch(`${API_BASE}/alerts`)).json(); setAlerts(d); } catch (e) {} };
  const fetchAiInsights = async () => { try { const d = await (await fetch(`${API_BASE}/insights`)).json(); setAiInsights(d); } catch (e) {} };
  const fetchAdminHierarchy = async () => { try { const d = await (await fetch(`${API_BASE}/admin/hierarchy`)).json(); setAdminHierarchy(d); } catch (e) {} };

  const fetchDeptBalance = async (year) => {
    try {
      const url = year && year !== "All"
        ? `${API_BASE}/departments/balance?year=${encodeURIComponent(year)}`
        : `${API_BASE}/departments/balance`;
      const d = await (await fetch(url)).json();
      setDeptBalanceData(d);
    } catch (e) {}
  };

  const fetchLeaderboard = async (reset = false) => {
    try {
      const newOffset = reset ? 0 : leaderboardOffset;
      const url = `${API_BASE}/leaderboard?limit=${LEADERBOARD_LIMIT}&offset=${newOffset}&department=${filterDept}&year=${filterYear}&engagement_group=${filterGroup}&sort_order=${sortOrder}`;
      const data = await (await fetch(url)).json();
      if (reset) { setLeaderboard(data); setLeaderboardOffset(LEADERBOARD_LIMIT); }
      else { setLeaderboard(prev => [...prev, ...data]); setLeaderboardOffset(prev => prev + LEADERBOARD_LIMIT); }
      setHasMoreLeaderboard(data.length === LEADERBOARD_LIMIT);
    } catch (e) {}
  };

  const fetchStudentDashboard = async (rollNo) => {
    try {
      const profileData = await (await fetch(`${API_BASE}/student/${rollNo}`)).json();
      setPersonalData(profileData);
      const analyticsData = await (await fetch(`${API_BASE}/student/${rollNo}/analytics`)).json();
      setPersonalAnalytics(analyticsData);
      // Pre-fetch pie year data — build from breakdown for each year via extended
      const extData = await (await fetch(`${API_BASE}/student/${rollNo}/extended`)).json();
      // We'll store the yearly_data to synthesize pie views
      setPieYearData(extData);
    } catch (e) {}
  };

  const fetchStudentPeers = async () => {
    try {
      const deptFilter = peerTab === "branch" ? personalData.department : "";
      const yearFilter = peerYearTab === "my_year" ? personalData.year : "";
      const data = await (await fetch(`${API_BASE}/leaderboard?limit=10&offset=0&department=${encodeURIComponent(deptFilter)}&year=${encodeURIComponent(yearFilter)}`)).json();
      setPeerLeaderboard(data.slice(0, 10));
    } catch (e) {}
  };

  const handleOpenStudentDrawer = async (rollNo) => {
    setSelectedStudentData(null); setSelectedStudentExtended(null); setIsDrawerOpen(true);
    setDrawerTab("overview"); setExpandedDeepCategory(null);
    try {
      const [profile, extended, analytics] = await Promise.all([
        fetch(`${API_BASE}/student/${rollNo}`).then(r => r.json()),
        fetch(`${API_BASE}/student/${rollNo}/extended`).then(r => r.json()),
        fetch(`${API_BASE}/student/${rollNo}/analytics`).then(r => r.json()),
      ]);
      setSelectedStudentData(profile); 
      setSelectedStudentExtended({ ...extended, analytics });
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError("");
    const loginUser = username.trim();
    if (!loginUser) { setLoginError("Please enter a username or roll number."); return; }
    try {
      const res = await fetch(`${API_BASE}/login?username=${encodeURIComponent(loginUser)}&role=${role}`);
      if (res.ok) { setIsLoggedIn(true); }
      else { const err = await res.json(); setLoginError(err.detail || "Login failed."); }
    } catch (err) { setLoginError("Cannot connect to the server."); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setUsername(""); setPersonalData(null); setPersonalAnalytics(null);
    setAiQueryResult(null); setSelectedStudentData(null); setSelectedStudentExtended(null);
    setIsDrawerOpen(false); setLeaderboardOffset(0); setLeaderboard([]);
    setTxLimit(10); setOverviewSearch(""); setOverviewSearchResult(null);
  };

  const handleAiSearch = async (q) => {
    if (!q?.trim()) return;
    setIsAiLoading(true); setAiQueryResult(null);
    try {
      const data = await (await fetch(`${API_BASE}/query?q=${encodeURIComponent(q)}`)).json();
      setAiQueryResult(data);
    } catch (e) {} finally { setIsAiLoading(false); }
  };

  const handleOverviewSearch = async (e) => {
    e.preventDefault();
    if (!overviewSearch.trim()) return;
    setOverviewSearchLoading(true); setOverviewSearchResult(null);
    try {
      const data = await (await fetch(`${API_BASE}/query?q=${encodeURIComponent(overviewSearch)}`)).json();
      setOverviewSearchResult(data);
    } catch (e) {} finally { setOverviewSearchLoading(false); }
  };

  const handleCSVExport = (data) => {
    if (!data || data.length === 0) return;
    const headers = ["Roll No", "Student Name", "Year", "Department", "Total Points", "Balance Points", "Engagement"];
    const csvRows = [headers.join(",")];
    data.forEach(row => {
      csvRows.push([row.roll_no, `"${row.student_name}"`, row.year, `"${row.department}"`, row.total_points, row.balance_points, row.engagement_group].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "students_export.csv"; a.click();
  };

  // Pie data
  const getPieData = () => {
    if (!personalData) return [];
    return (personalData.breakdown || []).filter(x => x.points > 0);
  };

  // ═══════════════════════════════════════════════════════════════════
  //  LOGIN
  // ═══════════════════════════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <div className="login-wrapper">
        <div className="login-card animated-fade">
          <div className="text-center mb-4">
            <div className="login-icon-ring mb-3"><Award size={32} color="#fff" /></div>
            <h3 className="fw-bold mb-1" style={{ fontSize: 20 }}>Reward Point Platform</h3>
            <p className="text-muted text-sm m-0">Ingenuity &amp; Student Performance Analytics</p>
          </div>
          <div className="role-toggle mb-4">
            <button onClick={() => { setRole("admin"); setUsername("admin"); setLoginError(""); }} className={`role-btn ${role === "admin" ? "active" : ""}`}>
              Mentor / Admin
            </button>
            <button onClick={() => { setRole("student"); setUsername(""); setLoginError(""); }} className={`role-btn ${role === "student" ? "active" : ""}`}>
              Student Portal
            </button>
          </div>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-secondary" style={{ fontSize: 13 }}>
                {role === "admin" ? "Administrator ID" : "Student Roll Number"}
              </label>
              <input type="text" className="form-control" style={{ borderRadius: 8, fontSize: 14 }}
                placeholder={role === "admin" ? "admin" : "e.g., 131CS106"}
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            {loginError && <div className="alert alert-danger py-2 mb-3 text-sm">{loginError}</div>}
            <button type="submit" className="btn btn-primary w-100 fw-semibold" style={{ borderRadius: 8, fontSize: 14 }}>
              Log In <ArrowRight className="ms-2 d-inline-block" size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADMIN VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (role === "admin") {
    return (
      <div className="app-container">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon"><Award size={18} color="#fff" /></div>
            <span className="fw-bold" style={{ fontSize: 14 }}>Academic Rewards</span>
          </div>
          <nav className="flex-fill p-2 d-flex flex-column gap-1 pt-3">
            {[
              { key: "overview",  icon: <Layers size={16} />,      label: "Overview Portal" },
              { key: "assistant", icon: <BrainCircuit size={16} />, label: "AI Assistant" },
              { key: "alerts",    icon: <ShieldAlert size={16} />,  label: "Policy Alerts" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`sidebar-nav-btn ${activeTab === tab.key ? "active" : ""}`}>
                {tab.icon} <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="d-flex align-items-center gap-2">
              <div className="sidebar-avatar"><User size={14} color="#fff" /></div>
              <div>
                <div className="fw-bold" style={{ fontSize: 12 }}>Faculty Admin</div>
                <div className="text-muted" style={{ fontSize: 10 }}>Root Account</div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} className="theme-toggle-btn" title="Toggle theme">
                {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
              </button>
              <button onClick={handleLogout} className="logout-btn" title="Logout"><LogOut size={14} /></button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <header className="main-header d-flex justify-content-between align-items-center">
            <div>
              <h1 className="fw-bold mb-1" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>Institutional Student Rewards Portal</h1>
              <p className="text-muted text-sm m-0">Comprehensive department metrics, credit statistics, policy logs, and department analytics.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (overviewSearch.trim()) handleOpenStudentDrawer(overviewSearch.trim().toUpperCase()); setOverviewSearch(""); }} className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ fontSize: 13, borderRadius: 8, width: 200, padding: '8px 12px' }}
                placeholder="Search Roll Number..."
                value={overviewSearch}
                onChange={e => setOverviewSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm px-3 d-flex align-items-center justify-content-center" style={{ borderRadius: 8 }}>
                <Search size={14} />
              </button>
            </form>
          </header>

          {/* ══ OVERVIEW TAB ══ */}
          {activeTab === "overview" && (
            <div className="animated-fade">
              {/* KPI Strip */}
              {kpis && (
                <div className="row g-3 mb-4">
                  {[
                    { label: "Total Students",   value: fmtInt(kpis.total_students),   icon: <Users size={20} />,         bg: "rgba(79,70,229,0.08)",  color: "#4f46e5" },
                    { label: "Average Points",   value: fmt(kpis.avg_points),           icon: <TrendingUp size={20} />,    bg: "rgba(5,150,105,0.08)",  color: "#059669" },
                    { label: "At Risk Students", value: fmtInt(kpis.at_risk_students),  icon: <TriangleAlert size={20} />, bg: "rgba(220,38,38,0.08)",  color: "#dc2626" },
                    { label: "Lab Reward Points",value: fmt(kpis.total_lab_points),     icon: <FlaskConical size={20} />,  bg: "rgba(2,132,199,0.08)",  color: "#0284c7" },
                  ].map((kpi, i) => (
                    <div key={i} className="col-md-3 col-6">
                      <div className="kpi-card">
                        <div>
                          <div className="kpi-label">{kpi.label}</div>
                          <div className="kpi-value">{kpi.value}</div>
                        </div>
                        <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Executive Insights */}
              {aiInsights.length > 0 && (
                <div className="exec-insight-card mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--brand-glow)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BrainCircuit size={15} color="var(--brand-color)" />
                    </div>
                    <span className="fw-bold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Executive Insights</span>
                    <span className="text-muted text-xs ms-auto">Live institutional analytics</span>
                  </div>
                  {aiInsights.map((insight, idx) => {
                    const iconEl = INSIGHT_ICON_MAP[insight.icon] || <BrainCircuit size={16} />;
                    const iconColor = INSIGHT_COLOR_MAP[insight.icon] || 'var(--brand-color)';
                    return (
                      <div key={idx} className="insight-row">
                        <div className="insight-icon-wrap" style={{ color: iconColor }}>{iconEl}</div>
                        <div>
                          {/* insight label is BLACK, not gray */}
                          <div className="insight-label" style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{insight.label}</div>
                          <div className="insight-text">{insight.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Charts: Dept Balance + Category Pie */}
              <div className="row g-4 mb-4">
                <div className="col-md-8">
                  <div className="glass-card h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <h5 className="fw-bold m-0 d-flex align-items-center" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        <BarChart2 className="me-2" size={16} color="var(--brand-color)" /> Department Avg. Balance Points
                      </h5>
                      <div className="year-tab-strip">
                        {["All", "I", "II", "III", "IV"].map(yr => (
                          <button key={yr} className={`year-tab-btn ${deptYearFilter === yr ? 'active' : ''}`} onClick={() => setDeptYearFilter(yr)}>
                            {yr === "All" ? "All Years" : `Year ${yr}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <BarChart data={deptBalanceData} margin={{ top: 5, right: 15, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                          <XAxis
                            dataKey="department"
                            tickFormatter={v => abbreviateDept(v)}
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="avg_balance_points" name="Avg Balance Points" radius={[4, 4, 0, 0]}>
                            {deptBalanceData.map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="glass-card h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        <Medal className="me-2 d-inline-block" size={15} color="var(--brand-color)" /> Reward Point Distribution
                      </h5>
                      <select 
                        className="form-select form-select-sm" 
                        style={{ width: 'auto', fontSize: 12, padding: '2px 24px 2px 8px' }}
                        value={pieYearFilter}
                        onChange={e => setPieYearFilter(e.target.value)}
                      >
                        <option value="All">All</option>
                        <option value="I">Yr I</option>
                        <option value="II">Yr II</option>
                        <option value="III">Yr III</option>
                        <option value="IV">Yr IV</option>
                      </select>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={catStats.slice(0, 6)} cx="50%" cy="44%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="total_points" nameKey="category">
                            {catStats.slice(0, 6).map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend iconSize={9} formatter={v => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dept & Year Breakdown Matrix — 3 per row */}
              <div className="glass-card mb-4">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Building2 size={15} color="var(--brand-color)" />
                  <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>Department &amp; Year Breakdown Matrix</h5>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: 12 }}>Click a department to expand academic year cohorts and top performers.</p>
                <div className="row g-2">
                  {adminHierarchy.map((dept, deptIdx) => {
                    const isExpanded = expandedDeptIndex === deptIdx;
                    return (
                      <div key={deptIdx} className="col-12">
                        <div className="hierarchy-dept-row">
                          <div className="hierarchy-dept-header" onClick={() => setExpandedDeptIndex(isExpanded ? null : deptIdx)}>
                            <div className="d-flex align-items-center gap-2" style={{ overflow: 'hidden' }}>
                              <div className="dept-color-dot flex-shrink-0" style={{ backgroundColor: COLORS[deptIdx % COLORS.length] }} />
                              <span className="fw-bold text-primary" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.department}</span>
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-muted flex-shrink-0" /> : <ChevronDown size={14} className="text-muted flex-shrink-0" />}
                          </div>
                          {/* Meta row */}
                          <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {dept.student_count} students &nbsp;·&nbsp; Avg {fmt(dept.avg_points)} pts
                          </div>

                          {isExpanded && (
                            <div className="animated-fade row g-2" style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border-color)', margin: 0 }}>
                              {dept.years.map((yr, yrIdx) => (
                                <div key={yrIdx} className="col-6">
                                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <span className="fw-bold" style={{ fontSize: 12 }}>Year {yr.year}</span>
                                      <div className="d-flex gap-1">
                                        <span className="badge rounded-pill badge-low text-xxs">L: {yr.low_count}</span>
                                        <span className="badge rounded-pill badge-medium text-xxs">M: {yr.med_count}</span>
                                        <span className="badge rounded-pill badge-high text-xxs">H: {yr.high_count}</span>
                                      </div>
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                                      {yr.student_count} students · Avg {fmt(yr.avg_points)} pts
                                    </div>
                                    <div className="inspect-section-label" style={{ marginBottom: 3 }}>Top 5</div>
                                    {Array.from({ length: 5 }).map((_, si) => {
                                      const s = yr.top_students[si];
                                      if (s) {
                                        return (
                                          <div key={s.roll_no}
                                            onClick={() => handleOpenStudentDrawer(s.roll_no)}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', cursor: 'pointer', fontSize: 11, borderBottom: si < 4 ? '1px solid var(--border-color)' : 'none' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>#{si + 1}</span>
                                            <span style={{ fontWeight: 600, flex: 1, marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.student_name}</span>
                                            <span style={{ fontWeight: 700, color: '#059669', flexShrink: 0 }}>{fmt(s.total_points)}</span>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div key={`empty-${si}`}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 11, borderBottom: si < 4 ? '1px solid var(--border-color)' : 'none', opacity: 0.3 }}>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>#{si + 1}</span>
                                            <span style={{ fontWeight: 600, flex: 1, marginLeft: 6 }}>—</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>—</span>
                                          </div>
                                        );
                                      }
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Institutional Students Ranking */}
              <div className="glass-card">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <GraduationCap size={16} color="var(--brand-color)" />
                    <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>Institutional Students Ranking</h5>
                  </div>
                  <div className="d-flex gap-2 flex-wrap align-items-center">

                    <select className="form-select form-select-sm" style={{ fontSize: 12, minWidth: 100, maxWidth: 160 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                      <option value="">All Departments</option>
                      {deptStats.map((d, i) => <option key={i} value={d.department}>{d.department.split(' ').slice(0, 2).join(' ')}</option>)}
                    </select>
                    <select className="form-select form-select-sm" style={{ fontSize: 12, width: 90 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                      <option value="">All Years</option>
                      <option value="I">Year I</option><option value="II">Year II</option>
                      <option value="III">Year III</option><option value="IV">Year IV</option>
                    </select>
                    <select className="form-select form-select-sm" style={{ fontSize: 12, width: 120 }} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                      <option value="">All Engagement</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <button onClick={() => handleCSVExport(leaderboard)} className="btn btn-sm btn-outline-primary d-flex align-items-center" style={{ fontSize: 12 }}>
                      <Download className="me-1" size={13} /> Export
                    </button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle m-0" style={{ fontSize: 13 }}>
                    <thead>
                      <tr className="text-secondary">
                        <th className="text-center" style={{ width: 50 }}>Rank</th>
                        <th style={{ width: 100 }}>Roll No</th>
                        <th>Name</th>
                        <th style={{ maxWidth: 180 }}>Department</th>
                        <th className="text-center" style={{ width: 60 }}>Year</th>
                        <th className="text-center" style={{ width: 110 }}>Total Points</th>
                        <th className="text-center" style={{ width: 110 }}>Balance</th>
                        <th className="text-center" style={{ width: 105 }}>Engagement</th>
                        <th className="text-center" style={{ width: 48 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map(student => (
                        <tr key={student.roll_no}>
                          <td className="text-center fw-bold text-secondary">#{student.rank}</td>
                          <td className="fw-semibold text-primary">{student.roll_no}</td>
                          <td className="fw-semibold">{student.student_name}</td>
                          <td className="text-muted col-narrow-dept" style={{ fontSize: 12 }}>{student.department}</td>
                          <td className="text-center">{student.year}</td>
                          <td className="text-center fw-bold text-primary">{fmt(student.total_points)}</td>
                          <td className="text-center fw-bold text-success">{fmt(student.balance_points)}</td>
                          <td className="text-center">
                            <span className={`badge rounded-pill ${student.engagement_group === 'Low' ? 'badge-low' : student.engagement_group === 'Medium' ? 'badge-medium' : 'badge-high'}`} style={{ fontSize: 11 }}>
                              {student.engagement_group}
                            </span>
                          </td>
                          <td className="text-center">
                            <button className="inspect-btn" title={`Inspect ${student.student_name}`} onClick={() => handleOpenStudentDrawer(student.roll_no)}>
                              <ScanSearch size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMoreLeaderboard && (
                  <div className="text-center mt-3 pt-3 border-top">
                    <button onClick={() => fetchLeaderboard(false)} className="btn btn-outline-primary btn-sm px-4 rounded-pill" style={{ fontSize: 12 }}>
                      Load More
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ AI ASSISTANT TAB ══ */}
          {activeTab === "assistant" && (
            <div className="animated-fade">
              {/* Always show the AI Search Bar */}
              <div className="glass-card mb-4 text-center py-4">
                {!aiQueryResult && (
                  <>
                    <div className="mb-4">
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-glow)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                        <BrainCircuit size={24} color="var(--brand-color)" />
                      </div>
                    </div>
                    <h4 className="fw-bold mb-2">How can I help you analyze the data?</h4>
                    <p className="text-muted mb-4">Try asking: "Show 1st year CSE students with balance points &gt; 500"</p>
                  </>
                )}
                
                <div className="mx-auto" style={{ maxWidth: 600, position: 'relative' }}>
                  <input 
                    type="text" 
                    className="form-control form-control-lg pe-5 shadow-sm" 
                    style={{ borderRadius: 16, border: '1px solid var(--border-color)', fontSize: 15 }}
                    placeholder="Ask anything about student data..."
                    value={aiQuery}
                    onChange={e => setAiQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAiSearch(aiQuery); }}
                  />
                  <button 
                    className="btn btn-primary position-absolute top-50 translate-middle-y end-0 me-2"
                    style={{ borderRadius: 12, padding: '6px 12px' }}
                    onClick={() => handleAiSearch(aiQuery)}
                    disabled={!aiQuery.trim()}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* aiQueryResult && (
                <div className="glass-card mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <BrainCircuit size={16} color="var(--brand-color)" />
                      <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>AI Assistant — Structured Query Blocks</h5>
                    </div>
                    <button className="btn btn-sm btn-light text-secondary fw-semibold" onClick={() => { setAiQueryResult(null); setAiQuery(""); }}>
                      New Query
                    </button>
                  </div>
                  <p className="text-muted mb-4" style={{ fontSize: 13 }}>
                    Here is your parsed query. You can adjust the blocks below. Maximum 3 blocks allowed.
                  </p>
                  <QueryBuilder
                    onSearch={handleAiSearch}
                    deptOptions={deptStats.map(d => d.department)}
                    initialBlocks={aiQueryResult?.interpreted}
                  />
                </div>
              ) */}

              {isAiLoading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status" style={{ width: 28, height: 28 }} />
                  <div className="text-muted text-sm">Processing query...</div>
                </div>
              )}

              {aiQueryResult && !isAiLoading && (
                <div className="animated-fade">

                  <div className="glass-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>Matching Students ({aiQueryResult.results.length})</h5>
                      <button onClick={() => handleCSVExport(aiQueryResult.results)} className="btn btn-sm btn-outline-primary d-flex align-items-center" style={{ fontSize: 12 }}>
                        <Download className="me-1" size={13} /> Export CSV
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle m-0" style={{ fontSize: 13 }}>
                        <thead>
                          <tr className="text-secondary">
                            <th>Roll No</th><th>Name</th>
                            <th style={{ maxWidth: 180 }}>Department</th>
                            <th className="text-center" style={{ width: 60 }}>Year</th>
                            <th className="text-center" style={{ width: 110 }}>Total Points</th>
                            <th className="text-center" style={{ width: 110 }}>Balance</th>
                            <th className="text-center" style={{ width: 105 }}>Engagement</th>
                            <th className="text-center" style={{ width: 48 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiQueryResult.results.map(s => (
                            <tr key={s.roll_no}>
                              <td className="fw-semibold text-primary">{s.roll_no}</td>
                              <td className="fw-semibold">{s.student_name}</td>
                              <td className="text-muted col-narrow-dept" style={{ fontSize: 12 }}>{s.department}</td>
                              <td className="text-center">{s.year}</td>
                              <td className="text-center fw-bold text-primary">{fmt(s.total_points)}</td>
                              <td className="text-center fw-bold text-success">{fmt(s.balance_points)}</td>
                              <td className="text-center">
                                <span className={`badge rounded-pill ${s.engagement_group === 'Low' ? 'badge-low' : s.engagement_group === 'Medium' ? 'badge-medium' : 'badge-high'}`} style={{ fontSize: 11 }}>{s.engagement_group}</span>
                              </td>
                              <td className="text-center">
                                <button className="inspect-btn" onClick={() => handleOpenStudentDrawer(s.roll_no)}><ScanSearch size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ POLICY ALERTS TAB ══ */}
          {activeTab === "alerts" && (
            <div className="animated-fade">
              <div className="glass-card">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <ShieldAlert size={16} color="var(--danger)" />
                  <h5 className="fw-bold m-0" style={{ fontSize: 14, color: 'var(--text-primary)' }}>System Alerts &amp; Policy Integrity Flags</h5>
                </div>
                <p className="text-muted mb-4" style={{ fontSize: 12 }}>Dynamic monitoring of points anomalies, extreme thresholds, and student drop-off risks.</p>
                <div className="d-flex flex-column gap-3">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="alert-item" style={{
                      backgroundColor: alert.severity === "High" ? "var(--danger-glow)" : alert.severity === "Medium" ? "var(--warning-glow)" : "rgba(99,102,241,0.05)",
                      borderColor: alert.severity === "High" ? "rgba(220,38,38,0.2)" : alert.severity === "Medium" ? "rgba(217,119,6,0.2)" : "rgba(99,102,241,0.2)"
                    }}>
                      <div className="d-flex align-items-center">
                        <TriangleAlert className={`me-3 ${alert.severity === 'High' ? 'text-danger' : alert.severity === 'Medium' ? 'text-warning' : 'text-primary'}`} size={18} />
                        <div>
                          <div className="fw-bold" style={{ fontSize: 13 }}>{alert.title}</div>
                          <div className="text-muted mt-1" style={{ fontSize: 12 }}>{alert.description}</div>
                        </div>
                      </div>
                      <span className="badge bg-white text-secondary border" style={{ fontSize: 11 }}>{alert.metric}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* STUDENT INSPECT DRAWER */}
        {isDrawerOpen && (
          <>
            <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
            <div className="drawer-content">
              {selectedStudentData && selectedStudentExtended ? (
                <div>
                  <div className="d-flex justify-content-between align-items-start pb-3 border-bottom mb-3">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <ScanSearch size={15} color="var(--brand-color)" />
                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: 'var(--text-tertiary)' }}>Student Inspection</span>
                      </div>
                      <h4 className="fw-bold mb-0" style={{ fontSize: 18 }}>{selectedStudentData.student_name}</h4>
                      <p className="text-muted m-0" style={{ fontSize: 12 }}>
                        {selectedStudentData.roll_no} &bull; {selectedStudentData.department} &bull; Year {selectedStudentData.year}
                      </p>
                    </div>
                    <button className="btn-close" onClick={() => setIsDrawerOpen(false)} />
                  </div>

                  {/* 6 KPI row */}
                  <div className="row g-2 mb-3">
                    {[
                      { label: "Total Points",   value: fmt(selectedStudentData.total_points),    color: "var(--brand-color)" },
                      { label: "Overall Rank",   value: `#${selectedStudentData.rank}`,            color: "var(--warning)" },
                      { label: "Dept. Rank",     value: `#${selectedStudentData.dept_rank}`,       color: "#0284c7" },
                      { label: "Balance",        value: fmt(selectedStudentData.balance_points),   color: "var(--success)" },
                      { label: "Redeemed",       value: fmt(selectedStudentData.redeemed_points),  color: "var(--text-secondary)" },
                      { label: "Cumulative",     value: fmt(selectedStudentData.cumulative_points),color: "var(--text-secondary)" },
                    ].map((k, i) => (
                      <div key={i} className="col-4">
                        <div className="drawer-kpi-card">
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{k.label}</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: k.color }}>{k.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="drawer-tab-strip d-flex gap-2 mb-3 border-bottom pb-2">
                    {['overview', 'heatmap', 'deep'].map(tab => (
                      <button key={tab} 
                              className={`btn btn-sm ${drawerTab === tab ? 'btn-primary fw-bold' : 'btn-light text-secondary'}`}
                              style={{ borderRadius: 20, padding: '4px 12px', fontSize: 11, textTransform: 'capitalize' }}
                              onClick={() => setDrawerTab(tab)}>
                        {tab === 'deep' ? 'Deep Inspection' : tab}
                      </button>
                    ))}
                  </div>

                  {drawerTab === 'overview' && (
                    <div className="animated-fade">
                      {/* Engagement badge */}
                      <div className="mb-3">
                        <span className={`badge rounded-pill px-3 py-2 fw-semibold ${selectedStudentData.engagement_group === 'High' ? 'badge-high' : selectedStudentData.engagement_group === 'Medium' ? 'badge-medium' : 'badge-low'}`} style={{ fontSize: 12 }}>
                          {selectedStudentData.engagement_group} Engagement
                        </span>
                      </div>

                      {/* Year-wise bar */}
                      <div className="mb-3">
                        <div className="inspect-section-label">Year-wise Points</div>
                        <div style={{ width: '100%', height: 150 }}>
                          <ResponsiveContainer>
                            <BarChart data={selectedStudentExtended.yearly_data} margin={{ top: 4, right: 5, left: -20, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                              <XAxis dataKey="year" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => v.toLocaleString()} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="points" name="Points" radius={[4, 4, 0, 0]}>
                                {selectedStudentExtended.yearly_data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Monthly trend */}
                      <div className="mb-3">
                        <div className="inspect-section-label d-flex align-items-center gap-2">
                          Monthly Trend
                          {selectedStudentExtended.most_active_month && (
                            <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: 10 }}>Peak: {selectedStudentExtended.most_active_month}</span>
                          )}
                        </div>
                        <div style={{ width: '100%', height: 150 }}>
                          <ResponsiveContainer>
                            <AreaChart data={selectedStudentExtended.monthly_data} margin={{ top: 4, right: 5, left: -20, bottom: 4 }}>
                              <defs>
                                <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                              <XAxis dataKey="month" tickFormatter={v => v.slice(0, 3)} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => v.toLocaleString()} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={2} fill="url(#dGrad)" name="Points" activeDot={{ r: 4 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Points breakdown pie */}
                      <div className="mb-3">
                        <div className="inspect-section-label">Reward Points Distribution</div>
                        <div style={{ width: '100%', height: 180 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={(selectedStudentData.breakdown || []).filter(x => x.points > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="points" nameKey="category">
                                {(selectedStudentData.breakdown || []).filter(x => x.points > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={v => `${fmt(v)} pts`} />
                              <Legend iconSize={9} formatter={v => <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{v}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Specialization strengths */}
                      {selectedStudentExtended.specialization?.length > 0 && (
                        <div className="mb-3">
                          <div className="inspect-section-label">Specialization Strengths</div>
                          {selectedStudentExtended.specialization.map((spec, i) => (
                            <div key={i} className="specialization-bar-wrap">
                              <div className="specialization-bar-header">
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>{spec.category}</span>
                                <span style={{ fontWeight: 700, color: COLORS[i % COLORS.length], fontSize: 12 }}>{fmt(spec.points)} pts ({spec.percentage}%)</span>
                              </div>
                              <div className="specialization-bar-track">
                                <div className="specialization-bar-fill" style={{ width: `${spec.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {drawerTab === 'heatmap' && (
                    <div className="animated-fade">
                      {selectedStudentExtended.analytics && (
                        <>
                          <CalendarHeatmap heatmapData={selectedStudentExtended.analytics.heatmap} theme={theme} />
                          <div className="row g-2 mt-2">
                            <div className="col-4">
                              <div className="glass-card text-center p-3">
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Active Days</div>
                                <div className="fw-bold text-primary" style={{ fontSize: 16 }}>{selectedStudentExtended.analytics.heatmap?.filter(d => d.points > 0).length || 0}</div>
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="glass-card text-center p-3">
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Max / Day</div>
                                <div className="fw-bold text-success" style={{ fontSize: 14 }}>
                                  {selectedStudentExtended.analytics.heatmap?.length ? fmt(Math.max(...selectedStudentExtended.analytics.heatmap.map(d => d.points), 0)) : '0.00'}
                                </div>
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="glass-card text-center p-3">
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Peak Month</div>
                                <div className="fw-bold text-warning" style={{ fontSize: 11 }}>{selectedStudentExtended.analytics.most_active_month || '—'}</div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {drawerTab === 'deep' && (
                    <div className="animated-fade">
                      <div className="mb-3 text-muted" style={{ fontSize: 12 }}>
                        Detailed log of all activities and reward points earned.
                      </div>
                      {selectedStudentExtended.analytics && (() => {
                        const txs = selectedStudentExtended.analytics.transactions || [];
                        const grouped = txs.reduce((acc, tx) => {
                          if (!acc[tx.category]) acc[tx.category] = [];
                          acc[tx.category].push(tx);
                          return acc;
                        }, {});
                        const cats = Object.keys(grouped).sort();
                        return (
                          <div className="d-flex flex-column gap-2">
                            {cats.map((cat, idx) => {
                              const catTxs = grouped[cat];
                              const isExpanded = expandedDeepCategory === cat;
                              return (
                                <div key={idx} className="glass-card p-0" style={{ overflow: 'hidden' }}>
                                  <div className="d-flex justify-content-between align-items-center p-3 cursor-pointer" style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-secondary)' : 'transparent' }} onClick={() => setExpandedDeepCategory(isExpanded ? null : cat)}>
                                    <div className="d-flex align-items-center gap-2">
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                                      <span className="fw-bold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cat}</span>
                                      <span className="badge bg-secondary bg-opacity-10 text-secondary" style={{ fontSize: 10 }}>{catTxs.length} items</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="fw-bold text-success" style={{ fontSize: 12 }}>{fmt(catTxs.reduce((sum, t) => sum + t.points, 0))} pts</span>
                                      {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div className="p-3 pt-0 border-top animated-fade" style={{ background: 'var(--bg-secondary)' }}>
                                      {catTxs.map((tx, i) => (
                                        <div key={i} className="d-flex justify-content-between align-items-start py-2 border-bottom last-no-border" style={{ fontSize: 11 }}>
                                          <div>
                                            <div className="fw-semibold text-primary mb-1">{tx.description}</div>
                                            <div className="text-muted">Cleared on: {tx.date} ({tx.day})</div>
                                          </div>
                                          <div className="fw-bold text-end">
                                            <div style={{ color: '#059669' }}>+{fmt(tx.points)}</div>
                                            <div className="text-muted mt-1" style={{ fontSize: 9 }}>{tx.status}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="d-flex justify-content-center align-items-center h-100">
                  <div className="text-center">
                    <div className="spinner-border text-primary mb-2" role="status" style={{ width: 24, height: 24 }} />
                    <div className="text-muted" style={{ fontSize: 12 }}>Loading profile...</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STUDENT VIEW
  // ═══════════════════════════════════════════════════════════════════
  const pieData = getPieData();

  return (
    <div className="student-dashboard animated-fade">
      {/* TOPBAR */}
      <div className="student-topbar">
        <div className="d-flex align-items-center gap-3">
          <div className="sidebar-brand-icon" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}><Award size={18} color="#fff" /></div>
          <div>
            <h5 className="fw-bold m-0" style={{ fontSize: 15 }}>Student Performance &amp; Reward Portal</h5>
            <p className="text-muted m-0" style={{ fontSize: 11 }}>Official tracking of academic milestones, reward points, and peer comparisons.</p>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} className="theme-toggle-btn" title="Toggle theme">
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm px-3 d-flex align-items-center gap-2" style={{ borderRadius: 7, height: 34, fontSize: 13 }}>
            <LogOut size={13} /> Log Out
          </button>
        </div>
      </div>

      {personalData ? (
        <div className="student-content">
          {/* KPI Strip */}
          <div className="row g-3 mb-4">
            {[
              { label: "Active Balance",  value: fmt(personalData.balance_points), color: "#166534" },
              { label: "Total Points",    value: fmt(personalData.total_points), color: "#4f46e5" },
              { label: "Overall / Dept Rank", value: `#${personalData.rank} / #${personalData.dept_rank}`, color: "#92400e" },
              { 
                label: "Engagement Status", 
                value: personalData.engagement_group, 
                isStatus: true,
                color: personalData.engagement_group === 'High' ? '#166534' : personalData.engagement_group === 'Medium' ? '#92400e' : '#991b1b',
                badgeClass: personalData.engagement_group === 'High' ? 'status-high' : personalData.engagement_group === 'Medium' ? 'status-medium' : 'status-low'
              },
            ].map((kpi, i) => {
              const valFontSize = kpi.value.length > 10 ? '26px' : '34px';
              return (
                <div key={i} className="col-md-3 col-6">
                  <div className="enterprise-kpi-card">
                    <div className="enterprise-kpi-indicator" style={{ backgroundColor: kpi.color }} />
                    <div className="enterprise-kpi-header">
                      <span className="enterprise-kpi-dot" style={{ backgroundColor: kpi.color }} />
                      <span className="enterprise-kpi-label">{kpi.label}</span>
                    </div>
                    {kpi.isStatus ? (
                      <div className={`enterprise-status-badge ${kpi.badgeClass}`}>
                        {kpi.value}
                      </div>
                    ) : (
                      <div className="enterprise-kpi-value" style={{ fontSize: valFontSize }}>
                        {kpi.value}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 1: Profile + Trend + Pie (with year tabs) */}
          <div className="row g-4 mb-4">
            {/* Profile card */}
            <div className="col-lg-3">
              <div className="glass-card h-100 text-center d-flex flex-column align-items-center justify-content-center p-4 position-relative">
                <button 
                  className="btn btn-sm btn-outline-primary position-absolute d-flex align-items-center gap-1" 
                  style={{ top: 12, left: 12, fontSize: 10, padding: '3px 8px', borderRadius: 20 }}
                  onClick={() => setIsStudentInspectModalOpen(true)}
                  title="Detailed Inspect"
                >
                  <ScanSearch size={12} /> Inspect
                </button>
                <div className="student-avatar mb-3"><User size={32} color="#fff" /></div>
                <h5 className="fw-bold mb-1" style={{ fontSize: 16 }}>{personalData.student_name}</h5>
                <p className="text-muted mb-2" style={{ fontSize: 12 }}>{personalData.roll_no}</p>
                <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-1 mb-2" style={{ fontSize: 11, fontWeight: 600 }}>{personalData.department}</span>
                <span className="badge rounded-pill bg-secondary bg-opacity-10 text-secondary px-3 py-1" style={{ fontSize: 12 }}>Year {personalData.year}</span>
                <div className="mt-3 pt-3 border-top w-100">
                  <div className="row g-2 text-start">
                    <div className="col-6">
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Redeemed</div>
                      <div className="fw-bold text-warning" style={{ fontSize: 14 }}>{fmt(personalData.redeemed_points)}</div>
                    </div>
                    <div className="col-6">
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Cumulative</div>
                      <div className="fw-bold text-info" style={{ fontSize: 14 }}>{fmt(personalData.cumulative_points)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend chart */}
            <div className="col-lg-5">
              <div className="glass-card h-100">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h6 className="fw-bold m-0 d-flex align-items-center" style={{ fontSize: 13 }}>
                      <TrendingUp className="me-2" size={14} color="var(--brand-color)" /> Points Growth Trend
                    </h6>
                    <p className="text-muted m-0 mt-1" style={{ fontSize: 11 }}>Earned points over time</p>
                  </div>
                  <div className="year-tab-strip">
                    {["weekly", "monthly", "yearly"].map(v => (
                      <button key={v} className={`year-tab-btn ${trendView === v ? 'active' : ''}`} onClick={() => setTrendView(v)} style={{ textTransform: 'capitalize' }}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {personalAnalytics && (
                  <div style={{ width: '100%', height: 210 }}>
                    <ResponsiveContainer>
                      <AreaChart
                        data={trendView === "weekly" ? personalAnalytics.weekly_trend : trendView === "monthly" ? personalAnalytics.monthly_trend : personalAnalytics.yearly_trend}
                        margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey={trendView === "weekly" ? "day" : trendView === "monthly" ? "month" : "year"} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => trendView === "yearly" ? v : (typeof v === 'string' ? v.slice(0, 3) : v)} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => v.toLocaleString()} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={2} fill="url(#lineGrad)" name="Points Earned" activeDot={{ r: 5, fill: '#6366f1' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Pie chart — with year tabs (All / I / II / III / IV) */}
            <div className="col-lg-4">
              <div className="glass-card h-100">
                <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                  <h6 className="fw-bold m-0 d-flex align-items-center" style={{ fontSize: 13 }}>
                    <BarChart2 className="me-2" size={14} color="var(--brand-color)" /> Points by Category
                  </h6>
                </div>
                <div style={{ width: '100%', height: 210 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="points" nameKey="category">
                        {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => `${fmt(v)} pts`} />
                      <Legend verticalAlign="bottom" height={40} iconSize={9} formatter={v => <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 pt-2 border-top">
                  {[...pieData].sort((a, b) => b.points - a.points).slice(0, 3).map((cat, i) => {
                    const originalIndex = pieData.findIndex(x => x.category === cat.category);
                    const color = COLORS[originalIndex !== -1 ? originalIndex % COLORS.length : i];
                    return (
                      <div key={i} className="d-flex justify-content-between align-items-center mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color }} />
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cat.category?.split(' ').slice(0, 2).join(' ')}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 11, color: color }}>{fmt(cat.points)} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Bar chart + Heatmap */}
          <div className="row g-4 mb-4">
            <div className="col-lg-7">
              <div className="glass-card h-100">
                <h6 className="fw-bold mb-3 d-flex align-items-center" style={{ fontSize: 13 }}>
                  <BarChart2 className="me-2" size={14} color="var(--brand-color)" /> Points Earned by Category
                </h6>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={(personalData.breakdown || []).filter(x => x.points > 0)} margin={{ top: 5, right: 10, left: -18, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="category" tickFormatter={v => v.split(' ')[0]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => v.toLocaleString()} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="points" name="Points" radius={[4, 4, 0, 0]}>
                        {(personalData.breakdown || []).filter(x => x.points > 0).map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              {/* Heatmap is here in the student profile */}
              <CalendarHeatmap heatmapData={personalAnalytics?.heatmap} theme={theme} />
              <div className="row g-2 mt-0">
                <div className="col-4">
                  <div className="glass-card text-center p-3">
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Active Days</div>
                    <div className="fw-bold text-primary" style={{ fontSize: 18 }}>{personalAnalytics?.heatmap?.filter(d => d.points > 0).length || 0}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="glass-card text-center p-3">
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Max / Day</div>
                    <div className="fw-bold text-success" style={{ fontSize: 16 }}>
                      {personalAnalytics?.heatmap ? fmt(Math.max(...personalAnalytics.heatmap.map(d => d.points), 0)) : '0.00'}
                    </div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="glass-card text-center p-3">
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 3 }}>Peak Month</div>
                    <div className="fw-bold text-warning" style={{ fontSize: 12 }}>{personalAnalytics?.most_active_month || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions */}
          {personalAnalytics && (
            <div className="glass-card mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold m-0 d-flex align-items-center" style={{ fontSize: 13 }}>
                    <Clock className="me-2" size={14} color="var(--brand-color)" /> Reward Points Breakdown
                  </h6>
                  <p className="text-muted m-0 mt-1" style={{ fontSize: 11 }}>Full transaction history</p>
                </div>
                <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: 11 }}>
                  {Math.min(txLimit, personalAnalytics.transactions.length)} of {personalAnalytics.transactions.length}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle m-0" style={{ fontSize: 13 }}>
                  <thead>
                    <tr className="text-secondary">
                      <th style={{ width: 28 }}>#</th>
                      <th>Date</th><th>Category</th><th>Description</th>
                      <th className="text-end">Points</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalAnalytics.transactions.slice(0, txLimit).map((tx, idx) => (
                      <tr key={idx}>
                        <td className="text-muted text-xs">{idx + 1}</td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{tx.date}</td>
                        <td><span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: 11 }}>{tx.category}</span></td>
                        <td style={{ fontSize: 12 }}>{tx.description}</td>
                        <td className="text-end fw-bold text-success">+{fmt(tx.points)}</td>
                        <td className="text-center">
                          <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-20" style={{ fontSize: 11 }}>{tx.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {txLimit < personalAnalytics.transactions.length && (
                <div className="text-center mt-3 pt-3 border-top">
                  <button onClick={() => setTxLimit(p => p + 10)} className="btn btn-outline-primary btn-sm px-4 rounded-pill" style={{ fontSize: 12 }}>
                    View More ({personalAnalytics.transactions.length - txLimit} remaining)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Peer Benchmark */}
          <div className="glass-card">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h6 className="fw-bold m-0 d-flex align-items-center" style={{ fontSize: 13 }}>
                  <Grid className="me-2" size={14} color="var(--brand-color)" /> Top 10 Peer Benchmark
                </h6>
                <p className="text-muted m-0 mt-1" style={{ fontSize: 11 }}>
                  Top 10 students in <strong>{peerTab === "branch" ? personalData.department : "All Branches"}</strong> — <strong>{peerYearTab === "my_year" ? `Year ${personalData.year}` : "All Years"}</strong>
                </p>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="year-tab-strip">
                  <button className={`year-tab-btn ${peerTab === 'branch' ? 'active' : ''}`} onClick={() => setPeerTab("branch")}>My Branch</button>
                  <button className={`year-tab-btn ${peerTab === 'all' ? 'active' : ''}`} onClick={() => setPeerTab("all")}>All Branches</button>
                </div>
                <select 
                  className="form-select form-select-sm" 
                  style={{ width: 'auto', fontSize: 12, padding: '4px 28px 4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  value={peerYearTab} 
                  onChange={e => setPeerYearTab(e.target.value)}
                >
                  <option value="my_year">My Year (Year {personalData.year})</option>
                  <option value="all">All Years</option>
                </select>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0" style={{ fontSize: 13 }}>
                <thead>
                  <tr className="text-secondary">
                    <th className="text-center" style={{ width: 50 }}>Rank</th>
                    <th>Roll No</th><th>Name</th>
                    <th>Department</th>
                    <th className="text-center" style={{ width: 60 }}>Year</th>
                    <th className="text-end">Total Points</th>
                    <th className="text-center" style={{ width: 105 }}>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {peerLeaderboard.slice(0, 10).map((s, idx) => {
                    const isMe = s.roll_no === personalData.roll_no;
                    const rankClass = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
                    return (
                      <tr key={s.roll_no} style={{ background: isMe ? 'var(--brand-glow)' : 'transparent' }}>
                        <td className="text-center">
                          <div className={`rank-badge ${rankClass}`} style={{ background: !rankClass ? 'var(--bg-tertiary)' : undefined, color: !rankClass ? 'var(--text-secondary)' : undefined }}>
                            {idx < 3 ? idx + 1 : `#${s.rank}`}
                          </div>
                        </td>
                        <td className={`fw-semibold ${isMe ? 'text-primary' : ''}`}>{s.roll_no}</td>
                        <td className="fw-semibold">
                          <div className="d-flex align-items-center gap-2">
                            {s.student_name}
                            {isMe && <span className="badge bg-primary text-white text-xxs px-2 py-1">You</span>}
                          </div>
                        </td>
                        <td className="text-muted col-narrow-dept" style={{ fontSize: 12 }}>{s.department}</td>
                        <td className="text-center">{s.year}</td>
                        <td className="text-end fw-bold text-success">{fmt(s.total_points)}</td>
                        <td className="text-center">
                          <span className={`badge rounded-pill ${s.engagement_group === 'Low' ? 'badge-low' : s.engagement_group === 'Medium' ? 'badge-medium' : 'badge-high'}`} style={{ fontSize: 11 }}>
                            {s.engagement_group}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: 28, height: 28 }} />
            <div className="text-muted" style={{ fontSize: 13 }}>Loading your dashboard...</div>
          </div>
        </div>
      )}
      {/* Student Inspect Modal */}
      {isStudentInspectModalOpen && personalAnalytics && (
        <>
          <div className="drawer-overlay" onClick={() => setIsStudentInspectModalOpen(false)} style={{ zIndex: 1040 }} />
          <div className="drawer-content" style={{ zIndex: 1050 }}>
            <div className="d-flex justify-content-between align-items-start pb-3 border-bottom mb-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <ScanSearch size={15} color="var(--brand-color)" />
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: 'var(--text-tertiary)' }}>Detailed Log</span>
                </div>
                <h4 className="fw-bold mb-0" style={{ fontSize: 18 }}>Activity History</h4>
              </div>
              <button className="btn-close" onClick={() => setIsStudentInspectModalOpen(false)} />
            </div>
            
            <div className="animated-fade">
              {(() => {
                const txs = personalAnalytics.transactions || [];
                const grouped = txs.reduce((acc, tx) => {
                  if (!acc[tx.category]) acc[tx.category] = [];
                  acc[tx.category].push(tx);
                  return acc;
                }, {});
                const cats = Object.keys(grouped).sort();
                return (
                  <div className="d-flex flex-column gap-2">
                    {cats.map((cat, idx) => {
                      const catTxs = grouped[cat];
                      const isExpanded = studentInspectCategory === cat;
                      return (
                        <div key={idx} className="glass-card p-0" style={{ overflow: 'hidden' }}>
                          <div className="d-flex justify-content-between align-items-center p-3 cursor-pointer" style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-secondary)' : 'transparent' }} onClick={() => setStudentInspectCategory(isExpanded ? null : cat)}>
                            <div className="d-flex align-items-center gap-2">
                              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                              <span className="fw-bold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cat}</span>
                              <span className="badge bg-secondary bg-opacity-10 text-secondary" style={{ fontSize: 10 }}>{catTxs.length} items</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-success" style={{ fontSize: 12 }}>{fmt(catTxs.reduce((sum, t) => sum + t.points, 0))} pts</span>
                              {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="p-3 pt-0 border-top animated-fade" style={{ background: 'var(--bg-secondary)' }}>
                              {catTxs.map((tx, i) => (
                                <div key={i} className="d-flex justify-content-between align-items-start py-2 border-bottom last-no-border" style={{ fontSize: 11 }}>
                                  <div>
                                    <div className="fw-semibold text-primary mb-1">{tx.description}</div>
                                    <div className="text-muted">Cleared on: {tx.date} ({tx.day})</div>
                                  </div>
                                  <div className="fw-bold text-end">
                                    <div style={{ color: '#059669' }}>+{fmt(tx.points)}</div>
                                    <div className="text-muted mt-1" style={{ fontSize: 9 }}>{tx.status}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
