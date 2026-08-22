import './globals.css';
import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { NotificationToastContainer } from '@/components/NotificationToast';
import { FetchIncidentModal } from '@/components/FetchIncidentModal';
import { AICopilot } from '@/components/AICopilot';
import { UpdateCadenceWarningModal } from '@/components/UpdateCadenceWarningModal';

export const metadata: Metadata = {
  title: 'Critical Incident Management Portal | Executive Command Center',
  description: 'Real-Time Enterprise IT Outage & Major Incident Operations Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Header />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
          {children}
        </main>

        <footer className="border-t border-slate-800/80 bg-slate-900/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-slate-400">Enterprise CIM Command Center v2.4 (Live ServiceNow Connected)</span>
            </div>
            <span>Powered by Next.js & OpenAI Generative Intelligence</span>
          </div>
        </footer>

        <FetchIncidentModal />
        <AICopilot />
        <UpdateCadenceWarningModal />
        <NotificationToastContainer />
      </body>
    </html>
  );
}
