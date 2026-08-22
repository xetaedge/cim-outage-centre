'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Radio, CheckCircle, RefreshCw } from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

export const NotificationToastContainer: React.FC = () => {
  const { toasts, removeToast } = useCimStore();

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2.5 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="pointer-events-auto glass-card p-3.5 border border-slate-700/80 shadow-2xl rounded-xl flex items-start space-x-3 relative overflow-hidden"
          >
            {/* Left Status Bar Indicator */}
            <div
              className={`w-1 absolute left-0 top-0 bottom-0 ${
                toast.type === 'p1'
                  ? 'bg-red-500'
                  : toast.type === 'error'
                  ? 'bg-red-400'
                  : toast.type === 'bridge'
                  ? 'bg-purple-500'
                  : toast.type === 'recovery'
                  ? 'bg-yellow-500'
                  : toast.type === 'closed'
                  ? 'bg-emerald-500'
                  : 'bg-accent'
              }`}
            />

            <div className="pl-1 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  {toast.title}
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">{toast.time}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-snug">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
