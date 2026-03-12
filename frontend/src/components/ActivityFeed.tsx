import React from 'react';

interface FeedItem {
  id: string;
  type: 'migrate' | 'deposit' | 'withdraw';
  text: string;
  detail: string;
  timestamp: number;
}

interface Props {
  items: FeedItem[];
}

const typeIcons: Record<string, string> = {
  migrate: '↔',
  deposit: '↓',
  withdraw: '↑',
};

const typeColors: Record<string, string> = {
  migrate: '#5B8CFF',
  deposit: '#22C55E',
  withdraw: '#F59E0B',
};

export default function ActivityFeed({ items }: Props) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
        Recent Activity
      </h3>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
          No recent activity
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.slice(0, 8).map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `${typeColors[item.type]}15`,
                color: typeColors[item.type],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 2,
              }}>
                {typeIcons[item.type]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{item.text}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.detail}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {formatTimeAgo(item.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
