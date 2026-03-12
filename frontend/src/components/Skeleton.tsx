import React from 'react';

interface Props {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}

export default function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  return (
    <div
      className="skeleton"
      style={{
        width, height, borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24,
    }}>
      <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
      <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24,
    }}>
      <Skeleton width="30%" height={14} style={{ marginBottom: 24 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Skeleton width={32} height={32} radius={16} />
          <Skeleton width="25%" height={16} />
          <Skeleton width="15%" height={16} />
          <Skeleton width="15%" height={16} />
          <Skeleton width="20%" height={16} />
        </div>
      ))}
    </div>
  );
}
