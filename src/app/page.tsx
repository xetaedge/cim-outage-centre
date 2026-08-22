'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  SlidersHorizontal,
  X,
  MessageSquareText,
  Send,
  Loader2,
  Activity,
  Archive,
  Radio,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';
import { KpiCards } from '@/components/KpiCards';
import { IncidentCard, IncidentData } from '@/components/IncidentCard';
import { OutageMap } from '@/components/OutageMap';

export default function CommandCenterPage() {
  const {
    currentRole,
    userName,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    groupFilter,
    setGroupFilter,
    serviceFilter,
    setServiceFilter,
    setFetchModalOpen,
    refreshTrigger,
    addToast,
  } = useCimStore();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeP1: 0,
    activeP2: 0,
    resolvedToday: 0,
    averageMttr: '24.0m',
    affectedSitesCount: 0,
    activeTeamsBridges: 0,
  });

  // Selected incident for updates drawer
  const [selectedIncidentForUpdates, setSelectedIncidentForUpdates] = useState<IncidentData | null>(null);
  const [newUpdateComment, setNewUpdateComment] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Generative AI 3 Options State
  const [aiOptions, setAiOptions] = useState<any[]>([]);
  const [selectedAiOptionId, setSelectedAiOptionId] = useState<string>('original');
  const [generatingOptions, setGeneratingOptions] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (groupFilter !== 'ALL') params.append('assignmentGroup', groupFilter);
      if (serviceFilter !== 'ALL') params.append('businessService', serviceFilter);

      // Status filtering logic
      if (activeTab === 'ACTIVE') {
        if (statusFilter !== 'ALL') {
          params.append('status', statusFilter);
        }
      } else {
        params.append('status', 'CLOSED');
      }

      const [incRes, kpiRes] = await Promise.all([
        fetch(`/api/incidents?${params.toString()}`),
        fetch('/api/analytics'),
      ]);

      const incData = await incRes.json();
      const kpiData = await kpiRes.json();

      if (incData.success) {
        if (activeTab === 'ACTIVE') {
          // If status filter is 'ALL', show all unclosed status types
          if (statusFilter === 'ALL') {
            setIncidents(incData.incidents.filter((i: IncidentData) => i.status !== 'CLOSED'));
          } else {
            setIncidents(incData.incidents.filter((i: IncidentData) => i.status === statusFilter));
          }
        } else {
          setIncidents(incData.incidents.filter((i: IncidentData) => i.status === 'CLOSED'));
        }
      }

      if (kpiData.success && kpiData.kpis) {
        setKpis(kpiData.kpis);
      }
    } catch (err) {
      console.error('Failed to fetch command center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [searchQuery, priorityFilter, statusFilter, groupFilter, serviceFilter, activeTab, refreshTrigger]);

  const handleGenerateAiOptions = async () => {
    if (!newUpdateComment.trim() || !selectedIncidentForUpdates) return;
    setGeneratingOptions(true);

    try {
      const res = await fetch('/api/ai/enhance-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftComment: newUpdateComment,
          incidentNumber: selectedIncidentForUpdates.number,
          priority: selectedIncidentForUpdates.priority,
          assignmentGroup: selectedIncidentForUpdates.assignmentGroup,
        }),
      });

      const data = await res.json();
      if (data.success && data.options) {
        setAiOptions(data.options);
        setSelectedAiOptionId('option1');
        addToast({
          title: '✨ Generative AI 3 Options Ready',
          message: 'Choose from Executive, Technical, or Customer Impact summaries.',
          type: 'update',
        });
      }
    } catch (err) {
      console.error('Failed to generate AI options:', err);
    } finally {
      setGeneratingOptions(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!selectedIncidentForUpdates) return;

    let commentToPublish = newUpdateComment;
    if (aiOptions.length > 0) {
      const chosen = aiOptions.find((opt) => opt.id === selectedAiOptionId);
      if (chosen) commentToPublish = chosen.summary;
    }

    if (!commentToPublish.trim()) return;

    setSubmittingUpdate(true);

    try {
      const res = await fetch(`/api/incidents/${selectedIncidentForUpdates.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: commentToPublish,
          authorName: userName || (currentRole === 'ADMIN' ? 'Administrator' : 'Incident Manager'),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewUpdateComment('');
        setAiOptions([]);
        setSelectedAiOptionId('original');

        addToast({
          title: `📝 Update #${data.update.updateNumber} Published`,
          message: `Auto-regenerated cumulative AI status summary for ${selectedIncidentForUpdates.number}`,
          type: 'update',
        });

        setSelectedIncidentForUpdates(data.incident);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to post update:', err);
    } finally {
      setSubmittingUpdate(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Executive KPI Cards Section */}
      <section>
        <KpiCards data={kpis} />
      </section>

      {/* 2. Interactive Global Outage Map */}
      <section>
        <OutageMap />
      </section>

      {/* 3. Filter & Section Controls Bar */}
      <section className="glass-card p-4 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          {/* Active vs Archived Tabs */}
          <div className="flex items-center space-x-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('ACTIVE');
                setStatusFilter('ALL');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'ACTIVE'
                  ? 'bg-accent text-white shadow-glowBlue'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span>Active Incidents</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('ARCHIVED');
                setStatusFilter('CLOSED');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'ARCHIVED'
                  ? 'bg-purple-600 text-white shadow-2xl'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-purple-300" />
              <span>Archived Incidents</span>
            </button>
          </div>

          {(priorityFilter !== 'ALL' ||
            statusFilter !== 'ALL' ||
            groupFilter !== 'ALL' ||
            serviceFilter !== 'ALL' ||
            searchQuery) && (
            <button
              onClick={() => {
                setPriorityFilter('ALL');
                setStatusFilter('ALL');
                setGroupFilter('ALL');
                setServiceFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-blue-400 hover:underline flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Dynamic Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Priority Select */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-accent"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - Major</option>
              <option value="P3">P3 - Moderate</option>
              <option value="P4">P4 - Low</option>
            </select>
          </div>

          {/* Status Select Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Incident Status State
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={activeTab === 'ARCHIVED'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-accent disabled:opacity-50"
            >
              {activeTab === 'ACTIVE' ? (
                <>
                  <option value="ALL">All Active Statuses</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="IDENTIFIED">IDENTIFIED</option>
                  <option value="MONITORING">MONITORING</option>
                  <option value="RESOLVED">RESOLVED</option>
                </>
              ) : (
                <option value="CLOSED">CLOSED (Archived)</option>
              )}
            </select>
          </div>

          {/* Group Select */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Assignment Group
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-accent"
            >
              <option value="ALL">All Assignment Groups</option>
              <option value="Database Administration">Database Administration</option>
              <option value="Global Network Operations">Global Network Operations</option>
              <option value="Identity & Access Engineering">Identity & Access Engineering</option>
            </select>
          </div>

          {/* Business Service Select */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Business Service
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-accent"
            >
              <option value="ALL">All Services</option>
              <option value="Core Online Payments & Checkout API">Core Online Payments</option>
              <option value="EMEA Enterprise Banking Portal">EMEA Enterprise Banking</option>
              <option value="Global SSO & Mobile Identity Engine">Global Identity Engine</option>
            </select>
          </div>
        </div>
      </section>

      {/* 4. Incidents Grid Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              activeTab === 'ACTIVE' ? 'bg-red-500 animate-pulse' : 'bg-purple-400'
            }`}
          />
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            {activeTab === 'ACTIVE' ? 'Active Incidents Feed' : 'Archived Closed Incidents'} ({incidents.length})
          </h2>
        </div>

        {currentRole !== 'GUEST' && activeTab === 'ACTIVE' && (
          <button
            onClick={() => setFetchModalOpen(true)}
            className="px-3.5 py-1.5 bg-accent hover:bg-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Fetch ServiceNow Record</span>
          </button>
        )}
      </div>

      {/* 5. Incidents Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card p-6 border border-slate-800 animate-pulse space-y-4 rounded-2xl h-72"
            >
              <div className="flex justify-between">
                <div className="w-20 h-5 bg-slate-700/80 rounded" />
                <div className="w-24 h-5 bg-slate-700/80 rounded" />
              </div>
              <div className="w-full h-8 bg-slate-700/80 rounded" />
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-800 rounded-2xl space-y-3">
          <Activity className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">
            No Incidents Match Selected Filters
          </h3>
          <p className="text-xs text-secondaryText">
            Adjust your Priority, Status State, or Assignment Group filters above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {incidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              onOpenUpdates={(incident) => {
                setSelectedIncidentForUpdates(incident);
                setAiOptions([]);
              }}
              onIncidentUpdated={fetchDashboardData}
            />
          ))}
        </div>
      )}

      {/* 6. Updates & Timeline Drawer Modal */}
      <AnimatePresence>
        {selectedIncidentForUpdates && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass-modal w-full max-w-lg h-full border-l border-slate-700 shadow-2xl p-6 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="font-mono text-xs font-bold text-accent">
                    {selectedIncidentForUpdates.number}
                  </span>
                  <h3 className="font-bold text-sm text-white line-clamp-1">
                    {selectedIncidentForUpdates.shortDescription}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setSelectedIncidentForUpdates(null);
                    setAiOptions([]);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Updates List */}
              <div className="flex-1 py-4 overflow-y-auto space-y-4 pr-1">
                {/* AI Cumulative Update Summary */}
                <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                    Cumulative AI Status Summary
                  </span>
                  <p className="text-xs text-slate-200 italic leading-relaxed">
                    "{selectedIncidentForUpdates.aiCurrentStatusSummary || selectedIncidentForUpdates.issueSummary}"
                  </p>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">
                  Timeline Updates ({selectedIncidentForUpdates.updates?.length || 0})
                </h4>

                {selectedIncidentForUpdates.updates?.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-400">Update #{u.updateNumber}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(u.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium leading-relaxed">{u.comment}</p>
                    <span className="text-[10px] text-slate-500 block pt-1">By: {u.authorName}</span>
                  </div>
                ))}
              </div>

              {/* Add New Update Input & Generative AI 3 Options */}
              {currentRole !== 'GUEST' && selectedIncidentForUpdates.status !== 'CLOSED' ? (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Type timeline update draft..."
                      value={newUpdateComment}
                      onChange={(e) => setNewUpdateComment(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />

                    {/* AI Enhancement Trigger Button */}
                    {newUpdateComment.trim().length > 5 && aiOptions.length === 0 && (
                      <button
                        type="button"
                        onClick={handleGenerateAiOptions}
                        disabled={generatingOptions}
                        className="w-full py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                      >
                        {generatingOptions ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                        )}
                        <span>Suggest 3 AI Summary Enhancements</span>
                      </button>
                    )}
                  </div>

                  {/* 3 AI Suggested Options Selector Cards */}
                  {aiOptions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 bg-blue-950/40 p-3 rounded-xl border border-blue-900/60"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-yellow-400">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          Generative AI 3 Options
                        </span>
                        <button
                          type="button"
                          onClick={() => setAiOptions([])}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {aiOptions.map((option) => {
                          const isSelected = selectedAiOptionId === option.id;
                          return (
                            <div
                              key={option.id}
                              onClick={() => setSelectedAiOptionId(option.id)}
                              className={`p-2.5 rounded-xl border cursor-pointer text-xs transition-all flex items-start justify-between gap-2 ${
                                isSelected
                                  ? 'bg-accent/20 border-accent text-white font-medium shadow-glowBlue'
                                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-[11px] text-blue-300">
                                    {option.title}
                                  </span>
                                  <span className="px-1.5 py-0.2 text-[9px] font-mono bg-blue-500/20 text-blue-300 rounded">
                                    {option.tag}
                                  </span>
                                </div>
                                <p className="text-[11px] opacity-90 leading-snug">{option.summary}</p>
                              </div>

                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={handlePostUpdate}
                    disabled={submittingUpdate || (!newUpdateComment.trim() && aiOptions.length === 0)}
                    className="w-full py-2 bg-accent hover:bg-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {submittingUpdate ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {aiOptions.length > 0
                        ? `Publish Selected (${selectedAiOptionId === 'original' ? 'Original' : selectedAiOptionId})`
                        : 'Publish Timeline Update'}
                    </span>
                  </button>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
