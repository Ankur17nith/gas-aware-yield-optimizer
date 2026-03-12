# Gas-Aware Stablecoin Yield Optimizer

A full-stack DeFi application that helps users maximize yield on stablecoins (USDC, DAI, USDT) by calculating net APY after gas costs and enabling one-click migration between DeFi pools.

## Features

- **Real-Time Net APY** — See actual yield after gas costs, not just gross APY
- **AI Yield Predictions** — ML model predicts 30-day forward yields with confidence intervals
- **Smart Migration** — One-click migration between protocols with break-even analysis
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
│   └── blockchain/         # On-chain interaction
├── frontend/               # React + TypeScript app
│   └── src/
│       ├── components/     # UI components
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API & blockchain services
│       ├── types/          # TypeScript interfaces
│       └── utils/          # Formatting & calculations
├── scripts/                # Hardhat deploy & verify scripts
├── tests/                  # Smart contract tests
├── abi/                    # Contract ABI files
└── docs/                   # Architecture & model docs
```

## Quick Start

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
| POST | `/net-yield` | Calculate net APY for a deposit amount |
| POST | `/predictions` | AI yield predictions |
| POST | `/migration` | Migration recommendation |
| GET | `/historical/{pool_id}` | 30-day historical APY |

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
