import os
import re
from pathlib import Path
from re import Pattern
from typing import Any


class SearchReplaceAgent:
    """Agent for searching (and optionally replacing) regex patterns across all files.

    Supports dry-run (no writes), directory filtering, and summary reporting.
    """

    def __init__(self, repo_root: str = "."):
        self.repo_root = Path(repo_root)

    def search(
        self,
        pattern: str,
        file_extensions: list[str] | None = None,
        ignore_dirs: list[str] | None = None,
    ) -> dict[str, list[str]]:
        """Return files and line numbers where pattern occurs."""
        regex: Pattern[str] = re.compile(pattern)
        results: dict[str, list[str]] = {}
        for file_path in self._iter_files(file_extensions, ignore_dirs):
            try:
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f, 1):
                        if regex.search(line):
                            results.setdefault(str(file_path), []).append(
                                f"Line {i}: {line.rstrip()}"
                            )
            except Exception:
                continue
        return results

    def replace(
        self,
        pattern: str,
        repl: str,
        file_extensions: list[str] | None = None,
        ignore_dirs: list[str] | None = None,
        dry_run: bool = True,
    ) -> list[dict[str, Any]]:
        """Replace pattern with repl in matching files. Returns list of changes."""
        regex: Pattern[str] = re.compile(pattern)
        changes: list[dict[str, Any]] = []
        for file_path in self._iter_files(file_extensions, ignore_dirs):
            try:
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                matches = list(regex.finditer(content))
                if matches:
                    if dry_run:
                        changes.append({"file": str(file_path), "matches": len(matches)})
                    else:
                        new_content = regex.sub(repl, content)
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        changes.append({"file": str(file_path), "changes": len(matches)})
            except Exception:
                continue
        return changes

    def _iter_files(self, file_extensions: list[str] | None, ignore_dirs: list[str] | None):
        for root, dirs, files in os.walk(self.repo_root):
            # Filter out ignored directories
            if ignore_dirs:
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                if (not file_extensions) or any(file.endswith(ext) for ext in file_extensions):
                    yield Path(root) / file
