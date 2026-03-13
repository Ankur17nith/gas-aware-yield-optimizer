import React, { useEffect, useMemo, useState } from 'react';
import { api, type AiAgentStrategyResponse } from '../services/api';
import type { Pool } from '../types/pool';
import ProtocolIcon from './ProtocolIcon';
import { formatAPY, formatUSD } from '../utils/format';

interface Props {
  pools: Pool[];
  depositAmount: number;
  selectedChain: string;
  onApplyRecommendation: (protocol: string, token: string) => void;
}

export default function AIAgentStrategyPanel({
  pools,
  depositAmount,
  selectedChain,
  onApplyRecommendation,
}: Props) {
  const [result, setResult] = useState<AiAgentStrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const seedCurrent = useMemo(() => {
    if (!pools.length) {
      return { protocol: 'aave', token: 'USDC' };
    }
    const worst = [...pools].sort((a, b) => (a.net_apy ?? a.apy ?? 0) - (b.net_apy ?? b.apy ?? 0))[0];
    return {
      protocol: worst?.protocol || 'aave',
      token: worst?.token || 'USDC',
    };
  }, [pools]);

  useEffect(() => {
    let cancelled = false;
    if (!pools.length) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAiAgentStrategy(
          seedCurrent.protocol,
          seedCurrent.token,
          depositAmount,
          selectedChain
        );
        if (!cancelled) {
          setResult(data);
          setExplanation(data.explanation || '');
        }

        if (!cancelled && !data.explanation && data.recommended) {
          setExplanationLoading(true);
          try {
            const explain = await api.getAiExplainStrategy(
              data.recommended.protocol,
              data.recommended.pool_name || data.recommended.pool_meta || 'Pool',
              data.recommended.token,
              Number(data.predicted_net_apy_30d || data.recommended.net_apy || data.recommended.apy || 0),
              Number(data.recommended.tvl || 0),
              selectedChain,
              data.confidence
            );
            if (!cancelled) {
              setExplanation(explain.explanation || '');
            }
          } catch {
            if (!cancelled) {
              setExplanation('Unable to generate AI explanation right now.');
            }
          } finally {
            if (!cancelled) setExplanationLoading(false);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to run AI strategy agent');
          setResult(null);
          setExplanation('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [seedCurrent.protocol, seedCurrent.token, depositAmount, selectedChain, pools.length]);

  if (!pools.length) {
    return null;
  }

  return (
    <section style={S.card}>
      <div style={S.header}>
        <div>
          <h3 style={S.title}>Autonomous Strategy Agent</h3>
          <p style={S.subtitle}>Continuous scoring over live stablecoin pools</p>
        </div>
        {result && (
          <span style={{ ...S.badge, ...statusStyle(result.action) }}>
            {result.action.toUpperCase()} · {result.confidence}%
          </span>
        )}
      </div>

      {loading && <p style={S.muted}>Running autonomous strategy analysis...</p>}
      {error && <p style={{ ...S.muted, color: 'var(--danger)' }}>{error}</p>}

      {!loading && !error && result && (
        <>
          <div style={S.row}>
            <PoolMini title="Current Position" pool={result.current} />
            <div style={S.arrow}>→</div>
            <PoolMini title="Recommended Target" pool={result.recommended} highlight />
          </div>

          <div style={S.decisionRow}>
            <div style={S.decisionBox}>
              <span style={S.mutedSmall}>Migration Decision</span>
              <span style={S.decisionValue}>{result.action.toUpperCase()}</span>
            </div>
            <div style={S.decisionBox}>
              <span style={S.mutedSmall}>Migration Probability</span>
              <span style={S.decisionValue}>{result.confidence}%</span>
            </div>
          </div>

          <div style={S.stats}>
            <Stat label="Predicted 30d APY" value={formatAPY(result.predicted_net_apy_30d)} />
            <Stat
              label="Estimated 30d Delta"
              value={
                (result.estimated_30d_delta_usd ?? 0) >= 0
                  ? `+${formatUSD(result.estimated_30d_delta_usd)}`
                  : formatUSD(result.estimated_30d_delta_usd)
              }
            />
            <Stat label="Framework" value={result.agent.framework} />
          </div>

          <div style={S.reasonBox}>
            {result.reasoning?.map((line, idx) => (
              <div key={`${idx}-${line}`} style={S.reasonLine}>
                • {line}
              </div>
            ))}
          </div>

          <div style={S.reasonBox}>
            <div style={S.explainTitle}>AI Explanation</div>
            {explanationLoading ? (
              <div style={S.reasonLine}>Generating AI explanation...</div>
            ) : (
              <div style={S.reasonLine}>{explanation || 'No explanation available yet.'}</div>
            )}
          </div>

          <div style={S.actions}>
            <button
              style={S.cta}
              onClick={() => onApplyRecommendation(result.recommended.protocol, result.recommended.token)}
              disabled={result.action === 'hold'}
            >
              Apply Strategy in Migration Flow
            </button>
            {result.onchain_trigger && !result.onchain_trigger.supported && (
              <span style={S.mutedSmall}>
                On-chain auto-trigger unavailable: {result.onchain_trigger.method}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PoolMini({
  title,
  pool,
  highlight,
}: {
  title: string;
  pool: any;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...S.poolMini,
        borderColor: highlight ? 'var(--primary)' : 'var(--border)',
      }}
    >
      <span style={S.mutedSmall}>{title}</span>
      <div style={S.poolHead}>
        <ProtocolIcon protocol={pool?.protocol || 'unknown'} size={18} />
        <span style={S.poolTitle}>{pool?.protocol || 'Unknown'}</span>
      </div>
      <span style={S.mutedSmall}>{pool?.token || 'N/A'}</span>
      <span style={{ ...S.poolApy, color: highlight ? 'var(--success)' : 'var(--text-1)' }}>
        {formatAPY(pool?.net_apy ?? pool?.apy ?? 0)}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.stat}>
      <span style={S.mutedSmall}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  );
}

function statusStyle(action: string): React.CSSProperties {
  if (action === 'migrate') return { background: 'rgba(34, 197, 94, 0.14)', color: 'var(--success)' };
  if (action === 'consider') return { background: 'rgba(245, 158, 11, 0.14)', color: 'var(--warning)' };
  return { background: 'rgba(148, 163, 184, 0.2)', color: 'var(--text-2)' };
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text-1)',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: 'var(--text-3)',
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 8px',
    borderRadius: 8,
    letterSpacing: '0.03em',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  arrow: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--primary)',
  },
  poolMini: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: 'var(--surface)',
  },
  poolHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  poolTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-1)',
  },
  poolApy: {
    fontSize: 16,
    fontWeight: 700,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
    marginBottom: 12,
  },
  decisionRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 8,
    marginBottom: 12,
  },
  decisionBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  decisionValue: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-1)',
  },
  stat: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-1)',
  },
  reasonBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '9px 10px',
    marginBottom: 12,
  },
  reasonLine: {
    fontSize: 12,
    color: 'var(--text-2)',
    lineHeight: 1.5,
  },
  explainTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-1)',
    marginBottom: 6,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  cta: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  muted: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-2)',
  },
  mutedSmall: {
    fontSize: 11,
    color: 'var(--text-3)',
  },
};
