'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Sparkles,
  Radio,
  Shield,
  Mail,
  Lock,
  ArrowRight,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const [ssoLoading, setSsoLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local login credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setErrorMsg(decodeURIComponent(error));
    }
  }, [searchParams]);

  const handleSsoClick = () => {
    setSsoLoading(true);
    setErrorMsg(null);
    window.location.href = '/api/auth/sso/login';
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setLocalLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during login.');
    } finally {
      setLocalLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail: string, demoPass: string = 'admin123') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent to-blue-500 shadow-glowBlue mb-2">
          <ShieldAlert className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">APEX COMMAND</h1>
        <p className="text-xs text-slate-400 font-medium">Critical Incident Management & Outage Operations Portal</p>
      </div>

      {/* Main Glass Card */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-6 bg-slate-900/90 backdrop-blur-xl">
        <div className="text-center space-y-1 border-b border-slate-800 pb-4">
          <h2 className="text-sm font-bold text-white flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            System Authentication
          </h2>
          <p className="text-xs text-slate-400">
            Sign in with Enterprise SSO or your local administrator account
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{successMsg}</div>
          </div>
        )}

        <div className="space-y-5">
          {/* Microsoft SSO Section */}
          <button
            onClick={handleSsoClick}
            disabled={ssoLoading || localLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-glowBlue flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {ssoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
            )}
            <span>{ssoLoading ? 'Connecting to Microsoft...' : 'Sign in with Microsoft 365 (SSO)'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Or Login With Local Account
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Local Login Form */}
          <form onSubmit={handleLocalLogin} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cim.corp"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={localLoading || ssoLoading}
              className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-all disabled:opacity-50 shadow-sm"
            >
              {localLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <KeyRound className="w-4 h-4 text-blue-400" />
              )}
              <span>{localLoading ? 'Signing in...' : 'Sign In with Credentials'}</span>
            </button>
          </form>

          {/* Quick Demo Credentials Preset */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Quick Demo Accounts</span>
              <span className="text-[9px] text-slate-500 font-normal">pass: admin123</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@cim.corp')}
                className="py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] text-blue-300 font-medium transition-colors text-center"
              >
                🛡️ Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager@cim.corp')}
                className="py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] text-indigo-300 font-medium transition-colors text-center"
              >
                ⚡ Manager
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('guest@cim.corp')}
                className="py-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-medium transition-colors text-center"
              >
                👁️ Guest
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <Suspense fallback={<Loader2 className="w-8 h-8 text-blue-400 animate-spin" />}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
