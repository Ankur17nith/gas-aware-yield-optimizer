import React, { useMemo, useState } from 'react';
import { api } from '../services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  selectedChain: string;
}

const QUICK_QUESTIONS = [
  'What is net APY in simple words?',
  'Should I migrate now or hold?',
  'How does gas affect my return?',
  'What does risk level mean?',
];

export default function BeginnerChatWidget({ selectedChain }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I am your Yield Assistant. Ask me beginner DeFi questions and I will explain in simple language.',
    },
  ]);

  const canSend = input.trim().length > 0 && !sending;

  const contextText = useMemo(() => {
    return 'This user is on the YieldOptimizer dashboard and may be new to DeFi.';
  }, []);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const result = await api.chatWithAssistant(text, selectedChain, contextText);
      const reply: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: result.reply || 'I could not generate a response right now. Please try again.',
      };
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      const reply: ChatMessage = {
        id: `${Date.now()}-e`,
        role: 'assistant',
        text: err?.message || 'Network issue. Please try again.',
      };
      setMessages((prev) => [...prev, reply]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <section style={S.panel} aria-label="Beginner DeFi Assistant">
          <div style={S.head}>
            <div>
              <div style={S.title}>Beginner DeFi Assistant</div>
              <div style={S.sub}>Powered by Gemini</div>
            </div>
            <button style={S.iconBtn} onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </div>

          <div style={S.quickRow}>
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} style={S.quickBtn} onClick={() => sendMessage(q)} disabled={sending}>
                {q}
              </button>
            ))}
          </div>

          <div style={S.messages}>
            {messages.map((m) => (
              <div key={m.id} style={m.role === 'assistant' ? S.assistantBubble : S.userBubble}>
                {m.text}
              </div>
            ))}
            {sending && <div style={S.assistantBubble}>Thinking...</div>}
          </div>

          <form
            style={S.inputRow}
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              style={S.input}
              placeholder="Ask anything in simple words..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button style={S.sendBtn} type="submit" disabled={!canSend}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        style={S.fab}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? 'Close Assistant' : 'Ask AI Assistant'}
      </button>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    zIndex: 250,
    background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(14, 165, 233, 0.35)',
  },
  panel: {
    position: 'fixed',
    right: 20,
    bottom: 74,
    width: 'min(360px, calc(100vw - 24px))',
    maxHeight: '72vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    zIndex: 249,
    boxShadow: '0 16px 40px rgba(2, 8, 23, 0.28)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: 'var(--text-1)',
    fontSize: 14,
    fontWeight: 700,
  },
  sub: {
    color: 'var(--text-3)',
    fontSize: 11,
  },
  iconBtn: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    borderRadius: 8,
    width: 28,
    height: 28,
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: '24px',
  },
  quickRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickBtn: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    borderRadius: 999,
    fontSize: 11,
    padding: '6px 8px',
    cursor: 'pointer',
  },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
    padding: '6px 2px',
    minHeight: 180,
    maxHeight: '45vh',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: 'rgba(14, 165, 233, 0.15)',
    border: '1px solid rgba(14, 165, 233, 0.35)',
    color: 'var(--text-1)',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
  },
  input: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-1)',
    borderRadius: 10,
    padding: '10px 11px',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  sendBtn: {
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    borderRadius: 10,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
