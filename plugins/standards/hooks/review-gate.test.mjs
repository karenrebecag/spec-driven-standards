import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseVerdict, isCodeDiff, evaluateCommit, resolveStatePath } from './review-gate.mjs'

test('parseVerdict reads a well-formed APPROVE line', () => {
  const text = 'blah blah\n## Review Summary\nVERDICT: APPROVE critical=0 high=0\n'
  assert.deepEqual(parseVerdict(text), { verdict: 'APPROVE', critical: 0, high: 0 })
})

test('parseVerdict reads BLOCK with counts', () => {
  assert.deepEqual(parseVerdict('VERDICT: BLOCK critical=2 high=1'), {
    verdict: 'BLOCK',
    critical: 2,
    high: 1,
  })
})

test('parseVerdict takes the last VERDICT line when several exist', () => {
  const text = 'VERDICT: BLOCK critical=1 high=0\nlater\nVERDICT: APPROVE critical=0 high=0'
  assert.equal(parseVerdict(text).verdict, 'APPROVE')
})

test('parseVerdict is case and spacing tolerant', () => {
  assert.deepEqual(parseVerdict('verdict:WARNING  critical=0   high=3'), {
    verdict: 'WARNING',
    critical: 0,
    high: 3,
  })
})

test('parseVerdict returns null when no line is present', () => {
  assert.equal(parseVerdict('a review with no verdict line'), null)
  assert.equal(parseVerdict(''), null)
  assert.equal(parseVerdict(undefined), null)
})

test('isCodeDiff is true when any file has a code extension', () => {
  assert.equal(isCodeDiff(['README.md', 'src/app.ts']), true)
  assert.equal(isCodeDiff(['api/handler.py']), true)
})

test('isCodeDiff is false for docs-only or empty change sets', () => {
  assert.equal(isCodeDiff(['README.md', 'docs/plan.md', 'notes.txt']), false)
  assert.equal(isCodeDiff([]), false)
})

const HASH = 'abc123'
const approved = (extra = {}) => ({
  'code-reviewer': { verdict: 'APPROVE', critical: 0, high: 0, diffHash: HASH },
  'security-reviewer': { verdict: 'APPROVE', critical: 0, high: 0, diffHash: HASH },
  'qa-reviewer': { verdict: 'APPROVE', critical: 0, high: 0, diffHash: HASH },
  ...extra,
})

test('evaluateCommit allows when all three reviewers approved this exact diff', () => {
  assert.equal(evaluateCommit(approved(), HASH).allow, true)
})

test('evaluateCommit blocks when the security reviewer verdict is missing', () => {
  const state = approved()
  delete state['security-reviewer']
  const r = evaluateCommit(state, HASH)
  assert.equal(r.allow, false)
  assert.match(r.reason, /security-reviewer/)
})

test('evaluateCommit blocks when the qa reviewer verdict is missing', () => {
  const state = approved()
  delete state['qa-reviewer']
  const r = evaluateCommit(state, HASH)
  assert.equal(r.allow, false)
  assert.match(r.reason, /qa-reviewer/)
})

test('evaluateCommit blocks when a verdict is for a stale diff', () => {
  const state = approved({ 'code-reviewer': { verdict: 'APPROVE', critical: 0, high: 0, diffHash: 'old' } })
  const r = evaluateCommit(state, HASH)
  assert.equal(r.allow, false)
  assert.match(r.reason, /stale|desactualizad|re-?review|revis/i)
})

test('evaluateCommit blocks when a reviewer did not APPROVE', () => {
  const state = approved({ 'code-reviewer': { verdict: 'BLOCK', critical: 1, high: 0, diffHash: HASH } })
  const r = evaluateCommit(state, HASH)
  assert.equal(r.allow, false)
  assert.match(r.reason, /BLOCK|critical/)
})

test('evaluateCommit blocks when no review state exists at all', () => {
  assert.equal(evaluateCommit(null, HASH).allow, false)
  assert.equal(evaluateCommit({}, HASH).allow, false)
})

// Worktrees: `git rev-parse --git-dir` devuelve una ruta ABSOLUTA. Unirla a cwd con join() la
// convertia en <cwd>/Users/.../worktrees/x: el estado se escribia dentro del arbol de trabajo,
// cambiaba el hash del diff y el veredicto del reviewer quedaba "desactualizado" en silencio.
test('resolveStatePath respeta un git-dir absoluto (worktree)', () => {
  const abs = '/repo/.git/worktrees/feat'
  assert.equal(resolveStatePath('/elsewhere/wt', abs), '/repo/.git/worktrees/feat/claude-review.json')
})

test('resolveStatePath resuelve un git-dir relativo contra cwd', () => {
  assert.equal(resolveStatePath('/repo', '.git'), '/repo/.git/claude-review.json')
})

test('worktree real: el estado cae fuera del arbol y no ensucia el diff', async () => {
  const { execFileSync } = await import('node:child_process')
  const { mkdtempSync, realpathSync, writeFileSync, mkdirSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join, dirname } = await import('node:path')
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'review-gate-wt-')))
  const repo = join(base, 'repo')
  const wt = join(base, 'wt')
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' })
  try {
    mkdirSync(repo)
    g(repo, 'init', '-q', '-b', 'main')
    g(repo, 'config', 'user.email', 't@t')
    g(repo, 'config', 'user.name', 't')
    writeFileSync(join(repo, 'a.ts'), 'x\n')
    g(repo, 'add', '.')
    g(repo, 'commit', '-q', '-m', 'i')
    g(repo, 'worktree', 'add', '-q', wt, '-b', 'feat/w')
    const p = resolveStatePath(wt, g(wt, 'rev-parse', '--git-dir').trim())
    assert.equal(p.startsWith(wt + '/'), false)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, '{}')
    assert.equal(g(wt, 'status', '--porcelain'), '')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// La guarda de readState importa en subagent-stop: `state[agent] = ...` revienta si el estado no es
// objeto (null, array). Se ejercita ese sitio exacto; sin la guarda, el primer caso tira TypeError.
for (const bad of ['null', '[]']) {
  test(`subagent-stop: un estado no-objeto (${bad}) no revienta y persiste el veredicto`, async () => {
    const { execFileSync, spawnSync } = await import('node:child_process')
    const { mkdtempSync, realpathSync, writeFileSync, readFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const HOOK = fileURLToPath(new URL('./review-gate.mjs', import.meta.url))
    const repo = realpathSync(mkdtempSync(join(tmpdir(), 'review-gate-null-')))
    const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
    try {
      g('init', '-q', '-b', 'main')
      g('config', 'user.email', 't@t')
      g('config', 'user.name', 't')
      writeFileSync(join(repo, 'a.ts'), 'export const a = 1\n')
      g('add', '.')
      g('commit', '-q', '-m', 'i')
      writeFileSync(join(repo, '.git', 'claude-review.json'), bad) // estado no-objeto
      const r = spawnSync(process.execPath, [HOOK, 'subagent-stop'], {
        input: JSON.stringify({
          agent_type: 'code-reviewer',
          last_assistant_message: 'revisado\nVERDICT: APPROVE critical=0 high=0',
          cwd: repo,
        }),
        encoding: 'utf8',
      })
      assert.equal(r.status, 0, r.stderr)
      const state = JSON.parse(readFileSync(join(repo, '.git', 'claude-review.json'), 'utf8'))
      assert.equal(state['code-reviewer'].verdict, 'APPROVE')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
}
