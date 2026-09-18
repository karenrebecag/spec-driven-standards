---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Hooks

Extends: ../common/hooks.md
Applies to: **/*.ts, **/*.tsx, **/*.js, **/*.jsx

## PostToolUse Hooks (auto-configured)

- Auto-format JS/TS files after edit via Prettier
- Run `tsc` after editing `.ts`/`.tsx` files
- Alert on `console.log` statements in modified files

## Stop Hooks

- Check all modified files for `console.log` before session ends

## Configuration

Los hooks de formato/`tsc`/`console.log` los provee el plugin everything-claude-code, no
`settings.json`. En `~/.claude/settings.json` vive solo el gate de revisión
(`review-gate.mjs`: SubagentStop + PreToolUse de commit). Ver `common/hooks.md`.
