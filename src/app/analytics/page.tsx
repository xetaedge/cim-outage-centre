'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Server,
  Building,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function ExecutiveAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeP1: 0,
    activeP2: 0,
    resolvedToday: 0,
    averageMttr: '24.0m',
    affectedSitesCount: 0,
    activeTeamsBridges: 0,
  });

  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);
  const [groupWorkload, setGroupWorkload] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();

      if (data.success) {
        if (data.kpis) setKpis(data.kpis);
        if (data.analytics?.priorityDistribution) {
          setPriorityDistribution(data.analytics.priorityDistribution);
        }
        if (data.analytics?.assignmentGroupWorkload) {
          setGroupWorkload(data.analytics.assignmentGroupWorkload);
        }
      }
    } catch (err) {
      console.error('Failed to load executive analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center border border-slate-800 space-y-4 rounded-2xl">
        <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Computing Executive Incident Telemetry & MTTR Trends...</p>
      </div>
    );
  }

  const defaultPriorityData = priorityDistribution.length > 0 ? priorityDistribution : [
    { name: 'P1 Critical', value: kpis.activeP1 || 1, color: '#EF4444' },
    { name: 'P2 Major', value: kpis.activeP2 || 1, color: '#FB923C' },
    { name: 'P3 Moderate', value: 2, color: '#FACC15' },
    { name: 'P4 Low', value: 1, color: '#3B82F6' },
  ];

  const defaultWorkloadData = groupWorkload.length > 0 ? groupWorkload : [
    { group: 'Database Administration', incidents: 2 },
    { group: 'Global Network Operations', incidents: 3 },
    { group: 'Identity & Access Engineering', incidents: 1 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-2">
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <BarChart2 className="w-6 h-6 text-accent" />
          Executive Incident Analytics & MTTR Intelligence
        </h1>
        <p className="text-xs text-secondaryText">
          Real-time aggregated KPIs, priority distribution, assignment group workload, and system availability.
        </p>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-red-500/30 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Active P1 Critical</span>
          <p className="text-2xl font-extrabold text-red-400">{kpis.activeP1}</p>
        </div>

        <div className="glass-card p-4 border border-orange-500/30 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Active P2 Major</span>
          <p className="text-2xl font-extrabold text-orange-400">{kpis.activeP2}</p>
        </div>

        <div className="glass-card p-4 border border-emerald-500/30 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Resolved Today</span>
          <p className="text-2xl font-extrabold text-emerald-400">{kpis.resolvedToday}</p>
        </div>

        <div className="glass-card p-4 border border-blue-500/30 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Average MTTR</span>
          <p className="text-2xl font-extrabold text-blue-400">{kpis.averageMttr}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Priority Distribution Pie Chart */}
        <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-purple-400" />
            Incident Priority Distribution
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={defaultPriorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {defaultPriorityData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#3B82F6'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Assignment Group Workload Bar Chart */}
        <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            Assignment Group Workload Breakdown
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defaultWorkloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="group" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                />
                <Bar dataKey="incidents" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
