# Documentation Instructions

## Placement

- Use `docs/overview.md` for product purpose, scope, constraints, and success criteria.
- Use `docs/architecture.md` for stack, runtime design, state flow, persistence, and verification.
- Use `docs/project-structure.md` for the repository layout and file responsibilities.
- Use `docs/guides/` for current user-facing or developer-facing how-to material.
- Use `docs/instructions/` for durable documentation and workflow standards.
- Use `docs/reference/` for licensing, attribution, project-memory notes, and stable reference material.
- Use `docs/design/` for historical product or component specs.
- Use `docs/tasks/{task-name}/` only for complex investigations that need a changelog and multiple work sessions.
- Use `docs/reports/` for completed standalone analysis summaries.

## Update Rules

- Keep repository-root `README.md` short and link to durable docs instead of duplicating full explanations.
- Document actual behavior verified from source or tests.
- If docs, instructions, and code disagree, verify the current code path first and call out the mismatch before changing behavior.
- Update docs in the same change when gameplay, helper behavior, persistence, setup commands, or verification commands change.
- Prefer English for technical docs in this repo.

## Task Changelogs

For future complex tasks under `docs/tasks/{task-name}/`, keep `changelog.md` append-only with newest entries at the top. Include date, time, model or author, context, action, result, and next steps.
