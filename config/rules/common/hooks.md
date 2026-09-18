# Hooks

## Dónde viven los hooks (esta máquina)

Dos fuentes, no una:
- **Plugin everything-claude-code**: formateo, `tsc`, aviso de `console.log`, salud de MCP,
  protección de configs. Vienen del plugin, no de `settings.json`. Congelado (`autoUpdate:false`)
  para que no cambien solos.
- **`settings.json` propio**: el gate de revisión (`review-gate.mjs`) — SubagentStop que exige el
  VERDICT de los reviewers, y PreToolUse que deniega un commit de código sin APPROVE vigente.

## Hook Types

- **PreToolUse**: validation before tool execution; puede denegar (el gate lo usa para commits)
- **PostToolUse**: formatting/checks after file edits
- **SubagentStop**: lee el veredicto del reviewer y lo registra contra el diff
- **Stop**: final verification when the turn ends

## Permissions

- Enable auto-accept only for trusted, well-defined plans
- Keep disabled during exploratory work
- Use `allowedTools` in settings.json instead of permission-skipping flags

## Task Management

Use TodoWrite to:
- Track progress on multi-step tasks
- Enable real-time steering
- Surface structural issues (ordering, missing steps, wrong detail level)
