# Agent Orchestration

## When to Use Each Agent

- Complex feature → **planner**
- System design → **architect**
- Code just written → **code-reviewer**
- Bug fix or new feature → **tdd-guide**
- Architectural decision → **architect**
- Security concern → **security-reviewer**
- Build broken → **build-error-resolver**

## Execution Strategy

- Run independent analyses in PARALLEL, not sequentially
- For complex problems: deploy multiple specialized agents simultaneously
  (factual reviewer + senior engineer + security expert + consistency checker)
- Parallel task execution > sequential processing for independent operations
