# Architecture Overview

## Gas-Aware Stablecoin Yield Optimizer

### System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Frontend (React + TypeScript)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Dashboard │  │ PoolTable│  │Prediction│  │ Migration Modal  │    │
│  │          │  │          │  │  Chart   │  │                  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │
│       │              │              │                 │              │
│  ┌────┴──────────────┴──────────────┴─────────────────┴──────┐      │
│  │                    Custom Hooks Layer                      │      │
│  │  useWallet  │  usePools  │  usePredictions │ useMigration │      │
│  └────┬──────────────┬──────────────┬─────────────────┬──────┘      │
│       │              │              │                 │              │
│  ┌────┴──────────────┴──────────────┴─────────────────┴──────┐      │
│  │                   Services Layer                           │      │
│  │  api.ts (REST)  │  blockchain.ts  │  routerContract.ts    │      │
│  └────┬──────────────────────────────────────────┬───────────┘      │
└───────┼──────────────────────────────────────────┼──────────────────┘
        │ HTTP                                     │ ethers.js
        ▼                                          ▼
┌───────────────────────┐              ┌──────────────────────────────┐
│  Backend (FastAPI)    │              │  Ethereum Mainnet            │
│                       │              │                              │
│  ┌─────────────────┐  │              │  ┌────────────────────────┐  │
│  │   Aggregator    │  │              │  │     Router.sol         │  │
│  │  fetch_pools    │  │              │  │  ┌──────────────────┐  │  │
│  │  fetch_gas      │  │              │  │  │  AaveAdapter     │  │  │
│  │  price_feeds    │  │              │  │  │  CurveAdapter    │  │  │
│  │  historical     │  │              │  │  └──────────────────┘  │  │
│  └────────┬────────┘  │              │  └────────────────────────┘  │
│           │           │              │                              │
│  ┌────────▼────────┐  │              │  External Protocols:         │
│  │    Engine       │  │              │  - Aave V3                   │
│  │  net_yield      │  │              │  - Curve Finance             │
│  │  pool_ranker    │  │              │  - Compound V3               │
│  │  migration_rec  │  │              │  - Yearn Finance             │
│  └────────┬────────┘  │              └──────────────────────────────┘
│           │           │
│  ┌────────▼────────┐  │
│  │   AI Engine     │  │
│  │  feature_eng    │  │
│  │  train_model    │  │
│  │  yield_predict  │  │
│  └─────────────────┘  │
└───────────────────────┘
```

### Layer Descriptions

#### 1. Smart Contracts (`contracts/`)

| Contract | Purpose |
|----------|---------|
| `Router.sol` | Central entry point for deposits, withdrawals, and migrations. Manages adapters, fees, token whitelist, and pause functionality. |
| `AaveAdapter.sol` | Interfaces with Aave V3 lending pools. Handles supply/withdraw via the Aave Pool contract. |
| `CurveAdapter.sol` | Interfaces with Curve Finance pools. Handles single-coin liquidity add/remove with slippage protection. |
| `SafeTransfer.sol` | Library for safe ERC-20 transfers. Handles non-standard tokens like USDT. |

**Security Features:**
- ReentrancyGuard on all state-changing functions
- Emergency pause mechanism
- Token whitelist
- Fee cap at 50 basis points
- Access control (onlyOwner, onlyRouter)

#### 2. Backend (`backend/`)

**Aggregator Module** — Fetches real-time data from external sources:
- DefiLlama Yields API for pool APY and TVL data
- Etherscan Gas Oracle / RPC fallback for gas prices
- DefiLlama Prices API for token prices with ETH
- DefiLlama Chart API for 30-day historical APY

**Engine Module** — Computes financial metrics:
- Net APY after gas costs per protocol
- Pool ranking by composite score (55% yield + 20% TVL + 25% trust)
- Migration recommendations with break-even analysis

**AI Engine** — Predicts future yields:
- Feature extraction from historical data (6 features)
- Gradient Boosting model training with bootstrap augmentation
- 30-day forward yield prediction with confidence intervals

**Blockchain Module** — On-chain interaction:
- Event polling for contract activity monitoring
- Transaction building for migration execution
- Token balance queries

#### 3. Frontend (`frontend/`)

**Component Architecture:**
- `Dashboard` — Main container with stat cards, tab navigation, deposit input
- `PoolTable` — Sortable table with net APY, gas costs, AI predictions
- `PredictionChart` — Area chart (recharts) comparing current vs predicted APY
- `MigrationModal` — Full migration workflow with recommendation, comparison, execution
- `WalletConnect` — MetaMask connection with balance display

**State Management:**
- Custom hooks per domain (wallet, pools, predictions, migration)
- React state + useEffect for data fetching
- No external state library needed for this scope

### Data Flow

1. **Pool Discovery**: Backend fetches pools from DefiLlama → filters to Ethereum stablecoins → caches 45s
2. **Net Yield Calc**: Gas price × protocol gas estimate = gas cost → gross_apy - gas_cost = net_apy
3. **AI Prediction**: Historical 30-day data → feature extraction → model inference → predicted APY + confidence
4. **Migration**: Compare current position vs target → calculate migration gas + 30d gain → recommend/hold
5. **Execution**: User approves → Router.migrate() → withdraw from source → deposit to target → emit event

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/pools` | Ranked pool data |
| GET | `/gas` | Current gas prices (safe/standard/fast) |
| GET | `/prices` | Token + ETH prices |
| POST | `/net-yield` | Calculate net APY for deposit amount |
| POST | `/predictions` | AI yield predictions for pools |
| POST | `/migration` | Migration recommendation |
| GET | `/historical/{pool_id}` | 30-day historical APY |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.19, Hardhat |
| Backend | Python 3.11+, FastAPI, uvicorn |
| AI/ML | scikit-learn, numpy |
| Frontend | React 18, TypeScript, Vite |
| Charts | Recharts |
| Blockchain | ethers.js v6, web3.py |
| Data Sources | DefiLlama, Etherscan, CoinGecko |
