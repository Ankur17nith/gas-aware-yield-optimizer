import React from 'react';
import type { Pool } from '../types/pool';
import type { Prediction } from '../types/prediction';
import { formatAPY, formatUSD, formatCompact } from '../utils/format';
import RiskBadge from './RiskBadge';

interface Props {
  pool: Pool;
  prediction?: Prediction;
  onClose: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export default function PoolDetail({ pool, prediction, onClose, onDeposit, onWithdraw }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>
              {pool.protocol} — {pool.token}
            </h3>
            <span style={styles.chain}>{pool.chain ?? 'Ethereum'}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.grid}>
          <div style={styles.box}>
            <span style={styles.label}>Gross APY</span>
            <span style={styles.value}>{formatAPY(pool.gross_apy ?? pool.apy)}</span>
          </div>
          <div style={styles.box}>
            <span style={styles.label}>Net APY</span>
            <span style={{ ...styles.value, color: 'var(--success)' }}>
              {formatAPY(pool.net_apy ?? pool.apy)}
            </span>
          </div>
          <div style={styles.box}>
            <span style={styles.label}>TVL</span>
            <span style={styles.value}>{formatCompact(pool.tvl ?? 0)}</span>
          </div>
          <div style={styles.box}>
            <span style={styles.label}>Gas Cost</span>
            <span style={styles.value}>{formatUSD(pool.gas_cost_usd ?? 0)}</span>
          </div>
          <div style={styles.box}>
            <span style={styles.label}>Gas Impact</span>
            <span style={styles.value}>{(pool.gas_impact_pct ?? 0).toFixed(2)}%</span>
          </div>
          <div style={styles.box}>
            <span style={styles.label}>30d Profit</span>
            <span style={{ ...styles.value, color: 'var(--secondary)' }}>
              {formatUSD(pool.profit_30d ?? 0)}
            </span>
          </div>
        </div>

        <div style={styles.row}>
          <span style={styles.rowLabel}>Risk Score</span>
          <RiskBadge score={pool.trust_score ?? 70} size="md" />
        </div>

        {prediction && (
          <div style={styles.predCard}>
            <div style={styles.predTitle}>🤖 AI Prediction (30d)</div>
            <div style={styles.predGrid}>
              <div>
                <span style={styles.predLabel}>Predicted APY</span>
                <span style={styles.predVal}>
                  {formatAPY(prediction.predicted_apy_30d)}
                </span>
              </div>
              <div>
                <span style={styles.predLabel}>Direction</span>
                <span
                  style={{
                    ...styles.predVal,
                    color:
                      prediction.direction === 'up'
                        ? 'var(--success)'
                        : prediction.direction === 'down'
                        ? 'var(--danger)'
                        : 'var(--text-1)',
                  }}
                >
                  {prediction.direction === 'up'
                    ? '↑ Up'
                    : prediction.direction === 'down'
                    ? '↓ Down'
                    : '→ Stable'}
                </span>
              </div>
              <div>
                <span style={styles.predLabel}>Confidence</span>
                <span style={styles.predVal}>{prediction.confidence}</span>
              </div>
              <div>
                <span style={styles.predLabel}>Range</span>
                <span style={styles.predVal}>
                  {formatAPY(prediction.apy_lower)} – {formatAPY(prediction.apy_upper)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.depositBtn} onClick={onDeposit}>
            💰 Deposit
          </button>
          <button style={styles.withdrawBtn} onClick={onWithdraw}>
            💸 Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.15s ease',
  },
  modal: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'slideUp 0.2s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-1)' },
  chain: { fontSize: 12, color: 'var(--primary)', fontWeight: 500 },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    fontFamily: 'inherit',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 16,
  },
  box: {
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
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-1)',
    fontVariantNumeric: 'tabular-nums',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: 16,
  },
  rowLabel: { fontSize: 13, color: 'var(--text-2)', fontWeight: 500 },
  predCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  predTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-1)',
    marginBottom: 10,
  },
  predGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  predLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-3)',
    marginBottom: 2,
  },
  predVal: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-1)',
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
  depositBtn: {
    flex: 1,
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  withdrawBtn: {
    flex: 1,
    background: 'transparent',
    color: 'var(--text-1)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
