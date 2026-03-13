"""
pool_ranker.py
──────────────
Ranks pools by a composite score: net APY, TVL (liquidity safety),
and protocol reliability.
"""

PROTOCOL_TRUST_SCORES = {
    "Aave V3": 0.95,
    "Compound V3": 0.92,
    "Curve": 0.90,
    "Yearn": 0.85,
    "Spark": 0.88,
    "Morpho Aave": 0.87,
}

PROTOCOL_AGE_YEARS = {
    "Aave V3": 5.0,
    "Compound V3": 4.5,
    "Curve": 4.5,
    "Yearn": 4.0,
    "Spark": 1.5,
    "Morpho Aave": 2.0,
}

# Weights for the composite score
W_NET_APY = 0.55
W_TVL = 0.20
W_TRUST = 0.25
W_RISK = 0.15


def rank_pools(pools: list[dict]) -> list[dict]:
    """
    Rank pools by composite score:
    score = W_NET_APY * normalized_net_apy
          + W_TVL     * normalized_tvl
          + W_TRUST   * trust_score
    """
    if not pools:
        return []

    # Compute normalization ranges
    apys = [p["net_apy"] for p in pools]
    tvls = [p.get("tvl", 0) for p in pools]
    max_apy = max(apys) if apys else 1
    min_apy = min(apys) if apys else 0
    max_tvl = max(tvls) if tvls else 1
    apy_range = max_apy - min_apy if max_apy != min_apy else 1

    ranked = []
    for pool in pools:
        norm_apy = (pool["net_apy"] - min_apy) / apy_range
        norm_tvl = pool.get("tvl", 0) / max_tvl if max_tvl > 0 else 0
        trust = PROTOCOL_TRUST_SCORES.get(pool["protocol"], 0.80)

        risk_score, risk_level = _compute_risk_score(pool)

        # Adjust score by favoring lower risk pools.
        # risk_score is 0-100 (high = risky), convert to safety_factor (0-1, high = safer)
        safety_factor = 1 - (risk_score / 100)

        score = round(
            W_NET_APY * norm_apy
            + W_TVL * norm_tvl
            + W_TRUST * trust
            + W_RISK * safety_factor,
            4,
        )

        ranked.append(
            {
                **pool,
                "rank_score": score,
                "trust_score": trust,
                "risk_score": risk_score,
                "risk_level": risk_level,
            }
        )

    ranked.sort(key=lambda x: x["rank_score"], reverse=True)

    # Add rank position
    for i, pool in enumerate(ranked):
        pool["rank"] = i + 1

    return ranked


def _compute_risk_score(pool: dict) -> tuple[float, str]:
    """
    Compute a risk score (0-100, higher = riskier) from:
    - TVL
    - Protocol age
    - APY volatility proxy
    - Liquidity depth
    """
    protocol = pool.get("protocol", "")
    tvl = float(pool.get("tvl", 0) or 0)
    apy = float(pool.get("apy", 0) or 0)
    age_years = PROTOCOL_AGE_YEARS.get(protocol, 1.0)

    # TVL risk: lower TVL => higher risk
    if tvl >= 1_000_000_000:
        tvl_risk = 10
    elif tvl >= 100_000_000:
        tvl_risk = 25
    elif tvl >= 10_000_000:
        tvl_risk = 45
    elif tvl >= 1_000_000:
        tvl_risk = 65
    else:
        tvl_risk = 80

    # Protocol age risk
    if age_years >= 4:
        age_risk = 10
    elif age_years >= 2:
        age_risk = 30
    else:
        age_risk = 55

    # Volatility proxy: very high APY often implies higher risk
    if apy >= 30:
        vol_risk = 80
    elif apy >= 15:
        vol_risk = 60
    elif apy >= 8:
        vol_risk = 40
    elif apy >= 3:
        vol_risk = 25
    else:
        vol_risk = 15

    # Liquidity depth proxy (re-using TVL buckets with stronger penalty below 10m)
    if tvl >= 100_000_000:
        liq_risk = 10
    elif tvl >= 10_000_000:
        liq_risk = 35
    elif tvl >= 1_000_000:
        liq_risk = 60
    else:
        liq_risk = 80

    risk_score = round(
        0.35 * tvl_risk + 0.20 * age_risk + 0.25 * vol_risk + 0.20 * liq_risk,
        2,
    )

    if risk_score < 33:
        level = "Low"
    elif risk_score < 66:
        level = "Medium"
    else:
        level = "High"

    return risk_score, level
