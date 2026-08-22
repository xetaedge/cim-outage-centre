'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Radio,
} from 'lucide-react';

interface KpiData {
  activeP1: number;
  activeP2: number;
  resolvedToday: number;
  averageMttr: string;
  affectedSitesCount: number;
  activeTeamsBridges: number;
}

interface KpiCardsProps {
  data: KpiData;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ data }) => {
  const cards = [
    {
      title: 'Active P1 Critical',
      value: data.activeP1,
      subtext: 'High Severity Escalation',
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      glow: 'shadow-glowRed',
      badge: 'P1 CRITICAL',
      badgeBg: 'bg-red-500/20 text-red-400',
    },
    {
      title: 'Active P2 Major',
      value: data.activeP2,
      subtext: 'Degraded Performance',
      icon: AlertCircle,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      glow: 'hover:shadow-[0_0_20px_rgba(251,146,60,0.3)]',
      badge: 'P2 MAJOR',
      badgeBg: 'bg-orange-500/20 text-orange-400',
    },
    {
      title: 'Resolved Today',
      value: data.resolvedToday,
      subtext: 'Normalized Telemetry',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      glow: 'shadow-glowGreen',
      badge: 'RESTORED',
      badgeBg: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      title: 'Average MTTR',
      value: data.averageMttr,
      subtext: 'Mean Time to Resolution',
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      glow: 'shadow-glowBlue',
      badge: 'SLA MET',
      badgeBg: 'bg-blue-500/20 text-blue-400',
    },
    {
      title: 'Affected Sites',
      value: data.affectedSitesCount,
      subtext: 'Global Outage Footprint',
      icon: Globe,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      glow: 'hover:shadow-[0_0_20px_rgba(250,204,21,0.3)]',
      badge: 'SITES',
      badgeBg: 'bg-yellow-500/20 text-yellow-400',
    },
    {
      title: 'Active Teams Bridges',
      value: data.activeTeamsBridges,
      subtext: 'Live Command Bridges',
      icon: Radio,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      glow: 'hover:shadow-[0_0_20px_rgba(192,132,252,0.3)]',
      badge: 'LIVE BRIDGES',
      badgeBg: 'bg-purple-500/20 text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`glass-card p-4 flex flex-col justify-between border ${card.border} ${card.glow} transition-all duration-300 relative overflow-hidden group`}
          >
            {/* Background subtle gradient glow */}
            <div
              className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${card.bg} blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none`}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${card.badgeBg}`}>
                  {card.badge}
                </span>
                <div className={`p-2 rounded-xl ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <h3 className="text-xs font-semibold text-secondaryText uppercase tracking-wider">
                {card.title}
              </h3>
            </div>

            <div className="mt-3">
              <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1">
                <span>{card.value}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{card.subtext}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
