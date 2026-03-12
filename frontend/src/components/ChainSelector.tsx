import React from 'react';

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', icon: '⟠' },
  { id: 'arbitrum', label: 'Arbitrum', icon: '🔵' },
  { id: 'polygon', label: 'Polygon', icon: '🟣' },
  { id: 'base', label: 'Base', icon: '🔷' },
];

interface Props {
  selectedChain: string;
  onChainChange: (chain: string) => void;
}

export default function ChainSelector({ selectedChain, onChainChange }: Props) {
  return (
    <div style={styles.wrap}>
      {CHAINS.map((chain) => (
        <button
          key={chain.id}
          style={
            selectedChain === chain.id ? styles.btnActive : styles.btn
          }
          onClick={() => onChainChange(chain.id)}
          title={chain.label}
        >
          <span>{chain.icon}</span>
          <span style={styles.label}>{chain.label}</span>
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    gap: 4,
    padding: '4px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-3)',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    fontFamily: 'inherit',
    transition: 'color 0.12s',
  },
  btnActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 6,
    fontFamily: 'inherit',
  },
  label: { fontSize: 12 },
};
