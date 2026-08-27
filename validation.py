"""Beneficiary Verification & Data Validation (Module 1)

Solves SOP 1: detect duplicates, cross-check with masterlist, and assign verification_status.
"""
from typing import Tuple
import pandas as pd


def validate_households(households: pd.DataFrame, masterlist: pd.DataFrame) -> pd.DataFrame:
    """Cross-check households against masterlist, detect duplicates, and set verification_status.

    verification_status: Verified, Pending, Flagged, Rejected
    - Verified: exact match in masterlist
    - Flagged: possible duplicate or mismatch on key fields
    - Pending: minor mismatch (keeps for manual review)
    - Rejected: missing critical fields or clearly invalid
    """
    df = households.copy()
    df["verification_status"] = "Pending"

    # Basic rejection: missing household_id or name
    df.loc[df["household_id"].isna() | df["name"].isna(), "verification_status"] = "Rejected"

    # Exact match against masterlist based on name+address
    master_keys = set(
        zip(masterlist["name"].str.lower(), masterlist["address"].str.lower())
    )
    def check_master(row):
        key = (str(row["name"]).lower(), str(row["address"]).lower())
        return "Verified" if key in master_keys else None

    df["from_master"] = df.apply(check_master, axis=1)
    df.loc[df["from_master"] == "Verified", "verification_status"] = "Verified"

    # Duplicate detection: household_id duplicates or same name+birth_year+address
    dup_id = df["household_id"].duplicated(keep=False)
    dup_multi = (
        df.duplicated(subset=["name", "address", "birth_year"], keep=False)
    )
    df.loc[dup_id | dup_multi, "verification_status"] = "Flagged"

    # If Verified but also flagged for duplicates, mark Flagged
    df.loc[(df["verification_status"] == "Verified") & (dup_id | dup_multi), "verification_status"] = "Flagged"

    # Only output Verified rows as H*
    return df
