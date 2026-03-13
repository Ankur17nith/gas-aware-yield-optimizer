"""
pool_ranker.py
──────────────
Ranks pools by a composite score: net APY, TVL (liquidity safety),
and protocol reliability.
"""

PROTOCOL_REPUTATION_POINTS = {
    "Aave": 30,
    "Curve": 30,
    "Compound": 28,
    "Yearn": 27,
}

PROTOCOL_AGE_YEARS = {
    "Aave V3": 5.0,
    "Compound V3": 4.5,
    "Curve": 4.5,
    "Yearn": 4.0,
    "Spark": 1.5,
    "Morpho Aave": 2.0,
}

PROTOCOL_AUDIT_STATUS = {
    "Aave": True,
    "Compound": True,
    "Curve": True,
    "Yearn": True,
    "Spark": True,
    "Morpho Aave": True,
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
        trust = _compute_trust_score(pool)
        trust_norm = trust / 100

        risk_score, risk_level = _compute_risk_score(pool)

        # Adjust score by favoring lower risk pools.
        # risk_score is 0-100 (high = risky), convert to safety_factor (0-1, high = safer)
        safety_factor = 1 - (risk_score / 100)

        score = round(
            W_NET_APY * norm_apy
            + W_TVL * norm_tvl
            + W_TRUST * trust_norm
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


def _compute_trust_score(pool: dict) -> int:
    """
    Trust Score (0-100):
    - 40% TVL strength
    - 30% protocol reputation
    - 20% liquidity stability
    - 10% smart contract risk
    """
    protocol = str(pool.get("protocol", "") or "")
    tvl = float(pool.get("tvl", 0) or 0)
    audited = PROTOCOL_AUDIT_STATUS.get(protocol, False)

    if tvl >= 1_000_000_000:
        tvl_score = 40
    elif tvl >= 100_000_000:
        tvl_score = 30
    elif tvl >= 10_000_000:
        tvl_score = 20
    else:
        tvl_score = 10

    protocol_reputation = PROTOCOL_REPUTATION_POINTS.get(protocol, 20)

    # Prefer real TVL change fields when available; fallback to TVL-size stability proxy.
    tvl_change_pct = pool.get("tvl_change_7d_pct")
    if tvl_change_pct is None:
        tvl_change_pct = pool.get("tvl_change_pct")

    if tvl_change_pct is None:
        if tvl >= 1_000_000_000:
            tvl_change_pct = 4.0
        elif tvl >= 100_000_000:
            tvl_change_pct = 7.0
        elif tvl >= 10_000_000:
            tvl_change_pct = 12.0
        else:
            tvl_change_pct = 22.0

    tvl_change_abs = abs(float(tvl_change_pct))
    if tvl_change_abs < 5:
        liquidity_stability = 20
    elif tvl_change_abs < 10:
        liquidity_stability = 15
    elif tvl_change_abs < 20:
        liquidity_stability = 10
    else:
        liquidity_stability = 5

    contract_risk = 10 if audited else 5
    return int(tvl_score + protocol_reputation + liquidity_stability + contract_risk)


def _compute_risk_score(pool: dict) -> tuple[float, str]:
    """
    Compute a risk score (0-100, higher = riskier) from:
    - TVL
    - Protocol age
    - APY volatility proxy
    - Liquidity depth
    - Audit status
    """
    protocol = pool.get("protocol", "")
    tvl = float(pool.get("tvl", 0) or 0)
    apy = float(pool.get("apy", 0) or 0)
    suspicious = bool(pool.get("suspicious", False))
    age_years = PROTOCOL_AGE_YEARS.get(protocol, 1.0)
    audited = PROTOCOL_AUDIT_STATUS.get(protocol, False)

    if suspicious:
        return 85.0, "High"

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

    audit_risk = 10 if audited else 60

    risk_score = round(
        0.30 * tvl_risk
        + 0.20 * age_risk
        + 0.20 * vol_risk
        + 0.20 * liq_risk
        + 0.10 * audit_risk,
        2,
    )

    if risk_score < 33:
        level = "Low"
    elif risk_score < 66:
        level = "Medium"
    else:
        level = "High"

    return risk_score, level
