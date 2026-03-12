import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  open: boolean;
  mode: 'deposit' | 'withdraw';
  protocol: string;
  token: string;
  onConfirm: (amount: string) => Promise<void>;
  onClose: () => void;
}

export default function DepositWithdrawModal({
  open,
  mode,
  protocol,
  token,
  onConfirm,
  onClose,
}: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(amount);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {mode === 'deposit' ? '💰 Deposit' : '💸 Withdraw'}
          </h3>
          <button style={styles.closeBtn} onClick={handleClose}>
            ✕
          </button>
        </div>

        {success ? (
          <div style={styles.successWrap}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.successText}>
              {mode === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!
            </p>
            <button style={styles.doneBtn} onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={styles.info}>
              <span style={styles.infoLabel}>Protocol</span>
              <span style={styles.infoVal}>{protocol}</span>
            </div>
            <div style={styles.info}>
              <span style={styles.infoLabel}>Token</span>
              <span style={styles.infoVal}>{token}</span>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Amount ({token})</label>
              <div style={styles.inputWrap}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={styles.input}
                  min={0}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={handleClose}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.confirmBtn,
                  background:
                    mode === 'deposit' ? 'var(--primary)' : '#DC2626',
                }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LoadingSpinner size={14} /> Processing…
                  </span>
                ) : mode === 'deposit' ? (
                  'Confirm Deposit'
                ) : (
                  'Confirm Withdraw'
                )}
              </button>
            </div>
          </>
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
    maxWidth: 420,
    animation: 'slideUp 0.2s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-1)' },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    fontFamily: 'inherit',
  },
  info: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  infoLabel: { fontSize: 13, color: 'var(--text-3)' },
  infoVal: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)' },
  inputGroup: { marginTop: 16, marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-2)',
    marginBottom: 6,
  },
  inputWrap: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-1)',
    padding: '12px 14px',
    fontSize: 16,
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  },
  error: { color: 'var(--danger)', fontSize: 13, marginBottom: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
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
  successText: { fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 },
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
};
