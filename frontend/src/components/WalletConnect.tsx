import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface Props {
  compact?: boolean;
}

export default function WalletConnect({ compact = false }: Props) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!connected) {
          return (
            <button onClick={openConnectModal} style={compact ? styles.connectBtnCompact : styles.connectBtn}>
              Connect Wallet
            </button>
          );
        }

        return (
          <div style={styles.connected}>
            <button onClick={openChainModal} style={styles.chainBtn}>
              {chain.name}
            </button>
            <button onClick={openAccountModal} style={styles.addressBtn}>
              {account.displayBalance ? `${account.displayBalance} · ` : ''}
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

const styles: Record<string, React.CSSProperties> = {
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  chainBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-1)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addressBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 14px',
    color: 'var(--text-1)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  connectBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 22px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
  connectBtnCompact: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
