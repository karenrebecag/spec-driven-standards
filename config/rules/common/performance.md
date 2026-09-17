# Performance

## Model Selection

- **Haiku 4.5**: lightweight agents, frequent invocations, pair programming
- **Sonnet 4.6**: main development work, orchestrating multi-agent workflows
- **Opus 4.8**: architectural decisions, complex analysis, deepest reasoning only

## Context Window

- Reserve final 20% of context for simpler tasks (single-file edits, docs)
- Don't start large refactors when context is nearly full

## Extended Thinking

Default cap: 31,999 tokens. Set `MAX_THINKING_TOKENS=10000` for routine tasks.
Use extended thinking + Plan Mode for genuinely complex problems only.
