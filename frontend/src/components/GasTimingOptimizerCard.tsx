import React, { useCallback, useEffect, useState } from 'react';
import { api, type GasTimingResponse } from '../services/api';

interface Props {
  walletAddress?: string;
  targetPool?: string;
}

export default function GasTimingOptimizerCard({ walletAddress, targetPool }: Props) {
  const [data, setData] = useState<GasTimingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [message, setMessage] = useState<string>('');

  const fetchTiming = useCallback(async () => {
    try {
      const response = await api.getGasTiming();
      setData(response);
    } catch {
      setMessage('Could not load gas timing now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiming();
    const interval = setInterval(fetchTiming, 60000);
    return () => clearInterval(interval);
  }, [fetchTiming]);

  const scheduleMigration = useCallback(async () => {
    if (!data || !walletAddress || !targetPool) {
      setMessage('Connect wallet and select a target pool to schedule migration.');
      return;
    }

    try {
      setScheduling(true);
      const threshold = Math.max(1, Math.floor(data.average_gas));
      const response = await api.scheduleMigration(walletAddress, targetPool, threshold);
      setMessage(response?.message || 'Migration schedule saved.');
    } catch {
      setMessage('Failed to schedule migration. Please try again.');
    } finally {
      setScheduling(false);
    }
  }, [data, walletAddress, targetPool]);

  if (loading || !data) {
    return (
      <section style={S.card}>
        <div style={S.title}>Gas Timing Optimizer</div>
        <div style={S.subtle}>Analyzing current and historical gas conditions...</div>
      </section>
    );
  }

  const high = data.status === 'HIGH';
  const history = Array.isArray(data.history) ? data.history : [];

  return (
    <section style={S.card}>
      <div style={S.headRow}>
        <div>
          <div style={S.title}>Gas Timing Optimizer</div>
          <div style={S.subtle}>Best migration timing based on 24h gas behavior</div>
        </div>
        <span style={{ ...S.statusPill, ...(high ? S.high : S.low) }}>{data.status}</span>
      </div>

      <div style={S.grid}>
        <Metric label="Current Gas" value={`${data.current_gas.toFixed(0)} gwei`} />
        <Metric label="Daily Average" value={`${data.average_gas.toFixed(0)} gwei`} />
        <Metric label="Best Migration Time" value={`~${data.recommended_wait_time}`} />
        <Metric label="Expected Savings" value={`$${data.expected_savings.toFixed(2)}`} />
      </div>

      <div style={S.costLine}>
        Estimated Gas Cost: ${data.estimated_current_cost.toFixed(2)} now vs ${data.estimated_optimal_cost.toFixed(2)} near average conditions.
      </div>

      <div style={S.chartWrap}>
        <div style={S.chartTitle}>24h Gas Trend</div>
        {history.length >= 2 ? (
          <GasTrendChart history={history} />
        ) : (
          <div style={S.chartEmpty}>Collecting gas snapshots. Trend will appear after more samples.</div>
        )}
      </div>

      <div style={S.actions}>
        <button style={S.primaryBtn} onClick={scheduleMigration} disabled={scheduling}>
          {scheduling ? 'Scheduling...' : 'Schedule Migration'}
        </button>
        {message ? <span style={S.msg}>{message}</span> : null}
      </div>
    </section>
  );
}

function GasTrendChart({ history }: { history: Array<{ timestamp: number; gas_price: number }> }) {
  const width = 520;
  const height = 130;
  const padX = 8;
  const padY = 10;

  const points = history.slice(-288); // 24h at 5m cadence (or latest available samples)
  const min = Math.min(...points.map((p) => p.gas_price));
  const max = Math.max(...points.map((p) => p.gas_price));
  const range = Math.max(max - min, 1);

  const line = points
    .map((p, i) => {
      const x = padX + (i * (width - padX * 2)) / Math.max(points.length - 1, 1);
      const y = height - padY - ((p.gas_price - min) / range) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div style={S.chartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} style={S.chartSvg} role="img" aria-label="24 hour gas trend">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="var(--border)" strokeWidth="1" />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--border)" strokeWidth="1" />
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={line} />
      </svg>
      <div style={S.chartLegend}>
        <span>Min: {min.toFixed(1)} gwei</span>
        <span>Max: {max.toFixed(1)} gwei</span>
        <span>Latest: {points[points.length - 1].gas_price.toFixed(1)} gwei</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.metric}>
      <span style={S.metricLabel}>{label}</span>
      <span style={S.metricValue}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
  },
  headRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: 'var(--text-1)',
    fontSize: 16,
    fontWeight: 700,
  },
  subtle: {
    color: 'var(--text-3)',
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  high: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--danger)',
  },
  low: {
    background: 'rgba(34, 197, 94, 0.16)',
    color: 'var(--success)',
  },
  grid: {
    marginTop: 12,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  metric: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  metricValue: {
    fontSize: 14,
    color: 'var(--text-1)',
    fontWeight: 700,
  },
  costLine: {
    marginTop: 10,
    fontSize: 12,
    color: 'var(--text-2)',
    lineHeight: 1.45,
  },
  chartWrap: {
    marginTop: 12,
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--surface)',
    padding: 10,
  },
  chartTitle: {
    color: 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  chartContainer: {
    display: 'grid',
    gap: 6,
  },
  chartSvg: {
    width: '100%',
    height: 130,
    display: 'block',
  },
  chartLegend: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    color: 'var(--text-3)',
    fontSize: 11,
  },
  chartEmpty: {
    color: 'var(--text-3)',
    fontSize: 12,
    padding: '4px 0 2px',
  },
  actions: {
    marginTop: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  msg: {
    fontSize: 12,
    color: 'var(--text-2)',
  },
};
