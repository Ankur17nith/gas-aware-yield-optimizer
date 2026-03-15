import React, { useCallback, useEffect, useState } from 'react';
import { api, type GasTimingResponse } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Props {
  walletAddress?: string;
  targetPool?: string;
  chain?: string;
}

export default function GasTimingOptimizerCard({ walletAddress, targetPool, chain }: Props) {
  const [data, setData] = useState<GasTimingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [message, setMessage] = useState<string>('');

  const fetchTiming = useCallback(async () => {
    try {
      const response = await api.getGasTiming(chain);
      setData(response);
    } catch {
      setMessage('Could not load gas timing now.');
    } finally {
      setLoading(false);
    }
  }, [chain]);

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
  const trend = (data as any).trend;
  const history = Array.isArray(data.history)
    ? data.history
    : Array.isArray(trend)
      ? trend.map((x: any) => ({ timestamp: x.timestamp, gas_price: x.gas }))
      : [];
  const averageGas = data.daily_average ?? data.average_gas;
  const updatedText = data.last_updated
    ? new Date(data.last_updated).toUTCString().replace('GMT', 'UTC')
    : 'Unavailable';

  const formatToLocalHHMM = (timestamp: string | number): string => {
    const date =
      typeof timestamp === 'number'
        ? new Date(timestamp * 1000)
        : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const chartData = history.slice(-288).map((h: any) => ({
    time: formatToLocalHHMM(h.timestamp),
    gas: Number(h.gas_price || 0),
  }));
  const chainLabel = (data.chain || chain || 'ethereum').replace(/^./, (c) => c.toUpperCase());

  return (
    <section style={S.card}>
      <div style={S.headRow}>
        <div>
          <div style={S.title}>Gas Timing Optimizer</div>
          <div style={S.subtle}>Best migration timing based on 24h gas behavior</div>
        </div>
        <div style={S.headMeta}>
          <span style={S.liveBadge}><span style={S.liveDot} /> Live Data</span>
          <span style={{ ...S.statusPill, ...(high ? S.high : S.low) }}>{data.status}</span>
        </div>
      </div>

      <div style={S.grid}>
        <Metric label={`Current Gas (${chainLabel})`} value={`${data.current_gas.toFixed(0)} gwei`} />
        <Metric label="24h Average" value={`${averageGas.toFixed(0)} gwei`} />
        <Metric label="Best Migration Time" value={`~${data.recommended_wait_time}`} />
        <Metric label="Expected Savings" value={`$${data.expected_savings.toFixed(2)}`} />
      </div>

      <div style={S.metaLine}>
        Source: {data.data_source || 'Etherscan Gas Tracker'} | Last Updated: {updatedText}
      </div>

      <div style={S.costLine}>
        Estimated Gas Cost: ${data.estimated_current_cost.toFixed(2)} now vs ${(data.estimated_average_cost ?? data.estimated_optimal_cost).toFixed(2)} near average conditions.
      </div>

      <div style={S.chartWrap}>
        <div style={S.chartTitle}>24h Gas Trend</div>
        {chartData.length >= 2 ? (
          <GasTrendChart chartData={chartData} />
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

function GasTrendChart({ chartData }: { chartData: Array<{ time: string; gas: number }> }) {
  const min = Math.min(...chartData.map((p) => p.gas));
  const max = Math.max(...chartData.map((p) => p.gas));
  const latest = chartData[chartData.length - 1]?.gas ?? 0;
  return (
    <div style={S.chartContainer}>
      <div style={S.chartSvg}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fill: 'var(--text-3)', fontSize: 10 }} minTickGap={28} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} width={38} />
            <Tooltip
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="gas" stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={S.chartLegend}>
        <span>Min: {min.toFixed(1)} gwei</span>
        <span>Max: {max.toFixed(1)} gwei</span>
        <span>Latest: {latest.toFixed(1)} gwei</span>
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
  headMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    border: '1px solid rgba(34,197,94,0.35)',
    background: 'rgba(34,197,94,0.1)',
    color: 'var(--success)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '3px 8px',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--success)',
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
  metaLine: {
    marginTop: 8,
    fontSize: 11,
    color: 'var(--text-3)',
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
