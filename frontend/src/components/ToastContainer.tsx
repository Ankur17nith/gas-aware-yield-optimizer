import React from 'react';
import { useToast } from '../context/ToastContext';

const typeColors: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', border: '#22C55E', icon: '✓' },
  error: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', icon: '✗' },
  warning: { bg: 'rgba(234,179,8,0.12)', border: '#EAB308', icon: '⚠' },
  info: { bg: 'rgba(79,70,229,0.12)', border: '#4F46E5', icon: 'ℹ' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map((t) => {
        const c = typeColors[t.type] || typeColors.info;
        return (
          <div
            key={t.id}
            style={{ ...styles.toast, background: c.bg, borderColor: c.border }}
          >
            <span style={{ ...styles.icon, color: c.border }}>{c.icon}</span>
            <span style={styles.msg}>{t.message}</span>
            <button style={styles.close} onClick={() => removeToast(t.id)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 360,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    animation: 'slideUp 0.2s ease',
    backdropFilter: 'blur(8px)',
  },
  icon: { fontSize: 16, fontWeight: 700 },
  msg: { flex: 1, fontSize: 13, color: 'var(--text-1)', fontWeight: 500 },
  close: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    cursor: 'pointer',
    fontSize: 13,
    padding: 2,
    fontFamily: 'inherit',
  },
};
