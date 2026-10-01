# Handoff: review-gate handback (issue #20)

Fecha: 2026-10-01
Rama: `fix/review-gate-handback`

## 1) Archivos tocados

- `plugins/standards/hooks/review-gate.mjs`
- `plugins/standards/hooks/review-gate.test.mjs`
- `docs/research/review-gate-subagent-handback.md`
- `docs/research/INDEX.md`

## 2) Fuente elegida para handback y cita documental

Fuente de verdad elegida cuando `last_assistant_message` no trae `VERDICT`:

- `agent_transcript_path` del evento `SubagentStop`, buscando en lineas `type=assistant` el bloque `message.content[]` con `type=tool_use`, `name=SubagentHandback` y campo `input.message`, para parsear de ahi el `VERDICT`.

Cita de la documentacion oficial (`https://code.claude.com/docs/en/hooks.md`, extraida con `curl ... | rg ...`):

- "SubagentStop hooks receive `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, and `last_assistant_message`..."
- "On Claude Code v2.1.271 or later... `SubagentHandback`... The `last_assistant_message` field then holds the subagent's closing text... The report is that call's `message` input..."

Decision aplicada:

- Primero se intenta `last_assistant_message`.
- Si no hay `VERDICT`, se hace fallback a `agent_transcript_path` y se extrae el ultimo `SubagentHandback` parseable.

## 3) RED (antes del fix)

Comando:

- `node --test plugins/standards/hooks/review-gate.test.mjs`

Salida relevante (fallo esperado):

- `not ok 23 - subagent-stop: si last_assistant_message no trae VERDICT, lo recupera del handback en agent_transcript_path`
- `Expected values to be strictly equal`
- `actual: '{"decision":"block","reason":"El review de code-reviewer debe terminar..."}'`
- `expected: ''`

Resultado:

- 35 tests totales, 34 pass, 1 fail.

## 4) GREEN (despues del fix)

Comando:

- `node --test plugins/standards/hooks/review-gate.test.mjs`

Salida relevante:

- `ok 23 - subagent-stop: si last_assistant_message no trae VERDICT, lo recupera del handback en agent_transcript_path`
- `# pass 35`
- `# fail 0`

## 5) Verificacion adicional pedida

Tests de la carpeta que importan `review-gate` o `work-repo`:

- `node --test plugins/standards/hooks/work-repo.test.mjs plugins/standards/hooks/review-gate.test.mjs`
- Resultado: `# pass 63`, `# fail 0`.

## 6) Cambio funcional implementado

En `review-gate.mjs`:

- Se agrego fallback de veredicto para `SubagentStop`:
  - parseo directo de `last_assistant_message`;
  - fallback a lectura de `agent_transcript_path` para extraer `SubagentHandback.input.message` desde lineas `type=assistant`.
- Se removio el retorno silencioso temprano para `stop_hook_active=true`.
- Si `stop_hook_active=true` y aun no hay veredicto parseable, se emite `systemMessage` visible (sin registrar APPROVE).
- Politica fail-closed mantenida: sin veredicto parseable no se escribe APPROVE en estado.

## 7) Riesgos residuales

- Riesgo potencial: si un transcript supera varios MB, hoy se lee completo en memoria; queda marcado con un HACK para migrar a lectura desde el final.
- Riesgo bajo: el parser ahora es estricto al shape real (`type=assistant` + `message.content[]` + `tool_use` exacto), lo que reduce superficie de match accidental.

No se detectaron regresiones funcionales en los tests ejecutados.

## Ronda 2

Comando ejecutado en ambos momentos:

- `node --test plugins/standards/hooks/*.test.mjs`

RED (antes del fix, fallan solo los casos nuevos):

```text
# Subtest: subagent-stop: lineas no JSON o parciales se ignoran y se registran
not ok 245 - subagent-stop: lineas no JSON o parciales se ignoran y se registran
...
# Subtest: subagent-stop: ignora handback adversarial dentro del input de otra tool y dentro de tool_result
not ok 254 - subagent-stop: ignora handback adversarial dentro del input de otra tool y dentro de tool_result
...
# pass 281
# fail 2
```

GREEN final (despues del fix):

```text
# Subtest: subagent-stop: lineas no JSON o parciales se ignoran y se registran
ok 245 - subagent-stop: lineas no JSON o parciales se ignoran y se registran
...
# Subtest: subagent-stop: ignora handback adversarial dentro del input de otra tool y dentro de tool_result
ok 254 - subagent-stop: ignora handback adversarial dentro del input de otra tool y dentro de tool_result
...
# tests 283
# pass 283
# fail 0
```

## Ronda 3

Comandos de RED (antes de implementar los cambios de esta ronda):

- `node --test plugins/standards/hooks/review-gate.test.mjs plugins/standards/hooks/research-gate.test.mjs`

RED observado (fallan solo los casos nuevos):

```text
# Subtest: subagent-stop: si solo hay RESEARCH en handback, lo recupera desde agent_transcript_path
not ok
...
# Subtest: subagent-stop: salida final sin veredicto limpia el log del agente
not ok
...
# Subtest: subagent-stop: salida final stop_hook_active sin VERDICT limpia el log del agente
not ok
...
# tests 115
# pass 112
# fail 3
```

GREEN final (despues del fix completo y modulo compartido):

- `node --test plugins/standards/hooks/*.test.mjs`

```text
# tests 291
# pass 291
# fail 0
```
