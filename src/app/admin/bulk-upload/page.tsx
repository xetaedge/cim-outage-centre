'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
  Sparkles,
  Server,
  FileText,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

export default function BulkUploadPage() {
  const { addToast } = useCimStore();

  const [jsonContent, setJsonContent] = useState(`[
  {
    "number": "HIST-2025-089",
    "title": "PostgreSQL Primary Node Deadlock During High-Concurrency Lock Request",
    "category": "Database Administration",
    "rootCause": "Transaction isolation level SERIALIZABLE caused cascading page locks.",
    "resolutionNotes": "Lowered isolation level to READ COMMITTED and optimized row-level locking.",
    "assignmentGroup": "Database Administration"
  },
  {
    "number": "HIST-2025-090",
    "title": "London Edge BGP Transceiver Signal Degradation",
    "category": "Global Network Operations",
    "rootCause": "Dirty fiber optic connector interface causing link flaps.",
    "resolutionNotes": "Cleaned fiber patch cable ferrule and replaced 100G SFP module.",
    "assignmentGroup": "Global Network Operations"
  }
]`);

  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        setJsonContent(text);
      } else if (file.name.endsWith('.csv')) {
        // Basic CSV to JSON converter
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
          const records = lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
            const obj: any = {};
            headers.forEach((h, idx) => {
              obj[h] = values[idx] || '';
            });
            return obj;
          });
          setJsonContent(JSON.stringify(records, null, 2));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setUploading(true);
      setResultMessage(null);

      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidents: parsed }),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: '✅ Bulk Upload Complete',
          message: `Indexed ${data.count} historical incidents into AI Solutions Knowledge Base.`,
          type: 'update',
        });
        setResultMessage(`Successfully indexed ${data.count} historical incident records into AI Knowledge Base!`);
      } else {
        alert(data.error || 'Failed to upload records');
      }
    } catch (e: any) {
      alert(`Invalid JSON format: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Settings</span>
        </Link>
      </div>

      <div className="glass-card p-6 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-xl text-purple-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Historical Data Repository Bulk Upload</h1>
            <p className="text-xs text-secondaryText">
              Upload historical CSV/JSON incident archives to train Source C of the AI Recommended Solutions Engine.
            </p>
          </div>
        </div>

        {/* File Drag and Drop / Choose File Section */}
        <div className="p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-2 text-xs">
          <span className="font-bold text-purple-300 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            Upload File (.json or .csv)
          </span>
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileUpload}
            className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
          />
        </div>

        {/* Input Box */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Edit / Review JSON Array of Historical Incidents
          </label>
          <textarea
            rows={12}
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 focus:outline-none focus:border-accent"
          />
        </div>

        {resultMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{resultMessage}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleBulkSubmit}
            disabled={uploading}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-accent hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>Index Historical Incidents into AI Engine</span>
          </button>
        </div>
      </div>
    </div>
  );
}
