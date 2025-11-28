# Repository Guidelines

## Project Structure & Module Organization

- Backend lives in `src`: `agents/` for agent types and factory wiring, `api/` for FastAPI routers (training, RAG), `models/` for schemas, and `utils/` for helpers; configuration defaults are in `config/`.
- Frontend is a Vite React app rooted at `client/` (components, hooks, pages) with shared TypeScript helpers in `shared/` and assets in `attached_assets/`.
- Tests sit in `tests/` with `unit/` and `reassembly/`; CLI helpers and runners are in `scripts/`, `run.py`, and `run_tests.py`.
- Docs and examples live in `docs/`, `examples/`, and `projects/`.

## Build, Test, and Development Commands

- Install backend (dev): `python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`.
- Run API locally: `python run.py` (uses `src.main:app`; defaults set in `config/config.py` and `.env`).
- Frontend dev server: `npm install` then `npm run dev -- --host --port 5173` from repo root (Vite uses `client/` root).
- Type checking / lint (web): `npm run check` (tsc + eslint); `npm run prettier` for formatting.
- Python quality: `ruff check src tests` and `black src tests` (line length 100); `mypy src` for type safety.

## Coding Style & Naming Conventions

- Python: Black-formatted, Ruff-enforced; prefer typed functions, explicit imports, and `snake_case` modules, functions, and variables. Keep public API schemas in `models/` and avoid circular imports by using `typing.TYPE_CHECKING` when needed.
- TypeScript/React: Follow ESLint/Prettier defaults; favor functional components and hooks, `PascalCase` for components, `camelCase` for props and utilities, and `kebab-case` filenames within `client/src`.
- Config and secrets: never commit `.env`; sample values belong in `.env.example`.

## Testing Guidelines

- Primary framework: `pytest` with coverage (`pytest --cov=src --cov-report=term-missing`). Use `run_tests.py --test-type unit` for targeted runs.
- Place fast deterministic tests in `tests/unit/`; longer flow/reassembly tests belong in `tests/reassembly/`.
- Name tests with `test_<target>_behavior.py` and descriptive function names; add markers (`-m llm`, `-m training`) when behavior depends on external providers.
- Aim to keep new code covered; prefer fixtures in `tests/conftest.py` to avoid duplication.

## Commit & Pull Request Guidelines

- Commit messages follow a lightweight conventional style (`feat:`, `fix:`, `chore:`, `docs:`); keep subjects in imperative mood and ≤72 chars (e.g., `fix: tighten rate limiter guard`).
- PRs should summarize scope, note breaking changes, link issues, and include screenshots for UI changes or sample API payloads for backend changes. Mention required env vars or migrations explicitly.

## Security & Configuration Tips

- Required keys (OpenAI/Gemini/Anthropic) and optional Redis/PostgreSQL endpoints come from `.env`; validate with `settings.validate_api_keys()` logs at startup.
- Respect `settings.max_file_size_bytes` and rate-limit knobs when adding endpoints; avoid widening CORS or logging secrets.
- For telemetry, only enable OTLP exporters when the endpoint is configured; keep defaults safe for local development.
