import React from 'react';
import type { Pool } from '../types/pool';
import { formatAPY, formatCompact } from '../utils/format';

interface Props {
  pools: Pool[];
}

export default function Leaderboard({ pools }: Props) {
  const sorted = [...pools]
    .sort((a, b) => (b.net_apy ?? b.apy ?? 0) - (a.net_apy ?? a.apy ?? 0))
    .slice(0, 10);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>🏆 Pool Leaderboard</h3>
      <p style={styles.sub}>Top 10 pools ranked by net APY</p>

      <div style={styles.list}>
        {sorted.map((pool, i) => (
          <div key={pool.pool_id} style={styles.row}>
            <span style={styles.rank}>
              {i < 3 ? medals[i] : `#${i + 1}`}
            </span>
            <div style={styles.poolInfo}>
              <span style={styles.poolName}>{pool.protocol}</span>
              <span style={styles.poolToken}>{pool.token}</span>
            </div>
            <div style={styles.stats}>
              <span style={{ ...styles.apy, color: 'var(--success)' }}>
                {formatAPY(pool.net_apy ?? pool.apy)}
              </span>
              <span style={styles.tvl}>TVL {formatCompact(pool.tvl ?? 0)}</span>
            </div>
            <div style={styles.bar}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${Math.min(
                    ((pool.net_apy ?? pool.apy ?? 0) /
                      (sorted[0]?.net_apy ?? sorted[0]?.apy ?? 1)) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        ))}
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
  title: { margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  sub: { fontSize: 13, color: 'var(--text-3)', marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  rank: { fontSize: 16, width: 32, textAlign: 'center', flexShrink: 0 },
  poolInfo: { flex: 1, minWidth: 0 },
  poolName: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' },
  poolToken: { display: 'block', fontSize: 11, color: 'var(--primary)' },
  stats: { textAlign: 'right', flexShrink: 0 },
  apy: { display: 'block', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  tvl: { display: 'block', fontSize: 11, color: 'var(--text-3)' },
  bar: {
    width: 60,
    height: 6,
    background: 'var(--border)',
    borderRadius: 3,
    overflow: 'hidden',
    flexShrink: 0,
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
};
