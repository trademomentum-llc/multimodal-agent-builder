from pathlib import Path


class DatasetManager:
    """Central interface for accessing train, validation, and test dataset splits in the project.

    Handles resolved file paths, loading, and (optionally) application-specific adaptors.
    """

    def __init__(self, dataset_root: str = "train-test-validate") -> None:
        self.root = Path(dataset_root)

    def get_split_path(self, split: str) -> Path:
        split_map = {
            "train": self.root / "ML-Training",
            "validation": self.root / "ML-Validation",
            "test": self.root / "ML-Testing",
        }
        return split_map[split]

    def list_files(self, split: str) -> list[Path]:
        d = self.get_split_path(split)
        return list(d.glob("*"))

    # Optionally, add loader/iterator methods here for pandas, torch, etc.
