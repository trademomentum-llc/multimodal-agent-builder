import shutil

# Justification for B404: subprocess is used only to run the repo's own reassembly script.
import subprocess  # nosec B404

from src.utils.dataset_manager import DatasetManager

# Must match the --kind values accepted by scripts/reassemble_files.sh
_ALLOWED_KINDS = frozenset({"all", "testing", "training", "validation"})


class DataManagementAgent:
    """Agent for orchestrating data chunk reassembly, movement, and workflow coordination.

    Can invoke the reassembly shell script, check outputs, and track split metadata.
    """

    def __init__(self, dataset_manager: DatasetManager) -> None:
        self.dataset_manager = dataset_manager

    def reassemble_split(
        self, kind: str = "all", dry_run: bool = False, verbose: bool = True
    ) -> subprocess.CompletedProcess[str]:
        if kind not in _ALLOWED_KINDS:
            raise ValueError(f"kind must be one of {sorted(_ALLOWED_KINDS)}, got {kind!r}")
        bash = shutil.which("bash")
        if bash is None:
            raise RuntimeError("bash is required to run the reassembly script")
        cmd = [bash, "scripts/reassemble_files.sh", "--kind", kind]
        if dry_run:
            cmd.append("--dry-run")
        if verbose:
            cmd.append("--verbose")
        # Justification for B603: fixed argv (no shell), constant script path, and `kind`
        # is validated against _ALLOWED_KINDS above, so no untrusted input reaches the call.
        return subprocess.run(cmd, capture_output=True, text=True, check=False)  # nosec B603

    # TODO: add metadata tracking, backup, upload/download, etc.
