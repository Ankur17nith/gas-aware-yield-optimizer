"""
yield_predictor.py
──────────────────
Uses the trained model to predict 30-day forward APY for each pool.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

import numpy as np
from ai_engine.feature_engineering import build_features


def predict_yields(
    model: Any,
    pool_data: Sequence[Mapping[str, Any]],
    historical: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """
    Predict 30-day forward APY for each pool.
    Returns list of predictions with confidence intervals.
    """
    if model is None:
        return _fallback_predictions(pool_data)

    features_list: list[dict[str, Any]] = build_features(pool_data, historical)

    predictions: list[dict[str, Any]] = []
    for feat in features_list:
        fv: list[float] = feat["feature_vector"]
        X = np.array([fv], dtype=np.float64)

        try:
            predicted_apy = float(model.predict(X)[0])
            predicted_apy = max(predicted_apy, 0.01)

            # Estimate confidence based on data quality
            data_points: int = int(feat["features"]["data_points"])
            std_apy: float = float(feat["features"]["std_apy"])

            if data_points >= 20:
                confidence = "high"
                margin = std_apy * 0.5
            elif data_points >= 7:
                confidence = "medium"
                margin = std_apy * 1.0
            else:
                confidence = "low"
                margin = std_apy * 1.5

            predictions.append(
                {
                    "pool_id": feat["pool_id"],
                    "protocol": feat["protocol"],
                    "token": feat["token"],
                    "current_apy": feat["features"]["latest_apy"],
                    "predicted_apy_30d": round(predicted_apy, 4),
                    "apy_upper": round(predicted_apy + margin, 4),
                    "apy_lower": round(max(predicted_apy - margin, 0.01), 4),
                    "trend": feat["features"]["trend"],
                    "momentum": feat["features"]["momentum"],
                    "confidence": confidence,
                    "direction": (
                        "up"
                        if predicted_apy > feat["features"]["latest_apy"]
                        else "down"
                    ),
                }
            )
        except Exception:
            predictions.append(
                {
                    "pool_id": feat["pool_id"],
                    "protocol": feat["protocol"],
                    "token": feat["token"],
                    "current_apy": feat["features"]["latest_apy"],
                    "predicted_apy_30d": feat["features"]["latest_apy"],
                    "apy_upper": feat["features"]["latest_apy"] * 1.1,
                    "apy_lower": feat["features"]["latest_apy"] * 0.9,
                    "trend": 0,
                    "momentum": 0,
                    "confidence": "low",
                    "direction": "stable",
                }
            )

    return predictions


def _fallback_predictions(pool_data: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Simple fallback when no model is available."""
    return [
        {
            "pool_id": p.get("pool_id", ""),
            "protocol": p.get("protocol", ""),
            "token": p.get("token", ""),
            "current_apy": p.get("apy", 0),
            "predicted_apy_30d": p.get("apy", 0),
            "apy_upper": p.get("apy", 0) * 1.1,
            "apy_lower": p.get("apy", 0) * 0.9,
            "trend": 0,
            "momentum": 0,
            "confidence": "low",
            "direction": "stable",
        }
        for p in pool_data
    ]
