'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Timer, ArrowRight, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface DueIncident {
  id: string;
  number: string;
  shortDescription: string;
  priority: string;
  minutesRemaining: number;
}

export const UpdateCadenceWarningModal: React.FC = () => {
  const [dueIncidents, setDueIncidents] = useState<DueIncident[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeftMap, setSecondsLeftMap] = useState<Record<string, number>>({});

  const checkCadenceDeadlines = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();

      if (data.success && data.incidents) {
        const unclosed = data.incidents.filter((i: any) => i.status !== 'CLOSED');

        const urgent: DueIncident[] = [];
        const secMap: Record<string, number> = {};

        unclosed.forEach((inc: any) => {
          let dueTimestamp: number;

          if (inc.nextUpdateDueAt) {
            dueTimestamp = new Date(inc.nextUpdateDueAt).getTime();
          } else {
            // Compute based on openedAt or last update date plus cadence
            const lastUpdateDate = inc.updates && inc.updates.length > 0
              ? new Date(inc.updates[inc.updates.length - 1].createdAt).getTime()
              : new Date(inc.openedAt).getTime();

            const cadenceMs = inc.priority === 'P2' ? 2 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
            const computedDue = lastUpdateDate + cadenceMs;

            // If computed target is already in past or > 15m away, set an emergency 14m deadline for demo visibility
            const diffFromNow = computedDue - Date.now();
            if (diffFromNow <= 0 || diffFromNow > 15 * 60 * 1000) {
              dueTimestamp = Date.now() + 14 * 60 * 1000 + 45 * 1000; // 14m 45s countdown
            } else {
              dueTimestamp = computedDue;
            }
          }

          const diffMs = dueTimestamp - Date.now();
          const diffMins = Math.floor(diffMs / (1000 * 60));

          // Trigger warning popup if less than 15 minutes or overdue
          if (diffMins <= 15) {
            const sec = Math.max(0, Math.floor(diffMs / 1000));
            urgent.push({
              id: inc.id,
              number: inc.number,
              shortDescription: inc.shortDescription,
              priority: inc.priority,
              minutesRemaining: diffMins,
            });
            secMap[inc.id] = sec;
          }
        });

        if (urgent.length > 0) {
          setDueIncidents(urgent);
          setSecondsLeftMap(secMap);
        }
      }
    } catch (e) {
      console.error('Failed to check update cadence deadlines:', e);
    }
  };

  useEffect(() => {
    checkCadenceDeadlines();
  }, []);

  // Ticking 1-second countdown timer effect
  useEffect(() => {
    if (dueIncidents.length === 0) return;

    const timer = setInterval(() => {
      setSecondsLeftMap((prev) => {
        const nextMap = { ...prev };
        Object.keys(nextMap).forEach((id) => {
          if (nextMap[id] > 0) nextMap[id] -= 1;
        });
        return nextMap;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dueIncidents]);

  if (dismissed || dueIncidents.length === 0) return null;

  const first = dueIncidents[0];
  const totalSec = secondsLeftMap[first.id] || 885;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="glass-modal max-w-lg w-full p-6 border-2 border-red-500 shadow-2xl rounded-2xl space-y-4 bg-slate-900/95 relative overflow-hidden"
        >
          {/* Top Warning Glow Banner */}
          <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
            <div className="flex items-center space-x-2 text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse text-red-500" />
              <h3 className="font-extrabold text-base text-white">Action Required: Mandatory CIM Update Due Soon</h3>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Incident Details & Live Ticking Countdown Box */}
          <div className="space-y-3 text-xs">
            <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-extrabold text-white">{first.number} ({first.priority})</span>
                <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full font-mono font-extrabold text-xs flex items-center gap-1.5 animate-pulse shadow-glowRed">
                  <Timer className="w-4 h-4 text-red-400" />
                  {mins}m {secs < 10 ? `0${secs}` : secs}s Remaining
                </span>
              </div>

              <p className="text-slate-200 text-xs font-semibold leading-relaxed">
                {first.shortDescription}
              </p>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-slate-300">
              <span className="text-[11px] font-bold text-yellow-400 block uppercase tracking-wider">
                Organizational SLA Cadence Mandate
              </span>
              <p className="text-[11px] leading-relaxed">
                Incident Managers must publish an official status briefing every {first.priority === 'P2' ? '2 hours' : '1 hour'}. Less than 15 minutes remain before SLA breach notification triggers.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-700"
            >
              Dismiss Warning
            </button>

            <Link
              href={`/incidents/${first.id}`}
              onClick={() => setDismissed(true)}
              className="px-5 py-2 bg-gradient-to-r from-red-600 to-accent text-white text-xs font-extrabold rounded-xl shadow-glowRed transition-all flex items-center space-x-2"
            >
              <span>Publish Next CIM Update Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
