'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Server,
  Key,
  Radio,
  Sliders,
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  UserCheck,
  Globe,
  Upload,
  ArrowRight,
  Sparkles,
  BellRing,
  Users,
  UserPlus,
  Trash2,
  Shield,
  Search,
  X,
  KeyRound,
  Mail,
  Plus,
  Edit2,
  Save,
  Building2,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

export default function AdminSettingsPage() {
  const { currentRole, addToast } = useCimStore();

  const [snUrl, setSnUrl] = useState('https://dev403781.service-now.com');
  const [snUser, setSnUser] = useState('admin');
  const [snPassword, setSnPassword] = useState('VK0oo6l+YbZ=');
  const [teamsWebhook, setTeamsWebhook] = useState('https://outlook.office.com/webhook/cim-incidents');

  // Microsoft Teams Plug & Play API Configuration State
  const [teamsAppName, setTeamsAppName] = useState('Graph Java quick start');
  const [teamsClientId, setTeamsClientId] = useState('bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a');
  const [teamsTenantId, setTeamsTenantId] = useState('common');
  const [teamsClientSecret, setTeamsClientSecret] = useState('');
  const [testingTeamsConnection, setTestingTeamsConnection] = useState(false);
  const [teamsTestResult, setTeamsTestResult] = useState<any>(null);

  // AI Configuration State
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');

  // Notification Module State
  const [bridgeRecipients, setBridgeRecipients] = useState('');
  const [cimUpdateRecipients, setCimUpdateRecipients] = useState('');
  const [senderEmail, setSenderEmail] = useState('shivam@xetainteractives.com');
  const [testEmailRecipient, setTestEmailRecipient] = useState('shivam@xetainteractives.com');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testingAiConnection, setTestingAiConnection] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ total: 0, admins: 0, managers: 0, guests: 0 });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('GUEST');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Assignment Groups State
  const [assignmentGroups, setAssignmentGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmail, setNewGroupEmail] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupEmail, setEditingGroupEmail] = useState('');
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  // Load existing configurations from DB on mount
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        if (s.SERVICENOW_INSTANCE_URL || s.servicenow_url) setSnUrl(s.SERVICENOW_INSTANCE_URL || s.servicenow_url);
        if (s.SERVICENOW_USERNAME || s.servicenow_user) setSnUser(s.SERVICENOW_USERNAME || s.servicenow_user);
        if (s.SERVICENOW_PASSWORD || s.servicenow_password) setSnPassword(s.SERVICENOW_PASSWORD || s.servicenow_password);
        if (s.TEAMS_WEBHOOK_URL) setTeamsWebhook(s.TEAMS_WEBHOOK_URL);
        if (s.TEAMS_APP_NAME) setTeamsAppName(s.TEAMS_APP_NAME);
        if (s.TEAMS_CLIENT_ID) setTeamsClientId(s.TEAMS_CLIENT_ID);
        if (s.TEAMS_TENANT_ID) setTeamsTenantId(s.TEAMS_TENANT_ID);
        if (s.TEAMS_CLIENT_SECRET) setTeamsClientSecret(s.TEAMS_CLIENT_SECRET);
        if (s.GEMINI_API_KEY || s.OPENAI_API_KEY) setAiKey(s.GEMINI_API_KEY || s.OPENAI_API_KEY);
        if (s.AI_MODEL) setAiModel(s.AI_MODEL);
        if (s.BRIDGE_RECIPIENTS) setBridgeRecipients(s.BRIDGE_RECIPIENTS);
        if (s.CIM_UPDATE_RECIPIENTS) setCimUpdateRecipients(s.CIM_UPDATE_RECIPIENTS);
        if (s.GRAPH_SENDER_EMAIL) {
          setSenderEmail(s.GRAPH_SENDER_EMAIL);
          setTestEmailRecipient(s.GRAPH_SENDER_EMAIL);
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const query = new URLSearchParams();
      if (userSearch) query.set('search', userSearch);
      if (userRoleFilter !== 'ALL') query.set('role', userRoleFilter);
      const res = await fetch(`/api/admin/users?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        if (data.stats) setUserStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAssignmentGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/admin/assignment-groups');
      const data = await res.json();
      if (data.success && data.groups) {
        setAssignmentGroups(data.groups);
      }
    } catch (e) {
      console.error('Failed to load assignment groups:', e);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
    fetchAssignmentGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, userRoleFilter]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '✅ User Permission Updated',
          message: data.message || `Updated role to ${newRole}.`,
          type: 'update',
        });
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update user role.');
      }
    } catch (err: any) {
      alert('Network error updating role: ' + err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    setAddingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          password: newUserPassword || 'welcome123',
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '🎉 User Created',
          message: `Created account for ${newUserName} with role ${newUserRole}.`,
          type: 'update',
        });
        setShowAddUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('GUEST');
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create user.');
      }
    } catch (err: any) {
      alert('Network error creating user: ' + err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user account "${userName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '🗑️ User Deleted',
          message: `User ${userName} has been removed.`,
          type: 'update',
        });
        fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err: any) {
      alert('Network error deleting user: ' + err.message);
    }
  };

  const handleCreateAssignmentGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupEmail.trim()) {
      alert('Please provide both Group Name and Notification Email.');
      return;
    }
    setAddingGroup(true);
    try {
      const res = await fetch('/api/admin/assignment-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, email: newGroupEmail }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '🏢 Assignment Group Added',
          message: `Group "${newGroupName}" mapped to ${newGroupEmail}.`,
          type: 'update',
        });
        setNewGroupName('');
        setNewGroupEmail('');
        fetchAssignmentGroups();
      } else {
        alert(data.error || 'Failed to save assignment group.');
      }
    } catch (err: any) {
      alert('Network error adding assignment group: ' + err.message);
    } finally {
      setAddingGroup(false);
    }
  };

  const handleStartEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupEmail(group.email);
  };

  const handleCancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
    setEditingGroupEmail('');
  };

  const handleSaveGroupEdit = async (id: string) => {
    setSavingGroupId(id);
    try {
      const res = await fetch(`/api/admin/assignment-groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingGroupName, email: editingGroupEmail }),
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '✅ Group Email Updated',
          message: `Updated "${editingGroupName}" email mapping.`,
          type: 'update',
        });
        setEditingGroupId(null);
        fetchAssignmentGroups();
      } else {
        alert(data.error || 'Failed to update assignment group.');
      }
    } catch (err: any) {
      alert('Network error updating assignment group: ' + err.message);
    } finally {
      setSavingGroupId(null);
    }
  };

  const handleDeleteAssignmentGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove assignment group "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/assignment-groups/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        addToast({
          title: '🗑️ Assignment Group Removed',
          message: `Removed "${name}" from notification directory.`,
          type: 'update',
        });
        fetchAssignmentGroups();
      } else {
        alert(data.error || 'Failed to delete assignment group.');
      }
    } catch (err: any) {
      alert('Network error deleting assignment group: ' + err.message);
    }
  };

  const handleTestServiceNow = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/servicenow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceUrl: snUrl,
          username: snUser,
          password: snPassword,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        addToast({
          title: '✅ ServiceNow Connection Verified',
          message: `Latency: ${data.latencyMs}ms | Endpoint: ${data.instanceUrl}`,
          type: 'update',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'Network test failed: ' + (err.message || 'Unknown error') });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestOpenAI = async () => {
    setTestingAiConnection(true);
    setAiTestResult(null);

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiKey,
          model: aiModel,
        }),
      });
      const data = await res.json();
      setAiTestResult(data);
      if (data.success) {
        addToast({
          title: '🤖 AI Model Connection Verified',
          message: `Latency: ${data.latencyMs}ms | Model: ${data.model}`,
          type: 'update',
        });
      }
    } catch (err: any) {
      setAiTestResult({ success: false, message: 'Network test failed: ' + (err.message || 'Unknown error') });
    } finally {
      setTestingAiConnection(false);
    }
  };

  const handleTestTeams = async () => {
    setTestingTeamsConnection(true);
    setTeamsTestResult(null);
    try {
      const res = await fetch('/api/teams/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: teamsAppName,
          clientId: teamsClientId,
          tenantId: teamsTenantId,
          clientSecret: teamsClientSecret,
          webhookUrl: teamsWebhook,
        }),
      });
      const data = await res.json();
      setTeamsTestResult(data);
      if (data.success) {
        addToast({
          title: '🔌 Microsoft Teams API Connected',
          message: `Verified Plug & Play auth for ${data.appName}`,
          type: 'update',
        });
      }
    } catch (err: any) {
      setTeamsTestResult({ success: false, message: 'Teams API test failed: ' + (err.message || 'Unknown error') });
    } finally {
      setTestingTeamsConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'SERVICENOW_INSTANCE_URL', value: snUrl },
            { key: 'SERVICENOW_USERNAME', value: snUser },
            { key: 'SERVICENOW_PASSWORD', value: snPassword },
            { key: 'TEAMS_WEBHOOK_URL', value: teamsWebhook },
            { key: 'TEAMS_APP_NAME', value: teamsAppName },
            { key: 'TEAMS_CLIENT_ID', value: teamsClientId },
            { key: 'TEAMS_TENANT_ID', value: teamsTenantId },
            { key: 'TEAMS_CLIENT_SECRET', value: teamsClientSecret },
            { key: 'GEMINI_API_KEY', value: aiKey },
            { key: 'AI_MODEL', value: aiModel },
            { key: 'BRIDGE_RECIPIENTS', value: bridgeRecipients },
            { key: 'CIM_UPDATE_RECIPIENTS', value: cimUpdateRecipients },
            { key: 'GRAPH_SENDER_EMAIL', value: senderEmail },
          ],
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: '💾 Settings & AI Model Saved',
          message: `Model set to ${aiModel}. Active summaries re-aligned.`,
          type: 'update',
        });
      }
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailRecipient) {
      alert('Please enter a recipient email address for testing.');
      return;
    }
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testEmailRecipient }),
      });
      const data = await res.json();
      setEmailTestResult(data);
      if (data.success) {
        addToast({
          title: '📧 Test Email Sent',
          message: `Dispatched test email to ${testEmailRecipient}`,
          type: 'update',
        });
      } else {
        addToast({
          title: '❌ Email Delivery Failed',
          message: data.message || 'Check Graph API permissions or credentials',
          type: 'error',
        });
      }
    } catch (err: any) {
      setEmailTestResult({
        success: false,
        message: err.message || 'Network error executing email test.',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-12 text-center border border-slate-800 space-y-4 rounded-2xl">
        <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-mono">Loading Config Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title Header */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-2">
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-accent" />
          Enterprise Admin Settings & Integrations
        </h1>
        <p className="text-xs text-secondaryText font-sans">
          Configure live ServiceNow REST APIs, AI API Credentials, Generative AI models, and Notification systems.
        </p>
      </div>

      {/* Prominent Historical Bulk Upload Navigation Card */}
      <div className="glass-card p-6 border border-purple-500/40 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-xl text-purple-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Bulk Upload Historical Incident Data</h2>
              <p className="text-xs text-slate-300">
                Upload CSV or JSON historical incident archives to train Source C of the AI Recommended Solutions Engine.
              </p>
            </div>
          </div>

          <Link
            href="/admin/bulk-upload"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-2xl flex items-center space-x-2 transition-all"
          >
            <span>Open Bulk Upload Page</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* User Management & Role Permissions Section */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                User Management & Access Control
              </h2>
              <p className="text-xs text-slate-400">
                Manage registered users, promote permissions (Admin, Incident Manager, Guest), and provision accounts.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-accent hover:from-blue-500 hover:to-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue flex items-center space-x-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Total Users</span>
            <span className="text-base font-extrabold text-white">{userStats.total}</span>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-0.5">Administrators</span>
            <span className="text-base font-extrabold text-purple-300">{userStats.admins}</span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">Incident Managers</span>
            <span className="text-base font-extrabold text-blue-300">{userStats.managers}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Guests</span>
            <span className="text-base font-extrabold text-emerald-300">{userStats.guests}</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by user name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-400">Filter Role:</span>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:border-accent"
            >
              <option value="ALL">All Roles ({userStats.total})</option>
              <option value="ADMIN">Administrators ({userStats.admins})</option>
              <option value="INCIDENT_MANAGER">Incident Managers ({userStats.managers})</option>
              <option value="GUEST">Guests ({userStats.guests})</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Assigned Role & Permissions</th>
                <th className="py-2.5 px-4">Registered</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                    <span>Loading registered users...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{u.email}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2">
                        <select
                          value={u.role}
                          disabled={updatingUserId === u.id}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-all ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : u.role === 'INCIDENT_MANAGER'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <option value="ADMIN" className="bg-slate-900 text-purple-300 font-bold">
                            👑 Administrator (Full Control)
                          </option>
                          <option value="INCIDENT_MANAGER" className="bg-slate-900 text-blue-300 font-bold">
                            ⚡ Incident Manager (Bridge & Triage)
                          </option>
                          <option value="GUEST" className="bg-slate-900 text-emerald-300 font-bold">
                            🛡️ Guest (Read-Only)
                          </option>
                        </select>
                        {updatingUserId === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md glass-modal p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-accent" />
                Provision New User Account
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jdoe@organization.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Initial Role & Permission</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-accent"
                >
                  <option value="GUEST">🛡️ Guest (Read-Only Observer)</option>
                  <option value="INCIDENT_MANAGER">⚡ Incident Manager (Bridge, Status Updates & Triage)</option>
                  <option value="ADMIN">👑 Administrator (Full Platform & User Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Initial Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Default: welcome123"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-2 bg-accent hover:bg-accentHover text-white rounded-xl text-xs font-bold shadow-glowBlue flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {addingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Create User Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Groups Notification Directory Section */}
      <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Assignment Groups & Notification Mapping
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  {assignmentGroups.length} Groups Configured
                </span>
              </h2>
              <p className="text-xs text-secondaryText">
                Configure dedicated notification email addresses for each Assignment Group. When Bridge Emails or CIM Notifications are sent for an incident, the group email configured here will be automatically included in the recipient list alongside base recipients and impacted site support emails.
              </p>
            </div>
          </div>
        </div>

        {/* Add Group Form */}
        <form onSubmit={handleCreateAssignmentGroup} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
          <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Add / Register Assignment Group
          </p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <input
                type="text"
                required
                placeholder="Assignment Group Name (e.g. Database Administration)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="md:col-span-5">
              <input
                type="text"
                required
                placeholder="Notification Email(s) (comma-separated)"
                value={newGroupEmail}
                onChange={(e) => setNewGroupEmail(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="md:col-span-2 flex items-center">
              <button
                type="submit"
                disabled={addingGroup}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {addingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add Group</span>
              </button>
            </div>
          </div>
        </form>

        {/* Groups Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Group Name</th>
                <th className="py-3 px-4">Notification Email Address(es)</th>
                <th className="py-3 px-4">Automatic Inclusion Rule</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {loadingGroups ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading Assignment Groups...
                  </td>
                </tr>
              ) : assignmentGroups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No assignment groups registered yet. Add one above.
                  </td>
                </tr>
              ) : (
                assignmentGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-white">
                      {editingGroupId === g.id ? (
                        <input
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="bg-slate-850 border border-cyan-500 rounded-lg p-1 text-xs text-white w-full"
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{g.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-cyan-300">
                      {editingGroupId === g.id ? (
                        <input
                          type="text"
                          value={editingGroupEmail}
                          onChange={(e) => setEditingGroupEmail(e.target.value)}
                          className="bg-slate-850 border border-cyan-500 rounded-lg p-1 text-xs text-cyan-300 font-mono w-full"
                        />
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{g.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        CIM Updates + Bridge Details
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {editingGroupId === g.id ? (
                          <>
                            <button
                              onClick={() => handleSaveGroupEdit(g.id)}
                              disabled={savingGroupId === g.id}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                            >
                              {savingGroupId === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                            <button
                              onClick={handleCancelEditGroup}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditGroup(g)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="Edit Email"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignmentGroup(g.id, g.name)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                              title="Remove Group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live ServiceNow Configuration Form */}
        <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              ServiceNow Integration Instance
            </h2>
            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
              Connected
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">ServiceNow Instance URL</label>
              <input
                type="text"
                value={snUrl}
                onChange={(e) => setSnUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">ServiceNow Username</label>
              <input
                type="text"
                value={snUser}
                onChange={(e) => setSnUser(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">ServiceNow Password</label>
              <input
                type="password"
                value={snPassword}
                onChange={(e) => setSnPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <p className="font-bold">{testResult.message}</p>
              {testResult.latencyMs && (
                <p className="text-[11px] font-mono opacity-80">Latency: {testResult.latencyMs}ms</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTestServiceNow}
              disabled={testingConnection}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2"
            >
              {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-blue-400" />}
              <span>Test ServiceNow Connection</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex-1 py-2 bg-accent hover:bg-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center justify-center space-x-2"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

        {/* Microsoft Teams Integrations & AI Settings */}
        <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
              Generative AI Model & Notification Settings
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Gemini API Key */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Gemini API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-accent"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                Used to synthesize briefings, updates, enhance summaries, and power Copilot chatbot.
              </p>
            </div>

            {/* AI Model selector */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Generative AI Model Selector</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-accent"
              >
                <option value="gemini-flash-latest">Gemini Flash Latest (Ultra-Fast Operational Synthesis)</option>
                <option value="gemini-pro-latest">Gemini Pro Latest (Enterprise Executive Model)</option>
              </select>
            </div>

            {/* Microsoft Teams Webhook */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Teams Notification Webhook</label>
              <input
                type="text"
                value={teamsWebhook}
                onChange={(e) => setTeamsWebhook(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-purple-300 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            {aiTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  aiTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                <p className="font-bold">{aiTestResult.message}</p>
                {aiTestResult.latencyMs && (
                  <p className="text-[11px] font-mono opacity-80">Latency: {aiTestResult.latencyMs}ms</p>
                )}
              </div>
            )}

            <button
              onClick={handleTestOpenAI}
              disabled={testingAiConnection}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2"
            >
              {testingAiConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
              <span>Test Gemini Connection</span>
            </button>
          </div>
        </div>

        {/* Microsoft Teams Graph API & Command Bridge Plug & Play Authentication Card */}
        <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
                🔌
              </span>
              Microsoft Teams Graph API (Plug & Play Authentication)
            </h2>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full font-bold border border-purple-500/30">
              Command Bridge & Notifications
            </span>
          </div>

          <p className="text-xs text-secondaryText leading-relaxed">
            Configures centralized Plug and Play authentication for Microsoft Graph Java / Teams API to generate live meeting bridges and deliver AI executive briefing notifications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">App Name</label>
              <input
                type="text"
                placeholder="e.g. Graph Java quick start"
                value={teamsAppName}
                onChange={(e) => setTeamsAppName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Client ID (Application ID)</label>
              <input
                type="text"
                placeholder="bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a"
                value={teamsClientId}
                onChange={(e) => setTeamsClientId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-yellow-400 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Tenant Authority ID</label>
              <input
                type="text"
                placeholder="common or specific tenant GUID"
                value={teamsTenantId}
                onChange={(e) => setTeamsTenantId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-slate-300 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Client Secret / Token (Optional)</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={teamsClientSecret}
                onChange={(e) => setTeamsClientSecret(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Teams Notification Webhook URL</label>
              <input
                type="text"
                placeholder="https://outlook.office.com/webhook/..."
                value={teamsWebhook}
                onChange={(e) => setTeamsWebhook(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-purple-300 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {teamsTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                teamsTestResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <p className="font-bold">{teamsTestResult.message}</p>
              {teamsTestResult.latencyMs && (
                <p className="text-[11px] font-mono opacity-80">Latency: {teamsTestResult.latencyMs}ms</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTestTeams}
              disabled={testingTeamsConnection}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2"
            >
              {testingTeamsConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
              <span>Test Teams Graph API Connection</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-accent hover:from-purple-500 hover:to-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center justify-center space-x-2"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save AI & Teams Settings</span>
            </button>
          </div>
        </div>

        {/* Notification Module */}
        <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <BellRing className="w-4 h-4" />
              </span>
              Notification & Mailing List Module
            </h2>
          </div>

          <p className="text-xs text-secondaryText leading-relaxed">
            Configure the mailing lists for automated alerts. Enter email addresses separated by commas (e.g. john@example.com, team@example.com).
          </p>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center justify-between">
                <span>Microsoft Graph Sender Mailbox</span>
                <span className="text-[10px] text-blue-400 font-normal">Must have Exchange Online mailbox</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="shivam@xetainteractives.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 pl-8 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-accent"
                />
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Bridge Invite Recipients</label>
              <textarea
                rows={2}
                placeholder="List of email IDs to receive Teams Bridge invitations..."
                value={bridgeRecipients}
                onChange={(e) => setBridgeRecipients(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">CIM Update Recipients</label>
              <textarea
                rows={2}
                placeholder="List of email IDs to receive ongoing CIM updates..."
                value={cimUpdateRecipients}
                onChange={(e) => setCimUpdateRecipients(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-accent"
              />
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center justify-center space-x-2"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Notification Settings</span>
            </button>

            {/* Test Email Delivery Section */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  Test Microsoft Graph Email Delivery
                </span>
                <span className="text-[10px] text-slate-500">Uses Graph /users/{`{sender}`}/sendMail</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Recipient email (e.g. shivam@xetainteractives.com)"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {testingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span>{testingEmail ? 'Sending...' : 'Send Test Email'}</span>
                </button>
              </div>

              {emailTestResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                  emailTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {emailTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <span>{emailTestResult.message}</span>
                  </div>

                  {emailTestResult.hint && (
                    <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px] text-yellow-300 font-sans">
                      💡 <strong>Action Required:</strong> {emailTestResult.hint}
                    </div>
                  )}

                  {emailTestResult.steps && (
                    <div className="space-y-1 pt-1 font-mono text-[10px] text-slate-400">
                      {emailTestResult.steps.map((st: any, i: number) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className={st.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                            {st.status === 'ok' ? '✔' : '✖'}
                          </span>
                          <span><strong>{st.step}:</strong> {st.details}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
