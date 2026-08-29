"""Advisory-only PyTorch defect-urgency estimator (Rules.md §2). Trains on synthetic
features, writes urgency_score with urgency_source='ML_ESTIMATED' (ML-002 lineage).
Calibration + sensitivity analysis run in apps/eval (TASK-055)."""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn

SEED = 42
FEATURES = ["tgi_index", "cumulative_gmt", "rail_wear_loss_percent", "imr_severity_num"]


def physical_urgency(tgi: float, gmt: float, imr_num: float, wear: float) -> float:
    """Rule-based target the network must learn (domain rule, deterministic)."""
    u = 0.10 + 0.55 * max(0.0, (90 - tgi) / 60.0) + 0.15 * min(gmt / 60.0, 1.0) \
        + 0.15 * min(imr_num / 3.0, 1.0) + 0.05 * min(wear / 12.0, 1.0)
    return float(min(max(u, 0.0), 1.0))


def make_dataset(n: int = 4000, seed: int = SEED):
    rng = np.random.default_rng(seed)
    tgi = rng.uniform(30, 90, n)
    gmt = rng.uniform(10, 60, n)
    imr = rng.integers(0, 4, n)
    wear = rng.uniform(0, 12, n)
    X = np.stack([tgi, gmt, imr.astype(float), wear], axis=1).astype(np.float32)
    y = np.array([physical_urgency(*row) for row in X], dtype=np.float32)
    y += rng.normal(0, 0.02, n).astype(np.float32)
    return torch.tensor(X), torch.clip(torch.tensor(y), 0, 1).unsqueeze(1)


class UrgencyNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(4, 32), nn.ReLU(), nn.Linear(32, 16), nn.ReLU(),
                                 nn.Linear(16, 1), nn.Sigmoid())

    def forward(self, x):
        return self.net(x)


def train(epochs: int = 60, lr: float = 1e-3) -> UrgencyNet:
    torch.manual_seed(SEED)
    X, y = make_dataset()
    model = UrgencyNet()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    lossf = nn.MSELoss()
    for _ in range(epochs):
        opt.zero_grad()
        loss = lossf(model(X), y)
        loss.backward()
        opt.step()
    model.eval()
    return model


def estimate(model: UrgencyNet, features: dict) -> float:
    vec = torch.tensor([[float(features.get(k, 0) or 0) for k in FEATURES]], dtype=torch.float32)
    with torch.no_grad():
        return float(model(vec).item())
