"""Ethics/Grounding loader utilities.

Loads guidelines and principles from a configurable path so that
agents or services can reference them for behavior grounding.
"""

from pathlib import Path

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None  # type: ignore

from config.config import settings
from src.utils.logging_utils import logger


def load_grounding_documents() -> dict[str, str]:
    """Load text-like files from the configured ethics framework path.

    Returns a mapping of filename -> content. Non-fatal on errors.
    """
    results: dict[str, str] = {}
    base = settings.ethics_framework_path.strip()
    if not base:
        return results
    try:
        p = Path(base).expanduser()
        if not p.exists() or not p.is_dir():
            return results
        for f in p.glob("**/*"):
            if f.is_file() and f.suffix.lower() in {".md", ".txt", ".json"}:
                try:
                    results[str(f.name)] = f.read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    logger.debug("Skipping unreadable grounding file %s", f, exc_info=True)
            elif f.is_file() and f.suffix.lower() in {".pdf"} and PdfReader is not None:
                try:
                    reader = PdfReader(str(f))
                    text_parts: list[str] = []
                    for page in reader.pages[:50]:  # cap pages for performance
                        try:
                            text_parts.append(page.extract_text() or "")
                        except Exception:
                            logger.debug("Skipping unextractable PDF page in %s", f, exc_info=True)
                    content = "\n".join(text_parts)
                    results[str(f.name)] = content
                except Exception:
                    logger.debug("Skipping unreadable PDF %s", f, exc_info=True)
    except Exception as e:
        logger.warning(f"Failed to load ethics framework: {e}")
    return results


def get_grounding_summary(max_chars: int = 4000) -> str:
    """Compact summary string for prompts or logs."""
    docs = load_grounding_documents()
    if not docs:
        return ""
    parts: list[str] = []
    for name, content in sorted(docs.items()):
        parts.append(f"## {name}\n{content}\n")
        if sum(len(p) for p in parts) > max_chars:
            break
    summary = "\n".join(parts)
    return summary[:max_chars]
