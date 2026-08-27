"""Standard Hungarian Baseline (Module 3)

Solves SOP 1 baseline: single-objective distance-only assignment using SciPy.
"""
from typing import Tuple, Dict, List
import numpy as np
from scipy.optimize import linear_sum_assignment
import time


def solve_distance_only(distance_matrix: np.ndarray) -> Dict[int, int]:
    """Solve assignment using only the distance matrix as cost.

    Returns a mapping row->col (household index -> resource index) and timing info.
    """
    t0 = time.perf_counter()
    row_ind, col_ind = linear_sum_assignment(distance_matrix)
    t1 = time.perf_counter()
    mapping = {int(r): int(c) for r, c in zip(row_ind, col_ind)}
    return {"mapping": mapping, "time_s": t1 - t0}
