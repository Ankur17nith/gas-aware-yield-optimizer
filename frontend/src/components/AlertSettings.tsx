import React, { useState } from 'react';
import type { Pool } from '../types/pool';

interface AlertRule {
  id: number;
  type: 'apy_drop' | 'apy_rise' | 'gas_low';
  threshold: number;
  protocol?: string;
  enabled: boolean;
}

interface Props {
  pools?: Pool[];
}

export default function AlertSettings({ pools = [] }: Props) {
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem('yo-alerts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return [
      { id: 1, type: 'apy_drop', threshold: 2, enabled: true },
      { id: 2, type: 'gas_low', threshold: 20, enabled: false },
    ];
  });

  const [newType, setNewType] = useState<AlertRule['type']>('apy_drop');
  const [newThreshold, setNewThreshold] = useState(5);

  const save = (updated: AlertRule[]) => {
    setAlerts(updated);
    localStorage.setItem('yo-alerts', JSON.stringify(updated));
  };

  const toggleAlert = (id: number) => {
    save(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  const removeAlert = (id: number) => {
    save(alerts.filter((a) => a.id !== id));
  };

  const addAlert = () => {
    const id = Date.now();
    save([...alerts, { id, type: newType, threshold: newThreshold, enabled: true }]);
  };

  const typeLabels: Record<string, string> = {
    apy_drop: '📉 APY drops below',
    apy_rise: '📈 APY rises above',
    gas_low: '⛽ Gas drops below',
  };

  const unitLabels: Record<string, string> = {
    apy_drop: '%',
    apy_rise: '%',
    gas_low: ' gwei',
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>🔔 Alert Settings</h3>
      <p style={styles.sub}>
        Get notified when conditions are met (stored locally).
        {pools.length > 0 && (
          <span> Currently tracking {pools.length} pools — best APY: {Math.max(...pools.map(p => p.net_apy ?? p.apy ?? 0)).toFixed(2)}%</span>
        )}
      </p>

      <div style={styles.list}>
        {alerts.map((alert) => (
          <div key={alert.id} style={styles.alertRow}>
            <button
              style={alert.enabled ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggleAlert(alert.id)}
            >
              {alert.enabled ? '●' : '○'}
            </button>
            <span style={styles.alertText}>
              {typeLabels[alert.type]} {alert.threshold}
              {unitLabels[alert.type]}
            </span>
            <button style={styles.removeBtn} onClick={() => removeAlert(alert.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={styles.addRow}>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as AlertRule['type'])}
          style={styles.select}
        >
          <option value="apy_drop">APY drops below</option>
          <option value="apy_rise">APY rises above</option>
          <option value="gas_low">Gas drops below</option>
        </select>
        <input
          type="number"
          value={newThreshold}
          onChange={(e) => setNewThreshold(parseFloat(e.target.value) || 0)}
          style={styles.thresholdInput}
          min={0}
        />
        <button style={styles.addBtn} onClick={addAlert}>
          + Add
        </button>
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
  title: { margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' },
  sub: { fontSize: 13, color: 'var(--text-3)', marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  alertRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  toggleOn: {
    background: 'none',
    border: 'none',
    color: 'var(--success)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  toggleOff: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  alertText: { flex: 1, fontSize: 13, color: 'var(--text-1)' },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 12,
    cursor: 'pointer',
    padding: 2,
    fontFamily: 'inherit',
  },
  addRow: { display: 'flex', gap: 8, alignItems: 'center' },
  select: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-1)',
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
  },
  thresholdInput: {
    width: 70,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-1)',
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
  },
  addBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
