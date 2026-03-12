import React from 'react';

const ICONS: Record<string, { svg: string; color: string }> = {
  'Aave V3': { color: '#B6509E', svg: 'M16 3L4 28h5l2.4-5h9.2L23 28h5L16 3zm0 9l3.2 7h-6.4L16 12z' },
  'Aave': { color: '#B6509E', svg: 'M16 3L4 28h5l2.4-5h9.2L23 28h5L16 3zm0 9l3.2 7h-6.4L16 12z' },
  'Compound V3': { color: '#00D395', svg: 'M16 2a14 14 0 100 28 14 14 0 000-28zm5 19.6c-1.4 1-3.2 1.6-5 1.6-4.8 0-8.7-3.9-8.7-8.7 0-3.2 1.8-6.2 4.6-7.7l1.1 2c-2 1.1-3.3 3.2-3.3 5.5 0 3.5 2.8 6.3 6.3 6.3 1.3 0 2.5-.4 3.5-1l1.5 2z' },
  'Compound': { color: '#00D395', svg: 'M16 2a14 14 0 100 28 14 14 0 000-28zm5 19.6c-1.4 1-3.2 1.6-5 1.6-4.8 0-8.7-3.9-8.7-8.7 0-3.2 1.8-6.2 4.6-7.7l1.1 2c-2 1.1-3.3 3.2-3.3 5.5 0 3.5 2.8 6.3 6.3 6.3 1.3 0 2.5-.4 3.5-1l1.5 2z' },
  'Curve': { color: '#FF0000', svg: 'M4 20c2-6 6-12 12-14s10 2 10 8-4 10-10 12S4 26 4 20z' },
  'Yearn': { color: '#006AE3', svg: 'M16 2L8 14h5v10h6V14h5L16 2z' },
  'Spark': { color: '#F7A600', svg: 'M18 2l-8 14h6v14l8-14h-6V2z' },
  'Morpho Aave': { color: '#0F62FE', svg: 'M16 4l-12 24h8l4-8 4 8h8L16 4zm0 8l3 6h-6l3-6z' },
};

interface Props {
  protocol: string;
  size?: number;
}

export default function ProtocolIcon({ protocol, size = 20 }: Props) {
  const icon = ICONS[protocol];
  if (!icon) {
    return (
      <span style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--border)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 700, color: 'var(--text-2)',
        flexShrink: 0,
      }}>
        {protocol.charAt(0)}
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="16" r="16" fill={icon.color} opacity={0.12} />
      <path d={icon.svg} fill={icon.color} />
    </svg>
  );
}
