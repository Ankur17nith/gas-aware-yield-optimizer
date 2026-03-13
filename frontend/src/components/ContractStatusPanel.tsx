import React, { useState } from 'react';
import { addressExplorerUrl, txExplorerUrl } from '../utils/explorer';
import type { ContractStatus } from '../services/routerContract';
import {
  getRuntimeRouterAddress,
  setRuntimeRouterAddress,
  clearRuntimeRouterAddress,
} from '../services/routerContract';

interface Props {
  status: ContractStatus | null;
  chainId: number | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onTestTransaction: () => void;
  txLoading: boolean;
}

export default function ContractStatusPanel({
  status,
  chainId,
  loading,
  error,
  onRefresh,
  onTestTransaction,
  txLoading,
}: Props) {
  const [routerInput, setRouterInput] = useState<string>(() => getRuntimeRouterAddress());
  const [configError, setConfigError] = useState<string | null>(null);

  const saveRouterAddress = () => {
    try {
      setRuntimeRouterAddress(routerInput);
      setConfigError(null);
      onRefresh();
    } catch (err: any) {
      setConfigError(err.message || 'Invalid router address');
    }
  };

  const clearRouterAddress = () => {
    clearRuntimeRouterAddress();
    setRouterInput('');
    setConfigError(null);
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>Contract Status</h3>
        <div style={styles.actions}>
          <button style={styles.btn} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button style={styles.primaryBtn} onClick={onTestTransaction} disabled={txLoading}>
            {txLoading ? 'Testing...' : 'Test Smart Contract'}
          </button>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {configError && <p style={styles.error}>{configError}</p>}

      {!status?.contractAddress && (
        <div style={styles.configWrap}>
          <span style={styles.configLabel}>Set Router Address (runtime)</span>
          <div style={styles.configRow}>
            <input
              style={styles.input}
              placeholder="0x..."
              value={routerInput}
              onChange={(e) => setRouterInput(e.target.value)}
            />
            <button style={styles.btn} onClick={saveRouterAddress}>Save</button>
            <button style={styles.btn} onClick={clearRouterAddress}>Clear</button>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        <div style={styles.item}><span style={styles.label}>Network</span><span style={styles.value}>{status?.network || '—'}</span></div>
        <div style={styles.item}><span style={styles.label}>Wallet</span><span style={styles.value}>{status?.walletAddress ? `${status.walletAddress.slice(0, 6)}...${status.walletAddress.slice(-4)}` : 'Not connected'}</span></div>
        <div style={styles.item}><span style={styles.label}>Latest Block</span><span style={styles.value}>{status?.latestBlock?.toLocaleString() || '—'}</span></div>
        <div style={styles.item}>
          <span style={styles.label}>Contract Address</span>
          {status?.contractAddress ? (
            <a style={styles.link} target="_blank" rel="noopener noreferrer" href={addressExplorerUrl(status.contractAddress, chainId)}>
              {status.contractAddress.slice(0, 10)}...{status.contractAddress.slice(-8)}
            </a>
          ) : <span style={styles.value}>Not configured</span>}
        </div>
        <div style={styles.item}>
          <span style={styles.label}>Last Transaction</span>
          {status?.lastTransactionHash ? (
            <a style={styles.link} target="_blank" rel="noopener noreferrer" href={txExplorerUrl(status.lastTransactionHash, chainId)}>
              {status.lastTransactionHash.slice(0, 10)}...{status.lastTransactionHash.slice(-8)}
            </a>
          ) : <span style={styles.value}>No recent tx</span>}
        </div>
      </div>

      {status?.userDeposits?.length ? (
        <div style={styles.depositTableWrap}>
          <div style={styles.depositTableTitle}>User Deposits (Tracked On-Chain)</div>
          <table style={styles.depositTable}>
            <thead>
              <tr>
                <th style={styles.th}>Token</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Aave</th>
                <th style={styles.th}>Curve</th>
                <th style={styles.th}>Compound</th>
              </tr>
            </thead>
            <tbody>
              {status.userDeposits.map((d) => (
                <tr key={d.token}>
                  <td style={styles.td}>{d.token}</td>
                  <td style={styles.td}>{d.total}</td>
                  <td style={styles.td}>{d.aave}</td>
                  <td style={styles.td}>{d.curve}</td>
                  <td style={styles.td}>{d.compound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  primaryBtn: { border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 },
  error: { color: 'var(--danger)', fontSize: 12, margin: '0 0 8px' },
  configWrap: { marginBottom: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' },
  configLabel: { display: 'block', marginBottom: 6, color: 'var(--text-2)', fontSize: 12, fontWeight: 600 },
  configRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  input: { flex: 1, minWidth: 220, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--card)', color: 'var(--text-1)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  item: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  value: { fontSize: 13, color: 'var(--text-1)', fontWeight: 600 },
  link: { fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  depositTableWrap: { marginTop: 14, overflowX: 'auto' },
  depositTableTitle: { fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600 },
  depositTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', padding: '6px 4px' },
  td: { color: 'var(--text-1)', borderBottom: '1px solid var(--border)', padding: '6px 4px' },
};
