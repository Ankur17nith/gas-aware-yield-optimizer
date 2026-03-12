import React from 'react';
import type { MigrationRecommendation } from '../types/migration';
import { formatAPY, formatUSD } from '../utils/format';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  open: boolean;
  recommendation: MigrationRecommendation | null;
  loading: boolean;
  txLoading: boolean;
  txHash: string | null;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function MigrationModal({
  open,
  recommendation,
  loading,
  txLoading,
  txHash,
  error,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  const rec = recommendation;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>Migration Details</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingWrap}>
            <LoadingSpinner size={28} />
            <p style={{ color: 'var(--text-2)', marginTop: 12 }}>
              Analyzing migration…
            </p>
          </div>
        ) : txHash ? (
          /* Success state */
          <div style={styles.successWrap}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.successTitle}>Migration Submitted</p>
            <p style={styles.txHash}>
              Tx:{' '}
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.txLink}
              >
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </a>
            </p>
            <button style={styles.doneBtn} onClick={onClose}>
              Done
            </button>
          </div>
        ) : rec ? (
          <>
            {/* Recommendation badge */}
            <div style={styles.recBadgeRow}>
              <span
                style={{
                  ...styles.recBadge,
                  background:
                    rec.recommendation === 'migrate'
                      ? 'rgba(34,197,94,0.12)'
                      : rec.recommendation === 'consider'
                      ? 'rgba(234,179,8,0.12)'
                      : 'rgba(239,68,68,0.12)',
                  color:
                    rec.recommendation === 'migrate'
                      ? '#22C55E'
                      : rec.recommendation === 'consider'
                      ? '#EAB308'
                      : '#EF4444',
                }}
              >
                {rec.recommendation === 'migrate'
                  ? '✓ Recommended'
                  : rec.recommendation === 'consider'
                  ? '⚡ Consider'
                  : '✗ Hold Position'}
              </span>
            </div>

            <p style={styles.reason}>{rec.reason}</p>

            {/* Pool comparison */}
            <div style={styles.comparison}>
              {/* Current */}
              <div style={styles.poolCard}>
                <span style={styles.poolLabel}>Current Pool</span>
                <span style={styles.poolProto}>
                  {rec.current?.protocol ?? '—'}
                </span>
                <span style={styles.poolToken}>
                  {rec.current?.token ?? '—'}
                </span>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Gross APY</span>
                  <span style={styles.statVal}>
                    {formatAPY(rec.current?.gross_apy ?? 0)}
                  </span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Net APY</span>
                  <span style={styles.statVal}>
                    {formatAPY(rec.current?.net_apy ?? 0)}
                  </span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Gas Cost</span>
                  <span style={styles.statVal}>
                    {formatUSD(rec.current?.gas_cost_usd ?? 0)}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div style={styles.arrow}>→</div>

              {/* Target */}
              <div
                style={{
                  ...styles.poolCard,
                  borderColor: rec.target ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <span style={styles.poolLabel}>Target Pool</span>
                <span style={styles.poolProto}>
                  {rec.target?.protocol ?? '—'}
                </span>
                <span style={styles.poolToken}>
                  {rec.target?.token ?? '—'}
                </span>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Gross APY</span>
                  <span style={styles.statVal}>
                    {formatAPY(rec.target?.gross_apy ?? 0)}
                  </span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Net APY</span>
                  <span style={{ ...styles.statVal, color: 'var(--success)' }}>
                    {formatAPY(rec.target?.net_apy ?? 0)}
                  </span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Gas Cost</span>
                  <span style={styles.statVal}>
                    {formatUSD(rec.target?.gas_cost_usd ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={styles.statsGrid}>
              <div style={styles.statBlock}>
                <span style={styles.statBlockLabel}>Migration Gas</span>
                <span style={styles.statBlockVal}>
                  {formatUSD(rec.migration_cost_usd ?? 0)}
                </span>
              </div>
              <div style={styles.statBlock}>
                <span style={styles.statBlockLabel}>30d Net Gain</span>
                <span
                  style={{
                    ...styles.statBlockVal,
                    color:
                      (rec.net_gain_30d ?? 0) > 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {(rec.net_gain_30d ?? 0) > 0 ? '+' : ''}
                  {formatUSD(rec.net_gain_30d ?? 0)}
                </span>
              </div>
              <div style={styles.statBlock}>
                <span style={styles.statBlockLabel}>Break-even</span>
                <span style={styles.statBlockVal}>
                  {rec.breakeven_days ?? '—'} days
                </span>
              </div>
              <div style={styles.statBlock}>
                <span style={styles.statBlockLabel}>Current 30d Profit</span>
                <span style={styles.statBlockVal}>
                  {formatUSD(rec.current_profit_30d ?? 0)}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && <p style={styles.error}>{error}</p>}

            {/* Action buttons */}
            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              {rec.recommendation !== 'hold' && rec.target && (
                <button
                  style={styles.confirmBtn}
                  onClick={onConfirm}
                  disabled={txLoading}
                >
                  {txLoading ? (
                    <span style={styles.btnInner}>
                      <LoadingSpinner size={14} /> Processing…
                    </span>
                  ) : (
                    'Confirm Migration'
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={styles.empty}>No migration data available.</div>
        )}
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
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-1)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    fontFamily: 'inherit',
  },
  recBadgeRow: {
    marginBottom: 12,
  },
  recBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  reason: {
    color: 'var(--text-2)',
    fontSize: 14,
    lineHeight: '1.5',
    marginBottom: 20,
    margin: '0 0 20px',
  },
  comparison: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 20,
  },
  poolCard: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 14,
  },
  poolLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6,
  },
  poolProto: {
    display: 'block',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-1)',
  },
  poolToken: {
    display: 'block',
    fontSize: 12,
    color: 'var(--primary)',
    marginBottom: 10,
  },
  arrow: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--primary)',
    fontSize: 22,
    fontWeight: 700,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-3)',
  },
  statVal: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-1)',
    fontVariantNumeric: 'tabular-nums',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 20,
  },
  statBlock: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 12,
  },
  statBlockLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-3)',
    marginBottom: 4,
  },
  statBlockVal: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-1)',
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    marginBottom: 12,
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 40,
  },
  successWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.12)',
    color: 'var(--success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-1)',
    marginBottom: 8,
  },
  txHash: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginBottom: 20,
  },
  txLink: {
    color: 'var(--primary)',
    textDecoration: 'none',
  },
  doneBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: 'var(--text-3)',
  },
};
