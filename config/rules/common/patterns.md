# Common Patterns

## New Feature Approach

Before writing new code:
1. Search for existing implementations (`gh search repos`, `gh search code`)
2. Consult primary documentation
3. Search package registries for adaptable open-source solutions (80%+ fit)
4. Only build from scratch if nothing fits

## Repository Pattern

Separate data access from business logic via standard interface:
- findAll(), findById(), create(), update(), delete()
- Implementations swap transparently (DB, API, file system)
- Enables easy mock testing

## API Response Format

Consistent structure across all endpoints:
```
{ status, data: T | null, error: string | null, meta?: { total, page, limit } }
```
