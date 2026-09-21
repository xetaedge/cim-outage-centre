'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Radio,
  Sparkles,
  MapPin,
  MessageSquareText,
  Archive,
  Loader2,
  Users,
  Building,
  Timer,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

export interface SiteRelation {
  site: {
    id: string;
    name: string;
    city: string;
    country: string;
  };
}

export interface TimelineUpdate {
  id: string;
  updateNumber: number;
  comment: string;
  authorName: string;
  createdAt: string;
  isFinal?: boolean;
  additionalInfo?: string;
}

export interface IncidentData {
  id: string;
  number: string;
  shortDescription: string;
  description?: string;
  priority: string;
  status: string;
  openedAt: string;
  closedAt?: string;
  resolvedAt?: string;
  nextUpdateDueAt?: string;
  assignmentGroup: string;
  assignmentGroupEmail?: string;
  assignedTo?: string;
  cmdbCi?: string;
  businessService?: string;
  cti?: string;
  issueSummary?: string;
  teamsBridgeLink?: string;
  ettrMinutes: number;
  aiRootCause?: string;
  aiBusinessImpact?: string;
  aiTechnicalSummary?: string;
  aiExecutiveSummary?: string;
  aiCurrentStatusSummary?: string;
  aiDoneSoFar?: string;
  aiWhatIsAwaited?: string;
  totalOutageDuration?: string;
  relatedIncidents?: string;
  teamsInvolved?: string;
  partnerLead?: string;
  cdItCoordinator?: string;
  stakeholdersInformed?: string;
  sites?: SiteRelation[];
  updates?: TimelineUpdate[];
}

interface IncidentCardProps {
  incident: IncidentData;
  onOpenUpdates: (incident: IncidentData) => void;
  onIncidentUpdated: () => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onOpenUpdates,
  onIncidentUpdated,
}) => {
  const { currentRole, addToast } = useCimStore();
  const [closing, setClosing] = useState(false);
  const [statusValue, setStatusValue] = useState(incident.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isP1 = incident.priority === 'P1';
  const isClosed = incident.status === 'CLOSED';

  const getTags = () => {
    if (!incident.cti) return [];
    return incident.cti.split('/').map((t) => t.trim()).filter(Boolean);
  };

  const getNextUpdateText = () => {
    if (isClosed) return 'Resolved';
    if (incident.nextUpdateDueAt) {
      const due = new Date(incident.nextUpdateDueAt);
      const diffMins = Math.max(1, Math.floor((due.getTime() - Date.now()) / (1000 * 60)));
      return `Expected in ~${diffMins}m (${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
    const cadenceMins = isP1 ? 60 : 120;
    return `Expected every ${isP1 ? '1 hr' : '2 hrs'}`;
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusValue(newStatus);
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
          title: `🔄 Incident ${incident.number} Status: ${newStatus}`,
          message: newStatus === 'CLOSED' ? 'Moved to Archive section.' : 'Status updated.',
          type: newStatus === 'CLOSED' ? 'closed' : 'update',
        });
        onIncidentUpdated();
      }
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div
      className={`glass-card p-5 border rounded-2xl flex flex-col justify-between space-y-4 transition-all duration-300 hover:shadow-2xl relative overflow-hidden ${
        isP1 ? 'border-red-500/40 hover:border-red-500/80' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Banner Accent Line */}
      <div
        className={`h-1.5 absolute top-0 left-0 right-0 ${
          isClosed ? 'bg-purple-600' : isP1 ? 'bg-red-500 shadow-glowRed' : 'bg-orange-500'
        }`}
      />

      <div className="space-y-3 pt-1">
        {/* Header Badges & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-full border ${
                isP1
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-glowRed animate-pulse'
                  : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
              }`}
            >
              {incident.priority} CRITICAL
            </span>

            {/* Status Change Selector */}
            {currentRole !== 'GUEST' ? (
              <select
                value={statusValue}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="bg-slate-900 border border-slate-700 text-white font-bold text-[10px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="IDENTIFIED">IDENTIFIED</option>
                <option value="MONITORING">MONITORING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED (Archive)</option>
              </select>
            ) : (
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  isClosed
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                {incident.status}
              </span>
            )}

            {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
          </div>

          <span className="font-mono text-xs font-extrabold text-white tracking-wider">
            {incident.number}
          </span>
        </div>

        {/* Guest Visible Next CIM Status Update Timing Badge */}
        <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-yellow-400" />
            Next CIM Briefing:
          </span>
          <span className="font-mono font-bold text-yellow-300">{getNextUpdateText()}</span>
        </div>

        {/* Short Description */}
        <Link href={`/incidents/${incident.id}`} className="block group">
          <h3 className="text-sm font-bold text-white group-hover:text-accent transition-colors line-clamp-2 leading-snug">
            {incident.shortDescription}
          </h3>
        </Link>

        {/* Dynamic CTI / ServiceNow Tags */}
        {(incident.cti || incident.cmdbCi) && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {getTags().map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md uppercase tracking-wider"
              >
                🏷️ {tag}
              </span>
            ))}
            {incident.cmdbCi && incident.cmdbCi !== '-' && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md uppercase tracking-wider animate-pulse">
                ⚙️ {incident.cmdbCi}
              </span>
            )}
          </div>
        )}

        {/* Cumulative Short AI Summary Box */}
        <div className="bg-blue-950/40 p-3 rounded-xl border border-blue-900/60 space-y-1">
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
            <span>Cumulative AI Status Summary</span>
          </div>
          <p className="text-[11px] text-slate-200 leading-relaxed italic line-clamp-2">
            "{incident.aiCurrentStatusSummary || incident.issueSummary}"
          </p>
        </div>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Assignment Group</span>
            <p className="font-medium text-white truncate">{incident.assignmentGroup}</p>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Assigned To</span>
            <p className="font-medium text-white truncate">{incident.assignedTo || 'Unassigned'}</p>
          </div>
        </div>

        {/* Impacted Locations Tags */}
        <div className="flex items-center space-x-1 text-[11px] text-slate-400 overflow-x-auto">
          <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="font-semibold text-slate-300">Locations:</span>
          {incident.sites && incident.sites.length > 0 ? (
            incident.sites.map((s) => (
              <span
                key={s.site.id}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/20 rounded"
              >
                {s.site.name}
              </span>
            ))
          ) : (
            <span className="text-slate-500 italic">No locations tagged</span>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenUpdates(incident)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1.5"
        >
          <MessageSquareText className="w-3.5 h-3.5 text-blue-400" />
          <span>Updates ({incident.updates?.length || 0})</span>
        </button>

        <div className="flex items-center space-x-2">
          {currentRole !== 'GUEST' && (
            <a
              href={incident.teamsBridgeLink || 'https://teams.microsoft.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl transition-all"
              title="Join Microsoft Teams Bridge"
            >
              <Radio className="w-4 h-4 animate-pulse" />
            </a>
          )}

          <Link
            href={`/incidents/${incident.id}`}
            className="px-3 py-1.5 bg-accent hover:bg-accentHover text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all"
          >
            Details & Solutions
          </Link>
        </div>
      </div>
    </div>
  );
};
