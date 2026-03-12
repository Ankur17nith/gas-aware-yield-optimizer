import React from 'react';

const spinner: React.CSSProperties = {
  display: 'inline-block',
  width: 20,
  height: 20,
  border: '2px solid var(--border)',
  borderTopColor: 'var(--primary)',
  borderRadius: '50%',
  animation: 'yo-spin 0.6s linear infinite',
};

export default function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes yo-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        style={{ ...spinner, width: size, height: size }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
}
