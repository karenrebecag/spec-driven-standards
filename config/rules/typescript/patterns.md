# TypeScript/JavaScript Patterns

Extends: ../common/patterns.md
Applies to: **/*.ts, **/*.tsx, **/*.js, **/*.jsx

## API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

## Custom Hooks

- Use debounce hooks for delayed state updates
- Manage side effects in useEffect with proper cleanup
- Extract complex state logic into custom hooks

## Repository Pattern

```typescript
interface Repository<T, ID> {
  findAll(): Promise<T[]>
  findById(id: ID): Promise<T | null>
  create(entity: Omit<T, 'id'>): Promise<T>
  update(id: ID, entity: Partial<T>): Promise<T>
  delete(id: ID): Promise<void>
}
```
