import React, { useState, useMemo } from 'react';
import { formatUSD, formatAPY } from '../utils/format';

export default function YieldCalculator() {
  const [amount, setAmount] = useState(10000);
  const [apy, setApy] = useState(5);
  const [days, setDays] = useState(365);
  const [compound, setCompound] = useState(true);

  const result = useMemo(() => {
    const r = apy / 100;
    if (compound) {
      // Daily compounding
      const periods = days;
      return amount * Math.pow(1 + r / 365, periods) - amount;
    }
    return amount * r * (days / 365);
  }, [amount, apy, days, compound]);

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>🧮 Yield Calculator</h3>

      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Deposit Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            style={styles.input}
            min={0}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>APY (%)</label>
          <input
            type="number"
            value={apy}
            onChange={(e) => setApy(parseFloat(e.target.value) || 0)}
            style={styles.input}
            min={0}
            step={0.1}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Duration (days)</label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
            style={styles.input}
            min={1}
          />
        </div>
      </div>

      <div style={styles.toggleRow}>
        <button
          style={compound ? styles.toggleActive : styles.toggle}
          onClick={() => setCompound(true)}
        >
          Compound
        </button>
        <button
          style={!compound ? styles.toggleActive : styles.toggle}
          onClick={() => setCompound(false)}
        >
          Simple
        </button>
      </div>

      <div style={styles.resultBox}>
        <div style={styles.resultRow}>
          <span style={styles.resultLabel}>Estimated Yield</span>
          <span style={{ ...styles.resultVal, color: '#22C55E' }}>
            +{formatUSD(result)}
          </span>
        </div>
        <div style={styles.resultRow}>
          <span style={styles.resultLabel}>Total Value</span>
          <span style={styles.resultVal}>{formatUSD(amount + result)}</span>
        </div>
        <div style={styles.resultRow}>
          <span style={styles.resultLabel}>Effective APY</span>
          <span style={styles.resultVal}>
            {formatAPY(amount > 0 ? (result / amount) * (365 / days) * 100 : 0)}
          </span>
        </div>
      </div>
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
  fields: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 },
  field: {},
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-3)',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-1)',
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  },
  toggleRow: { display: 'flex', gap: 4, marginBottom: 16 },
  toggle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-3)',
    padding: '6px 16px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toggleActive: {
    background: 'rgba(91,140,255,0.1)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    padding: '6px 16px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resultBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  },
  resultLabel: { fontSize: 13, color: 'var(--text-3)' },
  resultVal: { fontSize: 16, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' },
};
