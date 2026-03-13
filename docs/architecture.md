# Architecture Overview

## Gas-Aware Stablecoin Yield Optimizer

### System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Dashboard│  │ PoolTable│  │Prediction│  │ Migration Modal  │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘     │
│       │              │              │                 │               │
│  ┌────┴──────────────┴──────────────┴─────────────────┴──────┐       │
│  │                    Custom Hooks Layer                      │       │
│  │  useWallet  │  usePools  │  usePredictions │ useMigration │       │
│  └────┬──────────────┬──────────────┬─────────────────┬──────┘       │
│       │              │              │                 │               │
│  ┌────┴──────────────┴──────────────┴─────────────────┴──────┐       │
│  │                       Services Layer                       │       │
│  │  api.ts (REST)  │ blockchain.ts │ routerContract.ts       │       │
│  └────┬──────────────────────────────────────────┬───────────┘       │
└───────┼──────────────────────────────────────────┼───────────────────┘
        │ HTTP                                     │ ethers.js
        ▼                                          ▼
┌───────────────────────┐              ┌──────────────────────────────┐
│  Backend (FastAPI)    │              │  Ethereum / Sepolia          │
│                       │              │                              │
│  ┌─────────────────┐  │              │  ┌────────────────────────┐  │
│  │   Aggregator    │  │              │  │     Router.sol         │  │
│  │  fetch_pools    │  │              │  │  ┌──────────────────┐  │  │
│  │  fetch_gas      │  │              │  │  │  AaveAdapter     │  │  │
│  │  price_feeds    │  │              │  │  │  CurveAdapter    │  │  │
│  │  historical     │  │              │  │  │  CompoundAdapter │  │  │
│  └────────┬────────┘  │              │  │  └──────────────────┘  │  │
│           │           │              │  └────────────────────────┘  │
│  ┌────────▼────────┐  │              │                              │
│  │    Engine       │  │              │  External Protocols:         │
│  │  net_yield      │  │              │  - Aave V3                   │
│  │  pool_ranker    │  │              │  - Curve Finance             │
│  │  migration_rec  │  │              │  - Compound V3               │
│  └────────┬────────┘  │              │  - Yearn Finance             │
│           │           │              └──────────────────────────────┘
│  ┌────────▼────────┐  │
│  │   AI Engine     │  │
│  │  feature_eng    │  │
│  │  train_model    │  │
│  │  yield_predict  │  │
│  └────────┬────────┘  │
│           │           │
│  ┌────────▼────────┐  │
│  │ Gemini Service  │  │
│  │ gemini_explainer│  │
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
| `CompoundAdapter.sol` | Interfaces with Compound V3 Comet for deposit/withdraw flows. |
| `SafeTransfer.sol` | Library for safe ERC-20 transfers. Handles non-standard tokens like USDT. |

#### 2. Backend (`backend/`)

**Aggregator Module** — Fetches real-time data:
- DefiLlama Yields API for pool APY and TVL
- Etherscan Gas Oracle / RPC fallback for gas prices
- DefiLlama / CoinGecko price sources for ETH and token pricing
- DefiLlama historical APY series for model features

**Engine Module** — Computes strategy metrics:
- Net APY after gas costs
- Trust and risk-aware pool ranking
- Migration recommendations and break-even logic

**AI Engine** — Predicts near-term yields:
- Feature extraction from historical data
- Model inference for 30-day APY trajectories

**Services Module** — External AI integrations:
- Gemini strategy explanation service (`services/gemini_explainer.py`)
- Deterministic fallback explanation if Gemini is unavailable

#### 3. Frontend (`frontend/`)

**Component Architecture:**
- `Dashboard` — Main container with metrics, navigation, and actions
- `PoolTable` — Sortable pool table with APY, gas, trust, risk, and prediction views
- `AIAgentStrategyPanel` — Autonomous recommendation + Gemini explanation block
- `MigrationModal` — On-chain migration execution workflow
- `ContractStatusPanel` — Wallet/network/router diagnostics
- `WalletConnect` — MetaMask and connector integration

**State Management:**
- Custom hooks per domain (`useWallet`, `usePools`, `usePredictions`, `useMigration`)
- Local React state and effect-driven API fetching

### Data Flow

1. Pool data fetched from DefiLlama and normalized.
2. Net-yield engine computes gas-aware APY and expected 30-day outcomes.
3. Ranking engine scores pools and determines recommendation targets.
4. Autonomous strategy endpoint returns action, confidence, reasoning, and explanation.
5. Gemini explainer generates plain-language rationale for recommendation context.
6. Frontend renders strategy recommendation and optional on-chain migration actions.
7. Router contract executes deposit/withdraw/migrate/rebalance on supported adapters.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/pools` | Normalized pools feed |
| GET | `/gas` | Current gas prices (safe/standard/fast) |
| GET | `/prices` | Token + ETH prices |
| GET | `/net-yield` | Gas-aware net APY calculations |
| GET | `/predictions` | AI yield predictions |
| GET | `/migration` | Migration recommendation |
| GET | `/auto-rebalance` | Auto-rebalance recommendation status |
| GET | `/leaderboard` | Top pools ranked by net APY |
| GET | `/portfolio` | Portfolio simulation |
| GET | `/ai-agent/strategy` | Autonomous strategy recommendation |
| GET | `/ai/explain-strategy` | Gemini explanation endpoint |
| GET | `/historical` | Historical APY payload |

### Wallet + Router Reliability

- Frontend wallet service supports both wagmi wallet clients and injected `window.ethereum`.
- Router service lazily resolves provider/signer and avoids false provider-not-connected states.
- Runtime router address can come from env or local storage override.
- Contract status panel reports wallet, network, contract address, latest block, and last tx.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.19, Hardhat |
| Backend | Python 3.11+, FastAPI, uvicorn |
| AI/ML | scikit-learn, numpy, Google Gemini API |
| Frontend | React 18, TypeScript, Vite |
| Blockchain | ethers.js v6, web3.py |
| Data Sources | DefiLlama, Etherscan/RPC, CoinGecko |
