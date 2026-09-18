---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Coding Style

Extends: ../common/coding-style.md
Applies to: **/*.ts, **/*.tsx, **/*.js, **/*.jsx

## Types & Interfaces

- Add parameter and return types to exported functions, shared utilities, public class methods
- Allow TypeScript to infer obvious local variable types
- Use `interface` for extensible object shapes
- Use `type` for unions, intersections, utility types
- NEVER use `any` in application code — use `unknown` for external inputs, narrow before use

## React Components

- Define props using named interfaces or types
- Explicitly type callbacks
- Avoid `React.FC` without specific justification

## Immutability

Spread operator for updates, never direct mutation:
- CORRECT: `{ ...user, name }` 
- WRONG: `user.name = name`

## Error Handling

- Use async/await with try-catch
- Narrow `unknown` errors with `instanceof` before accessing properties

## Validation

- Use Zod for schema-based validation
- Derive types with `z.infer<typeof schema>`

## Logging

- Production code: use proper logging libraries, not `console.log`
- Hooks auto-detect and warn about console statements
