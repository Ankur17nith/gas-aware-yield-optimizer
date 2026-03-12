import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={styles.btn}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 16,
    cursor: 'pointer',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
    lineHeight: 1,
  },
};
