import React from 'react';
import type { Pool } from '../types/pool';
import { formatCompact, formatAPY } from '../utils/format';

interface Props {
  pools: Pool[];
}

export default function LiveStatsBanner({ pools }: Props) {
  if (pools.length === 0) return null;

  const totalTVL = pools.reduce((s, p) => s + (p.tvl ?? 0), 0);
  const bestAPY = Math.max(...pools.map((p) => p.net_apy ?? p.apy ?? 0));
  const protocolCount = new Set(pools.map((p) => p.protocol)).size;
  const tokenCount = new Set(pools.map((p) => p.token)).size;

  const items = [
    { label: 'Total TVL', value: formatCompact(totalTVL) },
    { label: 'Best APY', value: formatAPY(bestAPY) },
    { label: 'Protocols', value: String(protocolCount) },
    { label: 'Tokens', value: String(tokenCount) },
  ];

  return (
    <div style={styles.banner}>
      <div style={styles.inner}>
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <span style={styles.sep}>|</span>}
            <span style={styles.item}>
              <span style={styles.label}>{item.label}:</span>{' '}
              <span style={styles.val}>{item.value}</span>
            </span>
          </React.Fragment>
        ))}
        <span style={styles.live}>● LIVE</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '6px 24px',
    overflow: 'hidden',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  item: { fontSize: 12, color: 'var(--text-2)' },
  label: { fontWeight: 500 },
  val: { fontWeight: 700, color: 'var(--text-1)' },
  sep: { color: 'var(--border)', fontSize: 12 },
  live: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--success)',
    letterSpacing: '0.06em',
  },
};
