"""
model_loader.py
───────────────
Loads the trained yield prediction model from disk.
If no model exists, trains a fresh one automatically.
"""

import pickle
import os


def load_model(path: str = "ai_engine/models/yield_model.pkl"):
    """Load the pickled model. Auto-trains if missing."""
    if os.path.exists(path):
        with open(path, "rb") as f:
            model = pickle.load(f)
        return model

    # Auto-train if model doesn't exist
    from ai_engine.train_model import train_model

    train_model(save_path=path)

    with open(path, "rb") as f:
        model = pickle.load(f)
    return model
