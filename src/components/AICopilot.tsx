'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ShieldAlert,
  Globe,
  Terminal,
  Activity,
  Cpu,
  Radio,
  ExternalLink,
  Quote,
  Hash,
  MapPin,
  Phone,
  Info,
  ChevronRight,
  Zap,
  BrainCircuit,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

// ─── Inline Text Processor ────────────────────────────────────────────────────
// Parses a single line string and returns React nodes with bold, code, and link formatting.
const processInlineFormatting = (text: string, keyPrefix: string): React.ReactNode => {
  // Regex that captures: markdown links, inline code, bold
  const inlineRegex = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Markdown link [text](url)
      parts.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-500/40 hover:decoration-blue-400 transition-colors font-semibold"
        >
          {match[1]}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      );
    } else if (match[3] !== undefined) {
      // Inline code `code`
      parts.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className="px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-emerald-400 text-[12px] font-mono"
        >
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined) {
      // Bold **text**
      parts.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="text-white font-bold">
          {match[4]}
        </strong>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// ─── Rich Markdown Renderer ──────────────────────────────────────────────────
const renderFormattedMessage = (text: string) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Empty line → spacer ──────────────────────────────────────────────
    if (!trimmed) {
      elements.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // ── Horizontal rule --- ──────────────────────────────────────────────
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(
        <div key={i} className="my-3">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700/80 to-transparent" />
        </div>
      );
      i++;
      continue;
    }

    // ── Headers # ## ### ─────────────────────────────────────────────────
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = trimmed.replace(/^#+\s*/, '');
      const sizes = {
        1: 'text-[15px]',
        2: 'text-[14px]',
        3: 'text-[13px]',
      };
      const size = sizes[level as keyof typeof sizes] || 'text-[13px]';
      elements.push(
        <div key={i} className="mt-3 mb-2">
          <h4
            className={`${size} font-extrabold tracking-wide flex items-center gap-2 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent`}
          >
            <div className="flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
              <Hash className="w-3 h-3 text-blue-400" />
            </div>
            {content}
          </h4>
          <div className="mt-1.5 h-px bg-gradient-to-r from-blue-500/40 via-purple-500/30 to-transparent" />
        </div>
      );
      i++;
      continue;
    }

    // ── Blockquote > ─────────────────────────────────────────────────────
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      elements.push(
        <div
          key={`bq-${i}`}
          className="my-2.5 p-3 bg-gradient-to-r from-amber-500/[0.07] to-orange-500/[0.05] border border-amber-500/20 rounded-xl relative overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l-xl" />
          <div className="flex items-start gap-2.5 pl-2">
            <Quote className="w-4 h-4 text-amber-400/70 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {quoteLines.map((ql, qi) => (
                <p key={qi} className="text-[13px] text-amber-200/90 font-medium leading-relaxed italic">
                  {processInlineFormatting(ql, `bq-${i}-${qi}`)}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
      continue;
    }

    // ── Standalone link line [text](url) ─────────────────────────────────
    const fullLinkMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (fullLinkMatch) {
      elements.push(
        <div
          key={i}
          className="my-2.5 group"
        >
          <a
            href={fullLinkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-purple-500/[0.08] to-indigo-500/[0.08] hover:from-purple-500/[0.15] hover:to-indigo-500/[0.15] border border-purple-500/25 hover:border-purple-500/40 rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/[0.03] hover:shadow-purple-500/10"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/20 flex items-center justify-center">
                <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-purple-400/80 uppercase tracking-wider block">
                  Escalation Bridge
                </span>
                <span className="text-[13px] font-bold text-purple-200 group-hover:text-white transition-colors">
                  {fullLinkMatch[1]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500 rounded-lg text-white text-[11px] font-bold transition-colors shadow-lg shadow-purple-600/20">
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </a>
        </div>
      );
      i++;
      continue;
    }

    // ── Inline link within text ──────────────────────────────────────────
    const inlineLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    if (inlineLinkRegex.test(trimmed) && !fullLinkMatch) {
      elements.push(
        <p key={i} className="text-[13px] text-slate-300 font-medium leading-relaxed">
          {processInlineFormatting(trimmed, `il-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // ── Unordered list items - or * ──────────────────────────────────────
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: { raw: string; idx: number }[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        listItems.push({ raw: lines[i].trim().replace(/^[-*]\s+/, ''), idx: i });
        i++;
      }
      elements.push(
        <div key={`ul-${listItems[0].idx}`} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item) => (
            <div key={item.idx} className="flex items-start gap-2.5 group/li">
              <span className="mt-[7px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 shadow-sm shadow-blue-400/30 group-hover/li:shadow-blue-400/60 transition-shadow" />
              <p className="text-[13px] text-slate-300 font-medium leading-relaxed">
                {processInlineFormatting(item.raw, `ul-${item.idx}`)}
              </p>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // ── Ordered list 1. 2. 3. ────────────────────────────────────────────
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const listItems: { raw: string; num: string; idx: number }[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        const numMatch = lines[i].trim().match(/^(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          listItems.push({ raw: numMatch[2], num: numMatch[1], idx: i });
        }
        i++;
      }
      elements.push(
        <div key={`ol-${listItems[0].idx}`} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((item) => (
            <div key={item.idx} className="flex items-start gap-2.5">
              <span className="mt-[1px] flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-[11px] font-bold text-blue-400 flex items-center justify-center">
                {item.num}
              </span>
              <p className="text-[13px] text-slate-300 font-medium leading-relaxed pt-[1px]">
                {processInlineFormatting(item.raw, `ol-${item.idx}`)}
              </p>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // ── Default paragraph ────────────────────────────────────────────────
    elements.push(
      <p key={i} className="text-[13px] text-slate-300 font-medium leading-relaxed font-sans">
        {processInlineFormatting(trimmed, `p-${i}`)}
      </p>
    );
    i++;
  }

  return elements;
};

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator: React.FC = () => (
  <div className="flex gap-3 justify-start">
    {/* Bot avatar */}
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 border border-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-600/20">
      <BrainCircuit className="w-4 h-4 text-white" />
    </div>
    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-900/80 border border-slate-800/60 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400"
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: dot * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
        <span className="ml-2 text-[11px] text-slate-500 font-medium">Analyzing...</span>
      </div>
    </div>
  </div>
);

// ─── Suggestion Chip ──────────────────────────────────────────────────────────
const SuggestionChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  borderClass: string;
  onClick: () => void;
}> = ({ icon, label, colorClass, borderClass, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.04, y: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${colorClass} ${borderClass} text-[11px] font-semibold whitespace-nowrap transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md`}
  >
    {icon}
    <span>{label}</span>
  </motion.button>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const AICopilot: React.FC = () => {
  const { isCopilotOpen, setCopilotOpen } = useCimStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<'ONLINE' | 'THINKING' | 'SYNCED'>('ONLINE');
  const [activeIncidentNumbers, setActiveIncidentNumbers] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll to bottom ────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // ── Fetch active incidents for suggestion chips ──────────────────────
  const fetchActiveIncidentsForQuickSuggestions = async () => {
    try {
      const res = await fetch('/api/incidents?status=INVESTIGATING');
      const data = await res.json();
      if (data.success && data.incidents) {
        const numbers = data.incidents.map((inc: any) => inc.number);
        setActiveIncidentNumbers(numbers.slice(0, 3));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isCopilotOpen) {
      fetchActiveIncidentsForQuickSuggestions();
      // Focus input after panel animation
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isCopilotOpen]);

  // ── Welcome message ──────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          sender: 'bot',
          text: "### IT Command Copilot\n\nHello! 👋 I'm your operational AI Copilot. I have access to all incident databases, live ServiceNow feeds, timeline updates, and historical resolution archives.\n\n---\n\nAsk me anything naturally, such as:\n- **\"What is the current status of Chicago?\"**\n- **\"Summarize the timeline updates for incident INC0010001\"**\n- **\"Give me the Teams bridge link for incident INC0000060\"**\n\n> I'm connected and ready to assist with your critical incident operations.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setLoading(true);
    setCopilotStatus('THINKING');

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend }),
      });

      const data = await res.json();
      if (data.success && data.response) {
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
        setCopilotStatus('SYNCED');
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: '### System Error\n\nI encountered a network connection error while searching the incident database. Please check your connection and try again.\n\n> If this issue persists, contact the platform engineering team.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setCopilotStatus('ONLINE');
    } finally {
      setLoading(false);
      setTimeout(() => setCopilotStatus('ONLINE'), 2500);
    }
  };

  if (!isCopilotOpen) return null;

  // Status indicator colors
  const statusMeta = {
    ONLINE: { color: 'text-emerald-400', dot: 'bg-emerald-500', ping: 'bg-emerald-400', label: 'Connected' },
    THINKING: { color: 'text-amber-400', dot: 'bg-amber-500', ping: 'bg-amber-400', label: 'Processing' },
    SYNCED: { color: 'text-blue-400', dot: 'bg-blue-500', ping: 'bg-blue-400', label: 'Synced' },
  };
  const status = statusMeta[copilotStatus];

  return (
    <AnimatePresence>
      {/* Backdrop overlay */}
      <motion.div
        key="copilot-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setCopilotOpen(false)}
      />

      {/* Sliding Panel */}
      <motion.div
        key="copilot-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] flex flex-col bg-slate-950/95 backdrop-blur-xl border-l border-slate-800/80 shadow-2xl shadow-black/40"
      >
        {/* ── Ambient glow accents ──────────────────────────────────── */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/[0.06] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* ══════════════════════════════════════════════════════════════
            HEADER
           ══════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 px-5 py-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900/80 to-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* AI Icon */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/25">
                  <BrainCircuit className="w-5 h-5 text-white" />
                </div>
                {/* Live dot */}
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.ping} opacity-60`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${status.dot} ring-2 ring-slate-950`} />
                </span>
              </div>

              <div>
                <h3 className="text-[14px] font-bold text-white tracking-wide flex items-center gap-2">
                  AI Copilot
                  <span className={`text-[10px] font-semibold ${status.color} bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50`}>
                    {status.label}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-indigo-400" />
                  <span>AI Engine • Incident Intelligence</span>
                </p>
              </div>
            </div>

            {/* Close button */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCopilotOpen(false)}
              className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:border-red-500/40 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SUGGESTION CHIPS
           ══════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 px-4 py-3 border-b border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0 mr-1">
              Quick
            </span>

            {activeIncidentNumbers.map((num) => (
              <SuggestionChip
                key={num}
                icon={<Info className="w-3 h-3" />}
                label={num}
                colorClass="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                borderClass="border border-blue-500/25 hover:border-blue-400/40"
                onClick={() => handleSendMessage(`What is the current update on incident ${num}?`)}
              />
            ))}

            <SuggestionChip
              icon={<Zap className="w-3 h-3" />}
              label="ServiceNow INC0000060"
              colorClass="bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              borderClass="border border-emerald-500/25 hover:border-emerald-400/40"
              onClick={() => handleSendMessage('Check incident INC0000060 in ServiceNow directly via MCP')}
            />

            <SuggestionChip
              icon={<Activity className="w-3 h-3" />}
              label="ServiceNow Changes"
              colorClass="bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
              borderClass="border border-cyan-500/25 hover:border-cyan-400/40"
              onClick={() => handleSendMessage('What are the recent change requests in ServiceNow?')}
            />

            <SuggestionChip
              icon={<MapPin className="w-3 h-3" />}
              label="Victorville"
              colorClass="bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              borderClass="border border-amber-500/25 hover:border-amber-400/40"
              onClick={() => handleSendMessage('Please give me the incident numbers of Victorville?')}
            />

            <SuggestionChip
              icon={<Phone className="w-3 h-3" />}
              label="Live Bridge"
              colorClass="bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
              borderClass="border border-purple-500/25 hover:border-purple-400/40"
              onClick={() => handleSendMessage('Join command bridge')}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            MESSAGES AREA
           ══════════════════════════════════════════════════════════════ */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative z-10 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Bot avatar */}
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-purple-600/20">
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] relative ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-accent to-blue-700 border border-blue-500/30 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-blue-600/15 px-4 py-3'
                      : 'bg-slate-900/70 backdrop-blur-sm border border-slate-800/70 text-slate-200 rounded-2xl rounded-tl-sm shadow-xl px-4 py-3'
                  }`}
                >
                  {/* Gradient left accent for bot messages */}
                  {msg.sender === 'bot' && (
                    <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 opacity-60" />
                  )}

                  <div className={`space-y-1 font-sans leading-relaxed ${msg.sender === 'bot' ? 'pl-1.5' : ''}`}>
                    {msg.sender === 'bot' ? renderFormattedMessage(msg.text) : (
                      <p className="text-[13px] font-medium leading-relaxed">{msg.text}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className={`flex items-center gap-1.5 mt-2 pt-1.5 border-t ${
                    msg.sender === 'user' ? 'border-white/10 justify-end' : 'border-slate-800/50 justify-start pl-1.5'
                  }`}>
                    <span className={`text-[10px] font-medium ${
                      msg.sender === 'user' ? 'text-blue-200/60' : 'text-slate-500'
                    }`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>

                {/* User avatar */}
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-blue-700 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-blue-600/15">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading: typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            INPUT AREA
           ══════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 p-4 border-t border-slate-800/80 bg-gradient-to-t from-slate-950 to-slate-950/80 backdrop-blur-sm">
          <div className="flex gap-2.5">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about incidents, timelines, bridges..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-slate-900/80 border border-slate-700/60 hover:border-slate-600/60 focus:border-indigo-500/60 rounded-xl px-4 py-3 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 font-sans backdrop-blur-sm"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSendMessage()}
              disabled={loading || !inputQuery.trim()}
              className="px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <Send className="w-[18px] h-[18px]" />
            </motion.button>
          </div>

          {/* Footer branding */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Sparkles className="w-3 h-3 text-slate-600" />
            <p className="text-[10px] text-slate-600 font-medium">
              Powered by Generative AI
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
