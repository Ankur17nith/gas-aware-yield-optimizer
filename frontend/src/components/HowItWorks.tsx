import React from 'react';

const steps = [
  {
    icon: '🔍',
    title: 'Pool Discovery',
    desc: 'We aggregate yield pools from Aave, Compound, Curve, Yearn, and more — in real-time from DefiLlama.',
  },
  {
    icon: '⛽',
    title: 'Gas Analysis',
    desc: 'Current Ethereum gas prices are fetched from Etherscan and factored into every APY calculation.',
  },
  {
    icon: '📊',
    title: 'Net APY Ranking',
    desc: 'Pools are ranked by net APY — what you actually earn after gas costs, not just raw returns.',
  },
  {
    icon: '🤖',
    title: 'AI Predictions',
    desc: 'Our ML model (Gradient Boosting) predicts yield trends for the next 30 days with confidence scores.',
  },
  {
    icon: '🔄',
    title: 'Smart Migration',
    desc: 'Get recommendations on when to move your funds, including break-even analysis and gas estimates.',
  },
  {
    icon: '🔐',
    title: 'On-Chain Execution',
    desc: 'Execute deposits, withdrawals, and migrations through audited smart contracts on Ethereum.',
  },
];

export default function HowItWorks() {
  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>How It Works</h2>
        <p style={styles.sub}>
          From data aggregation to on-chain execution — here's the full pipeline
        </p>
      </div>

      <div style={styles.grid}>
        {steps.map((step, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.stepNum}>{i + 1}</div>
            <div style={styles.icon}>{step.icon}</div>
            <h4 style={styles.cardTitle}>{step.title}</h4>
            <p style={styles.cardDesc}>{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: 32,
  },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text-1)' },
  sub: { fontSize: 14, color: 'var(--text-3)', margin: 0 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    position: 'relative',
    textAlign: 'center',
  },
  stepNum: {
    position: 'absolute',
    top: 12,
    left: 14,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--primary)',
    background: 'rgba(91,140,255,0.1)',
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 28, marginBottom: 10 },
  cardTitle: {
    margin: '0 0 6px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-1)',
  },
  cardDesc: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-2)',
    lineHeight: '1.5',
  },
};
