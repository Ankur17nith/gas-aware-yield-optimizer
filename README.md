# Gas-Aware Stablecoin Yield Optimizer

A full-stack DeFi application that helps users maximize yield on stablecoins (USDC, DAI, USDT) by calculating net APY after gas costs and enabling one-click migration between DeFi pools.

## Features

- **Real-Time Net APY** — See actual yield after gas costs, not just gross APY
- **AI Yield Predictions** — ML model predicts 30-day forward yields with confidence intervals
- **Smart Migration** — One-click migration between protocols with break-even analysis
- **Autonomous Strategy Agent** — IQ-style decision engine for migrate/consider/hold actions
- **ADK-TS Core Agent** — Autonomous strategy execution powered by `@iqai/adk`
- **Gemini AI Explanations** — Generates plain-language reasoning for recommended strategies
- **Multi-Protocol Support** — Aave V3, Curve, Compound V3, Yearn, Spark, Morpho
- **Live Data** — Real-time data from DefiLlama, Etherscan, and on-chain sources

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity ^0.8.19, Hardhat |
| Backend | Python 3.11+, FastAPI |
| AI/ML | scikit-learn (Gradient Boosting) |
| Frontend | React 18, TypeScript, Vite |
| Blockchain | ethers.js v6 |

## Project Structure

```
yield-optimizer/
├── contracts/              # Solidity smart contracts
│   ├── Router.sol          # Central routing contract
│   ├── adapters/           # Protocol adapters (Aave, Curve)
│   ├── interfaces/         # Contract interfaces
│   └── libraries/          # SafeTransfer library
├── backend/                # Python FastAPI server
│   ├── app.py              # API endpoints
│   ├── aggregator/         # Data fetching (DefiLlama, Etherscan)
│   ├── engine/             # Net yield, ranking, migration logic
│   ├── ai_engine/          # ML model training & prediction
│   ├── services/           # External AI integrations (Gemini explainer)
│   └── blockchain/         # On-chain interaction
├── frontend/               # React + TypeScript app
│   └── src/
│       ├── components/     # UI components
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API & blockchain services
│       ├── types/          # TypeScript interfaces
│       └── utils/          # Formatting & calculations
├── agents/                 # Autonomous strategy agent definitions
│   └── yieldStrategyAgent.ts
├── scripts/                # Hardhat deploy & verify scripts
├── tests/                  # Smart contract tests
├── abi/                    # Contract ABI files
└── docs/                   # Architecture & model docs
```

## Quick Start

Prerequisite: Node.js 22+ (required by `@iqai/adk`).

### 1. Install Dependencies

```bash
# Root (Hardhat + contracts)
npm install

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

Copy `.env` and fill in your keys:

```bash
cp .env .env.local
```

Required keys:
- `RPC_URL` — Alchemy or Infura Ethereum RPC endpoint
- `ETHERSCAN_API_KEY` — For gas prices and contract verification
- `SEPOLIA_RPC_URL` — Sepolia RPC endpoint (required for Sepolia deploy)
- `DEPLOYER_PRIVATE_KEY` — Deployer private key for Hardhat networks
- `VITE_ROUTER_ADDRESS` — Router contract address used by frontend
- `GEMINI_API_KEY` — Google Gemini API key for AI explanation generation
- `GOOGLE_API_KEY` — Required by ADK-TS model runtime (can reuse `GEMINI_API_KEY`)
- `ADK_MODEL` — Optional ADK model override (default `gemini-2.5-flash`)

### 3. Run the Backend

```bash
cd backend
uvicorn app:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Check health at `/health`.

### 4. Run the Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### 5. Smart Contracts (Optional)

```bash
# Compile
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to local node
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/pools` | Ranked pool data with APY, TVL |
| GET | `/gas` | Current gas prices (safe/standard/fast) |
| GET | `/prices` | Token and ETH prices |
| GET | `/net-yield` | Calculate net APY for a deposit amount |
| GET | `/predictions` | AI yield predictions |
| GET | `/migration` | Migration recommendation |
| GET | `/ai-agent/strategy` | Autonomous strategy recommendation |
| GET | `/ai/explain-strategy` | Gemini explanation for a specific strategy |
| GET | `/historical` | 30-day historical APY set |

## Autonomous Agent Architecture

- ADK-TS workflow runner: `agents/adkYieldWorkflow.mjs`
- Backend ADK-wired strategy endpoint: `GET /ai-agent/strategy`
- Frontend dashboard panel: `Autonomous Strategy Agent`

The strategy agent consumes live pools, gas, and pricing inputs through ADK tools, reasons over candidate stablecoin pools, and outputs an action (`migrate`, `consider`, `hold`) with confidence, reasoning, and transaction-planning context.

### ADK-TS Compliance Proof

- NPM dependency: `@iqai/adk` (root package)
- CLI runner command: `npm run agent:strategy -- --current_protocol aave --current_token USDC --amount 10000 --chain ethereum`
- Backend endpoint uses ADK runner first and falls back only if ADK runtime is unavailable.
- ADK tools integrate external systems by fetching live `/net-yield`, `/gas`, and `/prices` snapshots.

### Gemini AI Layer

- Backend service: `backend/services/gemini_explainer.py`
- Direct explanation endpoint: `GET /ai/explain-strategy`
- Integrated response field in strategy endpoint: `explanation`
- Frontend integration: `Autonomous Strategy Agent` panel shows AI explanation with loading state (`Generating AI explanation...`)

If Gemini is unavailable or not configured, the backend returns a deterministic fallback explanation to keep UX stable.

### Wallet + Router Integration Notes

- Wallet connection now supports injected `window.ethereum` and wagmi wallet clients.
- Router address is read from `VITE_ROUTER_ADDRESS` first, then `NEXT_PUBLIC_ROUTER_ADDRESS`.
- Contract status panel displays network, wallet, latest block, and router address.
- Test transaction now targets the Router contract (not wallet-to-self), so MetaMask shows wallet -> router.

### IQ AI ADK Note

This project now uses the official ADK-TS package (`@iqai/adk`) as the core autonomous agent framework.

## Smart Contract Security

- Reentrancy guard on all state-changing functions
- Emergency pause mechanism
- Token whitelist for supported assets
- Fee cap at 50 basis points (0.5%)
- Access control (onlyOwner, onlyRouter patterns)
- Safe ERC-20 transfers handling non-standard tokens (USDT)

## AI Model

The yield prediction engine uses a **Gradient Boosting Regressor** trained on:
- 30-day historical APY trends
- Volatility metrics
- TVL-based liquidity features
- Short-term momentum indicators

See [docs/ai_model.md](docs/ai_model.md) for full details.

## License

MIT
