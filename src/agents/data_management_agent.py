import subprocess

from src.utils.dataset_manager import DatasetManager


class DataManagementAgent:
    """Agent for orchestrating data chunk reassembly, movement, and workflow coordination.

    Can invoke the reassembly shell script, check outputs, and track split metadata.
    """

    def __init__(self, dataset_manager: DatasetManager):
        self.dataset_manager = dataset_manager

    def reassemble_split(self, kind: str = "all", dry_run: bool = False, verbose: bool = True):
        cmd = ["bash", "scripts/reassemble_files.sh", "--kind", kind]
        if dry_run:
            cmd.append("--dry-run")
        if verbose:
            cmd.append("--verbose")
        return subprocess.run(cmd, capture_output=True, text=True)

    # TODO: add metadata tracking, backup, upload/download, etc.
