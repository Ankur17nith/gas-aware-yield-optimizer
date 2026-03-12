"""
feature_engineering.py
──────────────────────
Transforms raw historical pool data into feature vectors for the
yield prediction model.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def build_features(pool_data: list[dict[str, Any]], historical: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    For each pool, extract features from its historical data:
    - mean APY over the window
    - APY volatility (std)
    - trend (linear slope)
    - latest APY
    - TVL ratio vs mean
    - momentum (last 7d vs last 30d)
    """
    features_list: list[dict[str, Any]] = []

    for pool in pool_data:
        pool_id = pool.get("pool_id", "")

        # Find matching historical data
        hist_entry = None
        for h in historical:
            if h.get("pool_id") == pool_id:
                hist_entry = h
                break

        if hist_entry and hist_entry.get("history"):
            apys = [dp["apy"] for dp in hist_entry["history"] if dp.get("apy") is not None]
            tvls = [dp["tvl"] for dp in hist_entry["history"] if dp.get("tvl") is not None]
        else:
            apys = [pool.get("apy", 0)]
            tvls = [pool.get("tvl", 0)]

        if len(apys) < 2:
            apys = apys * 2  # Pad if too short

        apy_arr = np.array(apys, dtype=np.float64)
        tvl_arr = np.array(tvls, dtype=np.float64) if tvls else np.array([0.0])

        mean_apy = float(np.mean(apy_arr))
        std_apy = float(np.std(apy_arr))
        latest_apy = float(apy_arr[-1])

        # Linear trend (slope of APY over time)
        x = np.arange(len(apy_arr))
        if len(apy_arr) >= 2:
            coeffs = np.polyfit(x, apy_arr, 1)
            trend = float(coeffs[0])
        else:
            trend = 0.0

        # Momentum: avg of last 7 vs full window
        last_7 = apy_arr[-7:] if len(apy_arr) >= 7 else apy_arr
        momentum = float(np.mean(last_7) - mean_apy)

        # TVL stability
        mean_tvl = float(np.mean(tvl_arr)) if len(tvl_arr) > 0 else 0.0
        tvl_ratio = float(tvl_arr[-1] / mean_tvl) if mean_tvl > 0 else 1.0

        features_list.append(
            {
                "pool_id": pool_id,
                "protocol": pool.get("protocol", ""),
                "token": pool.get("token", ""),
                "features": {
                    "mean_apy": round(mean_apy, 4),
                    "std_apy": round(std_apy, 4),
                    "latest_apy": round(latest_apy, 4),
                    "trend": round(trend, 6),
                    "momentum": round(momentum, 4),
                    "tvl_ratio": round(tvl_ratio, 4),
                    "data_points": len(apy_arr),
                },
                "feature_vector": [
                    mean_apy,
                    std_apy,
                    latest_apy,
                    trend,
                    momentum,
                    tvl_ratio,
                ],
            }
        )

    return features_list
