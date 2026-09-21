'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldAlert,
  Clock,
  Sparkles,
  Radio,
  Server,
  UserCheck,
  Globe,
  AlertTriangle,
  Send,
  Loader2,
  MessageSquareText,
  Lock,
  Play,
  Users,
  Archive,
  CheckCircle2,
  BookOpen,
  FileText,
  Shield,
  Lightbulb,
  Target,
  Database,
  History,
  Timer,
  GitPullRequest,
  Sliders,
  RefreshCw,
  Edit2,
  Save,
  XCircle,
  Download,
  HelpCircle,
  BrainCircuit,
  X,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  MapPin,
  Plus,
  Trash2,
  Building2,
  Search,
  Mail,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';
import { IncidentData } from '@/components/IncidentCard';

export default function IncidentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentRole, userName, addToast, triggerRefresh } = useCimStore();

  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateComment, setUpdateComment] = useState('');
  const [nextCadenceHours, setNextCadenceHours] = useState<number>(1);
  const [isFinalUpdate, setIsFinalUpdate] = useState(false);
  const [totalOutageDuration, setTotalOutageDuration] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [closing, setClosing] = useState(false);
  const [publishToWorknotes, setPublishToWorknotes] = useState(true);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  // Email Preview / Review state
  const [emailPreviewPayload, setEmailPreviewPayload] = useState<any>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);

  // AI Solutions & Related Change Requests state
  const [solutions, setSolutions] = useState<any>(null);
  const [loadingSolutions, setLoadingSolutions] = useState(true);

  // RCA Summary state
  const [rcaData, setRcaData] = useState<any>(null);
  const [loadingRca, setLoadingRca] = useState(false);
  const [rcaExpanded, setRcaExpanded] = useState({ rca: true, fiveWhy: true, resolution: true });
  const [exportingDocx, setExportingDocx] = useState(false);

  // AI Powered Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [snTelemetry, setSnTelemetry] = useState<any>(null);
  const [loadingAiAnalysis, setLoadingAiAnalysis] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // Location Management & ServiceNow Refresh state
  const [refreshingServiceNow, setRefreshingServiceNow] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [addingSiteId, setAddingSiteId] = useState<string | null>(null);
  const [removingSiteId, setRemovingSiteId] = useState<string | null>(null);

  // Edit Attributes State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    shortDescription: '',
    description: '',
    priority: '',
    assignmentGroup: '',
    assignedTo: '',
    cmdbCi: '',
    businessService: '',
    ettrMinutes: 30,
    relatedIncidents: '',
    teamsInvolved: '',
    partnerLead: '',
    cdItCoordinator: '',
    stakeholdersInformed: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchIncidentDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents/${id}`);
      const data = await res.json();
      if (data.success && data.incident) {
        setIncident(data.incident);
        setNextCadenceHours(data.incident.priority === 'P2' ? 2 : 1);
        setEditForm({
          shortDescription: data.incident.shortDescription || '',
          description: data.incident.description || '',
          priority: data.incident.priority || '',
          assignmentGroup: data.incident.assignmentGroup || '',
          assignedTo: data.incident.assignedTo || '',
          cmdbCi: data.incident.cmdbCi || '',
          businessService: data.incident.businessService || '',
          ettrMinutes: data.incident.ettrMinutes || 30,
          relatedIncidents: data.incident.relatedIncidents || '',
          teamsInvolved: data.incident.teamsInvolved || '',
          partnerLead: data.incident.partnerLead || '',
          cdItCoordinator: data.incident.cdItCoordinator || '',
          stakeholdersInformed: data.incident.stakeholdersInformed || '',
        });
      }
    } catch (err) {
      console.error('Failed to load incident details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiSolutions = async () => {
    setLoadingSolutions(true);
    try {
      const res = await fetch(`/api/incidents/${id}/solutions`);
      const data = await res.json();
      if (data.success && data.solutions) {
        setSolutions(data.solutions);
      }
    } catch (e) {
      console.error('Failed to load AI solutions:', e);
    } finally {
      setLoadingSolutions(false);
    }
  };

  const fetchRca = async () => {
    if (!id) return;
    setLoadingRca(true);
    try {
      const res = await fetch(`/api/incidents/${id}/rca`);
      const data = await res.json();
      if (data.success && data.rca) {
        setRcaData(data.rca);
      }
    } catch (e) {
      console.error('Failed to fetch RCA:', e);
    } finally {
      setLoadingRca(false);
    }
  };


  const handleRefreshFromServiceNow = async () => {
    if (!incident) return;
    setRefreshingServiceNow(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/refresh-servicenow`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.incident) {
        setIncident(data.incident);
        addToast({
          title: '🔄 ServiceNow Synchronized',
          message: data.message || 'Incident attributes updated from ServiceNow.',
          type: 'update',
        });
      } else {
        addToast({
          title: '⚠️ Refresh Failed',
          message: data.error || 'Could not fetch record from ServiceNow.',
          type: 'update',
        });
      }
    } catch (err: any) {
      addToast({
        title: '❌ Network Error',
        message: 'Failed to contact ServiceNow refresh endpoint.',
        type: 'update',
      });
    } finally {
      setRefreshingServiceNow(false);
    }
  };

  const fetchAvailableSites = async () => {
    setLoadingSites(true);
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (data.success && Array.isArray(data.sites)) {
        setAvailableSites(data.sites);
      }
    } catch (err) {
      console.warn('Failed to load sites:', err);
    } finally {
      setLoadingSites(false);
    }
  };

  const handleAddLocation = async (siteId: string, siteName: string) => {
    if (!incident) return;
    setAddingSiteId(siteId);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (data.success && data.incident) {
        setIncident(data.incident);
        setShowAddLocationModal(false);
        setSiteSearch('');
        addToast({
          title: '📍 Location Added',
          message: `Added ${siteName} to incident ${incident.number}.`,
          type: 'update',
        });
      } else {
        addToast({
          title: '⚠️ Error Adding Location',
          message: data.error || 'Could not add location.',
          type: 'update',
        });
      }
    } catch (err: any) {
      addToast({
        title: '❌ Network Error',
        message: 'Failed to add location.',
        type: 'update',
      });
    } finally {
      setAddingSiteId(null);
    }
  };

  const handleRemoveLocation = async (siteId: string, siteName: string) => {
    if (!incident) return;
    if (!confirm(`Are you sure you want to remove "${siteName}" from this incident?`)) return;
    setRemovingSiteId(siteId);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/sites?siteId=${siteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.incident) {
        setIncident(data.incident);
        addToast({
          title: '🗑️ Location Removed',
          message: `Removed ${siteName} from incident ${incident.number}.`,
          type: 'update',
        });
      } else {
        addToast({
          title: '⚠️ Error Removing Location',
          message: data.error || 'Could not remove location.',
          type: 'update',
        });
      }
    } catch (err: any) {
      addToast({
        title: '❌ Network Error',
        message: 'Failed to remove location.',
        type: 'update',
      });
    } finally {
      setRemovingSiteId(null);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!incident) return;
    setLoadingAiAnalysis(true);
    setShowAiAnalysis(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/ai-analysis`);
      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis);
        if (data.serviceNowTelemetry) {
          setSnTelemetry(data.serviceNowTelemetry);
        }
        addToast({
          title: '🧠 AI Analysis & ServiceNow MCP Synchronized',
          message: `Recommended: ${data.analysis.assignmentGroupRecommendation?.recommended || 'Support Team'} (${data.modelUsed || 'Gemini AI'})`,
          type: 'update',
        });
      } else {
        addToast({
          title: '⚠️ AI Analysis Notice',
          message: data.error || 'Check Gemini AI Engine credentials in Admin Settings.',
          type: 'update',
        });
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      addToast({ title: '❌ Network Error', message: 'AI Analysis request failed.', type: 'update' });
    } finally {
      setLoadingAiAnalysis(false);
    }
  };


  useEffect(() => {
    fetchIncidentDetails();
    fetchAiSolutions();
  }, [id]);

  // Fetch RCA when incident data is loaded and status is RESOLVED or CLOSED
  useEffect(() => {
    if (incident && (incident.status === 'RESOLVED' || incident.status === 'CLOSED')) {
      fetchRca();
    }
  }, [incident?.status, id]);

  const handleChangeStatus = async (newStatus: string) => {
    if (!incident) return;
    setUpdatingStatus(true);

    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: `🔄 Incident Status Changed to ${newStatus}`,
          message: `Updated state for ${incident.number}`,
          type: newStatus === 'CLOSED' ? 'closed' : 'update',
        });
        setIncident(data.incident);
        triggerRefresh();
      }
    } catch (err) {
      alert('Failed to update incident status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveAttributes = async () => {
    if (!incident) return;
    setSavingEdit(true);

    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: `✅ Incident Attributes Updated`,
          message: `Saved changes for ${incident.number}`,
          type: 'update',
        });
        setIncident(data.incident);
        setIsEditing(false);
        triggerRefresh();
      } else {
        alert(data.error || 'Failed to update attributes');
      }
    } catch (err) {
      alert('Network error while saving attributes');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!incident || !updateComment.trim()) return;
    setSubmittingUpdate(true);

    try {
      const res = await fetch(`/api/incidents/${incident.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: updateComment,
          authorName: userName || (currentRole === 'ADMIN' ? 'Administrator' : 'Incident Manager'),
          nextCadenceHours,
          isFinalUpdate,
          totalOutageDuration,
          publishToWorknotes,
          additionalInfo: showAdditionalInfo ? additionalInfo : '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUpdateComment('');
        addToast({
          title: `📝 Update #${data.update.updateNumber} Published`,
          message: `Generative AI synthesized new executive summary. Review the CIM Notification email below.`,
          type: 'update',
        });
        setIncident(data.incident);
        triggerRefresh();

        // Open email preview modal if payload is present
        if (data.emailPreview) {
          setEmailPreviewPayload(data.emailPreview);
          setShowEmailPreview(true);
        }
      }
    } catch (err) {
      console.error('Failed to post update:', err);
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const handleSendEmail = async () => {
    if (!incident || !emailPreviewPayload) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPreviewPayload),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '✅ CIM Notification Sent',
          message: `Email delivered to ${data.recipientCount ?? 'configured'} recipients.`,
          type: 'update',
        });
      } else {
        addToast({
          title: '❌ Email Send Failed',
          message: data.message || data.error || 'Could not send the CIM notification.',
          type: 'update',
        });
      }
    } catch (err) {
      console.error('Failed to send CIM email:', err);
      addToast({
        title: '❌ Network Error',
        message: 'Failed to reach the email endpoint.',
        type: 'update',
      });
    } finally {
      setSendingEmail(false);
      setShowEmailPreview(false);
      setEmailPreviewPayload(null);
    }
  };

  const handleOpenEmailReview = async () => {
    if (!incident) return;
    setLoadingEmailPreview(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/send-email`);
      const data = await res.json();
      if (data.success && data.emailPreview) {
        setEmailPreviewPayload(data.emailPreview);
        setShowEmailPreview(true);
      } else {
        addToast({
          title: '⚠️ Could not load preview',
          message: data.error || 'Failed to prepare email notification preview.',
          type: 'update',
        });
      }
    } catch (e: any) {
      addToast({
        title: '❌ Network Error',
        message: 'Failed to load email preview.',
        type: 'update',
      });
    } finally {
      setLoadingEmailPreview(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-12 text-center border border-slate-800 space-y-4 rounded-2xl">
        <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading Incident Command Telemetry...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="glass-card p-12 text-center border border-slate-800 space-y-4 rounded-2xl">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-white">Incident Record Not Found</h2>
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Command Center</span>
        </Link>
      </div>
    );
  }

  const isP1 = incident.priority === 'P1';
  const isClosed = incident.status === 'CLOSED';
  const isResolved = incident.status === 'RESOLVED' || isClosed;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation Back Link & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Command Center</span>
        </button>

        <div className="flex items-center space-x-3">
          {/* Status Changer Dropdown */}
          {currentRole !== 'GUEST' && (
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400">Status:</span>
              <select
                value={incident.status}
                onChange={(e) => handleChangeStatus(e.target.value)}
                disabled={updatingStatus}
                className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-accent"
              >
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="IDENTIFIED">IDENTIFIED</option>
                <option value="MONITORING">MONITORING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED (Archived)</option>
              </select>
              {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
            </div>
          )}

          {/* Refresh from ServiceNow Button */}
          <button
            onClick={handleRefreshFromServiceNow}
            disabled={refreshingServiceNow}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh latest Assignment Group, Assigned To, CI, Short Description & Description from ServiceNow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingServiceNow ? 'animate-spin' : ''}`} />
            <span>{refreshingServiceNow ? 'Refreshing...' : 'Refresh from ServiceNow'}</span>
          </button>

          {/* AI Powered Analysis Button */}
          <button
            onClick={handleRunAiAnalysis}
            disabled={loadingAiAnalysis}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAiAnalysis ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BrainCircuit className="w-3.5 h-3.5" />
            )}
            <span>{loadingAiAnalysis ? 'Analysing...' : 'AI Powered Analysis'}</span>
          </button>

          {/* Review CIM Notification Email Button */}
          <button
            onClick={handleOpenEmailReview}
            disabled={loadingEmailPreview}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Review and verify all content before publishing on email notification"
          >
            {loadingEmailPreview ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            <span>{loadingEmailPreview ? 'Loading...' : 'Review CIM Email'}</span>
          </button>

          <span className="font-mono text-xs text-slate-500">ID: {incident.id}</span>
        </div>
      </div>

      {isEditing ? (
        <div className="glass-card p-6 border border-blue-500/40 rounded-2xl space-y-4 bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-400" />
              Edit Incident Attributes
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={handleSaveAttributes} disabled={savingEdit} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Short Description</label>
              <input type="text" value={editForm.shortDescription} onChange={(e) => setEditForm({...editForm, shortDescription: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Description</label>
              <input type="text" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Priority</label>
              <select value={editForm.priority} onChange={(e) => setEditForm({...editForm, priority: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none">
                <option value="P1">P1 CRITICAL</option>
                <option value="P2">P2 HIGH</option>
                <option value="P3">P3 MODERATE</option>
                <option value="P4">P4 LOW</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Assignment Group</label>
              <input type="text" value={editForm.assignmentGroup} onChange={(e) => setEditForm({...editForm, assignmentGroup: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Assigned To</label>
              <input type="text" value={editForm.assignedTo} onChange={(e) => setEditForm({...editForm, assignedTo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Target CI (CMDB)</label>
              <input type="text" value={editForm.cmdbCi} onChange={(e) => setEditForm({...editForm, cmdbCi: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Business Service</label>
              <input type="text" value={editForm.businessService} onChange={(e) => setEditForm({...editForm, businessService: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">ETTR (Minutes)</label>
              <input type="number" value={editForm.ettrMinutes} onChange={(e) => setEditForm({...editForm, ettrMinutes: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Related Incidents</label>
              <input type="text" value={editForm.relatedIncidents} onChange={(e) => setEditForm({...editForm, relatedIncidents: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Teams Involved</label>
              <input type="text" value={editForm.teamsInvolved} onChange={(e) => setEditForm({...editForm, teamsInvolved: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Partner Lead</label>
              <input type="text" value={editForm.partnerLead} onChange={(e) => setEditForm({...editForm, partnerLead: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">C&D IT Coordinator</label>
              <input type="text" value={editForm.cdItCoordinator} onChange={(e) => setEditForm({...editForm, cdItCoordinator: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase">Stakeholders Informed</label>
              <input type="text" value={editForm.stakeholdersInformed} onChange={(e) => setEditForm({...editForm, stakeholdersInformed: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none" />
            </div>
          </div>
        </div>
      ) : (
        /* Incident Header Banner */
        <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4 relative overflow-hidden group">
          {currentRole !== 'GUEST' && !isClosed && (
            <button onClick={() => setIsEditing(true)} className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] font-bold">
              <Edit2 className="w-3.5 h-3.5" /> Edit Attributes
            </button>
          )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full border ${
                isP1
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-glowRed'
                  : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
              }`}
            >
              {incident.priority} CRITICAL
            </span>
            <span className="font-mono text-lg font-extrabold text-white tracking-widest">
              {incident.number}
            </span>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                isClosed
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}
            >
              {incident.status}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 text-xs text-slate-400 font-mono mt-2 md:mt-0">
            <div className="flex items-center space-x-1.5 text-yellow-400">
              <Clock className="w-4 h-4" />
              <span>ETTR: {isClosed ? 'Resolved' : `~${incident.ettrMinutes} mins remaining`}</span>
            </div>

            <div className="flex items-center space-x-1.5 text-blue-400">
              <Timer className="w-4 h-4" />
              <span>Next Update Cadence: Every {isP1 ? '1 Hour (P1)' : '2 Hours (P2)'}</span>
            </div>

            <div className="flex items-center space-x-1.5 text-slate-400" title={`Assignment Group${incident.assignmentGroupEmail ? ` (${incident.assignmentGroupEmail})` : ''}`}>
              <Users className="w-4 h-4" />
              <span>{incident.assignmentGroup || 'Unassigned Group'} {incident.assignedTo ? `(${incident.assignedTo})` : ''}</span>
              {incident.assignmentGroupEmail && (
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono" title={`Notification Email: ${incident.assignmentGroupEmail}`}>
                  ✉️ {incident.assignmentGroupEmail}
                </span>
              )}
            </div>
          </div>
        </div>

        <h1 className="text-xl font-extrabold text-white leading-tight">
          {incident.shortDescription}
        </h1>

        {/* Dynamic CTI / ServiceNow Tags */}
        {(incident.cti || incident.cmdbCi) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {incident.cti?.split('/').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/25 rounded-md uppercase tracking-wider"
              >
                🏷️ {tag}
              </span>
            ))}
            {incident.cmdbCi && incident.cmdbCi !== '-' && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/25 rounded-md uppercase tracking-wider animate-pulse">
                ⚙️ {incident.cmdbCi}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          {incident.description || 'Primary incident description synchronized from ServiceNow.'}
        </p>
        {/* CIM Outage Attributes Display */}
        <div className="pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Related Incidents</span>
              <span className="text-xs text-white font-medium">{incident.relatedIncidents || '-'}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Teams Involved</span>
              <span className="text-xs text-white font-medium">{incident.teamsInvolved || '-'}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Partner Lead</span>
              <span className="text-xs text-white font-medium">{incident.partnerLead || '-'}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">C&D IT Coordinator</span>
              <span className="text-xs text-white font-medium">{incident.cdItCoordinator || '-'}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Stakeholders Informed</span>
              <span className="text-xs text-white font-medium">{incident.stakeholdersInformed || '-'}</span>
            </div>
          </div>
        </div>

      </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Structured AI Summary: What Has Been Done So Far vs What Is Awaited */}
          <div className="glass-card p-5 border border-blue-900/60 rounded-2xl space-y-4 bg-gradient-to-b from-slate-900/90 to-blue-950/30">
            <div className="flex items-center justify-between border-b border-blue-900/50 pb-3">
              <div className="flex items-center space-x-2.5 text-blue-400">
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                <h3 className="font-bold text-sm text-white">Generative AI Executive Briefing</h3>
              </div>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                {incident.updates?.length || 0} Updates Synthesized
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Section 1: WHAT HAS BEEN DONE SO FAR */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <CheckCircle2 className="w-4 h-4" />
                  WHAT HAS BEEN DONE SO FAR
                </span>
                <div className="space-y-2">
                  {(() => {
                    // Get the narrative text — AI-generated or fallback
                    const narrativeText = incident.aiDoneSoFar || incident.aiCurrentStatusSummary || (() => {
                      if (!incident.updates || incident.updates.length === 0) {
                        return 'Incident record ingested from ServiceNow. Command bridge established and engineering team assigned. Initial diagnostics are underway.';
                      }
                      // Build a structured inline narrative from raw updates
                      const cleaned = incident.updates.map((u) => u.comment.trim().replace(/^Update\s+#\d+:\s*/i, '')).filter(Boolean);
                      const siteName = incident.sites?.map((s: any) => s.site?.name || s.name).join(', ') || 'affected locations';

                      const overview = `Incident ${incident.number} was raised for "${incident.shortDescription}" affecting operations at ${siteName}. The ${incident.assignmentGroup} team was immediately mobilized.`;

                      let actions = '';
                      if (cleaned.length === 1) {
                        actions = `Upon initial triage, the team confirmed: ${cleaned[0]}.`;
                      } else if (cleaned.length === 2) {
                        actions = `During investigation, the team first established that ${cleaned[0].toLowerCase()}. Subsequently, ${cleaned[1].toLowerCase()}.`;
                      } else {
                        const first = cleaned[0];
                        const middle = cleaned.slice(1, -1).map(a => a.toLowerCase()).join('. Further analysis showed that ');
                        const last = cleaned[cleaned.length - 1];
                        actions = `Initial investigation confirmed that ${first.toLowerCase()}. Further analysis showed that ${middle}. Most recently, ${last.toLowerCase()}.`;
                      }

                      const current = `The ${incident.assignmentGroup} team continues to monitor and coordinate remediation.`;
                      return `${overview}\n\n${actions}\n\n${current}`;
                    })();

                    // Render paragraphs (split by double newlines for multi-paragraph narratives)
                    const paragraphs = narrativeText.split(/\n\n+/).filter((p: string) => p.trim());
                    return paragraphs.map((para: string, idx: number) => (
                      <p key={idx} className="text-slate-200 leading-relaxed text-[11px] font-sans">
                        {para.trim()}
                      </p>
                    ));
                  })()}
                </div>
              </div>

              {/* Section 2: WHAT IS AWAITED */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                <span className="font-bold text-yellow-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Clock className="w-4 h-4" />
                  WHAT IS AWAITED
                </span>
                <div className="space-y-2">
                  {(() => {
                    const awaitedText = incident.aiWhatIsAwaited || (
                      isClosed
                        ? 'All operational recovery steps completed. Incident is closed. Post-incident review may be scheduled.'
                        : `Next mandatory status update is scheduled per ${incident.priority === 'P1' ? 'P1 (hourly)' : 'P2 (bi-hourly)'} cadence. The ${incident.assignmentGroup} team will provide updates as remediation progresses. Full service restoration is expected once all diagnostic checkpoints are cleared.`
                    );
                    const sentences = awaitedText.split(/\n\n+/).filter((p: string) => p.trim());
                    return sentences.map((para: string, idx: number) => (
                      <p key={idx} className="text-slate-200 leading-relaxed text-[11px] font-sans">
                        {para.trim()}
                      </p>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Updates & Post Form */}
          <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-accent" />
              Timeline Updates ({incident.updates?.length || 0})
            </h3>

            <div className="space-y-3">
              {incident.updates?.map((u) => (
                <div
                  key={u.id}
                  className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 text-xs">Update #{u.updateNumber}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(u.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium leading-relaxed">{u.comment}</p>
                  <span className="text-[10px] text-slate-500 block">By: {u.authorName}</span>
                </div>
              ))}
            </div>

            {currentRole !== 'GUEST' && !isClosed ? (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Post Timeline Update
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Post new timeline update..."
                    value={updateComment}
                    onChange={(e) => setUpdateComment(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Mandatory Next Update Cadence Selector */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-yellow-400" />
                    Mandatory Next Update Timing:
                  </span>
                  <select
                    value={nextCadenceHours}
                    onChange={(e) => setNextCadenceHours(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white font-bold focus:outline-none focus:border-accent"
                  >
                    <option value={1}>1 Hour (P1 Default)</option>
                    <option value={2}>2 Hours (P2 Default)</option>
                    <option value={0.25}>15 Minutes</option>
                    <option value={0.5}>30 Minutes</option>
                    <option value={4}>4 Hours</option>
                  </select>
                </div>

                {/* ── Update Options ── */}
                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Update Options</p>

                  {/* 1. Publish to Worknotes */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={publishToWorknotes}
                        onChange={(e) => setPublishToWorknotes(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500 bg-slate-800 border-slate-700 focus:ring-0"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Publish to Worknotes
                      </span>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        When ON, this update will be synced to the ServiceNow incident work notes automatically.
                      </p>
                    </div>
                  </label>

                  {/* 2. Update Additional Info */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={showAdditionalInfo}
                        onChange={(e) => setShowAdditionalInfo(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-500 bg-slate-800 border-slate-700 focus:ring-0"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Update Additional Info
                      </span>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        Provide extra context (root cause hints, actions taken, vendor info) to improve the RCA quality.
                      </p>
                    </div>
                  </label>

                  {showAdditionalInfo && (
                    <div className="pl-6 space-y-1">
                      <textarea
                        rows={3}
                        placeholder="e.g. Root cause suspected: BGP route flap on CORE-SW-01. Vendor Cisco TAC engaged. No hardware change in last 7 days..."
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        className="w-full bg-slate-950 border border-purple-500/30 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                      />
                      <p className="text-[10px] text-purple-400/70 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        This info is passed to the AI to produce a more accurate RCA — it does not appear in the public update.
                      </p>
                    </div>
                  )}

                  {/* 3. Mark as Final Update */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isFinalUpdate}
                        onChange={(e) => setIsFinalUpdate(e.target.checked)}
                        className="w-4 h-4 rounded text-red-500 bg-slate-800 border-slate-700 focus:ring-0"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Mark as Final Update
                      </span>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        Marks this as the last update. The next update will be shown as "N/A" in CIM notifications.
                      </p>
                    </div>
                  </label>
                </div>

                {isFinalUpdate && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Total Outage Duration
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2h 15m"
                      value={totalOutageDuration}
                      onChange={(e) => setTotalOutageDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <button
                  onClick={handlePostUpdate}
                  disabled={submittingUpdate || !updateComment.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {submittingUpdate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Post Update &amp; Auto-Synthesize AI Executive Summary</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Sidebar: KB Articles & ServiceNow Related Change Requests */}
        <div className="space-y-6">
          {/* Sidebar Section 0: Impacted Locations & Facilities (Add / Remove) */}
          <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-3 bg-slate-900/90">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                Impacted Locations ({incident.sites?.length || 0})
              </h3>
              {currentRole !== 'GUEST' && !isClosed && (
                <button
                  onClick={() => {
                    fetchAvailableSites();
                    setShowAddLocationModal(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Location
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              {incident.sites && incident.sites.length > 0 ? (
                incident.sites.map((rel: any) => {
                  const s = rel.site;
                  if (!s) return null;
                  return (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 hover:border-amber-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>{s.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                              {s.code}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {s.city}{s.state ? `, ${s.state}` : ''}, {s.country} • {s.businessUnit || 'General'}
                          </p>
                        </div>
                        {currentRole !== 'GUEST' && !isClosed && (
                          <button
                            onClick={() => handleRemoveLocation(s.id, s.name)}
                            disabled={removingSiteId === s.id}
                            className="p-1 rounded bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/50 hover:border-red-500/30 transition-colors"
                            title="Remove location from incident"
                          >
                            {removingSiteId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {s.supportPersons && s.supportPersons.length > 0 && (
                        <div className="pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 space-y-0.5">
                          <p className="text-slate-500 font-semibold">Support Contact:</p>
                          {s.supportPersons.slice(0, 1).map((sp: any) => (
                            <p key={sp.id} className="text-slate-300">
                              👤 {sp.name} {sp.mobile1 ? `(${sp.mobile1})` : ''} • {sp.email}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No specific location assigned yet. Click "+ Add Location" to link a facility.
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Section 1: ServiceNow KB SOP Articles (Relevant to issue) */}
          <div className="glass-card p-5 border border-blue-900/60 rounded-2xl space-y-3 bg-slate-900/90">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              ServiceNow KB SOP Articles (Relevant)
            </h3>

            {loadingSolutions ? (
              <div className="p-4 text-center">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {solutions?.serviceNowKb?.map((kb: any) => (
                  <div key={kb.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-blue-400 font-bold">{kb.articleNumber}</span>
                      <span className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded">Associated SOP</span>
                    </div>
                    <p className="font-semibold text-white leading-snug">{kb.title}</p>
                    <p className="text-slate-400 text-[10px] line-clamp-2">{kb.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Section 2: ServiceNow Related Change Requests */}
          <div className="glass-card p-5 border border-purple-500/30 rounded-2xl space-y-3 bg-slate-900/90">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <GitPullRequest className="w-4 h-4 text-purple-400" />
              ServiceNow Related Change Requests
            </h3>

            <div className="space-y-2 text-xs">
              {solutions?.changeRequests?.map((chg: any) => (
                <div key={chg.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-purple-400 font-bold">{chg.number}</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold uppercase">
                      {chg.state || 'Implement'}
                    </span>
                  </div>
                  <p className="font-semibold text-white">{chg.title}</p>
                  <span className="text-[10px] text-slate-400 block">Target CI: {chg.targetCi || incident.cmdbCi || 'Infrastructure'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Section 3: Microsoft Teams Bridge */}
          <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center space-x-2.5 text-purple-400">
              <Radio className="w-5 h-5 animate-pulse" />
              <h3 className="font-bold text-sm text-white">Microsoft Teams Bridge</h3>
            </div>

            {currentRole !== 'GUEST' ? (
              <div className="space-y-3 text-xs">
                <a
                  href={incident.teamsBridgeLink || 'https://teams.microsoft.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-2xl flex items-center justify-center space-x-2 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Join Teams Command Bridge</span>
                </a>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl text-center space-y-2">
                <Lock className="w-6 h-6 text-purple-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">Teams Bridge Restricted</h4>
              </div>
            )}
          </div>

          {/* RCA Summary Section — only shown for RESOLVED / CLOSED incidents */}
          {isResolved && (
          <div className="glass-card p-5 border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 rounded-2xl space-y-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">RCA Summary</h3>
                  <span className="text-[10px] text-emerald-400 font-semibold">{incident.status} • Post-Incident Analysis</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setExportingDocx(true);
                    try {
                      const res = await fetch(`/api/incidents/${id}/rca/export`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rcaData }),
                      });
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `RCA_Report_${incident?.number || 'incident'}.doc`;
                        a.click();
                        URL.revokeObjectURL(url);
                        addToast({ title: '📄 RCA Report Exported', message: 'DOCX file downloaded successfully.', type: 'update' });
                      } else {
                        addToast({ title: '❌ Export Failed', message: 'Could not generate RCA document.', type: 'update' });
                      }
                    } catch {
                      addToast({ title: '❌ Export Failed', message: 'Network error during export.', type: 'update' });
                    } finally {
                      setExportingDocx(false);
                    }
                  }}
                  disabled={exportingDocx}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  title="Export RCA as DOCX"
                >
                  {exportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={fetchRca}
                  disabled={loadingRca}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg transition-colors disabled:opacity-50"
                  title="Regenerate RCA"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRca ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingRca && !rcaData ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Generating Root Cause Analysis...</span>
              </div>
            ) : rcaData ? (
              <div className="space-y-3">
                {/* Sub-section 1: Auto Generated RCA */}
                <div className="border border-emerald-500/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setRcaExpanded(prev => ({ ...prev, rca: !prev.rca }))}
                    className="w-full flex items-center justify-between p-3 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      Auto Generated RCA from Incident Notes
                    </span>
                    <span className="text-[10px] text-slate-400">{rcaExpanded.rca ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>

                  {rcaExpanded.rca && (
                    <div className="p-3 space-y-3">
                      {/* Summary */}
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block">Summary</span>
                        <p className="text-xs text-slate-200 leading-relaxed">{rcaData.autoGeneratedRca?.summary || 'No summary available.'}</p>
                      </div>

                      {/* Root Cause */}
                      <div className="p-3 bg-slate-900/90 border border-red-900/30 rounded-xl space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-red-400 flex items-center gap-1.5 block">
                          <Target className="w-3.5 h-3.5" />
                          Root Cause
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed">{rcaData.autoGeneratedRca?.rootCause || 'Root cause pending analysis.'}</p>
                      </div>

                      {/* Impact Analysis */}
                      {rcaData.autoGeneratedRca?.impactAnalysis && (
                        <div className="p-3 bg-slate-900/90 border border-orange-900/30 rounded-xl space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-orange-400 flex items-center gap-1.5 block">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Impact Analysis
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed">{rcaData.autoGeneratedRca.impactAnalysis}</p>
                        </div>
                      )}

                      {/* Resolution Steps */}
                      {rcaData.autoGeneratedRca?.resolutionSteps?.length > 0 && (
                        <div className="p-3 bg-slate-900/90 border border-blue-900/30 rounded-xl space-y-2">
                          <span className="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1.5 block">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolution Steps
                          </span>
                          <div className="space-y-1.5">
                            {rcaData.autoGeneratedRca.resolutionSteps.map((step: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{idx + 1}</span>
                                <span className="leading-relaxed">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preventive Measures */}
                      {rcaData.autoGeneratedRca?.preventiveMeasures?.length > 0 && (
                        <div className="p-3 bg-slate-900/90 border border-emerald-900/30 rounded-xl space-y-2">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1.5 block">
                            <Shield className="w-3.5 h-3.5" />
                            Preventive Measures
                          </span>
                          <div className="space-y-1.5">
                            {rcaData.autoGeneratedRca.preventiveMeasures.map((measure: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 p-1.5 bg-slate-900/50 rounded-lg">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{measure}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lessons Learned */}
                      {rcaData.autoGeneratedRca?.lessonsLearned?.length > 0 && (
                        <div className="p-3 bg-slate-900/90 border border-yellow-900/30 rounded-xl space-y-2">
                          <span className="text-[10px] uppercase font-bold text-yellow-400 flex items-center gap-1.5 block">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Lessons Learned
                          </span>
                          <div className="space-y-1.5">
                            {rcaData.autoGeneratedRca.lessonsLearned.map((lesson: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 p-1.5 bg-slate-900/50 rounded-lg">
                                <Lightbulb className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                                <span>{lesson}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      {rcaData.autoGeneratedRca?.timeline?.length > 0 && (
                        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 block">
                            <History className="w-3.5 h-3.5" />
                            Key Timeline Milestones
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {rcaData.autoGeneratedRca.timeline.map((milestone: string, idx: number) => (
                              <div key={idx} className="text-[11px] text-slate-400 pl-3 border-l-2 border-slate-700 py-0.5">
                                {milestone}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-section 1.5: 5 Why Analysis */}
                {rcaData.autoGeneratedRca?.fiveWhyAnalysis?.length > 0 && (
                <div className="border border-purple-500/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setRcaExpanded(prev => ({ ...prev, fiveWhy: !prev.fiveWhy }))}
                    className="w-full flex items-center justify-between p-3 bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-purple-300">
                      <HelpCircle className="w-4 h-4 text-purple-400" />
                      5 Why Analysis
                    </span>
                    <span className="text-[10px] text-slate-400">{rcaExpanded.fiveWhy ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>

                  {rcaExpanded.fiveWhy && (
                    <div className="p-3 space-y-0">
                      {rcaData.autoGeneratedRca.fiveWhyAnalysis.map((item: { why: string; answer: string }, idx: number) => (
                        <div key={idx}>
                          <div className="p-3 bg-slate-900/90 border border-purple-900/20 rounded-xl space-y-1.5">
                            <div className="flex items-start gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                W{idx + 1}
                              </span>
                              <div className="space-y-1 flex-1">
                                <p className="text-[11px] font-bold text-purple-300">{item.why}</p>
                                <p className="text-xs text-slate-200 leading-relaxed">{item.answer}</p>
                              </div>
                            </div>
                          </div>
                          {idx < rcaData.autoGeneratedRca.fiveWhyAnalysis.length - 1 && (
                            <div className="flex justify-center py-0.5">
                              <div className="w-0.5 h-3 bg-purple-500/30 rounded-full" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Sub-section 2: Resolution Summary */}
                <div className="border border-blue-500/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setRcaExpanded(prev => ({ ...prev, resolution: !prev.resolution }))}
                    className="w-full flex items-center justify-between p-3 bg-blue-900/20 hover:bg-blue-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-blue-300">
                      <Archive className="w-4 h-4 text-blue-400" />
                      Resolution Summary
                    </span>
                    <span className="text-[10px] text-slate-400">{rcaExpanded.resolution ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>

                  {rcaExpanded.resolution && (
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Status</span>
                          <span className={`text-xs font-bold ${isClosed ? 'text-purple-400' : 'text-emerald-400'}`}>{incident.status}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Priority</span>
                          <span className={`text-xs font-bold ${incident.priority === 'P1' ? 'text-red-400' : 'text-orange-400'}`}>{incident.priority}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Resolved At</span>
                          <span className="text-xs text-white">{rcaData.resolutionSummary?.resolvedAt ? new Date(rcaData.resolutionSummary.resolvedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Total Outage</span>
                          <span className="text-xs text-white">{rcaData.resolutionSummary?.totalOutageDuration || 'Not recorded'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Assignment Group</span>
                        <span className="text-xs text-white">{rcaData.resolutionSummary?.assignmentGroup || 'N/A'}</span>
                        {rcaData.resolutionSummary?.assignedTo && (
                          <span className="text-[10px] text-slate-400 block">Assigned to: {rcaData.resolutionSummary.assignedTo}</span>
                        )}
                      </div>

                      {rcaData.resolutionSummary?.impactedSites?.length > 0 && (
                        <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Impacted Sites</span>
                          <div className="flex flex-wrap gap-1">
                            {rcaData.resolutionSummary.impactedSites.map((site: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 rounded-md">
                                ✓ {site}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {rcaData.resolutionSummary?.rootCause && (
                        <div className="p-2.5 bg-slate-900/90 border border-red-900/20 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-red-400 block mb-0.5">AI Root Cause</span>
                          <p className="text-xs text-slate-200 leading-relaxed">{rcaData.resolutionSummary.rootCause}</p>
                        </div>
                      )}

                      {rcaData.resolutionSummary?.businessImpact && (
                        <div className="p-2.5 bg-slate-900/90 border border-orange-900/20 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-orange-400 block mb-0.5">Business Impact</span>
                          <p className="text-xs text-slate-200 leading-relaxed">{rcaData.resolutionSummary.businessImpact}</p>
                        </div>
                      )}

                      {/* Update Notes Count */}
                      <div className="text-[10px] text-slate-500 text-center pt-1 border-t border-slate-800">
                        Based on {rcaData.updateNotes?.length || 0} timeline update(s)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                RCA data will be generated once the incident is resolved.
              </div>
            )}
          </div>
          )}

          {/* Sidebar Section 4: Impacted Locations */}
          <div className="glass-card p-5 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Impacted Locations
            </h3>

            <div className="space-y-2">
              {incident.sites?.map((s) => (
                <div
                  key={s.site.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{s.site.name}</p>
                    <span className="text-[10px] text-slate-400">{s.site.city}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                    {isClosed ? 'RESTORED' : 'IMPACTED'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======= AI POWERED ANALYSIS SLIDE-OVER PANEL ======= */}
      {showAiAnalysis && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAiAnalysis(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-950/60 to-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <BrainCircuit className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white tracking-tight">AI Powered Analysis</h2>
                  <p className="text-[10px] text-purple-300 font-mono">{incident.number} · Powered by Gemini AI</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAiAnalysis && !aiAnalysis ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                      <BrainCircuit className="w-7 h-7 text-violet-400 animate-pulse" />
                    </div>
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin absolute -top-1 -right-1" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-white">Analysing Incident Knowledge Base</p>
                    <p className="text-xs text-slate-400">Scanning all portal incidents and bulk uploads for patterns...</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <>
                  {/* ServiceNow Live MCP Telemetry Card */}
                  {snTelemetry && (
                    <div className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            <Radio className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
                          </span>
                          <span className="text-xs font-bold text-white">ServiceNow Live MCP Telemetry</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          {snTelemetry.connected ? 'Connected' : 'Instance Active'}
                        </span>
                      </div>

                      {snTelemetry.liveIncident && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                          <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block">SN Priority</span>
                            <span className="text-white font-bold">{snTelemetry.liveIncident.priority || 'N/A'}</span>
                          </div>
                          <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block">SN State</span>
                            <span className="text-emerald-400 font-bold">{snTelemetry.liveIncident.state || 'N/A'}</span>
                          </div>
                          <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 col-span-2">
                            <span className="text-slate-500 block">SN Assignment Group</span>
                            <span className="text-purple-300 font-bold truncate block">{snTelemetry.liveIncident.assignmentGroup || 'N/A'}</span>
                          </div>
                        </div>
                      )}

                      {snTelemetry.changeRequests?.length > 0 && (
                        <div className="pt-2 border-t border-purple-500/20 text-[11px] space-y-1">
                          <span className="text-[10px] uppercase font-bold text-purple-300 flex items-center gap-1">
                            <span>🔄 Correlated ServiceNow Changes ({snTelemetry.changeRequests.length}):</span>
                          </span>
                          {snTelemetry.changeRequests.map((c: any, i: number) => (
                            <div key={i} className="text-slate-300 text-[10px]">
                              • <strong className="text-white">{c.number}</strong> ({c.risk || 'Risk'}): {c.shortDescription}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1. Assignment Group Recommendation */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-violet-400" />
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-widest">1. Assignment Group Recommendation</h3>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                      aiAnalysis.assignmentGroupRecommendation?.confidence === 'HIGH'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : aiAnalysis.assignmentGroupRecommendation?.confidence === 'MEDIUM'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-800/60 border-slate-700'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-extrabold text-white">{aiAnalysis.assignmentGroupRecommendation?.recommended || 'N/A'}</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{aiAnalysis.assignmentGroupRecommendation?.reasoning}</p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                          aiAnalysis.assignmentGroupRecommendation?.confidence === 'HIGH'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : aiAnalysis.assignmentGroupRecommendation?.confidence === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}>
                          {aiAnalysis.assignmentGroupRecommendation?.confidence} CONFIDENCE
                        </span>
                      </div>

                      {aiAnalysis.assignmentGroupRecommendation?.alternateGroups?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase mb-2">Alternate Groups</p>
                          <div className="flex flex-wrap gap-1.5">
                            {aiAnalysis.assignmentGroupRecommendation.alternateGroups.map((g: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Impact Assessment */}
                    {aiAnalysis.impactAssessment && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-red-300 uppercase mb-0.5">Impact Assessment</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{aiAnalysis.impactAssessment}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800" />

                  {/* 2. Suggested Resolution Steps */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-widest">2. Suggested Resolution Steps</h3>
                      <span className="ml-auto text-[10px] text-amber-400/80 font-mono">ServiceNow & Portal Derived</span>
                    </div>

                    <div className="space-y-2">
                      {aiAnalysis.resolutionSteps?.map((step: any) => (
                        <div key={step.stepNumber} className="flex gap-3 p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500/30 transition-colors">
                          <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                            step.priority === 'IMMEDIATE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            step.priority === 'SHORT_TERM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-slate-700 text-slate-400 border border-slate-600'
                          }`}>
                            {step.stepNumber}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-white">{step.action}</p>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${
                                step.priority === 'IMMEDIATE' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                step.priority === 'SHORT_TERM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-slate-700 text-slate-400 border-slate-600'
                              }`}>{step.priority}</span>
                              {step.source && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                  {step.source}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              <span className="text-slate-500">Responsible: </span>
                              <strong className="text-slate-300">{step.responsible}</strong>
                            </p>
                            {step.rationale && (
                              <p className="text-[10px] text-slate-400 italic leading-relaxed">{step.rationale}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800" />

                  {/* 3. Recent ServiceNow Changes (Last 10 Days) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-widest">3. Correlated Changes (Last 10 Days)</h3>
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                        {aiAnalysis.recentChanges?.length || 0} Found
                      </span>
                    </div>

                    {aiAnalysis.recentChanges?.length > 0 ? (
                      <div className="space-y-2">
                        {aiAnalysis.recentChanges.map((chg: any, idx: number) => (
                          <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-cyan-500/40 transition-colors space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-300 font-mono">{chg.changeNumber}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${
                                  chg.risk === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                  chg.risk === 'Moderate' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>{chg.risk || 'Normal'}</span>
                              </div>
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {chg.state || 'Implemented'}
                              </span>
                            </div>
                            <p className="text-xs text-white font-semibold leading-tight">{chg.shortDescription}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                              <span>CI: <strong className="text-slate-300">{chg.ci || 'General'}</strong></span>
                              {chg.createdDate && <span>Date: <strong className="text-slate-300">{chg.createdDate}</strong></span>}
                            </div>
                            {chg.correlationReason && (
                              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 text-[10px] text-cyan-300/90 leading-relaxed">
                                <span className="font-bold text-cyan-400">Correlation: </span>{chg.correlationReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
                        No recent change requests correlated with this incident CI or description.
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800" />

                  {/* 4. Suggested ServiceNow KB Articles */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-widest">4. Suggested KB Articles & Runbooks</h3>
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                        {aiAnalysis.suggestedKbArticles?.length || 0} Articles
                      </span>
                    </div>

                    {aiAnalysis.suggestedKbArticles?.length > 0 ? (
                      <div className="space-y-2">
                        {aiAnalysis.suggestedKbArticles.map((kb: any, idx: number) => (
                          <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/40 transition-colors space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-emerald-300 font-mono">{kb.kbNumber}</span>
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                {kb.topic || 'General'}
                              </span>
                            </div>
                            <p className="text-xs text-white font-semibold leading-tight">{kb.title}</p>
                            {kb.relevanceReason && (
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                <span className="text-slate-500">Relevance: </span>{kb.relevanceReason}
                              </p>
                            )}
                            {kb.recommendedAction && (
                              <div className="p-2 bg-emerald-950/30 rounded-lg border border-emerald-500/20 text-[10px] text-emerald-300 leading-relaxed">
                                <span className="font-bold">Playbook Action: </span>{kb.recommendedAction}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
                        No specific KB articles found in ServiceNow for these symptoms.
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800" />

                  {/* 5. Previous Related Incidents (ServiceNow & Portal) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-widest">5. Previous Related Incidents</h3>
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                        {aiAnalysis.relatedIncidents?.length || 0} Verified
                      </span>
                    </div>

                    {aiAnalysis.relatedIncidents?.length > 0 ? (
                      <div className="space-y-2">
                        {aiAnalysis.relatedIncidents.map((inc: any, idx: number) => (
                          <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/40 transition-colors space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-300 font-mono">{inc.incidentNumber}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${
                                  inc.source === 'ServiceNow' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                  'bg-slate-700 text-slate-300 border-slate-600'
                                }`}>{inc.source || 'ServiceNow'}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded border ${
                                  inc.priority === 'P1' || inc.priority === '1' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                  inc.priority === 'P2' || inc.priority === '2' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>{inc.priority}</span>
                              </div>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                                inc.status === 'Closed' || inc.status === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                inc.status === 'Resolved' || inc.status === 'RESOLVED' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' :
                                'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              }`}>{inc.status}</span>
                            </div>
                            <p className="text-xs text-white font-semibold leading-tight">{inc.shortDescription}</p>
                            <p className="text-[10px] text-slate-400">Group: <span className="text-slate-300 font-semibold">{inc.assignmentGroup}</span></p>
                            {inc.similarityReason && (
                              <div className="pt-1.5 border-t border-slate-800">
                                <p className="text-[10px] text-violet-300 font-semibold mb-0.5">Why Related</p>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{inc.similarityReason}</p>
                              </div>
                            )}
                            {inc.resolutionNotes && (
                              <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] leading-relaxed space-y-0.5">
                                <p className="text-emerald-400 font-bold">ServiceNow Close / Resolution Notes:</p>
                                <p className="text-slate-300">{inc.resolutionNotes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
                        No previous related incidents found in ServiceNow.
                      </div>
                    )}
                  </div>

                  {/* Urgency Note */}
                  {aiAnalysis.urgencyNote && (
                    <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">{aiAnalysis.urgencyNote}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-sm font-bold text-white">Analysis Failed</p>
                  <p className="text-xs text-slate-400">Please check your Gemini API key in Admin Settings and try again.</p>
                  <button
                    onClick={handleRunAiAnalysis}
                    className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl"
                  >
                    Retry Analysis
                  </button>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-between">
              <p className="text-[10px] text-slate-500">Data sources: Portal incidents + bulk uploads · Gemini AI</p>
              <button
                onClick={handleRunAiAnalysis}
                disabled={loadingAiAnalysis}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAiAnalysis ? 'animate-spin' : ''}`} />
                Re-analyse
              </button>
            </div>
          </div>
        </div>
      )}
          {/* Add Location Modal Dialog */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add Impacted Location</h3>
                  <p className="text-[10px] text-slate-400">Link facility site to incident {incident.number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddLocationModal(false);
                  setSiteSearch('');
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by city, country, name, or code..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            {/* Sites List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingSites ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Loading available locations...</span>
                </div>
              ) : (
                (() => {
                  const currentSiteIds = new Set((incident.sites || []).map((s: any) => s.site?.id || s.siteId));
                  const filtered = availableSites
                    .filter((s: any) => !currentSiteIds.has(s.id))
                    .filter((s: any) => {
                      if (!siteSearch.trim()) return true;
                      const q = siteSearch.toLowerCase();
                      return (
                        s.name?.toLowerCase().includes(q) ||
                        s.city?.toLowerCase().includes(q) ||
                        s.country?.toLowerCase().includes(q) ||
                        s.code?.toLowerCase().includes(q) ||
                        s.businessUnit?.toLowerCase().includes(q)
                      );
                    });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        {availableSites.length === 0
                          ? 'No locations found in the system.'
                          : 'No matching unlinked locations found.'}
                      </div>
                    );
                  }

                  return filtered.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{s.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {s.code}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          📍 {s.city}, {s.country} • {s.businessUnit || s.siteType || 'Corporate'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleAddLocation(s.id, s.name)}
                        disabled={addingSiteId === s.id}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg flex items-center gap-1 shadow-md shadow-amber-500/20 disabled:opacity-50 shrink-0"
                      >
                        {addingSiteId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Add</span>
                      </button>
                    </div>
                  ));
                })()
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setShowAddLocationModal(false);
                  setSiteSearch('');
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CIM Notification Email Preview / Review Modal ── */}
      {showEmailPreview && emailPreviewPayload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative bg-slate-950 border border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-500/10 w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Send className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Review CIM Notification Email</h2>
                  <p className="text-[10px] text-slate-400 font-mono">AI has rephrased your update. Review before sending.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowEmailPreview(false); setEmailPreviewPayload(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

              {/* Subject & Recipients */}
              <div className="p-3.5 bg-slate-900 border border-slate-700 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-20 shrink-0">Subject:</span>
                  <span className="text-white font-mono">{emailPreviewPayload.subject}</span>
                </div>
                {emailPreviewPayload.extraEmails && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold w-20 shrink-0">Extra To:</span>
                    <span className="text-cyan-300 font-mono break-all">{emailPreviewPayload.extraEmails}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-20 shrink-0">Also To:</span>
                  <span className="text-slate-300">CIM_UPDATE_RECIPIENTS (configured in Admin settings)</span>
                </div>
              </div>

              {/* AI-Rephrased Fields Banner */}
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-300">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Fields marked <span className="font-bold text-yellow-200">⭐ AI-Rephrased</span> were synthesised from your raw update. Review and edit before sending.</span>
              </div>

              {/* Email Fields Table */}
              <div className="rounded-xl overflow-hidden border border-slate-800 text-xs">

                {/* Row group: Incident metadata */}
                <div className="grid grid-cols-3 divide-x divide-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Incident No.</div>
                  <div className="px-3 py-2 text-white font-mono col-span-2">{emailPreviewPayload.incidentNumber}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Start Date / Time</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.startDate} {emailPreviewPayload.startTime}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Priority</div>
                  <div className="px-3 py-2 font-bold text-red-400 col-span-2">{emailPreviewPayload.priority}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Incident Manager</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.incidentManager}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Next Update</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.nextUpdate}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Business Impact</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.businessImpact}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Sites Impacted</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.sitesImpacted}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Outage Duration</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.outageDuration}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Assignment Group</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.assignmentGroup}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Related Incidents</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.relatedIncidents}</div>
                </div>

                {/* ⭐ AI-Rephrased: Issue Summary — editable */}
                <div className="border-t border-slate-800">
                  <div className="bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> ⭐ Issue Summary <span className="text-[9px] text-yellow-500 font-normal">(AI-Rephrased — editable)</span>
                  </div>
                  <textarea
                    rows={3}
                    value={emailPreviewPayload.issueSummary}
                    onChange={(e) => setEmailPreviewPayload((p: any) => ({ ...p, issueSummary: e.target.value }))}
                    className="w-full bg-slate-950 px-3 py-2 text-white leading-relaxed focus:outline-none focus:bg-slate-900 resize-none"
                  />
                </div>

                {/* ⭐ AI-Rephrased: Resolution Status — editable bullets */}
                <div className="border-t border-slate-800">
                  <div className="bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> ⭐ Resolution Status <span className="text-[9px] text-yellow-500 font-normal">(AI-Rephrased — one item per line)</span>
                  </div>
                  <textarea
                    rows={3}
                    value={(emailPreviewPayload.resolutionBullets as string[]).join('\n')}
                    onChange={(e) => setEmailPreviewPayload((p: any) => ({ ...p, resolutionBullets: e.target.value.split('\n') }))}
                    className="w-full bg-slate-950 px-3 py-2 text-white leading-relaxed focus:outline-none focus:bg-slate-900 resize-none"
                  />
                </div>

                {/* ⭐ AI-Rephrased: Overall Status — editable */}
                <div className="border-t border-slate-800">
                  <div className="bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> ⭐ Overall Status & ETA <span className="text-[9px] text-yellow-500 font-normal">(AI-Rephrased — editable)</span>
                  </div>
                  <textarea
                    rows={2}
                    value={emailPreviewPayload.overallStatus}
                    onChange={(e) => setEmailPreviewPayload((p: any) => ({ ...p, overallStatus: e.target.value }))}
                    className="w-full bg-slate-950 px-3 py-2 text-white leading-relaxed focus:outline-none focus:bg-slate-900 resize-none"
                  />
                </div>

                {/* Remaining metadata */}
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Teams Involved</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.teamsInvolved}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Partner Lead</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.partnerLead}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">C&D IT Coordinator</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.itCoordinator}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Stakeholders</div>
                  <div className="px-3 py-2 text-slate-200 col-span-2">{emailPreviewPayload.stakeholders}</div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800">
                  <div className="bg-slate-800/60 px-3 py-2 font-semibold text-slate-300">Teams Bridge Link</div>
                  <div className="px-3 py-2 text-blue-400 col-span-2 truncate">{emailPreviewPayload.teamsLink}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <p className="text-[10px] text-slate-500">Changes made above are applied to the email only and do not modify the incident record.</p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setShowEmailPreview(false); setEmailPreviewPayload(null); }}
                  disabled={sendingEmail}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
                >
                  Skip / Don&apos;t Send
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sendingEmail ? 'Sending...' : 'Send Email Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
