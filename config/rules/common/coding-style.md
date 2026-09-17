# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:
- WRONG: modify(original, field, value) → changes original in-place
- CORRECT: update(original, field, value) → returns new copy with change

Rationale: Immutable data prevents hidden side effects, makes debugging easier, enables safe concurrency.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Reuse Before Writing

Before writing new code, stop at the first level that holds:

1. Does this need to exist? Speculative need → skip it, say so in one line (YAGNI)
2. Already in this codebase? Grep for the helper, util, type or pattern before writing it — re-implementing what lives a few files over is the most common source of duplication
3. Standard library covers it? Use it
4. Native platform feature covers it? Use it — `<input type="date">` over a picker lib, CSS over JS, a DB constraint over app code
5. Already-installed dependency solves it? Use it — never add a new one for what a few lines cover
6. Only then: write the minimum that works

This runs AFTER understanding the problem, not instead of it. Read the code the change touches and trace the real flow first: the smallest change in the wrong place is a second bug, not a lazy win.

Two approaches of the same size → take the one that is correct on edge cases. Less code never means the flimsier algorithm.

NEVER simplified away: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, tests, anything explicitly requested.

## Deliberate Simplification Marker

A simplification that cuts a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) gets a `HACK:` comment naming the ceiling AND the upgrade trigger:

```ts
// HACK: single global lock. Per-account locks when write throughput matters.
```

Use `HACK:` rather than a custom tag — linters and editors already recognize it. A marker with no upgrade trigger is the one that silently rots, so the trigger is not optional.

Harvest the ledger with:

```bash
grep -rnE '(#|//) ?HACK:' --exclude-dir={node_modules,.git,dist,build} .
```

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly messages in UI-facing code
- Log detailed context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
