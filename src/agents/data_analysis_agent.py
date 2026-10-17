from src.utils.dataset_manager import DatasetManager


class DataAnalysisAgent:
    """An agent for exploring and analyzing dataset splits (train/val/test),
    generating statistics, summaries, and anomaly reports.
    """

    def __init__(self, dataset_manager: DatasetManager):
        self.dataset_manager = dataset_manager

    def analyze_split(self, split: str = "train"):
        """Example: Print basic statistics for all files in the split."""
        files = self.dataset_manager.list_files(split)
        return {
            "num_files": len(files),
            "files": [str(f) for f in files],
        }

    # TODO: add custom stat/anomaly algorithms
