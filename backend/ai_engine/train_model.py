"""
train_model.py
──────────────
Trains a lightweight yield prediction model using gradient boosting.
Can be run as a standalone script or imported.

The model predicts 30-day forward APY based on historical features.
"""

import numpy as np
import pickle
import os
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score


def generate_synthetic_training_data(n_samples: int = 500) -> tuple:
    """
    Generate plausible synthetic training data for initial model bootstrap.
    In production this would be replaced with real historical data.

    Features: [mean_apy, std_apy, latest_apy, trend, momentum, tvl_ratio]
    Target:   30-day forward APY
    """
    rng = np.random.RandomState(42)

    mean_apy = rng.uniform(0.5, 15.0, n_samples)
    std_apy = rng.uniform(0.05, 3.0, n_samples)
    latest_apy = mean_apy + rng.normal(0, 1.0, n_samples)
    latest_apy = np.clip(latest_apy, 0.1, 20.0)
    trend = rng.normal(0, 0.05, n_samples)
    momentum = rng.normal(0, 0.5, n_samples)
    tvl_ratio = rng.uniform(0.7, 1.3, n_samples)

    X = np.column_stack([mean_apy, std_apy, latest_apy, trend, momentum, tvl_ratio])

    # Target: future APY = latest_apy + trend * 30 + noise
    noise = rng.normal(0, 0.3, n_samples)
    y = latest_apy + trend * 30 + momentum * 0.5 + noise
    y = np.clip(y, 0.01, 25.0)

    return X, y


def train_model(save_path: str = "ai_engine/models/yield_model.pkl") -> dict:
    """Train the yield prediction model and save it."""
    X, y = generate_synthetic_training_data(800)

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )

    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="r2")

    # Fit on full data
    model.fit(X, y)

    # Save
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump(model, f)

    return {
        "cv_r2_mean": round(float(np.mean(cv_scores)), 4),
        "cv_r2_std": round(float(np.std(cv_scores)), 4),
        "n_features": X.shape[1],
        "n_samples": X.shape[0],
        "model_path": save_path,
    }


if __name__ == "__main__":
    result = train_model()
    print("Model trained successfully:")
    for k, v in result.items():
        print(f"  {k}: {v}")
