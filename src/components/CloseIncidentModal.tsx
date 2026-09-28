'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

interface ClosureTagItem {
  id: string;
  name: string;
  color: string;
  description?: string;
  active: boolean;
}

interface CloseIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  incidentNumber: string;
  currentStatus?: string;
  initialTags?: string;
  initialNotes?: string;
  onSuccess: (updatedIncident: any) => void;
}

export default function CloseIncidentModal({
  isOpen,
  onClose,
  incidentId,
  incidentNumber,
  currentStatus,
  initialTags = '',
  initialNotes = '',
  onSuccess,
}: CloseIncidentModalProps) {
  const { addToast } = useCimStore();

  const [availableTags, setAvailableTags] = useState<ClosureTagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Fetch available closure tags
  useEffect(() => {
    if (!isOpen) return;

    // Initialize with existing tags
    if (initialTags) {
      const parsed = initialTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      setSelectedTags(parsed);
    } else {
      setSelectedTags([]);
    }

    setCloseNotes(initialNotes || '');
    setValidationError('');

    const fetchTags = async () => {
      setLoadingTags(true);
      try {
        const res = await fetch('/api/admin/closure-tags');
        const data = await res.json();
        if (data.success && Array.isArray(data.tags)) {
          // Show active tags
          setAvailableTags(data.tags.filter((t: ClosureTagItem) => t.active));
        }
      } catch (err) {
        console.error('Failed to load closure tags:', err);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, [isOpen, initialTags, initialNotes]);

  if (!isOpen) return null;

  const toggleTag = (tagName: string) => {
    setValidationError('');
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleConfirmClose = async () => {
    if (selectedTags.length === 0) {
      setValidationError('Please select at least one Issue Category Tag to close and categorize this incident.');
      return;
    }

    setSubmitting(true);
    setValidationError('');

    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          closeTags: selectedTags.join(', '),
          closeNotes: closeNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: `🔒 Incident ${incidentNumber} Closed & Categorized`,
          message: `Tagged with: ${selectedTags.join(', ')}`,
          type: 'closed',
        });
        onSuccess(data.incident);
        onClose();
      } else {
        setValidationError(data.error || 'Failed to close incident');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Network error while closing incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Accent Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Close & Categorize Incident</span>
                <span className="text-xs px-2 py-0.5 font-bold bg-slate-800 text-purple-300 border border-purple-500/30 rounded-md">
                  {incidentNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign root cause issue tags for accurate executive analytics and post-incident reporting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Validation Warning */}
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300 animate-in slide-in-from-top-1">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Issue Category Tags */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Issue Category Tags (Required)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {selectedTags.length} selected
              </span>
            </div>

            {loadingTags ? (
              <div className="flex items-center justify-center p-8 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
                <span className="text-xs text-slate-400">Loading managed closure tags...</span>
              </div>
            ) : availableTags.length === 0 ? (
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400">No active closure tags configured in Admin Settings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  const tagColor = tag.color || '#3b82f6';

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                        isSelected
                          ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/10 scale-[1.01]'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${tagColor}15` : undefined,
                        borderColor: isSelected ? tagColor : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tagColor }}
                          />
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? 'text-white' : 'text-slate-200'
                            }`}
                          >
                            {tag.name}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 shrink-0"
                            style={{ color: tagColor }}
                          />
                        )}
                      </div>
                      {tag.description && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 group-hover:text-slate-300">
                          {tag.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Optional Resolution & Close Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Resolution / Close Notes (Optional)</span>
            </label>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="e.g. Physical fiber link spliced by telco provider. Redundant route verified healthy. All microservices recovered."
              rows={3}
              className="w-full p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Helpful context */}
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Tags selected here are used by executive reports to categorize outages by issue type (e.g., Fiber Cut, Power Issue, CDM Issue) and track operational trends.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmClose}
            disabled={submitting || selectedTags.length === 0}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Closing Incident...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Closure & Save Tags</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
