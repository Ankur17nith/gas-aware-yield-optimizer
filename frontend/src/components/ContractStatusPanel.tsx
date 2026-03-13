import React from 'react';
import { addressExplorerUrl, txExplorerUrl } from '../utils/explorer';
import type { ContractStatus } from '../services/routerContract';

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

      <div style={styles.grid}>
        <div style={styles.item}><span style={styles.label}>Network</span><span style={styles.value}>{status?.network || '—'}</span></div>
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
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  item: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  value: { fontSize: 13, color: 'var(--text-1)', fontWeight: 600 },
  link: { fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
};
