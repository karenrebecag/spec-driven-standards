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

// ---- repo del trabajo, no de la sesion (brief gate-work-repo) ----
// Escenario real: la sesion esta en A (limpio) y el reviewer trabaja en B (con codigo). Antes el
// veredicto caia en A con el hash del diff vacio, y `git -C B commit` pasaba sin gate.

import { execFileSync as xf, spawnSync as sp } from 'node:child_process'
import { mkdtempSync as mkt, realpathSync as rp, writeFileSync as wf, readFileSync as rf, rmSync as rmf } from 'node:fs'
import { tmpdir as tmpd } from 'node:os'
import { join as pj } from 'node:path'
import { fileURLToPath as f2p } from 'node:url'

const RG = f2p(new URL('./review-gate.mjs', import.meta.url))
const WR = f2p(new URL('./work-repo.mjs', import.meta.url))
const APPROVE_MSG = 'revisado\nVERDICT: APPROVE critical=0 high=0'

function twoRepos() {
  const base = rp(mkt(pj(tmpd(), 'review-gate-cross-')))
  const mk = (name, dirty) => {
    const r = pj(base, name)
    xf('mkdir', ['-p', r])
    const g = (...a) => xf('git', a, { cwd: r, encoding: 'utf8' })
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    wf(pj(r, 'a.ts'), 'export const a = 1\n')
    g('add', '.')
    g('commit', '-q', '-m', 'i')
    if (dirty) wf(pj(r, 'a.ts'), 'export const a = 2\n')
    return r
  }
  const tmp = pj(base, 'tmp')
  xf('mkdir', ['-p', tmp])
  return { base, a: mk('a', false), b: mk('b', true), tmp }
}

const env = (tmp) => ({ ...process.env, TMPDIR: tmp })
const ids = { session_id: 's1', agent_id: 'ag1' }

function logTool(tmp, cwd, tool_name, tool_input, extraEnv = {}) {
  const r = sp(process.execPath, [WR, 'log'], {
    input: JSON.stringify({ ...ids, cwd, tool_name, tool_input }),
    encoding: 'utf8',
    env: { ...env(tmp), ...extraEnv },
  })
  assert.equal(r.status, 0, r.stderr)
}

function reviewerStop(tmp, cwd, agent_type = 'code-reviewer', withIds = true) {
  const r = sp(process.execPath, [RG, 'subagent-stop'], {
    input: JSON.stringify({ ...(withIds ? ids : {}), agent_type, last_assistant_message: APPROVE_MSG, cwd }),
    encoding: 'utf8',
    env: env(tmp),
  })
  assert.equal(r.status, 0, r.stderr)
}

function preCommit(tmp, cwd, command) {
  const r = sp(process.execPath, [RG, 'pre-commit'], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }),
    encoding: 'utf8',
    env: env(tmp),
  })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null
}

const stateOf = (repo) => {
  try {
    return JSON.parse(rf(pj(repo, '.git', 'claude-review.json'), 'utf8'))
  } catch {
    return null
  }
}

test('subagent-stop: un reviewer que trabajo solo en B registra en B aunque la sesion este en A', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    logTool(tmp, a, 'Bash', { command: `git -C ${b} diff` })
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
    reviewerStop(tmp, a)
    assert.equal(stateOf(a), null)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: leer reglas bajo ~/.claude no convierte el trabajo en multi-repo', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    logTool(tmp, a, 'Read', { file_path: pj(process.env.HOME, '.claude', 'rules', 'x.md') })
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
    reviewerStop(tmp, a)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: evidencia de dos repos vuelve al cwd (K3)', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    logTool(tmp, a, 'Read', { file_path: pj(a, 'a.ts') })
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
    reviewerStop(tmp, a)
    assert.equal(stateOf(a)['code-reviewer'].verdict, 'APPROVE')
    assert.equal(stateOf(b), null)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: sin log (hilo principal o sin agent_id) registra en el cwd, como antes', () => {
  const { base, b, tmp } = twoRepos()
  try {
    reviewerStop(tmp, b, 'code-reviewer', false)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: el log del agente se borra al terminar', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
    reviewerStop(tmp, a)
    assert.throws(() => rf(pj(tmp, 'claude-gates', 's1', 'ag1.jsonl')))
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: git -C B commit sin APPROVE se niega aunque el cwd A este limpio', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    const out = preCommit(tmp, a, `git -C ${b} commit -am x`)
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /Falta revision de: code-reviewer/)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: cd B && git commit sin APPROVE se niega', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    const out = preCommit(tmp, a, `cd ${b} && git commit -am x`)
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /Falta revision de: code-reviewer/)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: con los tres APPROVE registrados en B, git -C B commit pasa', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    for (const rev of ['code-reviewer', 'security-reviewer', 'qa-reviewer']) {
      logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
      reviewerStop(tmp, a, rev)
    }
    assert.equal(preCommit(tmp, a, `git -C ${b} commit -am x`), null)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: un repo que no se puede resolver se niega con el motivo', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    const out = preCommit(tmp, a, `git --git-dir=${b}/.git commit -am x`)
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /no se puede determinar|resolver/i)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: texto que menciona git commit sin serlo no dispara el gate', () => {
  const { base, b, tmp } = twoRepos()
  try {
    assert.equal(preCommit(tmp, b, 'echo "git commit"'), null)
    assert.equal(preCommit(tmp, b, 'git log --grep commit'), null)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: evidencia de B mas una ruta fuera de git registra en B', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    wf(pj(base, 'notas.txt'), 'x\n')
    logTool(tmp, a, 'Read', { file_path: pj(base, 'notas.txt') })
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
    reviewerStop(tmp, a)
    assert.equal(stateOf(a), null)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: evidencia solo fuera de git vuelve al cwd', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    wf(pj(base, 'notas.txt'), 'x\n')
    logTool(tmp, a, 'Read', { file_path: pj(base, 'notas.txt') })
    reviewerStop(tmp, a)
    assert.equal(stateOf(a)['code-reviewer'].verdict, 'APPROVE')
    assert.equal(stateOf(b), null)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: ~/.claude que es symlink a un repo no cuenta como evidencia de ese repo', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    const home = pj(base, 'home')
    xf('mkdir', ['-p', home])
    xf('ln', ['-s', a, pj(home, '.claude')])
    logTool(tmp, a, 'Read', { file_path: pj(home, '.claude', 'a.ts') }, { HOME: home })
    logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') }, { HOME: home })
    reviewerStop(tmp, a)
    assert.equal(stateOf(a), null)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('subagent-stop: un log ilegible vuelve al cwd sin romper el hook', () => {
  const { base, a, b, tmp } = twoRepos()
  const log = pj(tmp, 'claude-gates', 's1', 'ag1.jsonl')
  try {
    logTool(tmp, b, 'Read', { file_path: pj(a, 'a.ts') })
    xf('chmod', ['000', log])
    reviewerStop(tmp, b)
    assert.equal(stateOf(a), null)
    assert.equal(stateOf(b)['code-reviewer'].verdict, 'APPROVE')
  } finally {
    try {
      xf('chmod', ['600', log])
    } catch {
      // el hook ya pudo borrarlo
    }
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: commits a dos repos en un mismo comando se niegan con el motivo', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    const out = preCommit(tmp, a, `git -C ${a} commit -m x && git -C ${b} commit -m y`)
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /repos distintos/)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})

test('pre-commit: con APPROVE registrado en la raiz de B, un commit desde un subdirectorio de B pasa', () => {
  const { base, a, b, tmp } = twoRepos()
  try {
    xf('mkdir', ['-p', pj(b, 'sub')])
    wf(pj(b, 'sub', 'nuevo.ts'), 'export const n = 1\n')
    for (const rev of ['code-reviewer', 'security-reviewer', 'qa-reviewer']) {
      logTool(tmp, a, 'Read', { file_path: pj(b, 'a.ts') })
      reviewerStop(tmp, a, rev)
    }
    assert.equal(preCommit(tmp, a, `cd ${pj(b, 'sub')} && git commit -am x`), null)
  } finally {
    rmf(base, { recursive: true, force: true })
  }
})
