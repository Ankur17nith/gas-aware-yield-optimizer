import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Prediction } from '../types/prediction';
import { formatAPY } from '../utils/format';
import {
  getDirectionColor,
  getConfidenceBg,
  getConfidenceColor,
} from '../utils/predictionUtils';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  predictions: Prediction[];
  loading: boolean;
}

function clampAPY(v: number) {
  return Math.max(0, Math.min(20, v));
}

export default function PredictionChart({ predictions, loading }: Props) {
  if (loading) {
    return (
      <div style={styles.loading}>
        <LoadingSpinner size={24} />
        <span style={{ color: 'var(--text-2)', marginLeft: 10 }}>Loading predictions…</span>
      </div>
    );
  }

  if (!predictions.length) {
    return <div style={styles.empty}>No prediction data available.</div>;
  }

  const chartData = predictions.slice(0, 10).map((p) => ({
    name: `${p.protocol} ${p.token}`,
    current: clampAPY(Math.round(p.current_apy * 100) / 100),
    predicted: clampAPY(Math.round(p.predicted_apy_30d * 100) / 100),
    upper: clampAPY(Math.round(p.apy_upper * 100) / 100),
    lower: clampAPY(Math.round(p.apy_lower * 100) / 100),
  }));

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h3 style={styles.title}>AI Yield Predictions (30-day)</h3>
      </div>

      <div style={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0}
              angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false}
              tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 20]} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)' }}
              formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'current' ? 'Current APY' : 'Predicted APY']} />
            <Area type="monotone" dataKey="current" stroke="var(--primary)" fill="url(#gradCurrent)" strokeWidth={2} />
            <Area type="monotone" dataKey="predicted" stroke="var(--secondary)" fill="url(#gradPredicted)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: 'var(--primary)' }} />Current APY</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: 'var(--secondary)' }} />Predicted 30d APY</span>
      </div>

      <div style={styles.cardGrid}>
        {predictions.slice(0, 6).map((pred) => (
          <div key={pred.pool_id} className="card-hover" style={styles.card}>
            <div style={styles.cardTop}>
              <span style={styles.cardProtocol}>{pred.protocol}</span>
              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: getConfidenceBg(pred.confidence), color: getConfidenceColor(pred.confidence), fontWeight: 500 }}>
                {pred.confidence}
              </span>
            </div>
            <div style={styles.cardToken}>{pred.token}</div>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>Now</span>
              <span style={styles.cardValue}>{formatAPY(clampAPY(pred.current_apy))}</span>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>30d Pred.</span>
              <span style={{ ...styles.cardValue, color: getDirectionColor(pred.direction) }}>
                {pred.direction === 'up' ? '↑' : pred.direction === 'down' ? '↓' : '→'}{' '}
                {formatAPY(clampAPY(pred.predicted_apy_30d))}
              </span>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}>Range</span>
              <span style={{ ...styles.cardValue, color: 'var(--text-2)', fontSize: 12 }}>
                {formatAPY(clampAPY(pred.apy_lower))} – {formatAPY(clampAPY(pred.apy_upper))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  chartWrap: { marginBottom: 12 },
  legend: { display: 'flex', gap: 20, marginBottom: 20, paddingLeft: 4 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 12 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardProtocol: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)' },
  cardToken: { fontSize: 12, color: 'var(--primary)', fontWeight: 500, marginBottom: 10 },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardLabel: { fontSize: 12, color: 'var(--text-3)' },
  cardValue: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 },
  empty: { padding: 48, textAlign: 'center', color: 'var(--text-3)' },
};
