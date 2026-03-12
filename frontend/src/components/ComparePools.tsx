import React, { useState } from 'react';
import type { Pool } from '../types/pool';
import { formatAPY, formatUSD, formatCompact } from '../utils/format';

interface Props {
  pools: Pool[];
}

export default function ComparePools({ pools }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev
    );
  };

  const selectedPools = pools.filter((p) => selected.includes(p.pool_id));

  const metrics = [
    { key: 'Gross APY', fn: (p: Pool) => formatAPY(p.gross_apy ?? p.apy) },
    { key: 'Net APY', fn: (p: Pool) => formatAPY(p.net_apy ?? p.apy) },
    { key: 'Gas Cost', fn: (p: Pool) => formatUSD(p.gas_cost_usd ?? 0) },
    { key: 'TVL', fn: (p: Pool) => formatCompact(p.tvl ?? 0) },
    { key: '30d Profit', fn: (p: Pool) => formatUSD(p.profit_30d ?? 0) },
    { key: 'Gas Impact', fn: (p: Pool) => `${(p.gas_impact_pct ?? 0).toFixed(2)}%` },
    { key: 'Trust Score', fn: (p: Pool) => `${p.trust_score ?? '—'}/100` },
  ];

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>⚖️ Compare Pools</h3>
      <p style={styles.sub}>Select up to 4 pools to compare side-by-side</p>

      {/* Selector */}
      <div style={styles.chips}>
        {pools.slice(0, 12).map((p) => (
          <button
            key={p.pool_id}
            style={
              selected.includes(p.pool_id)
                ? styles.chipActive
                : styles.chip
            }
            onClick={() => toggleSelect(p.pool_id)}
          >
            {p.protocol} · {p.token}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      {selectedPools.length >= 2 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Metric</th>
                {selectedPools.map((p) => (
                  <th key={p.pool_id} style={styles.th}>
                    {p.protocol}
                    <br />
                    <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                      {p.token}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key}>
                  <td style={styles.tdLabel}>{m.key}</td>
                  {selectedPools.map((p) => (
                    <td key={p.pool_id} style={styles.td}>
                      {m.fn(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.empty}>
          Select at least 2 pools above to see comparison
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
    padding: 20,
    marginBottom: 24,
  },
  title: { margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  sub: { fontSize: 13, color: 'var(--text-3)', marginBottom: 16 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  chip: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-2)',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chipActive: {
    background: 'rgba(91,140,255,0.1)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'center',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-1)',
    borderBottom: '1px solid var(--border)',
  },
  tdLabel: {
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-1)',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid var(--border)',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--text-3)',
    fontSize: 13,
  },
};
