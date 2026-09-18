---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Security

Extends: ../common/security.md
Applies to: **/*.ts, **/*.tsx, **/*.js, **/*.jsx

## Secret Management

NEVER hardcode credentials. Always retrieve from environment:
```typescript
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY is required')
```

## Available Tools

Use **security-reviewer** skill for thorough security assessments.
