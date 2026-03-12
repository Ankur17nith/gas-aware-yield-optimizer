import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { GasData } from '../types/api';

export default function GasTracker() {
  const [gas, setGas] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGas = useCallback(async () => {
    try {
      const data = await api.getGas();
      setGas(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGas();
    const interval = setInterval(fetchGas, 15000);
    return () => clearInterval(interval);
  }, [fetchGas]);

  if (loading || !gas) {
    return (
      <div style={styles.widget}>
        <span style={styles.title}>⛽ Gas Tracker</span>
        <span style={styles.loading}>Loading…</span>
      </div>
    );
  }

  const tiers = [
    { label: '🐢 Low', value: gas.safe ?? 0 },
    { label: '🚗 Avg', value: gas.standard ?? 0 },
    { label: '🚀 Fast', value: gas.fast ?? 0 },
  ];

  return (
    <div style={styles.widget}>
      <span style={styles.title}>⛽ Gas Tracker</span>
      <div style={styles.tiers}>
        {tiers.map((t) => (
          <div key={t.label} style={styles.tier}>
            <span style={styles.tierLabel}>{t.label}</span>
            <span style={styles.tierVal}>{Number(t.value).toFixed(0)} gwei</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  widget: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-1)',
    marginBottom: 10,
  },
  loading: { fontSize: 12, color: 'var(--text-3)' },
  tiers: { display: 'flex', gap: 12 },
  tier: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'center',
  },
  tierLabel: { display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 },
  tierVal: { fontSize: 14, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' },
};
