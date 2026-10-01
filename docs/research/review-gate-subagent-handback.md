# Reference Brief: Handback en SubagentStop para review-gate

Slug: review-gate-subagent-handback | Nivel: standard | Fecha: 2026-10-01 | Estado: AUTO
Versiones: node=22
Verificador: research-verifier 2026-10-01 AUTO

## 1. Pregunta y decisiones abiertas

Definir de que fuente debe leer `review-gate` el veredicto final cuando un reviewer termina via `SubagentHandback`, sin depender de texto de cierre.

## 2. Estado actual

- `review-gate` parsea solo `last_assistant_message` dentro de `runSubagentStop`, por eso no registra cuando el cierre no trae `VERDICT` [repo:plugins/standards/hooks/review-gate.mjs:149]
Contextos: hook `SubagentStop` de reviewers en sesiones con y sin handback

## 3. Fuentes primarias

- La referencia oficial indica que en `SubagentStop` existen `agent_transcript_path` y `last_assistant_message`, y que con `SubagentHandback` (v2.1.271+) el reporte va por `tool_input.message`, no por `last_assistant_message` [doc:https://code.claude.com/docs/en/hooks.md@v2.1.271]

## 4. Implementaciones de referencia

- El issue de producto documenta la reproduccion y el sintoma en esta base: reviewers aprueban via handback pero el gate no persiste veredicto [KAREN:issue-20]

## 5. Opciones

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A: mantener solo `last_assistant_message` | cambio cero de parser | sigue perdiendo handbacks | baja | no |
| B: leer `agent_transcript_path` y recuperar `tool_input.message` de `SubagentHandback` cuando falle `last_assistant_message` | usa campos documentados de `SubagentStop` y corrige el caso reportado | parser JSONL adicional | media | si |

## 6. Evidencia en contra

- El transcript se escribe de forma asincrona, asi que puede no incluir siempre el ultimo evento al instante; si no hay mensaje parseable el gate debe fallar cerrado y no registrar APPROVE [doc:https://code.claude.com/docs/en/hooks.md@v2.1.271]

## 7. Ejemplares y anti-ejemplos

- Ejemplar: payload `SubagentStop` con `agent_transcript_path` y linea de `SubagentHandback` que incluye `tool_input.message` con `VERDICT: APPROVE ...` [doc:https://code.claude.com/docs/en/hooks.md@v2.1.271]

## 8. Trampas

- Con `stop_hook_active=true`, una salida silenciosa oculta que no hubo veredicto parseable y dificulta diagnostico; la doc permite usar `systemMessage` para rastro visible [doc:https://code.claude.com/docs/en/hooks.md@v2.1.271]

## 9. Incertidumbre

- ASSUMPTION: el transcript del subagente conserva un evento parseable con nombre de tool e input de handback. prueba: test de `SubagentStop` con fixture JSONL realista y fallback activo.

## 10. Checklist de estandar

- [ ] El hook registra solo veredictos parseables y no marca APPROVE cuando falte `VERDICT`, incluso en flujos handback.

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | Hooks reference (`SubagentStop`, campos y handback) | Anthropic | v2.1.271+ | 2026-10-01 | high |
| 2 | Issue #20 fix(review-gate): no registra veredictos con handback | Karen Rebeca Ortiz | 2026-10-01 | 2026-10-01 | high |
