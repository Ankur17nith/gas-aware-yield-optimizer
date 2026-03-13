import React, { useState, useMemo } from 'react';
import type { Pool } from '../types/pool';
import type { Prediction } from '../types/prediction';
import { formatAPY, formatCompact, formatUSD } from '../utils/format';
import {
  getDirectionColor,
  getConfidenceBg,
  getConfidenceColor,
} from '../utils/predictionUtils';
import ProtocolIcon from './ProtocolIcon';

interface Props {
  pools: Pool[];
  predictions: Prediction[];
  loading: boolean;
  error?: string | null;
  onMigrate: (pool: Pool) => void;
  onPoolClick?: (pool: Pool) => void;
}

type SortKey = 'rank' | 'protocol' | 'token' | 'gross_apy' | 'gas_cost_usd' | 'net_apy' | 'tvl' | 'risk_score';

export default function PoolTable({ pools, predictions, loading, error, onMigrate, onPoolClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('net_apy');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    const arr = [...pools];
    const dir = sortAsc ? 1 : -1;
    arr.sort((a, b) => {
      const av = sortKey === 'protocol' ? a.protocol : sortKey === 'token' ? a.token
        : sortKey === 'gross_apy' ? (a.gross_apy ?? a.apy ?? 0) : sortKey === 'gas_cost_usd' ? (a.gas_cost_usd ?? 0)
        : sortKey === 'net_apy' ? (a.net_apy ?? a.apy ?? 0) : sortKey === 'tvl' ? (a.tvl ?? 0)
        : sortKey === 'risk_score' ? (a.risk_score ?? 0) : (a.rank ?? 0);
      const bv = sortKey === 'protocol' ? b.protocol : sortKey === 'token' ? b.token
        : sortKey === 'gross_apy' ? (b.gross_apy ?? b.apy ?? 0) : sortKey === 'gas_cost_usd' ? (b.gas_cost_usd ?? 0)
        : sortKey === 'net_apy' ? (b.net_apy ?? b.apy ?? 0) : sortKey === 'tvl' ? (b.tvl ?? 0)
        : sortKey === 'risk_score' ? (b.risk_score ?? 0) : (b.rank ?? 0);
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return arr;
  }, [pools, sortKey, sortAsc]);

  if (!pools.length && !loading) {
    return <div style={styles.empty}>{error || 'No pools found. Check your backend connection.'}</div>;
  }

  const predMap = new Map<string, Prediction>();
  predictions.forEach((p) => predMap.set(p.pool_id, p));

  const cols: { label: string; key: SortKey | '' }[] = [
    { label: '#', key: 'rank' }, { label: 'Protocol', key: 'protocol' }, { label: 'Token', key: 'token' },
    { label: 'Gross APY', key: 'gross_apy' }, { label: 'Gas Cost', key: 'gas_cost_usd' },
    { label: 'Net APY', key: 'net_apy' }, { label: 'Risk', key: 'risk_score' }, { label: 'TVL', key: 'tvl' },
    { label: 'AI Prediction', key: '' }, { label: '', key: '' },
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.label || 'action'} style={styles.th}
                  onClick={c.key ? () => handleSort(c.key as SortKey) : undefined}
                >
                  {c.label}
                  {c.key && sortKey === c.key && <span style={styles.sortArrow}>{sortAsc ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((pool, idx) => {
              const pred = predMap.get(pool.pool_id);
              return (
                <tr key={pool.pool_id} className="row-hover"
                  style={{ ...styles.tr, cursor: onPoolClick ? 'pointer' : undefined }}
                  onClick={() => onPoolClick?.(pool)}
                >
                  <td style={styles.td}><span style={styles.rank}>{pool.rank ?? idx + 1}</span></td>
                  <td style={styles.td}>
                    <span style={styles.protoCell}>
                      <ProtocolIcon protocol={pool.protocol} size={20} />
                      <span style={styles.protocol}>{pool.protocol}</span>
                    </span>
                  </td>
                  <td style={styles.td}><span style={styles.tokenBadge}>{pool.token}</span></td>
                  <td style={styles.td}>{formatAPY(pool.gross_apy ?? pool.apy)}</td>
                  <td style={styles.td}><span style={styles.gasCost}>{formatUSD(pool.gas_cost_usd ?? 0)}</span></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.netApy, color: (pool.net_apy ?? 0) >= (pool.gross_apy ?? pool.apy) ? 'var(--success)' : 'var(--text-1)' }}>
                      {formatAPY(pool.net_apy ?? pool.apy)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.riskBadge,
                      background: pool.risk_level === 'Low'
                        ? 'rgba(34,197,94,0.12)'
                        : pool.risk_level === 'Medium'
                          ? 'rgba(234,179,8,0.14)'
                          : 'rgba(239,68,68,0.12)',
                      color: pool.risk_level === 'Low'
                        ? 'var(--success)'
                        : pool.risk_level === 'Medium'
                          ? '#EAB308'
                          : 'var(--danger)',
                    }}>
                      {pool.risk_level ?? 'Medium'}
                    </span>
                  </td>
                  <td style={styles.td}>{formatCompact(pool.tvl)}</td>
                  <td style={styles.td}>
                    {pred ? (
                      <div style={styles.predCell}>
                        <span style={{ color: getDirectionColor(pred.direction), fontWeight: 600, fontSize: 13 }}>
                          {pred.direction === 'up' ? '↑' : pred.direction === 'down' ? '↓' : '→'}{' '}
                          {formatAPY(pred.predicted_apy_30d)}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: getConfidenceBg(pred.confidence), color: getConfidenceColor(pred.confidence), fontWeight: 500 }}>
                          {pred.confidence}
                        </span>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>—</span>}
                  </td>
                  <td style={styles.td}>
                    <button style={styles.migrateBtn} onClick={(e) => { e.stopPropagation(); onMigrate(pool); }}>
                      Migrate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 900 },
  th: {
    textAlign: 'left', padding: '12px 16px', color: 'var(--text-3)',
    fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  },
  sortArrow: { fontSize: 10, color: 'var(--primary)' },
  tr: { transition: 'background 0.12s' },
  td: { padding: '12px 16px', color: 'var(--text-1)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  rank: { color: 'var(--text-3)', fontSize: 12, fontWeight: 500 },
  protoCell: { display: 'flex', alignItems: 'center', gap: 8 },
  protocol: { fontWeight: 600, color: 'var(--text-1)' },
  tokenBadge: {
    display: 'inline-block', background: 'rgba(91,140,255,0.1)', color: 'var(--primary)',
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
  },
  gasCost: { color: 'var(--text-2)' },
  netApy: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  riskBadge: {
    display: 'inline-block',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  predCell: { display: 'flex', alignItems: 'center', gap: 6 },
  migrateBtn: {
    background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.15s', fontFamily: 'inherit',
  },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 },
  empty: { padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 },
};
