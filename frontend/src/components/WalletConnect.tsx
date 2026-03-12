import React from 'react';
import { truncateAddress } from '../utils/format';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  address: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  ethBalance: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function WalletConnect({
  address,
  connected,
  loading,
  error,
  ethBalance,
  onConnect,
  onDisconnect,
}: Props) {
  if (connected && address) {
    return (
      <div style={styles.connected}>
        <div style={styles.balancePill}>
          <span style={styles.balanceLabel}>{ethBalance} ETH</span>
        </div>
        <button style={styles.addressBtn} onClick={onDisconnect}>
          <span style={styles.dot} />
          {truncateAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        style={styles.connectBtn}
        onClick={onConnect}
        disabled={loading}
      >
        {loading ? (
          <span style={styles.btnInner}>
            <LoadingSpinner size={14} /> Connecting…
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  balancePill: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-1)',
    fontWeight: 500,
  },
  balanceLabel: {
    fontVariantNumeric: 'tabular-nums',
  },
  addressBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 14px',
    color: 'var(--text-1)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--success)',
    display: 'inline-block',
  },
  connectBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
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
    fontSize: 12,
    marginTop: 4,
  },
};
