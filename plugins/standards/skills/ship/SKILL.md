---
name: ship
description: Loop de entrega spec-driven — plan aprobado, TDD, revisión en paralelo, corrección con re-review acotada, y hasta PR abierto. Invocación manual con /ship.
disable-model-invocation: true
---

# /ship — loop de entrega con revisión obligatoria

Orquesta una unidad de trabajo desde la spec hasta el PR, con la revisión de seguridad y
calidad como puerta que el commit no puede saltar. El gate (`review-gate.mjs`) hace cumplir
la parte crítica: sin veredicto APPROVE de code-reviewer Y security-reviewer para el diff
exacto, el commit se deniega. Tu trabajo aquí es correr el loop, no confiar en que lo recuerdes.

Corre en el contexto principal (no forkeado) para que los reviewers sean subagentes reales y
disparen el SubagentStop del gate.

## Precondición

Un objetivo concreto: una feature, un fix o un refactor que quepa en 3–5 archivos. Si no cabe,
pásalo primero por `planner` y parte en fases mergeables por separado.

## Pasos

### 1. Plan — y PARA
Lanza `planner`. Devuelve spec: goal, archivos (máx 3–5), API, constraints, riesgos.
**Detente y muestra la spec a Karen. No sigas hasta que la apruebe.** Esta es la única parada
obligatoria del loop; el resto corre sin pedir permiso intermedio.

### 2. TDD — RED → GREEN
Lanza `tdd-guide`. Escribe el test que describe el comportamiento y **córrelo para verlo fallar**
antes de implementar. Luego la implementación mínima hasta green. Para un fix, el test reproduce
el síntoma reportado primero.

### 3. Verificación local
Corre, en el proyecto: la suite de tests, `tsc` (si es TS) y el linter. Si algo falla, arréglalo
antes de seguir. No lleves código roto a revisión.

### 4. Revisión en PARALELO
Lanza en un solo turno, concurrentes:
- `code-reviewer` — corrección de la implementación
- `security-reviewer` — vulnerabilidades
- `qa-reviewer` — calidad del diseño de pruebas y cobertura; conduce el sistema `awesome-qa-skills` (arranca por `discover-testing`) y emite el VERDICT
- `lean-review` (skill) — sobre-ingeniería (asesor, no bloquea el commit)

Los tres primeros terminan con su línea `VERDICT: APPROVE|WARNING|BLOCK critical=N high=N`. El
gate la lee y la guarda contra el hash del diff, y **el commit exige APPROVE de los tres**. Si un
reviewer no escribe la línea, el hook lo bloquea hasta que la escriba.

### 5. Corrección con re-review — máximo 3 rondas
Si hay CRITICAL o HIGH, o `lean-review` marca algo real:
1. El fix empieza por un test que falla (`tdd-guide`), nunca un parche directo. Para un hallazgo
   de seguridad, arréglalo en la función compartida por donde pasan todos los llamadores. Para un
   hallazgo de `qa-reviewer`, el fix ES el test que faltaba (o el escenario/aserción que faltaba).
2. Vuelve a correr **solo** los reviewers que marcaron algo, sobre el diff nuevo.
3. Repite hasta que los tres den APPROVE (critical=0, high=0).

**Tope: 3 rondas.** Si a la tercera sigue habiendo CRITICAL/HIGH, **para y escala a Karen** con
la lista de hallazgos pendientes y por qué no cerraron. No commitees, no sigas al PR.

### 6. Hasta PR abierto
Con ambos reviewers en APPROVE para el diff actual:
1. Rama `ship/<slug-corto>` (nunca commitees en `main`).
2. Commit convencional: `type(scope): description`, el cuerpo explica el PORQUÉ. Un cambio por
   commit. El gate permite el commit porque el diff está aprobado; la regla `ask` te pedirá
   confirmación.
3. `git push -u`.
4. `gh pr create` con resumen del alcance (`git diff main...HEAD`), el porqué, y un test plan con
   checklist. Cierra con la línea de atribución que pida el harness.
5. Resume: qué se hizo, qué reviewers pasaron, el link del PR. **Para aquí.**

## Límites (no negociables del loop)
- **Merge y deploy son de Karen.** `/ship` llega al PR abierto y para. No mergea, no despliega.
- El gate solo cubre commits que Claude hace por la tool Bash. Un `! git commit` de Karen es su
  válvula manual y no pasa por el gate.
- Cada commit y push disparan la regla `ask`: es la confirmación de Karen, no un bug.
- Si el objetivo excede 3–5 archivos y no se dejó partir en el paso 1, no lo fuerces: dilo.
