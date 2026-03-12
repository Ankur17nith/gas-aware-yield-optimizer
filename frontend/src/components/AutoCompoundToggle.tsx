import React from 'react';

interface Props {
  enabled: boolean;
  onToggle: () => void;
}

export default function AutoCompoundToggle({ enabled, onToggle }: Props) {
  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <div>
          <h4 style={styles.title}>🔄 Auto-Compound</h4>
          <p style={styles.desc}>
            Automatically reinvest yield earnings to maximize returns via compounding
          </p>
        </div>
        <button
          style={enabled ? styles.toggleOn : styles.toggleOff}
          onClick={onToggle}
        >
          <span
            style={{
              ...styles.dot,
              transform: enabled ? 'translateX(18px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>
      {enabled && (
        <div style={styles.info}>
          <span style={styles.infoIcon}>✓</span>
          Auto-compound is active. Yields will be reinvested daily.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: { margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' },
  desc: { margin: 0, fontSize: 12, color: 'var(--text-3)' },
  toggleOn: {
    width: 44,
    height: 26,
    borderRadius: 13,
    background: 'var(--primary)',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 3,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleOff: {
    width: 44,
    height: 26,
    borderRadius: 13,
    background: 'var(--border)',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 3,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  dot: {
    display: 'block',
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s ease',
  },
  info: {
    marginTop: 10,
    padding: '8px 12px',
    background: 'rgba(91,140,255,0.08)',
    border: '1px solid rgba(91,140,255,0.2)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  infoIcon: { color: 'var(--success)', fontWeight: 700 },
};
