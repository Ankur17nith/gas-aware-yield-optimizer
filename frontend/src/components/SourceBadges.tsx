import React from 'react';

interface Props {
  sources: Record<string, string>;
}

export default function SourceBadges({ sources }: Props) {
  const entries = Object.entries(sources);
  if (!entries.length) return null;

  return (
    <div style={styles.wrap}>
      {entries.map(([label, source]) => (
        <span key={label} style={styles.badge}>
          <span style={styles.label}>{label}</span>
          <span style={styles.source}>{source}</span>
        </span>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-3)',
    fontWeight: 700,
  },
  source: {
    color: 'var(--primary)',
    fontWeight: 700,
  },
};
