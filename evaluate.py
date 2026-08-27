"""Comparative Performance Evaluation (Module 5)

Solves SOP 3 / Objective 3: runs both standard and enhanced algorithms across sizes,
collects metrics and generates comparison charts.
"""
from typing import List, Dict
import numpy as np
import pandas as pd
import time
import os
import matplotlib.pyplot as plt
from scipy.stats import spearmanr

from data_generator import generate_households, generate_resources
from validation import validate_households
from cost_matrix import build_cost_matrix, DEFAULT_WEIGHTS, urgency_score
from standard_solver import solve_distance_only
from enhanced_solver import run_dynamic_assignment


def make_distance_matrix(households: pd.DataFrame, resources: pd.DataFrame, seed: int = 0) -> np.ndarray:
    """Assign random coordinates to households and resources and compute Euclidean distances."""
    rng = np.random.default_rng(seed)
    n = len(households)
    hh_coords = rng.random((n, 2)) * 50.0
    res_coords = rng.random((n, 2)) * 50.0
    dmat = np.linalg.norm(hh_coords[:, None, :] - res_coords[None, :, :], axis=2)
    return dmat


def run_once(n: int, seed: int = 0) -> Dict:
    households = generate_households(n, seed=seed)
    resources = generate_resources(n, seed=seed)
    master = generate_households(n, seed=seed)  # simple masterlist
    validated = validate_households(households, master)
    # use only Verified or Pending for simulation (H* per spec is Verified only,
    # but Pending allows some test variability) -> use Verified
    Hstar = validated[validated["verification_status"] == "Verified"]
    # if none verified, fall back to all households
    if len(Hstar) < n:
        Hstar = households

    # distance matrix
    dmat = make_distance_matrix(Hstar, resources, seed=seed)

    # build cost matrix (multi-objective)
    C = build_cost_matrix(Hstar.reset_index(drop=True), resources.reset_index(drop=True), dmat)

    # baseline (distance only)
    t0 = time.perf_counter()
    res_base = solve_distance_only(dmat)
    t1 = time.perf_counter()
    base_time = res_base.get("time_s", t1 - t0)
    base_map = res_base["mapping"]

    # enhanced
    urgencies = [urgency_score(row) for _, row in Hstar.reset_index(drop=True).iterrows()]
    enhanced_res = run_dynamic_assignment(Hstar.reset_index(drop=True), resources.reset_index(drop=True), C,
                                          urgency_series=urgencies, events=5, seed=seed)
    enh_map = enhanced_res["mapping"]

    # metrics
    def total_cost(mapping, mat):
        return float(sum(mat[r, c] for r, c in mapping.items()))

    base_cost = total_cost(base_map, dmat)
    enh_cost = total_cost(enh_map, C)

    # allocation accuracy: fraction assigned pack_type in household needs
    def alloc_accuracy(mapping, HH, RES):
        correct = 0
        for r, c in mapping.items():
            needs = list(HH.iloc[r].get("needs", []))
            pack = RES.iloc[c]["pack_type"]
            if pack in needs:
                correct += 1
        return correct / len(mapping) if mapping else 0.0

    base_acc = alloc_accuracy(base_map, Hstar.reset_index(drop=True), resources.reset_index(drop=True))
    enh_acc = alloc_accuracy(enh_map, Hstar.reset_index(drop=True), resources.reset_index(drop=True))

    # prioritization efficiency: Spearman correlation between urgency and assigned compatibility
    def prioritization_eff(mapping, HH, RES):
        urg = [urgency_score(HH.iloc[r]) for r in sorted(mapping.keys())]
        comp = [1.0 if RES.iloc[mapping[r]]["pack_type"] in HH.iloc[r]["needs"] else 0.0 for r in sorted(mapping.keys())]
        if len(urg) < 2:
            return 0.0
        rho, _ = spearmanr(urg, comp)
        return float(rho)

    base_pe = prioritization_eff(base_map, Hstar.reset_index(drop=True), resources.reset_index(drop=True))
    enh_pe = prioritization_eff(enh_map, Hstar.reset_index(drop=True), resources.reset_index(drop=True))

    # execution times: base_time vs enhanced timings sum
    enh_time = enhanced_res["timings"]["initial_s"] + sum(ev["time_s"] for ev in enhanced_res["timings"]["events"])

    return {
        "n": n,
        "base_cost": base_cost,
        "enh_cost": enh_cost,
        "base_acc": base_acc,
        "enh_acc": enh_acc,
        "base_pe": base_pe,
        "enh_pe": enh_pe,
        "base_time_s": base_time,
        "enh_time_s": enh_time,
    }


def batch_run(ns: List[int] = [10, 20, 30, 40, 50, 60], repeats: int = 3, out_dir: str = "outputs") -> pd.DataFrame:
    os.makedirs(out_dir, exist_ok=True)
    rows = []
    for n in ns:
        for r in range(repeats):
            res = run_once(n, seed=1000 + n + r)
            rows.append(res)

    df = pd.DataFrame(rows)

    # aggregate by n
    agg = df.groupby("n").agg({
        "base_cost": "mean",
        "enh_cost": "mean",
        "base_acc": "mean",
        "enh_acc": "mean",
        "base_pe": "mean",
        "enh_pe": "mean",
        "base_time_s": "mean",
        "enh_time_s": "mean",
    }).reset_index()

    # plots
    plt.figure(figsize=(10, 8))
    plt.subplot(2, 2, 1)
    plt.plot(agg["n"], agg["base_cost"], label="Standard")
    plt.plot(agg["n"], agg["enh_cost"], label="Enhanced")
    plt.title("Total Assignment Cost")
    plt.legend()

    plt.subplot(2, 2, 2)
    plt.plot(agg["n"], agg["base_acc"], label="Standard")
    plt.plot(agg["n"], agg["enh_acc"], label="Enhanced")
    plt.title("Mean Allocation Accuracy")
    plt.legend()

    plt.subplot(2, 2, 3)
    plt.plot(agg["n"], agg["base_pe"], label="Standard")
    plt.plot(agg["n"], agg["enh_pe"], label="Enhanced")
    plt.title("Prioritization Efficiency (Spearman)")
    plt.legend()

    plt.subplot(2, 2, 4)
    plt.plot(agg["n"], agg["base_time_s"], label="Standard")
    plt.plot(agg["n"], agg["enh_time_s"], label="Enhanced")
    plt.title("Execution Time (s)")
    plt.legend()

    plot_path = os.path.join(out_dir, "comparison.png")
    plt.tight_layout()
    plt.savefig(plot_path)

    # save table
    csv_path = os.path.join(out_dir, "summary.csv")
    agg.to_csv(csv_path, index=False)

    return agg


if __name__ == "__main__":
    print("Running batch evaluation (this may take a minute)…")
    agg = batch_run()
    print(agg)
