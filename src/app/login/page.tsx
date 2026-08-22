'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Radio,
  Shield,
} from 'lucide-react';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setErrorMsg(decodeURIComponent(error));
    }
  }, [searchParams]);

  const handleSsoClick = () => {
    setLoading(true);
    setErrorMsg(null);
    window.location.href = '/api/auth/sso/login';
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
            Enterprise Single Sign-On (SSO)
          </h2>
          <p className="text-xs text-slate-400">
            Sign in with your corporate Microsoft Entra ID / Microsoft 365 account
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        <div className="space-y-5">
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-bold text-white text-[13px]">
              <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
              Corporate Identity Gateway
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Authentication is securely managed via Microsoft Graph API. First-time users will be provisioned automatically with Guest permissions.
            </p>
          </div>

          {/* Microsoft SSO Button */}
          <button
            onClick={handleSsoClick}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-glowBlue flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              /* Microsoft 4-color square logo */
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
            )}
            <span>{loading ? 'Connecting to Microsoft...' : 'Sign in with Microsoft 365 (SSO)'}</span>
          </button>

          {/* First Time Registration Notice */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> First-Time Access Policy
            </span>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              New accounts are granted <strong>Guest permissions</strong> upon first login. An Administrator can promote your role to <strong>Incident Manager</strong> or <strong>Administrator</strong>.
            </p>
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
