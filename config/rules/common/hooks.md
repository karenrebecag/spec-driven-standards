# Hooks

## Hook Types

- **PreToolUse**: validation before tool execution
- **PostToolUse**: formatting/checks after file edits
- **Stop**: final verification when session ends

## Permissions

- Enable auto-accept only for trusted, well-defined plans
- Keep disabled during exploratory work
- Use `allowedTools` in settings.json instead of permission-skipping flags

## Task Management

Use TodoWrite to:
- Track progress on multi-step tasks
- Enable real-time steering
- Surface structural issues (ordering, missing steps, wrong detail level)
