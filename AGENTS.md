# Repository Guidelines

## Project Structure & Module Organization
- `src/`: FastAPI app and agent logic (`agents/` for agent types, `api/` for routes, `models/` for schemas, `utils/` for helpers).
- `config/`: Pydantic settings loaded from `.env` (API keys, rate limits, file limits, CORS).
- `tests/`: Pytest suites (`unit/`, `reassembly/`, shared fixtures in `conftest.py`); coverage XML/HTML lives in `coverage.xml` and `htmlcov/`.
- `client/`: Front-end scaffold (Vite/TypeScript) with `index.html` and `client/src` assets.
- `scripts/`, `examples/`, `docs/`, `projects/`: utility runners, usage samples, docs, and experiment artifacts.

## Build, Test, and Development Commands
- Install (dev): `python -m pip install --upgrade pip && pip install -e ".[dev]"`.
- Run API locally: `uvicorn src.main:app --reload --host 0.0.0.0 --port 8000`.
- Python checks: `ruff check src tests`, `mypy src`, `pytest -k "not old"` or `python run_tests.py all -v`.
- Front-end/TypeScript checks: `npm install` then `npm run check` (tsc + eslint) or targeted `npm run check:ts`, `npm run lint:fix`, `npm run prettier`.
- Security quick scan: `bandit -q -r src` (matches CI).

## Coding Style & Naming Conventions
- Editor config: LF, UTF-8, spaces, 2-space indent.
- Python: Black line length 100, type hints required (strict mypy); snake_case for functions/vars, PascalCase for classes. Keep FastAPI models lean and validated.
- Linting: Ruff enforced in CI; fix before pushing. Avoid broad `except:`; log with context.
- JS/TS: Prettier (printWidth 80, semicolons, single quotes, 2-space tabs) and ESLint (`@typescript-eslint`). Prefer typed APIs and descriptive prop/state names.

## Testing Guidelines
- Use Pytest; tests live beside feature area under `tests/unit/...` with filenames `test_*.py`.
- Default run is verbose with coverage (threshold 70% via `pytest.ini`); add markers (`@pytest.mark.api`, `@pytest.mark.agent`, `@pytest.mark.slow`) and select with `-m`.
- For new features, include happy-path, failure, and edge cases; mock external LLMs/IO and avoid real network calls.

## Security & Configuration
- Never commit secrets; rely on `.env` (keys for OpenAI/Gemini/Anthropic, Redis URL, CORS, size limits). Validate via `config.settings`.
- Respect payload limits and allowed file types defined in settings; keep new endpoints behind FastAPI validation and rate limiting hooks.
- Provide sanitized sample payloads in docs/examples rather than real data.

## Commit & Pull Request Guidelines
- Commits: short imperative summary (e.g., `Add rate limiter metrics`), reference issues (`#123`) when applicable.
- Before PR: run `ruff`, `mypy`, `pytest`, `npm run check` (if you touched TypeScript/JS). Ensure coverage stays above threshold.
- PR description: what changed, why, how to test (commands run). Link related issues and include screenshots/GIFs for UI updates in `client/`.
- Keep changes scoped; prefer small, reviewable PRs and note any breaking API changes or migrations.
