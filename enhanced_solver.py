"""Enhanced Multi-Objective Weighted Hungarian Algorithm + Dynamic Re-Assignment (Module 4)

Solves SOP 2 / Objective 2: runs multi-objective assignment and performs selective
re-assignments on urgency changes without recomputing the full matrix.
"""
from typing import Dict, Tuple, List
import numpy as np
from scipy.optimize import linear_sum_assignment
import time


def initial_assignment(cost_matrix: np.ndarray) -> Dict[int, int]:
    t0 = time.perf_counter()
    r, c = linear_sum_assignment(cost_matrix)
    t1 = time.perf_counter()
    return {int(rr): int(cc) for rr, cc in zip(r, c)}, (t1 - t0)


def selective_reassign(mapping: Dict[int, int], cost_matrix: np.ndarray, affected_rows: List[int]) -> Tuple[Dict[int, int], float]:
    """Reassign only affected rows among the resources currently assigned to them.

    This keeps the reduced sub-problem small (k x k) and avoids full recompute.
    """
    if not affected_rows:
        return mapping, 0.0
    # resources currently assigned to affected rows
    cols = [mapping[r] for r in affected_rows]
    k = len(affected_rows)
    sub = np.zeros((k, k), dtype=float)
    for i, r in enumerate(affected_rows):
        for j, c in enumerate(cols):
            sub[i, j] = cost_matrix[r, c]

    t0 = time.perf_counter()
    r_idx, c_idx = linear_sum_assignment(sub)
    t1 = time.perf_counter()

    # update mapping: map affected_rows[r_idx[i]] -> cols[c_idx[i]]
    for i_r, i_c in zip(r_idx, c_idx):
        mapping[affected_rows[int(i_r)]] = cols[int(i_c)]

    return mapping, (t1 - t0)


def run_dynamic_assignment(households, resources, cost_matrix: np.ndarray,
                           urgency_series: List[float], events: int = 5,
                           delta_threshold: float = 2.0, seed: int = 0) -> Dict:
    """Run initial assignment then simulate urgency fluctuation events.

    - urgency_series: initial urgencies (list length n)
    - On each event, perturb urgencies; if |Δ| >= threshold, selectively update mapping.
    Returns final mapping, event log, and timing.
    """
    import random
    random.seed(seed)
    n = len(households)
    mapping, t_init = initial_assignment(cost_matrix)
    timings = {"initial_s": t_init, "events": []}
    urg_prev = np.array(urgency_series, dtype=float)

    for e in range(events):
        # perturb some urgencies
        noise = np.random.normal(loc=0.0, scale=5.0, size=n)
        urg_new = np.clip(urg_prev + noise, 0.0, 100.0)
        delta = np.abs(urg_new - urg_prev)
        affected = [int(i) for i, d in enumerate(delta) if d >= delta_threshold]

        if affected:
            mapping, t_re = selective_reassign(mapping, cost_matrix, affected)
        else:
            t_re = 0.0

        timings["events"].append({"event": e + 1, "affected": affected, "time_s": t_re})
        urg_prev = urg_new

    return {"mapping": mapping, "timings": timings}
