import hashlib
from pathlib import Path

import pandas as pd


class GuardianAgent:
    """Monitor ledger or training artifact integrity.

    - Checks for missing/invalid records
    - Optionally performs file hashing for tamper detection
    - Verifies column/row counts and schema
    """

    REQUIRED_COLUMNS = [
        "Loop ID",
        "Topic",
        "Hypothesis",
        "Pattern",
        "Structure",
        "Why Closed",
        "Timestamp",
    ]

    def __init__(self, ledger_path: str):
        self.ledger_path = Path(ledger_path)

    def scan_ledger(self) -> dict:
        """Load the ledger file and check it for structural integrity."""
        if not self.ledger_path.exists():
            return {"status": "error", "msg": f"No ledger found at {self.ledger_path}"}

        df = pd.read_csv(self.ledger_path)
        missing_cols = [c for c in self.REQUIRED_COLUMNS if c not in df.columns]
        missing_data = df.isnull().sum().to_dict()
        duplicate_loops = df.duplicated(subset=["Loop ID"]).sum()
        row_hash = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
        results = {
            "status": (
                "ok"
                if not missing_cols and not df.isnull().any().any() and duplicate_loops == 0
                else "warn"
            ),
            "rows": len(df),
            "columns": list(df.columns),
            "missing_columns": missing_cols,
            "rows_missing_data": {k: v for k, v in missing_data.items() if v},
            "duplicated_loop_ids": int(duplicate_loops),
            "hash": row_hash,
        }
        return results

    def assert_expected_entries(self, expected_rows: int, strict: bool = True) -> bool:
        """Ensure the ledger contains exactly (or at least) the expected rows."""
        if not self.ledger_path.exists():
            return False
        df = pd.read_csv(self.ledger_path)
        return len(df) == expected_rows if strict else len(df) >= expected_rows
