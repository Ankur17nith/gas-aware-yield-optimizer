import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Pool } from '../types/pool';
import ProtocolIcon from './ProtocolIcon';
import { formatAPY, formatUSD } from '../utils/format';
import Skeleton from './Skeleton';

interface Props {
  pools: Pool[];
  depositAmount: number;
}

export default function AIRecommendation({ pools, depositAmount }: Props) {
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pools.length < 2) return;
    // Pick the worst-performing pool as "current" to get a meaningful recommendation
    const sorted = [...pools].sort((a, b) => (a.net_apy ?? a.apy ?? 0) - (b.net_apy ?? b.apy ?? 0));
    const worst = sorted[0];
    if (!worst) return;
    setLoading(true);
    api.getMigration(worst.protocol, worst.token, depositAmount)
      .then(setRec)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pools, depositAmount]);

  if (loading) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <Skeleton width="50%" height={14} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={80} />
      </div>
    );
  }

  if (!rec || !rec.target || !rec.current) return null;

  const apyDiff = (rec.target.net_apy ?? 0) - (rec.current.net_apy ?? 0);
  const confidence = Math.min(Math.round(Math.abs(apyDiff) * 30 + 50), 98);
  const risk = confidence >= 75 ? 'Low' : confidence >= 50 ? 'Medium' : 'High';
  const riskColor = risk === 'Low' ? 'var(--success)' : risk === 'Medium' ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>AI Recommendation</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
          background: rec.recommendation === 'migrate' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
          color: rec.recommendation === 'migrate' ? 'var(--success)' : 'var(--warning)',
        }}>
          {rec.recommendation === 'migrate' ? 'Migrate' : rec.recommendation === 'consider' ? 'Consider' : 'Hold'}
        </span>
      </div>

      {/* Migration path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ProtocolIcon protocol={rec.current.protocol} size={18} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{rec.current.protocol}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{rec.current.token}</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)', marginTop: 4 }}>
            {formatAPY(rec.current.net_apy ?? 0)}
          </div>
        </div>

        <div style={{ fontSize: 20, color: 'var(--primary)', fontWeight: 700 }}>→</div>

        <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ProtocolIcon protocol={rec.target.protocol} size={18} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{rec.target.protocol}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{rec.target.token}</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
            {formatAPY(rec.target.net_apy ?? 0)}
          </div>
        </div>
      </div>

      {/* Reason */}
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 16 }}>
        {rec.reason}
      </p>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <div style={statBox}>
          <span style={statLabel}>APY Gain</span>
          <span style={{ ...statVal, color: apyDiff > 0 ? 'var(--success)' : 'var(--danger)' }}>
            {apyDiff > 0 ? '+' : ''}{formatAPY(apyDiff)}
          </span>
        </div>
        <div style={statBox}>
          <span style={statLabel}>30d Gain</span>
          <span style={{ ...statVal, color: (rec.net_gain_30d ?? 0) > 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(rec.net_gain_30d ?? 0) > 0 ? '+' : ''}{formatUSD(rec.net_gain_30d ?? 0)}
          </span>
        </div>
        <div style={statBox}>
          <span style={statLabel}>Break-even</span>
          <span style={statVal}>{rec.breakeven_days ?? '—'} days</span>
        </div>
        <div style={statBox}>
          <span style={statLabel}>Confidence</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={statVal}>{confidence}%</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: riskColor }}>{risk}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const statBox: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 10px',
};
const statLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2,
};
const statVal: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: 'var(--text-1)',
  fontVariantNumeric: 'tabular-nums',
};
