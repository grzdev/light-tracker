"""
Light Tracker Data Science Dataset Loader
Provides seamless loading and feature extraction for Pandas and Polars pipelines.
"""

import json
import urllib.request
from typing import Optional, Tuple, Dict, Any
from pathlib import Path


class LightTrackerDataLoader:
    """
    Loader for Light Tracker datasets. Can load from local files or remote endpoints.
    """

    def __init__(self, endpoint_or_path: Optional[str] = None):
        self.source = endpoint_or_path or "http://localhost:3000/data/dataset-timeseries-5m.json"

    def load_raw_json(self) -> list:
        """Fetch raw JSON from URL or read from local disk."""
        if self.source.startswith("http://") or self.source.startswith("https://"):
            req = urllib.request.Request(
                self.source,
                headers={"User-Agent": "LightTracker-DSLoader/1.0", "Accept": "application/json"}
            )
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        else:
            path = Path(self.source)
            if not path.exists():
                raise FileNotFoundError(f"Dataset path not found: {path}")
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)

    def load_pandas(self, mask_unknown: bool = True):
        """
        Loads the dataset into a pandas DataFrame with datetime index.
        """
        try:
            import pandas as pd
        except ImportError:
            raise ImportError("pandas is required for load_pandas(). Install via: pip install pandas")

        records = self.load_raw_json()
        df = pd.DataFrame(records)

        # Parse timestamps into Lagos timezone (+01:00)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.set_index("timestamp", inplace=True)

        if mask_unknown:
            # Mask grid status where unconfirmed to avoid contaminating ML training
            df.loc[df["is_unknown"] == 1, "is_grid_on"] = None

        return df

    def load_polars(self):
        """
        Loads the dataset into a polars DataFrame.
        """
        try:
            import polars as pl
        except ImportError:
            raise ImportError("polars is required for load_polars(). Install via: pip install polars")

        records = self.load_raw_json()
        df = pl.DataFrame(records)
        return df.with_columns(pl.col("timestamp").str.to_datetime())

    def get_feature_matrix(self, df) -> Tuple[Any, Any]:
        """
        Extracts feature matrix X and target y for grid availability classification.
        Drops rows where ground truth is UNKNOWN.
        """
        import pandas as pd

        feature_cols = [
            "hour",
            "day_of_week",
            "is_weekend",
            "sin_hour",
            "cos_hour",
            "rolling_avail_6h",
            "rolling_avail_24h",
            "outage_streak_hours",
        ]

        # Only train on confirmed observations (mask out UNKNOWN)
        confirmed_df = df[df["is_unknown"] == 0].copy()
        X = confirmed_df[feature_cols]
        y = confirmed_df["is_grid_on"].astype(int)

        return X, y

    def get_outage_survival_data(self, df):
        """
        Prepares duration & censoring indicators for survival/hazard modeling (e.g. Kaplan-Meier).
        """
        import pandas as pd
        
        # Filter for outage periods
        outage_df = df[df["state"] == "OFF"].copy()
        return outage_df[["outage_streak_hours", "hour", "day_of_week"]]


if __name__ == "__main__":
    import sys

    source = sys.argv[1] if len(sys.argv) > 1 else None
    loader = LightTrackerDataLoader(source)
    print(f"Loading from: {loader.source}")
    try:
        df = loader.load_pandas()
        print(f"Successfully loaded {len(df)} records.")
        print(df.info())
        print(df.head())
    except Exception as e:
        print(f"Note: {e}")
