# AI Yield Prediction Model

## Overview

The AI engine uses a **Gradient Boosting Regressor** to predict 30-day forward yields for DeFi pools. The model is trained on historical APY data from DefiLlama and generates predictions with confidence intervals.

## Feature Engineering

Six features are extracted from each pool's 30-day historical APY time series:

| Feature | Calculation | Purpose |
|---------|-------------|---------|
| `mean_apy` | Arithmetic mean of daily APY values | Central tendency baseline |
| `std_apy` | Standard deviation of daily APY values | Volatility measure |
| `latest_apy` | Most recent APY observation | Current state anchor |
| `trend` | Slope of linear regression (numpy polyfit degree 1) | Directional momentum |
| `momentum` | Ratio of 7-day mean to 30-day mean | Short-term vs long-term comparison |
| `tvl_ratio` | `log(TVL / 1e6)` | Liquidity depth indicator |

### Feature Rationale

- **mean_apy + latest_apy**: Captures both the historical average and current state. Divergence between them signals regime change.
- **std_apy**: High volatility pools tend to revert to mean; low volatility pools are persistent.
- **trend**: Linear slope over 30 days detects sustained upward/downward movement.
- **momentum**: 7d/30d ratio captures recent acceleration. Values > 1.0 indicate improving yields.
- **tvl_ratio**: Log-scaled TVL. Higher TVL pools tend to have more stable yields due to larger capital base.

## Model Architecture

```
GradientBoostingRegressor(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    random_state=42
)
```

### Why Gradient Boosting?

1. **Handles non-linear relationships** — DeFi yields have complex, non-linear dynamics
2. **Robust to outliers** — Huber loss variant handles yield spikes
3. **Feature importance** — Built-in feature importance for interpretability
4. **No normalization needed** — Tree-based, so feature scaling is unnecessary
5. **Fast inference** — Sub-millisecond prediction time for real-time use

## Training Pipeline

### Data Collection
```
DefiLlama /yields/chart/{pool_id} → 30 days of daily APY snapshots
```

### Bootstrap Augmentation

Since live data availability varies, the model uses bootstrap augmentation:
1. Fetch real historical data for available pools
2. Generate augmented samples by adding Gaussian noise (σ = 5% of feature value)
3. Target variable: forward 30-day mean APY (approximated from trend extrapolation)

### Training Process
```python
1. Collect historical data for all tracked pools
2. Extract 6 features per pool
3. Bootstrap to minimum 50 training samples
4. Split: 80% train / 20% validation
5. Fit GradientBoostingRegressor
6. Save model as pickle file
7. Auto-retrain if model file is missing on startup
```

## Prediction Output

For each pool, the model returns:

```json
{
  "pool_id": "aave-v3-usdc",
  "current_apy": 4.82,
  "predicted_apy": 5.14,
  "confidence": "high",
  "prediction_range": {
    "low": 4.65,
    "high": 5.63
  },
  "direction": "up"
}
```

### Confidence Levels

| Level | Criteria | Range Width |
|-------|----------|-------------|
| **High** | ≥ 20 historical data points | ±10% of prediction |
| **Medium** | 10-19 data points | ±20% of prediction |
| **Low** | < 10 data points | ±35% of prediction |

### Direction Classification

- **up**: predicted_apy > current_apy × 1.02 (>2% increase)
- **down**: predicted_apy < current_apy × 0.98 (>2% decrease)
- **stable**: within ±2% band

## Model Persistence

- Models are saved as pickle files at `backend/models/yield_model.pkl`
- Auto-loaded on FastAPI startup via lifespan handler
- Auto-trained if model file is missing
- Manual retraining available via backend function call

## Limitations

1. **Short history window** — 30 days may miss longer cycles
2. **No protocol-specific features** — Governance votes, parameter changes not captured
3. **Bootstrap dependency** — Early predictions rely on augmented data
4. **No cross-pool correlation** — Each pool predicted independently
5. **Market regime changes** — Model may lag during rapid market shifts

## Future Improvements

- LSTM/Transformer for sequence modeling
- Cross-protocol correlation features
- On-chain governance event integration
- Ensemble with multiple model architectures
- Online learning with incremental updates
