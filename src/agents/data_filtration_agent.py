from pathlib import Path

from src.utils.dataset_manager import DatasetManager


class DataFiltrationAgent:
    """Agent that performs dataset filtering/deduplication for a split.

    Handles QA, outlier, and custom filter rules, with pluggable filters.
    """

    def __init__(self, dataset_manager: DatasetManager) -> None:
        self.dataset_manager = dataset_manager

    def filter_split(self, split: str = "train") -> list[Path]:
        files = self.dataset_manager.list_files(split)
        # Placeholder: return files "filtered" (identity)
        return files

    # TODO: add actual filter rules and output management
