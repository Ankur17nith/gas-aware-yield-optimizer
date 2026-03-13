"""
migration_recommender.py
────────────────────────
Analyzes the user's current position and recommends whether migrating
to a higher-yield pool is profitable after accounting for gas costs.
"""


def recommend_migration(
    current_protocol: str,
    current_token: str,
    amount: float,
    net_yields: list[dict],
    predictions: list[dict],
    gas_data: dict,
    price_data: dict,
    gas_threshold_gwei: float = 20.0,
) -> dict:
    """
    Compare the user's current pool against all alternatives.
    Return migration recommendation with projected profit.
    """
    # Find user's current pool
    current_pool = None
    for p in net_yields:
        if (
            p["protocol"].lower() == current_protocol.lower()
            and p["token"].upper() == current_token.upper()
        ):
            current_pool = p
            break

    if not current_pool:
        # If exact match not found, pick the first matching token
        for p in net_yields:
            if p["token"].upper() == current_token.upper():
                current_pool = p
                break

    if not current_pool:
        return {
            "recommendation": "hold",
            "reason": "Current pool position not found in data",
            "current": None,
            "target": None,
        }

    # Find the best alternative pool (different protocol, same token or any)
    best_target = None
    best_improvement = 0

    for p in net_yields:
        if p["pool_id"] == current_pool["pool_id"]:
            continue

        apy_diff = p["net_apy"] - current_pool["net_apy"]
        if apy_diff <= 0:
            continue

        # AI prediction boost: prefer pools with positive predicted trend
        pred_boost = 0
        for pred in predictions:
            if pred.get("pool_id") == p["pool_id"]:
                pred_trend = pred.get("predicted_apy_30d", p["net_apy"]) - p["net_apy"]
                pred_boost = max(pred_trend * 0.3, 0)
                break

        effective_improvement = apy_diff + pred_boost

        if effective_improvement > best_improvement:
            best_improvement = effective_improvement
            best_target = p

    if not best_target:
        return {
            "recommendation": "hold",
            "reason": "No higher-yield pool available after gas costs",
            "current": _pool_summary(current_pool),
            "target": None,
            "profit_30d_if_stay": current_pool.get("profit_30d", 0),
        }

    # Calculate migration gas cost
    eth_price = price_data.get("prices", {}).get("ETH", {}).get("price", 3000.0)
    gas_gwei = gas_data.get("standard", 20)

    # Migration = withdraw from source + deposit to target
    migration_gas_units = (
        current_pool.get("withdraw_gas", 200_000)
        + best_target.get("deposit_gas", 250_000)
    )
    migration_gas_eth = (migration_gas_units * gas_gwei) / 1e9
    migration_cost_usd = round(migration_gas_eth * eth_price, 2)

    # 30-day profit comparison
    current_profit_30d = current_pool.get("profit_30d", 0)
    target_daily_rate = best_target["net_apy"] / 365 / 100
    target_profit_30d = round(amount * target_daily_rate * 30, 2)
    net_gain_30d = round(target_profit_30d - current_profit_30d - migration_cost_usd, 2)

    # Break-even days
    daily_gain = (best_target["net_apy"] - current_pool["net_apy"]) / 365 / 100 * amount
    breakeven_days = round(migration_cost_usd / daily_gain, 1) if daily_gain > 0 else 999

    # Recommendation logic
    if net_gain_30d > 0 and breakeven_days < 30:
        recommendation = "migrate"
        reason = (
            f"Migration saves ${net_gain_30d} over 30 days. "
            f"Break-even in {breakeven_days} days."
        )
    elif net_gain_30d > 0:
        recommendation = "consider"
        reason = (
            f"Marginal improvement of ${net_gain_30d} over 30 days. "
            f"Break-even in {breakeven_days} days — only migrate for long holds."
        )
    else:
        recommendation = "hold"
        reason = "Migration cost exceeds potential yield improvement."

    gas_optimized = gas_gwei <= gas_threshold_gwei
    if gas_optimized:
        optimal_gas_window = (
            f"Gas is favorable at {gas_gwei} gwei (threshold {gas_threshold_gwei} gwei)."
        )
    else:
        optimal_gas_window = (
            f"Wait for lower gas. Current {gas_gwei} gwei, target <= {gas_threshold_gwei} gwei."
        )

    auto_rebalance_recommended = (
        recommendation in {"migrate", "consider"}
        and best_improvement > (migration_cost_usd / max(amount, 1)) * 100
        and gas_optimized
    )

    return {
        "recommendation": recommendation,
        "reason": reason,
        "current": _pool_summary(current_pool),
        "target": _pool_summary(best_target),
        "migration_cost_usd": migration_cost_usd,
        "net_gain_30d": net_gain_30d,
        "breakeven_days": breakeven_days,
        "current_profit_30d": current_profit_30d,
        "target_profit_30d": target_profit_30d,
        "gas_threshold_gwei": gas_threshold_gwei,
        "current_gas_gwei": gas_gwei,
        "gas_optimized": gas_optimized,
        "optimal_gas_window": optimal_gas_window,
        "auto_rebalance_recommended": auto_rebalance_recommended,
    }


def _pool_summary(pool: dict) -> dict:
    return {
        "protocol": pool.get("protocol", ""),
        "token": pool.get("token", ""),
        "gross_apy": pool.get("gross_apy", pool.get("apy", 0)),
        "net_apy": pool.get("net_apy", 0),
        "gas_cost_usd": pool.get("gas_cost_usd", 0),
        "tvl": pool.get("tvl", 0),
        "pool_id": pool.get("pool_id", ""),
    }
