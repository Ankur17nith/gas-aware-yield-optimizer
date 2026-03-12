import React from 'react';

interface Props {
  score: number; // 0-100
  size?: 'sm' | 'md';
}

function getLevel(score: number) {
  if (score >= 80) return { label: 'Low Risk', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' };
  if (score >= 50) return { label: 'Medium', color: '#EAB308', bg: 'rgba(234,179,8,0.12)' };
  return { label: 'High Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
}

export default function RiskBadge({ score, size = 'sm' }: Props) {
  const level = getLevel(score);
  const pad = size === 'md' ? '4px 10px' : '2px 8px';
  const fs = size === 'md' ? 12 : 11;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: pad,
        borderRadius: 6,
        fontSize: fs,
        fontWeight: 600,
        background: level.bg,
        color: level.color,
        whiteSpace: 'nowrap',
      }}
      title={`Trust score: ${score}/100`}
    >
      {level.label}
    </span>
  );
}
