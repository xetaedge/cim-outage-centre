'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileBarChart, Filter, Download, Search, Brain, RefreshCw, Loader2,
  BarChart2, PieChart as PieIcon, TrendingUp, MapPin, Users, Clock,
  AlertTriangle, CheckCircle2, Activity, ChevronDown, ChevronUp,
  ArrowUpDown, Sparkles, Target, Lightbulb, Timer, ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line
} from 'recharts';
import Link from 'next/link';

// Constants & Types
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const STATUSES = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED'];

const PRIORITY_COLORS: Record<string, string> = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P4: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  INVESTIGATING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  IDENTIFIED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  MONITORING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  CLOSED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

interface Incident {
  id: string;
  number: string;
  shortDescription: string;
  priority: string;
  status: string;
  assignmentGroup: string;
  sites: string;
  openedAt: string;
  mttr: number;
}

export default function ReportsAndInsights() {
  // State: Filter Panel
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    priority: [] as string[],
    status: [] as string[],
    assignmentGroup: '',
    location: '',
    keyword: '',
    tag: ''
  });

  // State: Data
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [kpis, setKpis] = useState<any>({ total: 0, p1: 0, p2: 0, mttr: 0, resolved: 0, open: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // State: AI Thinking
  const [aiQuery, setAiQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);

  // State: Dynamic Filter Options
  const [filterOptions, setFilterOptions] = useState<{
    sites: { id: string; name: string }[];
    assignmentGroups: string[];
    ctis: string[];
  }>({
    sites: [],
    assignmentGroups: [],
    ctis: [],
  });

  // Sorting
  const [sortField, setSortField] = useState<keyof Incident>('openedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Initial Fetch / Apply Filters
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query string
      const queryParams = new URLSearchParams();
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
      if (filters.priority.length > 0) queryParams.append('priority', filters.priority.join(','));
      if (filters.status.length > 0) queryParams.append('status', filters.status.join(','));
      if (filters.assignmentGroup) queryParams.append('assignmentGroup', filters.assignmentGroup);
      if (filters.location) queryParams.append('siteId', filters.location);
      if (filters.keyword) queryParams.append('keyword', filters.keyword);
      if (filters.tag) queryParams.append('cti', filters.tag);

      const res = await fetch(`/api/reports?${queryParams.toString()}`);
      
      if (!res.ok) {
        // Fallback mock data if API is not ready
        generateMockData();
        return;
      }
      const data = await res.json();
      // Map API incidents (with ettrMinutes and sites relation) to page format
      const mapped = (data.incidents || []).map((inc: any) => ({
        id: inc.id,
        number: inc.number,
        shortDescription: inc.shortDescription,
        priority: inc.priority,
        status: inc.status,
        assignmentGroup: inc.assignmentGroup,
        sites: inc.sites?.map((s: any) => s.site?.name || s.name).join(', ') || 'N/A',
        openedAt: inc.openedAt,
        mttr: (inc.ettrMinutes || 0) / 60,
      }));
      setIncidents(mapped);
      setAnalytics(data.analytics ? {
        ...data.analytics,
        mttrTrend: (data.analytics.mttrTrend || []).map((t: any) => ({ name: t.period || t.name, mttr: (t.avgMttr || t.mttr || 0) / 60 })),
      } : null);
      const s = data.summary || {};
      setKpis({
        total: s.totalIncidents || 0,
        p1: s.p1Count || 0,
        p2: s.p2Count || 0,
        mttr: s.avgMttr || '0m',
        resolved: s.resolvedCount || 0,
        open: s.openCount || 0,
      });
      if (data.filterOptions) {
        setFilterOptions(data.filterOptions);
      }
    } catch (error) {
      console.error('Failed to fetch reports', error);
      generateMockData(); // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Fallback Mock Data Generator
  const generateMockData = () => {
    setIncidents([
      { id: '1', number: 'INC0010023', shortDescription: 'Database connection timeouts', priority: 'P1', status: 'INVESTIGATING', assignmentGroup: 'DBA Team', sites: 'Primary DC', openedAt: new Date().toISOString(), mttr: 0 },
      { id: '2', number: 'INC0010024', shortDescription: 'API latency spikes', priority: 'P2', status: 'IDENTIFIED', assignmentGroup: 'Backend API', sites: 'Cloud Region A', openedAt: new Date(Date.now() - 3600000).toISOString(), mttr: 1.5 },
      { id: '3', number: 'INC0010025', shortDescription: 'Login portal intermittent errors', priority: 'P3', status: 'RESOLVED', assignmentGroup: 'IAM Team', sites: 'Global', openedAt: new Date(Date.now() - 86400000).toISOString(), mttr: 4.2 },
      { id: '4', number: 'INC0010026', shortDescription: 'Switch failure in Rack 4', priority: 'P2', status: 'MONITORING', assignmentGroup: 'Network Ops', sites: 'Secondary DC', openedAt: new Date(Date.now() - 7200000).toISOString(), mttr: 2.1 },
    ]);
    setKpis({ total: 124, p1: 3, p2: 12, mttr: 3.4, resolved: 89, open: 35 });
    setAnalytics({
      incidentsOverTime: [{ name: 'Mon', incidents: 12 }, { name: 'Tue', incidents: 19 }, { name: 'Wed', incidents: 15 }, { name: 'Thu', incidents: 22 }, { name: 'Fri', incidents: 10 }, { name: 'Sat', incidents: 5 }, { name: 'Sun', incidents: 8 }],
      priorityDistribution: [{ name: 'P1', value: 3 }, { name: 'P2', value: 12 }, { name: 'P3', value: 45 }, { name: 'P4', value: 64 }],
      mttrTrend: [{ name: 'Week 1', mttr: 4.2 }, { name: 'Week 2', mttr: 3.8 }, { name: 'Week 3', mttr: 3.5 }, { name: 'Week 4', mttr: 3.4 }],
      topSites: [{ name: 'Primary DC', value: 45 }, { name: 'Cloud Region A', value: 32 }, { name: 'Secondary DC', value: 20 }, { name: 'Branch Office', value: 15 }],
      topAssignmentGroups: [{ name: 'Network Ops', value: 30 }, { name: 'DBA Team', value: 25 }, { name: 'Backend API', value: 20 }, { name: 'IAM Team', value: 15 }],
      statusDistribution: [{ name: 'INVESTIGATING', value: 10 }, { name: 'IDENTIFIED', value: 15 }, { name: 'MONITORING', value: 10 }, { name: 'RESOLVED', value: 60 }, { name: 'CLOSED', value: 29 }]
    });
  };

  // Handlers
  const handleFilterToggle = (type: 'priority' | 'status', value: string) => {
    setFilters(prev => {
      const current = prev[type];
      return {
        ...prev,
        [type]: current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      };
    });
  };

  const handleResetFilters = () => {
    setFilters({
      dateFrom: '', dateTo: '', priority: [], status: [], assignmentGroup: '', location: '', keyword: '', tag: ''
    });
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      // append filters...
      const res = await fetch(`/api/reports/export?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob(); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = 'CIM_Report.xlsx'; 
      a.click();
    } catch (e) {
      console.error(e);
      alert("Export functionality not implemented in mock environment.");
    }
  };

  const handleAiAnalysis = async () => {
    if (!aiQuery) return;
    setIsAiThinking(true);
    setAiResults(null);
    try {
      const res = await fetch(`/api/reports/think?query=${encodeURIComponent(aiQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setAiResults(data.thinking || data);
        setIsAiThinking(false);
      } else {
        // Mock AI response
        setTimeout(() => {
          setAiResults({
            similarIncidents: [
              { number: 'INC0009982', desc: 'Database lockup on main cluster', res: 'Restarted connection pooler', similarity: '92% match on symptoms' },
              { number: 'INC0009841', desc: 'DB timeouts during backup', res: 'Adjusted backup window and IOPS limit', similarity: '85% match on timing' }
            ],
            rootCauses: [
              'Exhausted connection pool on primary database node',
              'Long-running unoptimized analytical queries blocking transaction threads',
              'Transient network partition between app servers and DB cluster'
            ],
            recommendedActions: [
              'Check pg_stat_activity for long-running queries',
              'Review connection pool metrics in DataDog',
              'Consider scaling read replicas if read-heavy load is detected',
              'Verify network latency between availability zones'
            ],
            estimatedResolution: { time: '45 mins', confidence: 78 }
          });
          setIsAiThinking(false);
        }, 1200);
      }
    } catch (e) {
      console.error(e);
      setIsAiThinking(false);
    }
  };

  const toggleSort = (field: keyof Incident) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedIncidents = [...incidents].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans selection:bg-accent/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="glass-card border border-slate-800 rounded-2xl p-6 bg-slate-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-accent/20 rounded-xl border border-accent/30 text-accent">
              <FileBarChart className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Reports & Insights</h1>
              <p className="text-slate-400 mt-1">Advanced reporting, interactive analytics, and AI-powered incident intelligence.</p>
            </div>
          </div>
        </div>

        {/* Section 1: Filter Bar */}
        <div className="glass-card border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-xl overflow-hidden">
          <div 
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <div className="flex items-center gap-2 text-white font-semibold">
              <Filter className="w-5 h-5 text-accent" />
              Advanced Filters
            </div>
            {isFiltersOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
          
          {isFiltersOpen && (
            <div className="p-6 border-t border-slate-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Dates */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Date Range</label>
                  <div className="flex gap-2">
                    <input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
                    <input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITIES.map(p => (
                      <button 
                        key={p} 
                        onClick={() => handleFilterToggle('priority', p)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filters.priority.includes(p) ? PRIORITY_COLORS[p] : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <button 
                        key={s} 
                        onClick={() => handleFilterToggle('status', s)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filters.status.includes(s) ? STATUS_COLORS[s] : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prefilled Dropdown Inputs */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Assignment Group</label>
                  <select 
                    value={filters.assignmentGroup} 
                    onChange={e => setFilters({...filters, assignmentGroup: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  >
                    <option value="">All Assignment Groups</option>
                    {filterOptions.assignmentGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Location / Site</label>
                  <select 
                    value={filters.location} 
                    onChange={e => setFilters({...filters, location: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  >
                    <option value="">All Locations / Sites</option>
                    {filterOptions.sites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Keyword Search</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input type="text" placeholder="Search descriptions..." value={filters.keyword} onChange={e => setFilters({...filters, keyword: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">CTI / Tag</label>
                  <select 
                    value={filters.tag} 
                    onChange={e => setFilters({...filters, tag: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  >
                    <option value="">All CTIs / Tags</option>
                    {filterOptions.ctis.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800/50">
                <button onClick={handleResetFilters} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
                <button onClick={handleExport} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" /> Export to Excel
                </button>
                <button onClick={fetchReports} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                  <Filter className="w-4 h-4" /> Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Analytics Dashboard */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <BarChart2 className="w-5 h-5 text-accent" /> Dashboard Overview
          </div>
          
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Incidents', value: kpis.total, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'P1 Critical', value: kpis.p1, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
              { label: 'P2 Major', value: kpis.p2, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
              { label: 'Avg MTTR (hrs)', value: kpis.mttr, icon: Clock, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              { label: 'Resolved', value: kpis.resolved, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Open', value: kpis.open, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            ].map((k, i) => (
              <div key={i} className="glass-card border border-slate-800 rounded-2xl p-4 bg-slate-900/50 backdrop-blur-xl flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-slate-400">{k.label}</span>
                  <div className={`p-1.5 rounded-lg ${k.bg} ${k.color}`}>
                    <k.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-2xl font-bold mt-2 ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Grid */}
          {analytics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Incidents Over Time */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-accent" /> Incidents Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.incidentsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="incidents" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIncidents)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Priority Distribution */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><PieIcon className="w-4 h-4 text-accent" /> Priority Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.priorityDistribution} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                        {analytics.priorityDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MTTR Trend */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-accent" /> MTTR Trend (Hours)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.mttrTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="mttr" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Affected Locations */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><MapPin className="w-4 h-4 text-accent" /> Top Affected Locations</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={analytics.topSites} margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Assignment Group Load */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-accent" /> Assignment Group Load</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topAssignmentGroups} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="glass-card border border-slate-800 rounded-2xl p-5 bg-slate-900/50 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-accent" /> Status Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.statusDistribution} cx="50%" cy="50%" outerRadius={85} dataKey="value" stroke="none">
                        {analytics.statusDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-96 flex items-center justify-center border border-slate-800 border-dashed rounded-2xl bg-slate-900/30">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          )}
        </div>

        {/* Section 3: AI Thinking Panel */}
        <div className="glass-card border border-purple-500/30 rounded-2xl overflow-hidden bg-slate-900/50 backdrop-blur-xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
          
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">AI Incident Intelligence <Sparkles className="w-4 h-4 text-purple-400" /></h2>
                <p className="text-sm text-slate-400">Describe an issue or enter an incident ID to generate insights, root causes, and recommended actions.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="e.g. Database connection timeouts in primary DC..." 
                  value={aiQuery} 
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiAnalysis()}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" 
                />
              </div>
              <button 
                onClick={handleAiAnalysis}
                disabled={!aiQuery || isAiThinking}
                className="px-6 py-3 rounded-xl font-medium bg-purple-600 text-white hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {isAiThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isAiThinking ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {isAiThinking && (
            <div className="p-12 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Brain className="w-12 h-12 text-purple-400 animate-pulse" />
                <div className="absolute inset-0 bg-purple-400 blur-xl opacity-20 animate-pulse rounded-full" />
              </div>
              <p className="text-slate-400 animate-pulse font-medium">AI is thinking...</p>
            </div>
          )}

          {aiResults && !isAiThinking && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/30">
              
              {/* Similar Incidents */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Search className="w-4 h-4 text-purple-400" /> Similar Past Incidents</h3>
                <div className="space-y-3">
                  {(aiResults.similarIncidents || []).map((inc: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Link href={`/incidents/${inc.number}`} className="text-accent font-mono text-sm hover:underline flex items-center gap-1">{inc.number} <ExternalLink className="w-3 h-3"/></Link>
                        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{inc.similarity || inc.similarityReason || 'Match'}</span>
                      </div>
                      <p className="text-sm text-slate-300 font-medium mb-1">{inc.desc || inc.description}</p>
                      <p className="text-xs text-slate-400"><span className="text-slate-500">Resolution:</span> {inc.res || inc.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {/* Root Causes */}
                <div className="glass-card border border-slate-800/80 rounded-xl p-4 bg-slate-800/20">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-amber-400" /> Potential Root Causes</h3>
                  <ul className="space-y-2">
                    {(aiResults.rootCauses || aiResults.commonRootCauses || []).map((cause: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Actions */}
                <div className="glass-card border border-slate-800/80 rounded-xl p-4 bg-slate-800/20">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Recommended Actions</h3>
                  <ol className="space-y-2 list-decimal list-inside text-sm text-slate-300">
                    {(aiResults.recommendedActions || []).map((action: string, idx: number) => (
                      <li key={idx} className="pl-1 marker:text-slate-500">{action}</li>
                    ))}
                  </ol>
                </div>
                
                {/* Resolution Time */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <Timer className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Est. Resolution Time</p>
                      <p className="text-lg font-bold text-white">{aiResults.estimatedResolution?.time || aiResults.estimatedResolutionTime || '~35 mins'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">AI Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${aiResults.estimatedResolution?.confidence ?? aiResults.confidence ?? 80}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-200">{aiResults.estimatedResolution?.confidence ?? aiResults.confidence ?? 80}%</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Section 4: Filtered Results Table */}
        <div className="glass-card border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Incident Records 
              <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{incidents.length}</span>
            </h2>
            <div className="flex items-center gap-2">
               {/* Optional table-specific controls could go here */}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('number')}>
                    <div className="flex items-center gap-1">Number <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('shortDescription')}>
                    <div className="flex items-center gap-1">Short Description <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('assignmentGroup')}>
                    <div className="flex items-center gap-1">Assignment Group <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium">Sites</th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('openedAt')}>
                    <div className="flex items-center gap-1">Opened At <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="p-4 font-medium cursor-pointer hover:text-slate-200 transition-colors" onClick={() => toggleSort('mttr')}>
                    <div className="flex items-center gap-1">MTTR (h) <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Loading records...</p>
                    </td>
                  </tr>
                ) : sortedIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">
                      No incidents found matching current filters.
                    </td>
                  </tr>
                ) : (
                  sortedIncidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 text-sm font-mono text-accent">
                        <Link href={`/incidents/${inc.id}`} className="hover:underline">{inc.number}</Link>
                      </td>
                      <td className="p-4 text-sm text-slate-200 max-w-xs truncate" title={inc.shortDescription}>{inc.shortDescription}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${PRIORITY_COLORS[inc.priority] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          {inc.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[inc.status] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-300">{inc.assignmentGroup}</td>
                      <td className="p-4 text-sm text-slate-400">{inc.sites}</td>
                      <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                        {new Date(inc.openedAt).toLocaleDateString()} {new Date(inc.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-sm text-slate-300 font-mono">{(inc.mttr || 0).toFixed(1)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
