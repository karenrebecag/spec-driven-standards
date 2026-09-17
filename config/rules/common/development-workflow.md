# Development Workflow

## Feature Implementation Order (MANDATORY)

1. **Research & Reuse** — search GitHub, docs, package registries before building
2. **Plan** — use planner agent: PRD, architecture, task list, dependencies, risks
3. **TDD** — write tests first (RED → GREEN → IMPROVE), target 80%+ coverage
4. **Review** — apply code-reviewer agent immediately after writing code
5. **Commit** — conventional commits with detailed WHY messages, then push

## Bug Fixes: Root Cause, Not Symptom

A ticket names a symptom. The fix goes where all callers route through.

1. Reproduce with a failing test first (tdd-guide) — never patch directly
2. Grep every caller of the function about to change
3. Fix once in the shared function, not once per call site

One guard in the shared function is a smaller diff than one guard per caller, and patching only the path the ticket names leaves every sibling caller still broken.

## Available Agents

- **planner**: complex feature planning
- **architect**: system design decisions
- **code-reviewer**: post-write review
- **security-reviewer**: vulnerability assessment
- **tdd-guide**: test-first development
- **build-error-resolver**: compilation/build issues
- **refactor-cleaner**: post-feature cleanup
