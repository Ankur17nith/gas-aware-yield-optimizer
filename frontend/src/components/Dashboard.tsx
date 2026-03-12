import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useWallet } from '../hooks/useWallet';
import { usePools } from '../hooks/usePools';
import { usePredictions } from '../hooks/usePredictions';
import { useMigration } from '../hooks/useMigration';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import WalletConnect from './WalletConnect';
import PoolTable from './PoolTable';
import PredictionChart from './PredictionChart';
import MigrationModal from './MigrationModal';
import ThemeToggle from './ThemeToggle';
import GasTracker from './GasTracker';
import PortfolioOverview from './PortfolioOverview';
import DepositWithdrawModal from './DepositWithdrawModal';
import TransactionHistory from './TransactionHistory';
import PoolDetail from './PoolDetail';
import ComparePools from './ComparePools';
import YieldCalculator from './YieldCalculator';
import Leaderboard from './Leaderboard';
import ChainSelector from './ChainSelector';
import HowItWorks from './HowItWorks';
import AlertSettings from './AlertSettings';
import AutoCompoundToggle from './AutoCompoundToggle';
import AIRecommendation from './AIRecommendation';
import APYHeatmap from './APYHeatmap';
import ActivityFeed from './ActivityFeed';
import { SkeletonCard, SkeletonTable } from './Skeleton';
import { formatUSD, formatAPY, formatCompact } from '../utils/format';
import { deposit as depositOnChain } from '../services/routerContract';
import type { Pool } from '../types/pool';

/* ── Constants ── */
interface TxRecord {
  id: string;
  type: 'deposit' | 'withdraw' | 'migrate';
  protocol: string;
  token: string;
  amount: number;
  gasCost: number;
  timestamp: number;
  txHash: string;
  status: 'success' | 'pending' | 'failed';
}

const PROTOCOL_TO_ID: Record<string, number> = {
  'Aave V3': 0, 'Compound V3': 0, Curve: 1, Yearn: 1, Spark: 0, 'Morpho Aave': 0,
};
const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

type PageKey = 'dashboard' | 'pools' | 'predictions' | 'compare' | 'calculator' | 'leaderboard' | 'history' | 'alerts' | 'howItWorks';

const NAV_ITEMS: { key: PageKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 'pools', label: 'Pools', icon: '◎' },
  { key: 'predictions', label: 'Predictions', icon: '⟐' },
  { key: 'compare', label: 'Compare', icon: '⇄' },
  { key: 'calculator', label: 'Calculator', icon: '∑' },
  { key: 'leaderboard', label: 'Leaderboard', icon: '▲' },
  { key: 'history', label: 'History', icon: '↩' },
  { key: 'alerts', label: 'Alerts', icon: '◉' },
  { key: 'howItWorks', label: 'How It Works', icon: '?' },
];

/* ── Main Component ── */
export default function Dashboard() {
  const wallet = useWallet();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [depositAmount, setDepositAmount] = useState(10000);
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const pools = usePools(true, selectedChain);
  const predictions = usePredictions(true, selectedChain);
  const migration = useMigration();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [autoCompound, setAutoCompound] = useState(false);
  const [detailPool, setDetailPool] = useState<Pool | null>(null);
  const [dwModal, setDwModal] = useState<{ open: boolean; mode: 'deposit' | 'withdraw'; pool: Pool | null }>({
    open: false, mode: 'deposit', pool: null,
  });
  const [transactions, setTransactions] = useState<TxRecord[]>(() => {
    try {
      const saved = localStorage.getItem('yo-transactions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  /* Transaction persistence */
  const saveTransaction = useCallback((tx: TxRecord) => {
    setTransactions((prev) => {
      const updated = [tx, ...prev].slice(0, 100);
      localStorage.setItem('yo-transactions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /* Alert checking */
  const alertsChecked = useRef(false);
  useEffect(() => {
    if (alertsChecked.current || pools.loading || !pools.pools.length) return;
    alertsChecked.current = true;
    try {
      const savedAlerts = localStorage.getItem('yo-alerts');
      if (!savedAlerts) return;
      const alerts = JSON.parse(savedAlerts) as { type: string; threshold: number; enabled: boolean }[];
      const bestApy = Math.max(...pools.pools.map((p) => p.net_apy ?? p.apy ?? 0));
      for (const a of alerts) {
        if (!a.enabled) continue;
        if (a.type === 'apy_drop' && bestApy < a.threshold)
          addToast('warning', `Alert: Best APY (${bestApy.toFixed(2)}%) dropped below ${a.threshold}%`);
        if (a.type === 'apy_rise' && bestApy > a.threshold)
          addToast('success', `Alert: Best APY (${bestApy.toFixed(2)}%) rose above ${a.threshold}%`);
      }
    } catch { /* ignore */ }
  }, [pools.pools, pools.loading, addToast]);

  /* Handlers */
  const handleRefresh = useCallback(() => {
    pools.fetchPools(depositAmount, selectedChain);
    predictions.fetchPredictions(selectedChain);
    alertsChecked.current = false;
    addToast('info', 'Refreshing pool data…');
  }, [pools, predictions, depositAmount, selectedChain, addToast]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1000;
    setDepositAmount(val);
  }, []);

  const handleSliderRelease = useCallback(() => {
    pools.fetchPools(depositAmount, selectedChain);
  }, [pools, depositAmount, selectedChain]);

  const handleMigrate = useCallback((pool: Pool) => {
    setSelectedPool(pool);
    setModalOpen(true);
    migration.fetchRecommendation(pool.protocol, pool.token, depositAmount, selectedChain);
  }, [migration, depositAmount, selectedChain]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPool(null);
    migration.reset();
  }, [migration]);

  const handleConfirmMigration = useCallback(async () => {
    if (!migration.recommendation?.target || !selectedPool) return;
    const target = migration.recommendation.target;
    if (!wallet.connected) {
      const fakeTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      saveTransaction({
        id: Date.now().toString(), type: 'migrate',
        protocol: `${selectedPool.protocol} → ${target.protocol}`,
        token: selectedPool.token, amount: depositAmount,
        gasCost: migration.recommendation.migration_cost_usd ?? 0,
        timestamp: Date.now(), txHash: fakeTxHash, status: 'success',
      });
      addToast('success', `Migration simulated: ${selectedPool.protocol} → ${target.protocol}`);
      handleCloseModal();
      return;
    }
    try {
      const hash = await migration.executeMigration(
        PROTOCOL_TO_ID[selectedPool.protocol] ?? 0,
        PROTOCOL_TO_ID[target.protocol] ?? 0,
        TOKEN_ADDRESSES[selectedPool.token] ?? '',
        depositAmount.toString(), (depositAmount * 0.995).toString()
      );
      if (hash) {
        saveTransaction({
          id: Date.now().toString(), type: 'migrate',
          protocol: `${selectedPool.protocol} → ${target.protocol}`,
          token: selectedPool.token, amount: depositAmount,
          gasCost: migration.recommendation.migration_cost_usd ?? 0,
          timestamp: Date.now(), txHash: hash, status: 'success',
        });
        addToast('success', 'Migration submitted on-chain!');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Migration failed');
    }
  }, [migration, selectedPool, depositAmount, wallet.connected, saveTransaction, addToast, handleCloseModal]);

  const handlePoolClick = useCallback((pool: Pool) => { setDetailPool(pool); }, []);
  const handleOpenDeposit = useCallback((pool: Pool) => { setDetailPool(null); setDwModal({ open: true, mode: 'deposit', pool }); }, []);
  const handleOpenWithdraw = useCallback((pool: Pool) => { setDetailPool(null); setDwModal({ open: true, mode: 'withdraw', pool }); }, []);

  const handleDwConfirm = useCallback(async (amount: string) => {
    if (!dwModal.pool) return;
    const pool = dwModal.pool;
    const mode = dwModal.mode;
    const numAmount = parseFloat(amount) || 0;
    if (wallet.connected) {
      const protocolId = PROTOCOL_TO_ID[pool.protocol] ?? 0;
      const tokenAddr = TOKEN_ADDRESSES[pool.token] ?? '';
      if (mode === 'deposit') await depositOnChain(protocolId, tokenAddr, amount);
    }
    const fakeTxHash = wallet.connected ? '0xpending...'
      : '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    saveTransaction({
      id: Date.now().toString(), type: mode, protocol: pool.protocol,
      token: pool.token, amount: numAmount, gasCost: pool.gas_cost_usd ?? 0,
      timestamp: Date.now(), txHash: fakeTxHash, status: 'success',
    });
    addToast('success', `${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} of $${numAmount.toLocaleString()} ${pool.token} ${wallet.connected ? 'submitted' : 'simulated'}!`);
  }, [dwModal, addToast, wallet.connected, saveTransaction]);

  /* Derived data — backend already filters by chain */
  const filteredPools = pools.pools;

  const topPool = filteredPools[0];
  const totalTVL = filteredPools.reduce((s, p) => s + (p.tvl ?? 0), 0);
  const bestApy = filteredPools.length ? Math.max(...filteredPools.map(p => p.net_apy ?? p.apy ?? 0)) : 0;
  const protocolCount = new Set(filteredPools.map(p => p.protocol)).size;
  const avgGas = filteredPools.length
    ? filteredPools.reduce((s, p) => s + (p.gas_cost_usd ?? 0), 0) / filteredPools.length : 0;

  const activityItems = useMemo(() =>
    transactions.slice(0, 8).map(tx => ({
      id: tx.id, type: tx.type as any,
      text: `${tx.type === 'migrate' ? 'Migrated' : tx.type === 'deposit' ? 'Deposited' : 'Withdrew'} ${formatUSD(tx.amount)} ${tx.token}`,
      detail: `${tx.protocol} · Gas ${formatUSD(tx.gasCost)}`,
      timestamp: tx.timestamp,
    })),
    [transactions]);

  const isDark = theme === 'dark';

  /* ── Render ── */
  return (
    <div style={S.shell}>
      {/* ── Global Metrics Bar ── */}
      <div style={S.metricsBar}>
        <div style={S.metricsInner}>
          {[
            { label: 'Total TVL', value: formatCompact(totalTVL) },
            { label: 'Best APY', value: `${bestApy.toFixed(1)}%` },
            { label: 'Protocols', value: String(protocolCount) },
            { label: 'Pools', value: String(filteredPools.length) },
          ].map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <span style={S.metricSep}>·</span>}
              <span style={S.metricItem}>
                <span style={S.metricLabel}>{m.label}</span>
                <span style={S.metricValue}>{m.value}</span>
              </span>
            </React.Fragment>
          ))}
          <span style={S.liveIndicator}><span style={S.liveDot} /> Live</span>
        </div>
      </div>

      {/* ── Top Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="var(--primary)" /><path d="M7 17l5-10 5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 13h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
            <span style={S.logoText}>YieldOptimizer</span>
          </div>
        </div>
        <div style={S.headerRight}>
          <ChainSelector selectedChain={selectedChain} onChainChange={setSelectedChain} />
          <ThemeToggle />
          <WalletConnect
            address={wallet.address} connected={wallet.connected}
            loading={wallet.loading} error={wallet.error}
            ethBalance={wallet.ethBalance}
            onConnect={wallet.connect} onDisconnect={wallet.disconnect}
          />
        </div>
      </header>

      <div style={S.layout}>
        {/* ── Sidebar ── */}
        <nav style={S.sidebar}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setActivePage(item.key)}
              style={activePage === item.key ? S.sideItemActive : S.sideItem}
            >
              <span style={S.sideIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={S.sideGap} />
          <GasTracker />
        </nav>

        {/* ── Main Content ── */}
        <main style={S.content}>
          {/* Deposit slider (always visible) */}
          <div style={S.sliderRow}>
            <div style={S.sliderInfo}>
              <span style={S.sliderLabel}>Deposit Amount</span>
              <span style={S.sliderValue}>${depositAmount.toLocaleString()}</span>
            </div>
            <input
              type="range" min={1000} max={100000} step={1000}
              value={depositAmount}
              onChange={handleSliderChange}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              style={S.slider}
            />
            <div style={S.sliderMarks}>
              <span>$1K</span><span>$25K</span><span>$50K</span><span>$75K</span><span>$100K</span>
            </div>
          </div>

          {/* ── Dashboard Page ── */}
          {activePage === 'dashboard' && (
            <div style={S.pageGrid}>
              {/* Portfolio */}
              <div style={{ gridColumn: '1 / -1' }}>
                <PortfolioOverview pools={filteredPools} depositAmount={depositAmount} connected={wallet.connected} />
              </div>

              {/* Stat cards */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={S.statsRow}>
                  {pools.loading ? (
                    <>
                      <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                    </>
                  ) : (
                    <>
                      <StatCard label="Best Net APY" value={topPool ? formatAPY(topPool.net_apy ?? topPool.apy) : '—'} sub={topPool ? `${topPool.protocol} · ${topPool.token}` : ''} color="var(--success)" />
                      <StatCard label="Pools Tracked" value={String(filteredPools.length)} sub="Across DeFi protocols" />
                      <StatCard label="Avg Gas Cost" value={formatUSD(avgGas)} sub="Round-trip" />
                      <StatCard label="30d Projection" value={topPool ? formatUSD(topPool.profit_30d ?? 0) : '—'} sub={`On ${formatCompact(depositAmount)} deposit`} color="var(--success)" />
                    </>
                  )}
                </div>
              </div>

              {/* AI Recommendation */}
              <div style={{ gridColumn: '1 / -1' }}>
                <AIRecommendation pools={filteredPools} depositAmount={depositAmount} />
              </div>

              {/* Quick yield calculator + auto-compound */}
              <div>
                <AutoCompoundToggle enabled={autoCompound} onToggle={() => {
                  setAutoCompound(v => !v);
                  addToast('info', autoCompound ? 'Auto-compound disabled' : 'Auto-compound enabled');
                }} />
              </div>
              <div>
                <ActivityFeed items={activityItems} />
              </div>

              {/* Heatmap */}
              {filteredPools.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <APYHeatmap pools={filteredPools} />
                </div>
              )}
            </div>
          )}

          {/* ── Pools Page ── */}
          {activePage === 'pools' && (
            <div>
              <PageHeader title="Pool Explorer" sub="Ranked by composite score (net APY + TVL + trust)" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                <button style={S.refreshBtn} onClick={handleRefresh}>↻ Refresh Data</button>
              </div>
              {pools.loading ? <SkeletonTable rows={8} /> : (
                <PoolTable pools={filteredPools} predictions={predictions.predictions}
                  loading={pools.loading} onMigrate={handleMigrate} onPoolClick={handlePoolClick} />
              )}
              {predictions.predictions.length > 0 && !pools.loading && (
                <div style={{ marginTop: 24 }}>
                  <PredictionChart predictions={predictions.predictions} loading={predictions.loading} />
                </div>
              )}
            </div>
          )}

          {/* ── Predictions Page ── */}
          {activePage === 'predictions' && (
            <div>
              <PageHeader title="AI Predictions" sub="ML-powered yield forecasts with confidence scores" />
              <PredictionChart predictions={predictions.predictions} loading={predictions.loading} />
            </div>
          )}

          {/* ── Compare Page ── */}
          {activePage === 'compare' && (
            <div>
              <PageHeader title="Compare Pools" sub="Side-by-side analysis" />
              <ComparePools pools={filteredPools} />
            </div>
          )}

          {/* ── Calculator Page ── */}
          {activePage === 'calculator' && (
            <div>
              <PageHeader title="Yield Calculator" sub="Simulate deposits and estimate returns" />
              <YieldCalculator />
            </div>
          )}

          {/* ── Leaderboard Page ── */}
          {activePage === 'leaderboard' && (
            <div>
              <PageHeader title="Leaderboard" sub="Top pools ranked by net APY" />
              <Leaderboard pools={filteredPools} />
            </div>
          )}

          {/* ── History Page ── */}
          {activePage === 'history' && (
            <div>
              <PageHeader title="Transaction History" sub="Your deposit, withdrawal, and migration activity" />
              <TransactionHistory transactions={transactions} onClear={() => {
                setTransactions([]);
                localStorage.removeItem('yo-transactions');
                addToast('info', 'Transaction history cleared');
              }} />
            </div>
          )}

          {/* ── Alerts Page ── */}
          {activePage === 'alerts' && (
            <div>
              <PageHeader title="Alert Settings" sub="Configure APY and gas notifications" />
              <AlertSettings pools={filteredPools} />
            </div>
          )}

          {/* ── How It Works Page ── */}
          {activePage === 'howItWorks' && <HowItWorks />}
        </main>
      </div>

      {/* ── Modals ── */}
      <MigrationModal open={modalOpen} recommendation={migration.recommendation}
        loading={migration.loading} txLoading={migration.txLoading}
        txHash={migration.txHash} error={migration.error}
        onConfirm={handleConfirmMigration} onClose={handleCloseModal} />

      {detailPool && (
        <PoolDetail pool={detailPool}
          prediction={predictions.predictions.find(p => p.protocol === detailPool.protocol && p.token === detailPool.token)}
          onClose={() => setDetailPool(null)}
          onDeposit={() => handleOpenDeposit(detailPool)}
          onWithdraw={() => handleOpenWithdraw(detailPool)} />
      )}

      <DepositWithdrawModal open={dwModal.open} mode={dwModal.mode}
        protocol={dwModal.pool?.protocol ?? ''} token={dwModal.pool?.token ?? ''}
        onConfirm={handleDwConfirm}
        onClose={() => setDwModal({ open: false, mode: 'deposit', pool: null })} />
    </div>
  );
}

/* ── Sub-components ── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card-hover" style={S.statCard}>
      <span style={S.statLabel}>{label}</span>
      <span style={{ ...S.statValue, color: color || 'var(--text-1)' }}>{value}</span>
      <span style={S.statSub}>{sub}</span>
    </div>
  );
}

function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-2)' }}>{sub}</p>
    </div>
  );
}

/* ── Styles ── */
const S: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text-1)',
    fontFamily: "'Inter', system-ui, sans-serif",
  },

  /* Global Metrics Bar */
  metricsBar: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '6px 32px',
  },
  metricsInner: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
  },
  metricItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 },
  metricLabel: { color: 'var(--text-3)', fontWeight: 500 },
  metricValue: { color: 'var(--text-1)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  metricSep: { color: 'var(--border)', fontSize: 10 },
  liveIndicator: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.06em',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%', background: 'var(--success)',
    animation: 'pulse-dot 2s ease-in-out infinite', display: 'inline-block',
  },

  /* Header */
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 32px', borderBottom: '1px solid var(--border)',
    background: 'var(--surface)', position: 'sticky' as const, top: 0, zIndex: 100,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoText: {
    fontSize: 16, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em',
  },

  /* Layout */
  layout: {
    display: 'flex', minHeight: 'calc(100vh - 90px)',
  },

  /* Sidebar */
  sidebar: {
    width: 220, flexShrink: 0,
    background: 'var(--surface)', borderRight: '1px solid var(--border)',
    padding: '16px 8px', display: 'flex', flexDirection: 'column' as const, gap: 2,
    position: 'sticky' as const, top: 49, height: 'calc(100vh - 49px)', overflowY: 'auto' as const,
  },
  sideItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'transparent', border: 'none', color: 'var(--text-2)',
    padding: '8px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    borderRadius: 8, fontFamily: 'inherit', textAlign: 'left' as const, width: '100%',
  },
  sideItemActive: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)',
    padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    borderRadius: 8, fontFamily: 'inherit', textAlign: 'left' as const, width: '100%',
  },
  sideIcon: { fontSize: 14, width: 20, textAlign: 'center' as const, flexShrink: 0 },
  sideGap: { flex: 1 },

  /* Content */
  content: {
    flex: 1, padding: 32, maxWidth: 1200, minWidth: 0,
  },

  /* Slider */
  sliderRow: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 24px', marginBottom: 24,
  },
  sliderInfo: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8,
  },
  sliderLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  sliderValue: { fontSize: 28, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' },
  slider: {
    width: '100%', height: 6, appearance: 'none' as any,
    background: 'var(--border)', borderRadius: 3, outline: 'none',
    cursor: 'pointer',
  },
  sliderMarks: {
    display: 'flex', justifyContent: 'space-between', marginTop: 4,
    fontSize: 11, color: 'var(--text-3)',
  },

  /* Stat cards */
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
  },
  statCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 20px',
    display: 'flex', flexDirection: 'column' as const,
  },
  statLabel: {
    fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 4,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: 28, fontWeight: 700, color: 'var(--text-1)',
    fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
  },
  statSub: { fontSize: 12, color: 'var(--text-3)', marginTop: 4 },

  /* Page grid */
  pageGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
  },

  /* Buttons */
  refreshBtn: {
    background: 'var(--card)', border: '1px solid var(--border)',
    color: 'var(--text-2)', borderRadius: 8, padding: '8px 16px',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  },
};
