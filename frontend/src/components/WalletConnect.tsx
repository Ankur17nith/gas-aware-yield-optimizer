import React from 'react';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { formatUnits } from 'viem';

interface Props {
  compact?: boolean;
}

const METAMASK_DEEP_LINK = 'https://metamask.app.link/dapp/gas-aware-yield-optimizer.vercel.app';

const NETWORK_LABELS: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Sepolia',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
};

export default function WalletConnect({ compact = false }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending } = useConnect();
  const [uiMessage, setUiMessage] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const browserWalletAvailable =
    typeof window !== 'undefined' && Boolean((window as Window & { ethereum?: unknown }).ethereum);

  const selectedAddress = address ?? undefined;
  const { data: balanceData } = useBalance({
    address: selectedAddress,
    query: { enabled: Boolean(selectedAddress) },
  });

  const connectWith = (matcher: (name: string, id: string) => boolean) => {
    const connector = connectors.find((c) => matcher(c.name.toLowerCase(), c.id.toLowerCase()));
    if (!connector) {
      setUiMessage('No compatible wallet connector available.');
      return;
    }
    connect({ connector });
    setUiMessage(null);
    setOpen(false);
  };

  const openInMetaMask = () => {
    window.location.href = METAMASK_DEEP_LINK;
  };

  const connectMetaMask = () => {
    if (isMobile) {
      openInMetaMask();
      return;
    }
    connectWith((name, id) => name.includes('metamask') || id.includes('metamask') || id.includes('injected'));
  };

  const connectBrowserWallet = () => {
    if (!browserWalletAvailable) {
      setUiMessage('No browser wallet detected. Install MetaMask extension or use WalletConnect.');
      return;
    }
    connectWith((name, id) => id.includes('injected') || name.includes('browser') || name.includes('metamask'));
  };

  const handleConnect = () => {
    if (isMobile) {
      const walletConnectConnector = connectors.find(
        (c) => c.id.toLowerCase().includes('walletconnect') || c.name.toLowerCase().includes('walletconnect')
      );
      if (walletConnectConnector) {
        connect({ connector: walletConnectConnector });
        setUiMessage(null);
        return;
      }
    }
    setOpen((v) => !v);
  };

  if (isConnected && address) {
    const formattedBalance = balanceData
      ? `${Number(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4)} ${balanceData.symbol}`
      : '0.0000 ETH';
    const networkLabel = chainId ? NETWORK_LABELS[chainId] || `Chain ${chainId}` : 'Unknown';

    return (
      <div style={styles.connected}>
        <button style={styles.addressBtn} onClick={() => disconnect()}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        <div style={styles.connectedMeta}>
          <span style={styles.connectedLine}>Network: {networkLabel}</span>
          <span style={styles.connectedLine}>{formattedBalance}</span>
        </div>
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
          <button style={styles.menuItem} onClick={connectMetaMask}>MetaMask</button>
          <button
            style={styles.menuItem}
            onClick={() => connectWith((name, id) => name.includes('walletconnect') || id.includes('walletconnect'))}
          >
            WalletConnect (Trust Wallet)
          </button>
          <button style={styles.menuItem} onClick={() => connectWith((name, id) => name.includes('coinbase') || id.includes('coinbase'))}>Coinbase Wallet</button>
          <button style={styles.menuItem} onClick={connectBrowserWallet}>Browser Wallet</button>
        </div>
      )}
      {isMobile && !browserWalletAvailable && (
        <div style={styles.mobileHint}>
          <p style={styles.mobileHintText}>MetaMask not detected. Tap below to open in MetaMask.</p>
          <button style={styles.openMetaMaskBtn} onClick={openInMetaMask}>Open in MetaMask</button>
        </div>
      )}
      {uiMessage && <p style={styles.message}>{uiMessage}</p>}
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
  connectedMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  connectedLine: {
    color: 'var(--text-2)',
    fontSize: 11,
    lineHeight: 1.2,
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
  mobileHint: {
    marginTop: 8,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    background: 'var(--surface)',
  },
  mobileHintText: {
    margin: '0 0 6px',
    color: 'var(--text-2)',
    fontSize: 12,
  },
  openMetaMaskBtn: {
    background: '#F6851B',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  message: {
    marginTop: 8,
    color: 'var(--warning)',
    fontSize: 12,
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
