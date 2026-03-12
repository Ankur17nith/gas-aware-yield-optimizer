import React from 'react';
import type { Pool } from '../types/pool';
import ProtocolIcon from './ProtocolIcon';
import { formatAPY } from '../utils/format';

interface Props { pools: Pool[]; }

function getHeatColor(apy: number, max: number): string {
  const ratio = Math.min(apy / (max || 1), 1);
  if (ratio > 0.7) return 'rgba(34,197,94,0.25)';
  if (ratio > 0.4) return 'rgba(43,217,197,0.18)';
  if (ratio > 0.2) return 'rgba(91,140,255,0.15)';
  return 'rgba(91,140,255,0.06)';
}

function getTextColor(apy: number, max: number): string {
  const ratio = Math.min(apy / (max || 1), 1);
  if (ratio > 0.7) return '#22C55E';
  if (ratio > 0.4) return '#2BD9C5';
  return '#5B8CFF';
}

export default function APYHeatmap({ pools }: Props) {
  const maxApy = Math.max(...pools.map(p => p.net_apy ?? p.apy ?? 0), 1);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
        APY Heatmap
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {pools.slice(0, 20).map(p => {
          const apy = p.net_apy ?? p.apy ?? 0;
          return (
            <div key={p.pool_id} className="card-hover" style={{
              background: getHeatColor(apy, maxApy),
              border: '1px solid var(--border)',
              borderRadius: 8, padding: 12,
              cursor: 'default',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <ProtocolIcon protocol={p.protocol} size={16} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{p.protocol}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{p.token}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: getTextColor(apy, maxApy), fontVariantNumeric: 'tabular-nums' }}>
                {formatAPY(apy)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Low</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {['rgba(91,140,255,0.06)', 'rgba(91,140,255,0.15)', 'rgba(43,217,197,0.18)', 'rgba(34,197,94,0.25)'].map((c, i) => (
            <div key={i} style={{ width: 24, height: 8, background: c, borderRadius: 2 }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>High</span>
      </div>
    </div>
  );
}
