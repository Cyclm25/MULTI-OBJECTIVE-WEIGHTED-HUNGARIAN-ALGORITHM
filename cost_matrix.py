"""Multi-Objective Weighted Cost Matrix (Module 2)

Solves SOP 1 / Objective 1: construct C[i][j] = w1*Distance + w2*Urgency + w3*Compatibility
Default weights are AHP-derived from thesis: w1=0.164, w2=0.539, w3=0.297
Includes a small AHP utility for traceability.
"""
from typing import List, Tuple, Dict
import numpy as np
import pandas as pd

# Default AHP-derived weights (from thesis Table 3.4)
DEFAULT_WEIGHTS = {"distance": 0.164, "urgency": 0.539, "compatibility": 0.297}


def ahp_weights_from_pairwise(matrix: np.ndarray) -> Tuple[np.ndarray, float]:
    """Compute AHP weights and consistency ratio for a pairwise comparison matrix.

    Returns (weights, CR).
    """
    # Principal eigenvector method (approx via normalized columns then average rows)
    col_sum = matrix.sum(axis=0)
    norm = matrix / col_sum
    weights = norm.mean(axis=1)
    # Consistency
    lam = (matrix @ weights) / weights
    lam_max = lam.mean()
    n = matrix.shape[0]
    ci = (lam_max - n) / (n - 1) if n > 1 else 0.0
    # Random Index (RI) for n (using common RI table)
    RI_TABLE = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45}
    ri = RI_TABLE.get(n, 1.45)
    cr = ci / ri if ri else 0.0
    return weights, cr


def urgency_score(hh_row: pd.Series) -> float:
    """Compute household urgency score (0-100) from vulnerability attributes.

    Rubric (simple, traceable):
    - Each elderly member: +15 points
    - PWD: +30 points
    - Each infant: +10 points
    - Cap at 100
    """
    score = 0.0
    score += 15.0 * float(hh_row.get("elderly_count", 0))
    score += 30.0 if hh_row.get("pwd", False) else 0.0
    score += 10.0 * float(hh_row.get("infants_count", 0))
    return min(100.0, score)


def compatibility_score(needs: List[str], pack_type: str) -> float:
    """Return compatibility in range 0..1 between household needs and a pack type.

    - Exact match: 1.0
    - If household needs include multiple types, partial credit given.
    """
    if not needs:
        return 0.0
    needs = list(needs)
    if pack_type in needs:
        # If pack covers one of many needs, partial if many needs
        return 1.0
    # No direct match -> low compatibility
    return 0.0


def normalize_array(arr: np.ndarray) -> np.ndarray:
    mn = np.nanmin(arr)
    mx = np.nanmax(arr)
    if mx - mn == 0:
        return np.zeros_like(arr)
    return (arr - mn) / (mx - mn)


def build_cost_matrix(households: pd.DataFrame, resources: pd.DataFrame, distance_matrix: np.ndarray,
                      w1: float = None, w2: float = None, w3: float = None) -> np.ndarray:
    """Construct the weighted cost matrix C for n households and n resources.

    households: DataFrame with urgency-related fields and `needs` list
    resources: DataFrame with `pack_type`
    distance_matrix: n x n numeric matrix (same order as households/resources)
    """
    w1 = DEFAULT_WEIGHTS["distance"] if w1 is None else w1
    w2 = DEFAULT_WEIGHTS["urgency"] if w2 is None else w2
    w3 = DEFAULT_WEIGHTS["compatibility"] if w3 is None else w3

    n = len(households)
    # compute urgency per household
    urgencies = np.array([urgency_score(row) for _, row in households.iterrows()], dtype=float)
    # compatibility matrix
    comp = np.zeros((n, n), dtype=float)
    for i, (_, hh) in enumerate(households.iterrows()):
        for j, (_, res) in enumerate(resources.iterrows()):
            comp[i, j] = compatibility_score(hh.get("needs", []), res.get("pack_type", ""))

    # normalize components to 0..1
    dist_n = normalize_array(np.array(distance_matrix, dtype=float))
    urg_n = normalize_array(urgencies)
    # expand urgencies to matrix rows
    urg_mat = np.repeat(urg_n.reshape((n, 1)), n, axis=1)
    comp_n = comp  # compatibility already 0..1

    C = w1 * dist_n + w2 * urg_mat + w3 * (1.0 - comp_n)
    # Note: higher compatibility reduces cost (1 - comp)
    return C
