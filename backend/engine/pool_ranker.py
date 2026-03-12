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

# Weights for the composite score
W_NET_APY = 0.55
W_TVL = 0.20
W_TRUST = 0.25


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

        score = round(
            W_NET_APY * norm_apy + W_TVL * norm_tvl + W_TRUST * trust, 4
        )

        ranked.append({**pool, "rank_score": score, "trust_score": trust})

    ranked.sort(key=lambda x: x["rank_score"], reverse=True)

    # Add rank position
    for i, pool in enumerate(ranked):
        pool["rank"] = i + 1

    return ranked
