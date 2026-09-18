# Performance

## Model Selection

- **Haiku 4.5**: lightweight agents, frequent invocations, pair programming. Es el modelo de los subagentes (`CLAUDE_CODE_SUBAGENT_MODEL=haiku`), salvo los que fijan su propio `model` en el frontmatter (planner, architect y code/security-reviewer piden más).
- **Sonnet 5**: main development work, orchestrating multi-agent workflows
- **Opus 5**: architectural decisions, complex analysis, deepest reasoning only. Es el modelo principal de la sesión (`settings.json` → `model: opus`).

## Context Window

- Reserve final 20% of context for simpler tasks (single-file edits, docs)
- Don't start large refactors when context is nearly full

## Extended Thinking

Default cap: 31,999 tokens. Set `MAX_THINKING_TOKENS=10000` for routine tasks.
Use extended thinking + Plan Mode for genuinely complex problems only.
