import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import LoadingSpinner from './LoadingSpinner';
import ThemeToggle from './ThemeToggle';
import GasTracker from './GasTracker';
import LiveStatsBanner from './LiveStatsBanner';
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
import { formatUSD, formatAPY, formatGwei, formatCompact } from '../utils/format';
import { deposit as depositOnChain } from '../services/routerContract';
import type { Pool } from '../types/pool';

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
  'Aave V3': 0,
  'Compound V3': 0,
  Curve: 1,
  Yearn: 1,
  Spark: 0,
  'Morpho Aave': 0,
};

const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

type TabKey = 'pools' | 'predictions' | 'compare' | 'calculator' | 'leaderboard' | 'history' | 'alerts' | 'howItWorks';

export default function Dashboard() {
  const wallet = useWallet();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [depositAmount, setDepositAmount] = useState(10000);
  const pools = usePools(true);
  const predictions = usePredictions(true);
  const migration = useMigration();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('pools');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [autoCompound, setAutoCompound] = useState(false);
  const [detailPool, setDetailPool] = useState<Pool | null>(null);
  const [dwModal, setDwModal] = useState<{ open: boolean; mode: 'deposit' | 'withdraw'; pool: Pool | null }>({
    open: false,
    mode: 'deposit',
    pool: null,
  });
  const [transactions, setTransactions] = useState<TxRecord[]>(() => {
    try {
      const saved = localStorage.getItem('yo-transactions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist transactions
  const saveTransaction = useCallback((tx: TxRecord) => {
    setTransactions((prev) => {
      const updated = [tx, ...prev].slice(0, 100);
      localStorage.setItem('yo-transactions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Check alerts against live data
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
        if (a.type === 'apy_drop' && bestApy < a.threshold) {
          addToast('warning', `Alert: Best APY (${bestApy.toFixed(2)}%) dropped below ${a.threshold}%`);
        }
        if (a.type === 'apy_rise' && bestApy > a.threshold) {
          addToast('success', `Alert: Best APY (${bestApy.toFixed(2)}%) rose above ${a.threshold}%`);
        }
      }
    } catch { /* ignore */ }
  }, [pools.pools, pools.loading, addToast]);

  const handleRefresh = useCallback(() => {
    pools.fetchPools(depositAmount);
    predictions.fetchPredictions();
    alertsChecked.current = false;
    addToast('info', 'Refreshing pool data…');
  }, [pools, predictions, depositAmount, addToast]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      setDepositAmount(val);
    },
    []
  );

  const handleAmountSubmit = useCallback(() => {
    pools.fetchPools(depositAmount);
  }, [pools, depositAmount]);

  const handleMigrate = useCallback(
    (pool: Pool) => {
      setSelectedPool(pool);
      setModalOpen(true);
      migration.fetchRecommendation(
        pool.protocol,
        pool.token,
        depositAmount
      );
    },
    [migration, depositAmount]
  );

  const handleAmountSubmitWithToast = useCallback(() => {
    pools.fetchPools(depositAmount);
    addToast('info', `Calculating net APY for $${depositAmount.toLocaleString()} deposit…`);
  }, [pools, depositAmount, addToast]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPool(null);
    migration.reset();
  }, [migration]);

  const handleConfirmMigration = useCallback(async () => {
    if (!migration.recommendation?.target || !selectedPool) return;
    const target = migration.recommendation.target;

    if (!wallet.connected) {
      // Simulate migration when wallet not connected
      const fakeTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      saveTransaction({
        id: Date.now().toString(),
        type: 'migrate',
        protocol: `${selectedPool.protocol} → ${target.protocol}`,
        token: selectedPool.token,
        amount: depositAmount,
        gasCost: migration.recommendation.migration_cost_usd ?? 0,
        timestamp: Date.now(),
        txHash: fakeTxHash,
        status: 'success',
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
        depositAmount.toString(),
        (depositAmount * 0.995).toString()
      );
      if (hash) {
        saveTransaction({
          id: Date.now().toString(),
          type: 'migrate',
          protocol: `${selectedPool.protocol} → ${target.protocol}`,
          token: selectedPool.token,
          amount: depositAmount,
          gasCost: migration.recommendation.migration_cost_usd ?? 0,
          timestamp: Date.now(),
          txHash: hash,
          status: 'success',
        });
        addToast('success', 'Migration submitted on-chain!');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Migration failed');
    }
  }, [migration, selectedPool, depositAmount, wallet.connected, saveTransaction, addToast, handleCloseModal]);

  const handlePoolClick = useCallback((pool: Pool) => {
    setDetailPool(pool);
  }, []);

  const handleOpenDeposit = useCallback((pool: Pool) => {
    setDetailPool(null);
    setDwModal({ open: true, mode: 'deposit', pool });
  }, []);

  const handleOpenWithdraw = useCallback((pool: Pool) => {
    setDetailPool(null);
    setDwModal({ open: true, mode: 'withdraw', pool });
  }, []);

  const handleDwConfirm = useCallback(
    async (amount: string) => {
      if (!dwModal.pool) return;
      const pool = dwModal.pool;
      const mode = dwModal.mode;
      const numAmount = parseFloat(amount) || 0;

      if (wallet.connected) {
        // Real on-chain transaction
        const protocolId = PROTOCOL_TO_ID[pool.protocol] ?? 0;
        const tokenAddr = TOKEN_ADDRESSES[pool.token] ?? '';
        if (mode === 'deposit') {
          await depositOnChain(protocolId, tokenAddr, amount);
        }
      }
      // Always simulate + record (works without wallet too)
      const fakeTxHash = wallet.connected
        ? '0xpending...'
        : '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      saveTransaction({
        id: Date.now().toString(),
        type: mode,
        protocol: pool.protocol,
        token: pool.token,
        amount: numAmount,
        gasCost: pool.gas_cost_usd ?? 0,
        timestamp: Date.now(),
        txHash: fakeTxHash,
        status: 'success',
      });
      addToast('success', `${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} of $${numAmount.toLocaleString()} ${pool.token} ${wallet.connected ? 'submitted' : 'simulated'}!`);
    },
    [dwModal, addToast, wallet.connected, saveTransaction]
  );

  // Filter pools by chain ("all" or match)
  const filteredPools = (selectedChain === 'ethereum' || selectedChain === 'all')
    ? pools.pools
    : pools.pools.filter((p) => (p.chain ?? 'Ethereum').toLowerCase() === selectedChain);

  // Summary stats
  const topPool = filteredPools[0];
  const avgGas = filteredPools.length
    ? filteredPools.reduce((s, p) => s + (p.gas_cost_usd ?? 0), 0) / filteredPools.length
    : 0;

  const isDark = theme === 'dark';
  const bg = isDark ? '#0B0F19' : '#F9FAFB';
  const surface = isDark ? '#111827' : '#FFFFFF';
  const border = isDark ? '#1F2937' : '#E5E7EB';
  const textBright = isDark ? '#F9FAFB' : '#111827';
  const textMuted = isDark ? '#6B7280' : '#6B7280';
  const textColor = isDark ? '#E5E7EB' : '#374151';
  const topBarBg = isDark ? '#0d1117' : '#FFFFFF';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pools', label: 'Pools' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'compare', label: 'Compare' },
    { key: 'calculator', label: 'Calculator' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'history', label: 'History' },
    { key: 'alerts', label: 'Alerts' },
    { key: 'howItWorks', label: 'How It Works' },
  ];

  return (
    <div style={{ ...styles.page, background: bg, color: textColor }}>
      {/* Live Stats Banner */}
      <LiveStatsBanner pools={filteredPools} />

      {/* Top bar */}
      <header style={{ ...styles.topBar, background: topBarBg, borderColor: border }}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◆</span>
          <span style={{ ...styles.logoText, color: textBright }}>YieldOptimizer</span>
        </div>
        <nav style={styles.nav}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              style={
                activeTab === tab.key
                  ? { ...styles.navActive, background: isDark ? '#1F2937' : '#E5E7EB', color: textBright }
                  : { ...styles.navItem, color: textMuted }
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div style={styles.topBarRight}>
          <ThemeToggle />
          <WalletConnect
            address={wallet.address}
            connected={wallet.connected}
            loading={wallet.loading}
            error={wallet.error}
            ethBalance={wallet.ethBalance}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </div>
      </header>

      {/* Content */}
      <main style={styles.main}>
        {/* Chain selector & Gas Tracker row */}
        <div style={styles.topWidgets}>
          <ChainSelector selectedChain={selectedChain} onChainChange={setSelectedChain} />
          <GasTracker />
        </div>

        {/* Auto-compound toggle */}
        <AutoCompoundToggle
          enabled={autoCompound}
          onToggle={() => {
            setAutoCompound((v) => !v);
            addToast('info', autoCompound ? 'Auto-compound disabled' : 'Auto-compound enabled');
          }}
        />

        {/* Portfolio Overview */}
        <PortfolioOverview
          pools={filteredPools}
          depositAmount={depositAmount}
          connected={wallet.connected}
        />

        {/* Stat cards */}
        <div style={styles.statsRow}>
          <div style={{ ...styles.statCard, background: surface, borderColor: border }}>
            <span style={{ ...styles.statLabel, color: textMuted }}>Best Net APY</span>
            <span style={{ ...styles.statValue, color: textBright }}>
              {topPool ? formatAPY(topPool.net_apy ?? topPool.apy) : '—'}
            </span>
            <span style={{ ...styles.statSub, color: textMuted }}>
              {topPool ? `${topPool.protocol} · ${topPool.token}` : ''}
            </span>
          </div>
          <div style={{ ...styles.statCard, background: surface, borderColor: border }}>
            <span style={{ ...styles.statLabel, color: textMuted }}>Pools Tracked</span>
            <span style={{ ...styles.statValue, color: textBright }}>{filteredPools.length}</span>
            <span style={{ ...styles.statSub, color: textMuted }}>Across DeFi protocols</span>
          </div>
          <div style={{ ...styles.statCard, background: surface, borderColor: border }}>
            <span style={{ ...styles.statLabel, color: textMuted }}>Avg Gas Cost</span>
            <span style={{ ...styles.statValue, color: textBright }}>{formatUSD(avgGas)}</span>
            <span style={{ ...styles.statSub, color: textMuted }}>Round-trip (deposit+withdraw)</span>
          </div>
          <div style={{ ...styles.statCard, background: surface, borderColor: border }}>
            <span style={{ ...styles.statLabel, color: textMuted }}>30d Projection</span>
            <span style={{ ...styles.statValue, color: '#22C55E' }}>
              {topPool ? formatUSD(topPool.profit_30d ?? 0) : '—'}
            </span>
            <span style={{ ...styles.statSub, color: textMuted }}>
              On {formatCompact(depositAmount)} deposit
            </span>
          </div>
        </div>

        {/* Deposit amount input */}
        <div style={styles.controlRow}>
          <div style={styles.inputGroup}>
            <label style={{ ...styles.inputLabel, color: textMuted }}>Deposit Amount (USD)</label>
            <div style={{ ...styles.inputWrap, background: surface, borderColor: border }}>
              <span style={styles.inputPrefix}>$</span>
              <input
                type="number"
                value={depositAmount}
                onChange={handleAmountChange}
                style={{ ...styles.input, color: textColor }}
                min={0}
              />
              <button style={styles.calcBtn} onClick={handleAmountSubmitWithToast}>
                Calculate Net APY
              </button>
            </div>
          </div>
          <button style={{ ...styles.refreshBtn, borderColor: border, color: textMuted }} onClick={handleRefresh}>
            ↻ Refresh Data
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'pools' && (
          <section>
            <div style={styles.sectionHeader}>
              <h2 style={{ ...styles.sectionTitle, color: textBright }}>Pool Comparison</h2>
              <span style={{ ...styles.sectionSub, color: textMuted }}>
                Ranked by composite score (net APY + TVL + trust)
              </span>
            </div>
            <PoolTable
              pools={filteredPools}
              predictions={predictions.predictions}
              loading={pools.loading}
              onMigrate={handleMigrate}
              onPoolClick={handlePoolClick}
            />
            {/* Prediction graph shown below pool table */}
            {predictions.predictions.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <PredictionChart
                  predictions={predictions.predictions}
                  loading={predictions.loading}
                />
              </div>
            )}
          </section>
        )}

        {activeTab === 'predictions' && (
          <section>
            <PredictionChart
              predictions={predictions.predictions}
              loading={predictions.loading}
            />
          </section>
        )}

        {activeTab === 'compare' && <ComparePools pools={filteredPools} />}
        {activeTab === 'calculator' && <YieldCalculator />}
        {activeTab === 'leaderboard' && <Leaderboard pools={filteredPools} />}
        {activeTab === 'history' && (
          <TransactionHistory
            transactions={transactions}
            onClear={() => {
              setTransactions([]);
              localStorage.removeItem('yo-transactions');
              addToast('info', 'Transaction history cleared');
            }}
          />
        )}
        {activeTab === 'alerts' && <AlertSettings pools={filteredPools} />}
        {activeTab === 'howItWorks' && <HowItWorks />}
      </main>

      {/* Migration modal */}
      <MigrationModal
        open={modalOpen}
        recommendation={migration.recommendation}
        loading={migration.loading}
        txLoading={migration.txLoading}
        txHash={migration.txHash}
        error={migration.error}
        onConfirm={handleConfirmMigration}
        onClose={handleCloseModal}
      />

      {/* Pool Detail modal */}
      {detailPool && (
        <PoolDetail
          pool={detailPool}
          prediction={predictions.predictions.find(
            (p) => p.protocol === detailPool.protocol && p.token === detailPool.token
          )}
          onClose={() => setDetailPool(null)}
          onDeposit={() => handleOpenDeposit(detailPool)}
          onWithdraw={() => handleOpenWithdraw(detailPool)}
        />
      )}

      {/* Deposit/Withdraw modal */}
      <DepositWithdrawModal
        open={dwModal.open}
        mode={dwModal.mode}
        protocol={dwModal.pool?.protocol ?? ''}
        token={dwModal.pool?.token ?? ''}
        onConfirm={handleDwConfirm}
        onClose={() => setDwModal({ open: false, mode: 'deposit', pool: null })}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0B0F19',
    color: '#E5E7EB',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  /* ── Top bar ── */
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 32px',
    borderBottom: '1px solid #1F2937',
    background: '#0d1117',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    color: '#4F46E5',
    fontSize: 20,
    fontWeight: 700,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: '#F9FAFB',
    letterSpacing: '-0.02em',
  },
  nav: {
    display: 'flex',
    gap: 4,
  },
  navItem: {
    background: 'transparent',
    border: 'none',
    color: '#6B7280',
    padding: '6px 16px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    fontFamily: 'inherit',
    transition: 'color 0.12s',
  },
  navActive: {
    background: '#1F2937',
    border: 'none',
    color: '#F9FAFB',
    padding: '6px 16px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    fontFamily: 'inherit',
  },
  /* ── Main ── */
  main: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '32px 24px',
  },
  topWidgets: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 16,
    marginBottom: 20,
  },
  /* ── Stat cards ── */
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: '#111827',
    border: '1px solid #1F2937',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 500,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#F9FAFB',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
  statSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  /* ── Controls ── */
  controlRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    flex: 1,
    maxWidth: 480,
  },
  inputLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#111827',
    border: '1px solid #1F2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputPrefix: {
    padding: '0 0 0 12px',
    color: '#6B7280',
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#E5E7EB',
    padding: '10px 8px',
    fontSize: 14,
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  },
  calcBtn: {
    background: '#4F46E5',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  refreshBtn: {
    background: 'transparent',
    border: '1px solid #1F2937',
    color: '#9CA3AF',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  /* ── Section ── */
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#F9FAFB',
  },
  sectionSub: {
    fontSize: 13,
    color: '#6B7280',
  },
};
