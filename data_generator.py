"""Synthetic data generator for households and resources.

Provides reproducible, parameterized synthetic datasets.

Solves: provides input for the pipeline (used by all SOPs).
"""
from typing import List, Tuple
import random
import pandas as pd

PACK_TYPES = ["food", "hygiene", "medical", "infant", "mobility"]

# The web application's configured Barangay 160 review boundary. Coordinates
# generated from this box are synthetic demonstration points, not surveyed
# household locations.
BARANGAY_160_BOUNDS = {
    "min_lat": 14.6200279,
    "max_lat": 14.6214747,
    "min_lon": 120.9729135,
    "max_lon": 120.9740792,
}
RELIEF_TYPES = ["Water", "Food", "Medical", "Shelter"]


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


def generate_barangay160_web_sample(n: int = 15, seed: int = 160) -> pd.DataFrame:
    """Generate coordinate-enabled sample rows accepted by Allocation Lab.

    The coordinates are reproducible synthetic points strictly inside the
    configured Barangay 160 boundary. They must not be used as real household
    locations or substituted for field-collected GPS data.
    """
    if n < 1:
        raise ValueError("n must be at least 1")

    rng = random.Random(seed)
    bounds = BARANGAY_160_BOUNDS
    lat_margin = (bounds["max_lat"] - bounds["min_lat"]) * 0.08
    lon_margin = (bounds["max_lon"] - bounds["min_lon"]) * 0.08
    addresses = [
        "F. Yuseco Street, Barangay 160, Tondo, Manila",
        "Near Barangay 160 Hall, Tondo, Manila",
        "Barangay 160, Zone 14, Tondo, Manila",
    ]

    rows = []
    for index in range(n):
        rows.append({
            "household": f"H-{index + 1:03d}",
            "address": addresses[index % len(addresses)],
            "latitude": round(rng.uniform(
                bounds["min_lat"] + lat_margin,
                bounds["max_lat"] - lat_margin,
            ), 7),
            "longitude": round(rng.uniform(
                bounds["min_lon"] + lon_margin,
                bounds["max_lon"] - lon_margin,
            ), 7),
            "urgency": rng.randint(1, 10),
            "compatible_resource": RELIEF_TYPES[index % len(RELIEF_TYPES)],
            "verification": "Pending" if (index + 1) % 5 == 0 else "Verified",
            "coordinate_source": "Synthetic sample point",
        })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    output_path = "barangay160_generated_sample.csv"
    generate_barangay160_web_sample().to_csv(output_path, index=False)
    print(f"Created {output_path} with synthetic Barangay 160 coordinates")
