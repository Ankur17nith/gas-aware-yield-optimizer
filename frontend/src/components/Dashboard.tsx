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
import ContractStatusPanel from './ContractStatusPanel';
import SourceBadges from './SourceBadges';
import { SkeletonCard, SkeletonTable } from './Skeleton';
import { formatUSD, formatAPY, formatCompact } from '../utils/format';
import {
  deposit as depositOnChain,
  withdraw as withdrawOnChain,
  getContractStatus,
  testSmartContract,
} from '../services/routerContract';
import { api } from '../services/api';
import type { Pool } from '../types/pool';
import type { ContractStatus } from '../services/routerContract';

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
  chainId: number | null;
}

const PROTOCOL_TO_ID: Record<string, number> = {
  'Aave V3': 0, Aave: 0, Curve: 1, 'Compound V3': 2, Compound: 2, Yearn: 1, Spark: 0, 'Morpho Aave': 0,
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
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 960);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoCompound, setAutoCompound] = useState(false);
  const [autoRebalanceEnabled, setAutoRebalanceEnabled] = useState(false);
  const [gasThreshold, setGasThreshold] = useState(20);
  const [autoRebalanceMessage, setAutoRebalanceMessage] = useState<string | null>(null);
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [contractStatusLoading, setContractStatusLoading] = useState(false);
  const [contractStatusError, setContractStatusError] = useState<string | null>(null);
  const [testTxLoading, setTestTxLoading] = useState(false);
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

  const refreshContractStatus = useCallback(async () => {
    if (!wallet.connected) return;
    setContractStatusLoading(true);
    setContractStatusError(null);
    try {
      const status = await getContractStatus(wallet.address);
      setContractStatus(status);
    } catch (err: any) {
      setContractStatusError(err.message || 'Failed to load contract status');
    } finally {
      setContractStatusLoading(false);
    }
  }, [wallet.connected]);

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
    migration.fetchRecommendation(pool.protocol, pool.token, depositAmount, selectedChain, gasThreshold);
  }, [migration, depositAmount, selectedChain, gasThreshold]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPool(null);
    migration.reset();
  }, [migration]);

  const handleConfirmMigration = useCallback(async () => {
    if (!migration.recommendation?.target || !selectedPool) return;
    const target = migration.recommendation.target;
    try {
      if (!wallet.connected) {
        await wallet.connect();
      }
      const hash = await migration.executeRebalance(
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
          timestamp: Date.now(), txHash: hash, status: 'success', chainId: wallet.chainId,
        });
        addToast('success', 'Migration submitted on-chain!');
        refreshContractStatus();
      }
    } catch (err: any) {
      addToast('error', err.message || 'Migration failed');
    }
  }, [migration, selectedPool, depositAmount, wallet, saveTransaction, addToast, refreshContractStatus]);

  const handlePoolClick = useCallback((pool: Pool) => { setDetailPool(pool); }, []);
  const handleOpenDeposit = useCallback((pool: Pool) => { setDetailPool(null); setDwModal({ open: true, mode: 'deposit', pool }); }, []);
  const handleOpenWithdraw = useCallback((pool: Pool) => { setDetailPool(null); setDwModal({ open: true, mode: 'withdraw', pool }); }, []);

  const handleDwConfirm = useCallback(async (amount: string) => {
    if (!dwModal.pool) return;
    const pool = dwModal.pool;
    const mode = dwModal.mode;
    const numAmount = parseFloat(amount) || 0;
    if (!wallet.connected) {
      await wallet.connect();
    }
    const protocolId = PROTOCOL_TO_ID[pool.protocol] ?? 0;
    const tokenAddr = TOKEN_ADDRESSES[pool.token] ?? '';
    const txHash = mode === 'deposit'
      ? await depositOnChain(protocolId, tokenAddr, amount)
      : await withdrawOnChain(protocolId, tokenAddr, amount);

    saveTransaction({
      id: Date.now().toString(), type: mode, protocol: pool.protocol,
      token: pool.token, amount: numAmount, gasCost: pool.gas_cost_usd ?? 0,
      timestamp: Date.now(), txHash, status: 'success', chainId: wallet.chainId,
    });
    addToast('success', `${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} submitted on-chain for $${numAmount.toLocaleString()} ${pool.token}!`);
    refreshContractStatus();
  }, [dwModal, addToast, wallet, saveTransaction, refreshContractStatus]);

  const handleTestSmartContract = useCallback(async () => {
    try {
      if (!wallet.connected) {
        await wallet.connect();
      }
      setTestTxLoading(true);
      const result = await testSmartContract();
      saveTransaction({
        id: Date.now().toString(),
        type: 'deposit',
        protocol: 'Router Test Tx',
        token: 'ETH',
        amount: 0,
        gasCost: 0,
        timestamp: Date.now(),
        txHash: result.hash,
        status: result.status === 'success' ? 'success' : 'failed',
        chainId: wallet.chainId,
      });
      addToast('success', `Test tx confirmed. Gas used: ${result.gasUsed}`);
      refreshContractStatus();
    } catch (err: any) {
      addToast('error', err.message || 'Test transaction failed');
    } finally {
      setTestTxLoading(false);
    }
  }, [wallet, saveTransaction, addToast, refreshContractStatus]);

  useEffect(() => {
    if (wallet.connected) {
      refreshContractStatus();
    }
  }, [wallet.connected, wallet.chainId, refreshContractStatus]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!autoRebalanceEnabled || !selectedPool) {
      setAutoRebalanceMessage(null);
      return;
    }

    const runCheck = async () => {
      try {
        const result = await api.getAutoRebalance(
          selectedPool.protocol,
          selectedPool.token,
          depositAmount,
          gasThreshold,
          selectedChain
        );
        const rec = result?.recommendation;
        if (result?.should_rebalance) {
          setAutoRebalanceMessage(`Auto-rebalance ready: ${rec?.reason || 'higher net APY detected.'}`);
        } else {
          setAutoRebalanceMessage(rec?.optimal_gas_window || rec?.reason || 'No rebalance action needed.');
        }
      } catch (err: any) {
        setAutoRebalanceMessage(err.message || 'Auto-rebalance check failed');
      }
    };

    runCheck();
  }, [autoRebalanceEnabled, selectedPool, depositAmount, gasThreshold, selectedChain]);

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
          {isMobile && (
            <button style={S.menuBtn} onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">
              {sidebarOpen ? 'Close' : 'Menu'}
            </button>
          )}
          <div style={S.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="var(--primary)" /><path d="M7 17l5-10 5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 13h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
            <span style={S.logoText}>YieldOptimizer</span>
          </div>
        </div>
        <div style={S.headerRight}>
          <ChainSelector selectedChain={selectedChain} onChainChange={setSelectedChain} />
          <ThemeToggle />
          <WalletConnect compact={isMobile} />
        </div>
      </header>

      <div style={S.layout}>
        {/* ── Sidebar ── */}
        <nav
          style={{
            ...S.sidebar,
            ...(isMobile ? S.sidebarMobile : {}),
            ...(isMobile && sidebarOpen ? S.sidebarMobileOpen : {}),
          }}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => {
                setActivePage(item.key);
                if (isMobile) setSidebarOpen(false);
              }}
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
  <main style={{ ...S.content, ...(isMobile ? S.contentMobile : {}) }}>
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
              <div style={{ gridColumn: '1 / -1' }}>
                <SourceBadges
                  sources={{
                    ...(pools.sources || {}),
                    ...(predictions.sources || {}),
                  }}
                />
              </div>

              {/* Portfolio */}
              <div style={{ gridColumn: '1 / -1' }}>
                <PortfolioOverview pools={filteredPools} depositAmount={depositAmount} connected={wallet.connected} />
              </div>

              {/* Stat cards */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={S.statsRow}>
                  {pools.loading ? (
                        <>
                          <div style={S.loadingLine}>Aggregating DeFi data...</div>
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
                <div style={S.autoRebalanceCard}>
                  <div style={S.autoRebalanceHead}>
                    <span style={S.autoRebalanceTitle}>Auto Rebalance</span>
                    <label style={S.switchWrap}>
                      <input
                        type="checkbox"
                        checked={autoRebalanceEnabled}
                        onChange={() => setAutoRebalanceEnabled(v => !v)}
                      />
                    </label>
                  </div>
                  <div style={S.autoRebalanceBody}>
                    <label style={S.gasInputLabel}>Gas Threshold (gwei)</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={gasThreshold}
                      onChange={(e) => setGasThreshold(Number(e.target.value) || 20)}
                      style={S.gasInput}
                    />
                    <p style={S.autoRebalanceText}>
                      {autoRebalanceMessage || 'Enable to recommend migration only when APY delta beats gas cost.'}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <ActivityFeed items={activityItems} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <ContractStatusPanel
                  status={contractStatus}
                  chainId={wallet.chainId}
                  loading={contractStatusLoading}
                  error={contractStatusError}
                  onRefresh={refreshContractStatus}
                  onTestTransaction={handleTestSmartContract}
                  txLoading={testTxLoading}
                />
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
              <SourceBadges sources={pools.sources || {}} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                <button style={S.refreshBtn} onClick={handleRefresh}>↻ Refresh Data</button>
              </div>
              {pools.loading ? (
                <>
                  <div style={S.loadingLine}>Fetching pools...</div>
                  <SkeletonTable rows={8} />
                </>
              ) : (
                <PoolTable pools={filteredPools} predictions={predictions.predictions}
                  loading={pools.loading} error={pools.error}
                  onMigrate={handleMigrate} onPoolClick={handlePoolClick} />
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
              <SourceBadges sources={predictions.sources || {}} />
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
        chainId={wallet.chainId}
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
  menuBtn: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    color: 'var(--text-1)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
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
  sidebarMobile: {
    position: 'fixed',
    top: 98,
    left: 0,
    width: 250,
    height: 'calc(100vh - 98px)',
    transform: 'translateX(-105%)',
    transition: 'transform 0.2s ease',
    zIndex: 140,
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
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
  contentMobile: {
    padding: 14,
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
  autoRebalanceCard: {
    marginTop: 16,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 12,
  },
  autoRebalanceHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  autoRebalanceTitle: {
    color: 'var(--text-1)',
    fontWeight: 600,
    fontSize: 13,
  },
  switchWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  autoRebalanceBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  gasInputLabel: {
    color: 'var(--text-3)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  gasInput: {
    background: 'var(--surface)',
    color: 'var(--text-1)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  autoRebalanceText: {
    margin: 0,
    color: 'var(--text-2)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  loadingLine: {
    marginBottom: 12,
    color: 'var(--text-2)',
    fontSize: 13,
    fontWeight: 500,
  },
};
