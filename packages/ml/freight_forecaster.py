"""Advisory-only XGBoost freight-density forecaster (rho_f). Used to enrich FOIS
forecast_confidence where absent and inside the benchmark. Deterministic seed."""
from __future__ import annotations

import numpy as np
from xgboost import XGBRegressor

SEED = 42


def hour_features(hour: int, dow: int, commodity_num: int) -> list[float]:
    return [np.sin(hour / 24 * 2 * np.pi), np.cos(hour / 24 * 2 * np.pi), dow / 6.0, commodity_num / 5.0]


def make_dataset(n: int = 3000, seed: int = SEED):
    rng = np.random.default_rng(seed)
    hours = rng.integers(0, 24, n)
    dows = rng.integers(0, 7, n)
    comms = rng.integers(0, 5, n)
    X = np.array([hour_features(h, d, c) for h, d, c in zip(hours, dows, comms, strict=False)])
    y = np.clip(0.35 + 0.25 * np.sin((hours + 3) / 24 * 2 * np.pi) + 0.1 * comms / 5
                + rng.normal(0, 0.08, n), 0.05, 0.98)
    return X, y


def train() -> XGBRegressor:
    X, y = make_dataset()
    model = XGBRegressor(n_estimators=120, max_depth=3, random_state=SEED)
    model.fit(X, y)
    return model


def forecast(model: XGBRegressor, hour: int, dow: int, commodity_num: int) -> float:
    return float(np.clip(model.predict(np.array([hour_features(hour, dow, commodity_num)]))[0], 0.05, 0.98))
