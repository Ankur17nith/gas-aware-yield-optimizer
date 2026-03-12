import React from 'react';
import type { Pool } from '../types/pool';
import { formatUSD, formatAPY, formatCompact } from '../utils/format';

interface Props {
  pools: Pool[];
  depositAmount: number;
  connected: boolean;
}

export default function PortfolioOverview({ pools, depositAmount, connected }: Props) {
  const topPool = pools[0];
  const avgNetAPY = pools.length
    ? pools.reduce((s, p) => s + (p.net_apy ?? p.apy ?? 0), 0) / pools.length
    : 0;
  const totalTVL = pools.reduce((s, p) => s + (p.tvl ?? 0), 0);
  const bestProfit = topPool?.profit_30d ?? 0;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>📊 Portfolio Overview</h3>
        {!connected && <span style={styles.badge}>Demo Mode</span>}
      </div>

      <div style={styles.grid}>
        <div style={styles.item}>
          <span style={styles.label}>Your Position</span>
          <span style={styles.value}>{formatUSD(depositAmount)}</span>
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Best Pool APY</span>
          <span style={{ ...styles.value, color: '#22C55E' }}>
            {topPool ? formatAPY(topPool.net_apy ?? topPool.apy) : '—'}
          </span>
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Avg Net APY</span>
          <span style={styles.value}>{formatAPY(avgNetAPY)}</span>
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Est. 30d Earnings</span>
          <span style={{ ...styles.value, color: '#06B6D4' }}>
            {formatUSD(bestProfit)}
          </span>
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Total TVL Tracked</span>
          <span style={styles.value}>{formatCompact(totalTVL)}</span>
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Best Strategy</span>
          <span style={styles.value}>
            {topPool ? `${topPool.protocol} ${topPool.token}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(234,179,8,0.12)',
    color: '#EAB308',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  item: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 12,
  },
  label: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-1)',
    fontVariantNumeric: 'tabular-nums',
  },
};
