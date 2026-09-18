# Agent Orchestration

## The Loop

For a full unit of work (feature, fix, refactor), the orchestration is the **`/ship`** skill:
plan aprobado → TDD → revisión en paralelo → corrección con re-review acotada → PR abierto. No
reinventes ese orden a mano; `/ship` lo corre y el gate (`review-gate.mjs`) lo hace cumplir. Los
agentes de abajo son las piezas que `/ship` usa, y también sirven sueltos para tareas puntuales.

## When to Use Each Agent

- Complex feature → **planner**
- System design → **architect**
- Code just written → **code-reviewer**
- Test design and coverage quality → **qa-reviewer**
- Bug fix or new feature → **tdd-guide**
- Architectural decision → **architect**
- Security concern → **security-reviewer**
- Build broken → **build-error-resolver**

## Execution Strategy

- Run independent analyses in PARALLEL, not sequentially
- For complex problems: deploy multiple specialized agents simultaneously
  (factual reviewer + senior engineer + security expert + consistency checker)
- Parallel task execution > sequential processing for independent operations
