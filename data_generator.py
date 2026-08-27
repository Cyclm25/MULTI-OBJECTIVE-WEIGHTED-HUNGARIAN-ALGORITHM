"""Synthetic data generator for households and resources.

Provides reproducible, parameterized synthetic datasets.

Solves: provides input for the pipeline (used by all SOPs).
"""
from typing import List, Tuple
import random
import pandas as pd

PACK_TYPES = ["food", "hygiene", "medical", "infant", "mobility"]


def generate_households(n: int, seed: int = 0) -> pd.DataFrame:
    """Generate n synthetic household records.

    Each household includes vulnerability attributes used to compute urgency.
    """
    random.seed(seed)
    rows = []
    for i in range(n):
        hh_id = f"HH{1000 + i}"
        name = f"Household_{i}"
        address = f"Blk {random.randint(1,50)} Lot {random.randint(1,200)}"
        birth_year = random.randint(1940, 2018)
        elderly_count = random.choices([0, 1, 2], weights=[0.7, 0.25, 0.05])[0]
        pwd = random.random() < 0.12
        infants = random.choices([0, 1], weights=[0.85, 0.15])[0]
        # declared needs: pick 1-2 pack types
        needs = random.sample(PACK_TYPES, k=random.choice([1, 2]))
        rows.append({
            "household_id": hh_id,
            "name": name,
            "address": address,
            "birth_year": birth_year,
            "elderly_count": elderly_count,
            "pwd": pwd,
            "infants_count": infants,
            "needs": needs,
        })
    return pd.DataFrame(rows)


def generate_resources(n: int, seed: int = 0) -> pd.DataFrame:
    """Generate n relief resource packs (one pack per resource slot).

    Types are drawn from standard categories.
    """
    random.seed(seed + 999)
    rows = []
    for i in range(n):
        res_id = f"R{2000 + i}"
        pack_type = random.choice(PACK_TYPES)
        # quantity, expiry etc. kept minimal for simulation
        rows.append({"resource_id": res_id, "pack_type": pack_type})
    return pd.DataFrame(rows)


def generate_masterlist(households: pd.DataFrame) -> pd.DataFrame:
    """Create a barangay masterlist (truth table) from a subset of households.

    Used by validation module to simulate cross-checking.
    """
    # for simplicity, take all households as in masterlist but scramble IDs for some
    df = households.copy()
    df["master_household_id"] = df["household_id"]
    return df[["master_household_id", "name", "address"]]
