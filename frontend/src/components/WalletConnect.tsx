import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface Props {
  compact?: boolean;
}

export default function WalletConnect({ compact = false }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending } = useConnect();
  const [open, setOpen] = React.useState(false);

  const isMobile =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|iemobile|opera mini/i.test(navigator.userAgent);

  const connectWith = (matcher: (name: string, id: string) => boolean) => {
    const connector = connectors.find((c) => matcher(c.name.toLowerCase(), c.id.toLowerCase()));
    if (!connector) return;
    connect({ connector });
    setOpen(false);
  };

  const handleConnect = () => {
    if (isMobile) {
      const walletConnectConnector = connectors.find(
        (c) => c.id.toLowerCase().includes('walletconnect') || c.name.toLowerCase().includes('walletconnect')
      );
      if (walletConnectConnector) {
        connect({ connector: walletConnectConnector });
        return;
      }
    }
    setOpen((v) => !v);
  };

  if (isConnected && address) {
    return (
      <div style={styles.connected}>
        <button style={styles.addressBtn} onClick={() => disconnect()}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button onClick={handleConnect} style={compact ? styles.connectBtnCompact : styles.connectBtn}>
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {open && (
        <div style={styles.menu}>
          <button style={styles.menuItem} onClick={() => connectWith((name, id) => name.includes('metamask') || id.includes('metamask'))}>MetaMask</button>
          <button
            style={styles.menuItem}
            onClick={() => connectWith((name, id) => name.includes('walletconnect') || id.includes('walletconnect'))}
          >
            WalletConnect (Trust Wallet)
          </button>
          <button style={styles.menuItem} onClick={() => connectWith((name, id) => name.includes('coinbase') || id.includes('coinbase'))}>Coinbase Wallet</button>
          <button
            style={styles.menuItem}
            onClick={() => connectWith((name, id) => name.includes('metamask') || id.includes('metamask') || id.includes('injected'))}
          >
            Browser Wallet
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
  },
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
  menu: {
    position: 'absolute',
    right: 0,
    top: '110%',
    minWidth: 220,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    padding: 8,
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  menuItem: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--text-1)',
    padding: '8px 10px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
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
