"""TASK-055 — ML calibration & sensitivity (ML-001, Rules.md §2).

Held-out split evaluation of the PyTorch urgency estimator with a reliability
diagram (text form) cross-checked against scikit-learn's calibration_curve and
Brier score, plus the ±20% Pi perturbation analysis that must accompany every
ML-derived figure (Model Calibration Transparency rule).

Usage:  python -m apps.eval.calibrate
"""
from __future__ import annotations

import numpy as np
import torch
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss

from packages.ml.degradation_model import UrgencyNet, make_dataset, physical_urgency, train


def reliability(model: UrgencyNet, n: int = 1200, seed: int = 777, bins: int = 8) -> None:
    rng = np.random.default_rng(seed)
    tgi = rng.uniform(30, 90, n); gmt = rng.uniform(10, 60, n)
    imr = rng.integers(0, 4, n); wear = rng.uniform(0, 12, n)
    X = np.stack([tgi, gmt, imr.astype(float), wear], axis=1).astype(np.float32)
    y = np.array([physical_urgency(*row) for row in X], dtype=np.float32)
    with torch.no_grad():
        pred = model(torch.tensor(X)).squeeze(-1).numpy()
    edges = np.linspace(0, 1, bins + 1)
    print("Reliability diagram (held-out split, seed %d):" % seed)
    print(f"{'bin':>10s} {'pred_mean':>10s} {'true_mean':>10s} {'n':>6s}")
    ece = 0.0
    for i in range(bins):
        m = (pred >= edges[i]) & (pred < edges[i + 1])
        if m.sum() == 0:
            continue
        pm, tm = float(pred[m].mean()), float(y[m].mean())
        ece += abs(pm - tm) * m.sum() / n
        print(f"{edges[i]:.2f}-{edges[i+1]:.2f} {pm:10.3f} {tm:10.3f} {int(m.sum()):6d}")
    print(f"Expected Calibration Error (ECE): {ece:.4f}")
    # scikit-learn cross-check (PS 027 recommended-stack item): urgency is a
    # continuous target, so the sklearn readout is thresholded at the 0.5 action
    # boundary — "does predicted urgency indicate true high-urgency (>0.5)?" —
    # scored by an independent, standard implementation.
    y_bin = (y > 0.5).astype(int)
    sk_frac, sk_mean = calibration_curve(y_bin, pred, n_bins=bins, strategy="quantile")
    brier = brier_score_loss(y_bin, pred)
    print("scikit-learn calibration_curve (quantile bins, target = true urgency > 0.5):")
    for pf, mf in zip(sk_frac, sk_mean):
        print(f"  pred_mean {mf:.3f}  true_high_fraction {pf:.3f}")
    print(f"scikit-learn Brier score (threshold 0.5): {brier:.4f}")


def sensitivity(model: UrgencyNet) -> None:
    """±20% perturbation of every input feature → output spread. This is the
    'schedule stability under ±20% perturbation' indication required by Rules §2."""
    base = {"tgi_index": 60.0, "cumulative_gmt": 35.0,
            "rail_wear_loss_percent": 6.0, "imr_severity_num": 2.0}
    from packages.ml.degradation_model import FEATURES, estimate
    b = estimate(model, base)
    print(f"\nPerturbation sensitivity at base urgency {b:.3f} (±20% per feature):")
    for f in FEATURES:
        lo = estimate(model, {**base, f: base[f] * 0.8})
        hi = estimate(model, {**base, f: base[f] * 1.2})
        print(f"  {f:28s} −20%→{lo:.3f}  +20%→{hi:.3f}  Δ={hi-lo:+.3f}")


def main() -> None:
    print("Training seeded urgency model…")
    model = train(epochs=40)
    Xtr, ytr = make_dataset(n=800)
    with torch.no_grad():
        rmse = float(torch.sqrt(((model(Xtr).squeeze(-1) - ytr.squeeze(-1)) ** 2).mean()))
    print(f"In-sample RMSE: {rmse:.4f}")
    reliability(model)
    sensitivity(model)
    print("\nNote (Rules.md §5): these are measured outputs of this run on synthetic",
          "seeded data; label them as such wherever quoted.")


if __name__ == "__main__":
    main()
