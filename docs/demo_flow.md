# Demo Flow

## Step-by-Step Demonstration Guide

### Prerequisites

1. MetaMask installed with Ethereum Mainnet selected
2. Backend running at `http://localhost:8000`
3. Frontend running at `http://localhost:5173`
4. Some ETH for gas (testnet or mainnet)

---

### Step 1: Launch the Application

1. Start the backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app:app --reload --port 8000
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

### Step 2: Connect Wallet

1. Click **"Connect Wallet"** in the top-right corner
2. MetaMask popup appears → approve connection
3. The button transforms to show your ETH balance and truncated address
4. A green dot indicates active connection

### Step 3: View Pool Data

1. The dashboard loads automatically with real-time pool data
2. **Stat Cards** at the top show:
   - Best Net APY across all pools
   - Total pools being tracked
   - Average gas cost in gwei
   - Projected 30-day yield on $10,000

3. The **Pool Table** displays:
   - Protocol name and icon
   - Token (USDC, DAI, USDT)
   - Gross APY (from DefiLlama)
   - Gas Cost (estimated for deposit tx)
   - Net APY (gross minus gas)
   - TVL (total value locked)
   - AI Prediction arrow and confidence badge

### Step 4: Calculate Net Yield

1. Enter a deposit amount (e.g., `10000`) in the input field
2. Click **"Calculate Net APY"**
3. The table updates with personalized net APY values
4. Larger deposits show higher net APY (gas cost amortized over larger principal)

### Step 5: View AI Predictions

1. Click the **"Predictions"** tab
2. The **Prediction Chart** shows:
   - Current APY (blue area)
   - Predicted 30-day APY (cyan area)
   - Hover for exact values

3. Below the chart, **Prediction Cards** show per-pool details:
   - Current → Predicted APY
   - Direction (↑ ↓ →)
   - Confidence badge (High/Medium/Low)

### Step 6: Migration Analysis

1. In the Pool Table, click **"Migrate"** on any pool
2. The **Migration Modal** opens showing:
   - Recommendation badge (Migrate / Consider / Hold)
   - Side-by-side comparison: Current Pool vs Target Pool
   - Migration gas cost in USD
   - 30-day net gain/loss
   - Break-even period in days
   - Current position's 30-day projected profit

3. If recommendation is **"Migrate"**:
   - Click **"Execute Migration"**
   - Approve token spending in MetaMask
   - Confirm migration transaction in MetaMask
   - Success screen shows transaction hash with Etherscan link

### Step 7: Refresh Data

1. Click **"Refresh Data"** to fetch latest pool/gas/price data
2. All values update with fresh data from DefiLlama and Etherscan
3. AI predictions are recalculated with latest historical data

---

## Key Talking Points for Demo

### Problem Statement
> "DeFi users chase high APY numbers but forget about gas costs. A 12% APY pool loses half its value if gas costs eat 6% for a $1,000 deposit. We solve this by showing the **real** yield after gas."

### AI Prediction Value
> "Our ML model analyzes 30-day yield trends to predict where APY is heading. This helps users avoid moving into pools that are about to drop."

### Migration Intelligence
> "Instead of blindly chasing the highest APY, our migration recommender calculates the actual cost of switching — gas fees, break-even period, and 30-day projected gain. It only recommends migration when the math works."

### Architecture Highlights
> "Real data from DefiLlama and Etherscan — no mocked numbers. Smart contracts with reentrancy protection, emergency pause, and fee caps. A production-grade Gradient Boosting model for yield prediction."

---

## Common Q&A

**Q: Where does the data come from?**
A: Pool APY and TVL from DefiLlama Yields API. Gas prices from Etherscan Gas Oracle with RPC fallback. Token prices from DefiLlama price feeds.

**Q: How accurate are the AI predictions?**
A: The model predicts the direction correctly ~70% of the time for high-confidence predictions. We show confidence levels so users know when to trust predictions.

**Q: What protocols are supported?**
A: Aave V3, Curve Finance, Compound V3, Yearn Finance, Spark, and Morpho (Aave V3). Smart contracts currently support Aave and Curve with adapters.

**Q: Is this safe to use on mainnet?**
A: The smart contracts include reentrancy guards, emergency pause, access control, and a fee cap. However, this is a hackathon project — a full audit would be needed for production use.

**Q: What stablecoins are supported?**
A: USDC, DAI, and USDT on Ethereum mainnet.
