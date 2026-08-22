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
} from 'lucide-react';
import { useCimStore, UserRole } from '@/store/useCimStore';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const {
    currentRole,
    userName,
    userEmail,
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

  useEffect(() => {
    // Check active session on load
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
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
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
          ' UTC'
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

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

          {/* Live UTC Clock */}
          <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentTime || '00:00:00 UTC'}</span>
          </div>

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
              <div className="absolute right-0 mt-2 w-64 glass-modal rounded-xl shadow-2xl py-2 z-50 border border-slate-700/80 divide-y divide-slate-800">
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
                  <div className="pt-1">
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
                  </div>
                </div>

                {/* Account Navigation */}
                <div className="py-1">
                  <Link
                    href="/login"
                    onClick={() => setIsRoleMenuOpen(false)}
                    className="w-full px-3.5 py-1.5 text-left text-xs flex items-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sign In / Switch Account</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full px-3.5 py-1.5 text-left text-xs flex items-center space-x-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
    </header>
  );
};
