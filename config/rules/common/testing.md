# Testing Requirements

## Coverage & Test Types

- Minimum 80% test coverage required
- Unit tests: isolated functions and components
- Integration tests: API endpoints and database operations
- E2E tests: critical user flows

## TDD Methodology

Follow RED → GREEN → IMPROVE:
1. Write test first (RED) — run it, verify it fails
2. Write minimal implementation to pass (GREEN)
3. Refactor while maintaining coverage (IMPROVE)

## Failure Resolution

- Check test isolation first
- Verify mocks function correctly
- Fix the implementation, not the tests (unless the test itself is wrong)

## Available Agents

Use **tdd-guide** agent for new features to enforce test-first development.
