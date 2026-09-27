'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Search,
  RotateCw,
  Clock,
  User,
  Activity,
  BarChart3,
  Settings,
  Sparkles,
  ChevronDown,
  Lock,
  Radio,
  Plus,
  FileBarChart,
  MapPin,
  LogIn,
  LogOut,
  Globe,
  X,
  Loader2,
  Check,
  Compass,
} from 'lucide-react';
import { useCimStore, UserRole } from '@/store/useCimStore';

const TIMEZONE_GROUPS = [
  {
    group: 'Coordinated Universal Time (UTC)',
    zones: [
      { id: 'UTC', label: 'UTC — Coordinated Universal Time', offset: 'UTC+00:00' },
    ],
  },
  {
    group: 'North America',
    zones: [
      { id: 'America/New_York', label: 'Eastern Time (New York, Toronto, Miami)', offset: 'UTC-05:00 / -04:00' },
      { id: 'America/Chicago', label: 'Central Time (Chicago, Dallas, Houston)', offset: 'UTC-06:00 / -05:00' },
      { id: 'America/Denver', label: 'Mountain Time (Denver, Phoenix, Calgary)', offset: 'UTC-07:00 / -06:00' },
      { id: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles, San Francisco, Vancouver)', offset: 'UTC-08:00 / -07:00' },
      { id: 'America/Anchorage', label: 'Alaska Time (Anchorage)', offset: 'UTC-09:00 / -08:00' },
      { id: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)', offset: 'UTC-10:00' },
      { id: 'America/Mexico_City', label: 'Central Standard Time (Mexico City)', offset: 'UTC-06:00' },
    ],
  },
  {
    group: 'Europe',
    zones: [
      { id: 'Europe/London', label: 'London, Dublin, Lisbon (GMT / BST)', offset: 'UTC+00:00 / +01:00' },
      { id: 'Europe/Paris', label: 'Paris, Amsterdam, Brussels (CET / CEST)', offset: 'UTC+01:00 / +02:00' },
      { id: 'Europe/Berlin', label: 'Berlin, Frankfurt, Rome, Madrid (CET / CEST)', offset: 'UTC+01:00 / +02:00' },
      { id: 'Europe/Athens', label: 'Athens, Bucharest, Helsinki (EET / EEST)', offset: 'UTC+02:00 / +03:00' },
      { id: 'Europe/Moscow', label: 'Moscow, St. Petersburg (MSK)', offset: 'UTC+03:00' },
    ],
  },
  {
    group: 'Asia & Middle East',
    zones: [
      { id: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat (GST)', offset: 'UTC+04:00' },
      { id: 'Asia/Kolkata', label: 'India Standard Time (New Delhi, Mumbai, Bengaluru)', offset: 'UTC+05:30' },
      { id: 'Asia/Dhaka', label: 'Dhaka, Almaty (BST)', offset: 'UTC+06:00' },
      { id: 'Asia/Bangkok', label: 'Bangkok, Hanoi, Jakarta (ICT)', offset: 'UTC+07:00' },
      { id: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT)', offset: 'UTC+08:00' },
      { id: 'Asia/Hong_Kong', label: 'Hong Kong, Beijing, Shanghai (HKT / CST)', offset: 'UTC+08:00' },
      { id: 'Asia/Tokyo', label: 'Tokyo, Osaka (JST)', offset: 'UTC+09:00' },
      { id: 'Asia/Seoul', label: 'Seoul (KST)', offset: 'UTC+09:00' },
    ],
  },
  {
    group: 'Australia & Pacific',
    zones: [
      { id: 'Australia/Perth', label: 'Western Australia (Perth)', offset: 'UTC+08:00' },
      { id: 'Australia/Adelaide', label: 'South Australia (Adelaide)', offset: 'UTC+09:30 / +10:30' },
      { id: 'Australia/Sydney', label: 'Eastern Australia (Sydney, Melbourne, Brisbane)', offset: 'UTC+10:00 / +11:00' },
      { id: 'Pacific/Auckland', label: 'New Zealand (Auckland, Wellington)', offset: 'UTC+12:00 / +13:00' },
    ],
  },
  {
    group: 'Latin America',
    zones: [
      { id: 'America/Sao_Paulo', label: 'São Paulo, Rio de Janeiro (BRT)', offset: 'UTC-03:00' },
      { id: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', offset: 'UTC-03:00' },
      { id: 'America/Bogota', label: 'Bogotá, Lima, Quito (COT)', offset: 'UTC-05:00' },
      { id: 'America/Santiago', label: 'Santiago (CLT)', offset: 'UTC-04:00 / -03:00' },
    ],
  },
  {
    group: 'Africa',
    zones: [
      { id: 'Africa/Cairo', label: 'Cairo (EET)', offset: 'UTC+02:00' },
      { id: 'Africa/Johannesburg', label: 'Johannesburg, Cape Town (SAST)', offset: 'UTC+02:00' },
      { id: 'Africa/Lagos', label: 'Lagos, Accra (WAT)', offset: 'UTC+01:00' },
      { id: 'Africa/Nairobi', label: 'Nairobi, Addis Ababa (EAT)', offset: 'UTC+03:00' },
    ],
  },
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  const {
    currentRole,
    userName,
    userEmail,
    timeZone,
    setTimeZone,
    setRole,
    setUser,
    searchQuery,
    setSearchQuery,
    triggerRefresh,
    setFetchModalOpen,
    setCopilotOpen,
    addToast,
  } = useCimStore();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Profile Settings Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedTz, setSelectedTz] = useState<string>(timeZone || 'UTC');
  const [savingTz, setSavingTz] = useState(false);
  const [previewNow, setPreviewNow] = useState(new Date());

  useEffect(() => {
    if (timeZone) {
      setSelectedTz(timeZone);
    }
  }, [timeZone]);

  useEffect(() => {
    // Check active session on load
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          if (data.user.timeZone) {
            setSelectedTz(data.user.timeZone);
          }
        }
      } catch (err) {
        console.warn('Session check failed:', err);
      }
    };
    initAuth();
  }, [setUser]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setPreviewNow(now);
      try {
        const tz = timeZone || 'UTC';
        const timeStr = now.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        const tzAbbr = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'short',
        }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || tz;

        setCurrentTime(`${timeStr} ${tzAbbr}`);
      } catch (err) {
        setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC');
      }
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [timeZone]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerRefresh();
    addToast({
      title: '🔄 Dashboard Refreshed',
      message: 'Telemetry and active incident feeds re-synchronized.',
      type: 'update',
    });
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleLogout = async () => {
    setIsRoleMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setRole('GUEST');
      addToast({
        title: '🔒 Signed Out',
        message: 'You have been logged out. Switched to Guest permissions.',
        type: 'update',
      });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleDetectTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setSelectedTz(detected);
        addToast({
          title: '🌐 Time Zone Detected',
          message: `Detected local browser time zone: ${detected}`,
          type: 'update',
        });
      }
    } catch (err) {
      console.warn('Failed to detect timezone:', err);
    }
  };

  const handleSaveProfileSettings = async () => {
    setSavingTz(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeZone: selectedTz }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTimeZone(selectedTz);
        addToast({
          title: '✅ Time Zone Saved',
          message: `Display time zone updated to ${selectedTz}.`,
          type: 'update',
        });
        setShowProfileModal(false);
      } else {
        addToast({
          title: '❌ Save Failed',
          message: data.error || 'Failed to update time zone preference.',
          type: 'update',
        });
      }
    } catch (err: any) {
      addToast({
        title: '❌ Network Error',
        message: err?.message || 'Could not connect to update profile.',
        type: 'update',
      });
    } finally {
      setSavingTz(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 glass-nav px-4 lg:px-8 py-3 transition-all duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Branding & Navigation Links */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-blue-400 flex items-center justify-center shadow-glowBlue group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">
                  APEX COMMAND
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <p className="text-xs text-secondaryText font-medium">Critical Incident Management</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-700/60">
            <Link
              href="/"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                pathname === '/'
                  ? 'bg-accent/20 text-blue-400 border border-accent/40'
                  : 'text-secondaryText hover:text-white hover:bg-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Command Center</span>
            </Link>

            <Link
              href="/analytics"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                pathname === '/analytics'
                  ? 'bg-accent/20 text-blue-400 border border-accent/40'
                  : 'text-secondaryText hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Executive Analytics</span>
            </Link>

            <Link
              href="/reports"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                pathname === '/reports'
                  ? 'bg-accent/20 text-blue-400 border border-accent/40'
                  : 'text-secondaryText hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileBarChart className="w-3.5 h-3.5" />
              <span>Reports & Insights</span>
            </Link>

            <Link
              href="/sites"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                pathname === '/sites'
                  ? 'bg-accent/20 text-blue-400 border border-accent/40'
                  : 'text-secondaryText hover:text-white hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Sites</span>
            </Link>

            {currentRole === 'ADMIN' && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
                  pathname === '/admin'
                    ? 'bg-accent/20 text-blue-400 border border-accent/40'
                    : 'text-secondaryText hover:text-white hover:bg-slate-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin Settings</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondaryText" />
          <input
            type="text"
            placeholder="Search by Incident #, Site, Group, Service, or Keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-secondaryText focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>

        {/* Right Actions: Fetch Incident (Managers/Admin), AI Copilot, Refresh, Time, Role Selector */}
        <div className="flex items-center space-x-3">
          {/* Add/Fetch Incident Button */}
          {currentRole !== 'GUEST' && (
            <button
              onClick={() => setFetchModalOpen(true)}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent text-white text-xs font-semibold rounded-xl shadow-glowBlue transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Fetch ServiceNow Incident</span>
            </button>
          )}

          {/* AI Copilot Button */}
          <button
            onClick={() => setCopilotOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all hover:border-blue-400"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
            <span className="hidden md:inline">AI Copilot</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh feeds"
            className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-secondaryText hover:text-white transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
          </button>

          {/* Live UTC Clock - Clickable to open Profile Timezone Settings */}
          <button
            onClick={() => setShowProfileModal(true)}
            title="Click to change timezone in Profile Settings"
            className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 font-mono transition-colors cursor-pointer group"
          >
            <Clock className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="group-hover:text-white transition-colors">{currentTime || '00:00:00 UTC'}</span>
          </button>

          {/* Role Switcher Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                currentRole === 'ADMIN'
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                  : currentRole === 'INCIDENT_MANAGER'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="capitalize">{currentRole.replace('_', ' ')}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-modal rounded-xl shadow-2xl py-2 z-50 border border-slate-700/80 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                {/* Active User Profile */}
                <div className="px-3.5 py-2.5 space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                      {(userName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{userName || 'Active User'}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{userEmail || 'user@organization.com'}</p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <span
                      className={`inline-block px-2 py-0.5 text-[9.5px] font-bold rounded-full border ${
                        currentRole === 'ADMIN'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : currentRole === 'INCIDENT_MANAGER'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {currentRole === 'ADMIN' ? '👑 Administrator' : currentRole === 'INCIDENT_MANAGER' ? '⚡ Incident Manager' : '🛡️ Guest User'}
                    </span>
                    <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 border border-blue-500/30">
                      {timeZone || 'UTC'}
                    </span>
                  </div>
                </div>

                {/* Profile & Account Navigation */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsRoleMenuOpen(false);
                      setShowProfileModal(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span>Profile &amp; Time Zone</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Edit ⚙️</span>
                  </button>

                  <Link
                    href="/login"
                    onClick={() => setIsRoleMenuOpen(false)}
                    className="w-full px-3.5 py-2 text-left text-xs flex items-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sign In / Switch Account</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full px-3.5 py-2 text-left text-xs flex items-center space-x-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── User Profile & Time Zone Settings Modal ── */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-blue-500/10 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Profile &amp; Time Zone Settings</h2>
                  <p className="text-[10px] text-slate-400">Configure your display time zone for incident timelines &amp; telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Active User Card */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{userName || 'Active User'}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{userEmail || 'user@organization.com'}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                    currentRole === 'ADMIN'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : currentRole === 'INCIDENT_MANAGER'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {currentRole.replace('_', ' ')}
                </span>
              </div>

              {/* Time Zone Selection Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Display Time Zone</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectTimezone}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
                  >
                    <Compass className="w-3 h-3 text-blue-400" />
                    <span>Auto-Detect My Time Zone</span>
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={selectedTz}
                    onChange={(e) => setSelectedTz(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono"
                  >
                    {/* If selectedTz isn't in predefined groups, show it as selected custom */}
                    {!TIMEZONE_GROUPS.some(g => g.zones.some(z => z.id === selectedTz)) && (
                      <option value={selectedTz}>
                        {selectedTz} (Detected Time Zone)
                      </option>
                    )}

                    {TIMEZONE_GROUPS.map((group) => (
                      <optgroup key={group.group} label={group.group} className="bg-slate-950 font-bold text-slate-400">
                        {group.zones.map((zone) => (
                          <option key={zone.id} value={zone.id} className="bg-slate-900 text-white font-normal">
                            {zone.label} ({zone.offset})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Controls the live clock in the dashboard header, incident timelines, next update cadences, and meeting durations.
                </p>
              </div>

              {/* Live Time Preview Card */}
              {(() => {
                let previewTimeStr = '';
                let previewDateStr = '';
                let tzAbbr = selectedTz;
                let offsetStr = '';

                try {
                  previewTimeStr = previewNow.toLocaleTimeString('en-US', {
                    timeZone: selectedTz,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  });
                  previewDateStr = previewNow.toLocaleDateString('en-US', {
                    timeZone: selectedTz,
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: selectedTz,
                    timeZoneName: 'short',
                  }).formatToParts(previewNow);
                  tzAbbr = parts.find((p) => p.type === 'timeZoneName')?.value || selectedTz;

                  const offsetParts = new Intl.DateTimeFormat('en-US', {
                    timeZone: selectedTz,
                    timeZoneName: 'longOffset',
                  }).formatToParts(previewNow);
                  offsetStr = offsetParts.find((p) => p.type === 'timeZoneName')?.value || '';
                } catch {
                  previewTimeStr = previewNow.toLocaleTimeString();
                  previewDateStr = previewNow.toLocaleDateString();
                }

                return (
                  <div className="p-4 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-blue-950/20 border border-blue-500/20 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live Time in {selectedTz}
                      </span>
                      <span className="text-blue-400 font-mono font-bold">{offsetStr}</span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                        {previewTimeStr}
                      </span>
                      <span className="text-xs font-bold text-blue-400 font-mono">{tzAbbr}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{previewDateStr}</p>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Preferences are saved to your account.</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  disabled={savingTz}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfileSettings}
                  disabled={savingTz}
                  className="px-5 py-2 text-xs font-bold bg-accent hover:bg-accentHover text-white rounded-xl shadow-glowBlue transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingTz ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{savingTz ? 'Saving...' : 'Save Time Zone'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
