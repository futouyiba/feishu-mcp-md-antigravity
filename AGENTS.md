# Repository Guidelines

## Project Structure & Module Organization
This repository is currently minimal and does not yet define a fixed source layout. Keep contributions organized from the start:
- `src/` for application or library code.
- `tests/` for automated tests, mirroring `src/` paths.
- `docs/` for design notes, decisions, and contributor-facing documentation.
- `scripts/` for repeatable local automation (setup, lint, test helpers).

Example:
`src/feature_x/handler.*` should have a corresponding `tests/feature_x/test_handler.*`.

## Build, Test, and Development Commands
No canonical build/test toolchain is committed yet. When introducing one, add scripts and document them here and in the main README.

Recommended baseline command set:
- `npm run build` or `make build`: create production artifacts.
- `npm test` or `make test`: run full automated tests.
- `npm run lint` or `make lint`: run static checks.
- `npm run dev`: start local development mode.

If you add a new command, include a short description in `README.md` and keep command names stable.

## Coding Style & Naming Conventions
- Use UTF-8 text files and 4-space indentation unless the language ecosystem strongly prefers otherwise.
- Prefer descriptive, domain-based module names (for example, `task_scheduler`, `agent_runtime`).
- Use `snake_case` for file names unless a framework requires another convention.
- Keep functions small and side effects explicit.
- Add formatter/linter config with the first language-specific code you introduce (for example, ESLint/Prettier, Ruff/Black, or golangci-lint).

## Testing Guidelines
- Place tests under `tests/` with names like `test_<module>.*` or `<module>.spec.*` (follow your framework standard consistently).
- Cover happy paths, edge cases, and failure behavior for new logic.
- Add regression tests for bug fixes.
- Aim for meaningful coverage on changed code, not just global percentages.

## Commit & Pull Request Guidelines
Git history includes both conventional (`fix: ...`) and free-form messages. Prefer Conventional Commits:
- `feat: add task queue retry policy`
- `fix: handle empty input in parser`
- `docs: update setup instructions`

Pull requests should include:
- clear summary of what changed and why,
- linked issue (if available),
- test evidence (command + result),
- screenshots/log snippets for UI or behavior-sensitive changes.
