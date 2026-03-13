import React from 'react';
import { formatUSD } from '../utils/format';
import { txExplorerUrl } from '../utils/explorer';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'migrate';
  protocol: string;
  token: string;
  amount: number;
  gasCost: number;
  timestamp: number;
  txHash: string;
  status: 'success' | 'pending' | 'failed';
  chainId?: number | null;
}

interface Props {
  transactions?: Transaction[];
  onClear?: () => void;
}

export default function TransactionHistory({ transactions = [], onClear }: Props) {

  const statusStyle = (s: string): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    background:
      s === 'success'
        ? 'rgba(34,197,94,0.12)'
        : s === 'pending'
        ? 'rgba(234,179,8,0.12)'
        : 'rgba(239,68,68,0.12)',
    color:
      s === 'success'
        ? '#22C55E'
        : s === 'pending'
        ? '#EAB308'
        : '#EF4444',
  });

  const typeIcon = (t: string) =>
    t === 'deposit' ? '⬇' : t === 'withdraw' ? '⬆' : '↔';

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ ...styles.title, marginBottom: 0 }}>📜 Transaction History</h3>
        {transactions.length > 0 && onClear && (
          <button onClick={onClear} style={styles.clearBtn}>Clear All</button>
        )}
      </div>
      {transactions.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No transactions yet</p>
          <p style={styles.emptySub}>
            Your deposit, withdrawal, and migration transactions will appear here
          </p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Protocol</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th}>Transaction Hash</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={styles.row}>
                  <td style={styles.td}>
                    {typeIcon(tx.type)} {tx.type}
                  </td>
                  <td style={styles.td}>{tx.protocol}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {formatUSD(tx.amount)} {tx.token}
                  </td>
                  <td style={styles.td}>
                    <a
                      href={txExplorerUrl(tx.txHash, tx.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.hashLink}
                    >
                      {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                    </a>
                  </td>
                  <td style={styles.td}>
                    <span style={statusStyle(tx.status)}>{tx.status}</span>
                  </td>
                  <td style={styles.td}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  title: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  empty: { padding: 40, textAlign: 'center' },
  emptyText: { fontSize: 14, color: 'var(--text-2)', marginBottom: 4 },
  emptySub: { fontSize: 12, color: 'var(--text-3)' },
  tableWrap: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
  },
  row: { borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 12px', color: 'var(--text-1)' },
  hashLink: {
    color: 'var(--primary)',
    textDecoration: 'none',
    fontWeight: 600,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  clearBtn: {
    background: 'rgba(239,68,68,0.15)',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
