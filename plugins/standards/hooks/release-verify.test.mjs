import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyFinding, validateRegresionPath, branchBase } from './release-verify.mjs'

const MODULE = join(dirname(fileURLToPath(import.meta.url)), 'release-verify.mjs')

// Construye un repo con la base (codigo vulnerable, sin test) en main y el fix + test en una rama,
// para que merge-base(HEAD, main) sea el commit pre-fix. `testBody` define el escenario.
function makeFixRepo({ testBody, extraFixFiles = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relverify-e2e-'))
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t.t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'tests'), { recursive: true })
  // Base: una funcion vulnerable (no escapa la entrada).
  writeFileSync(join(dir, 'src/sanitize.mjs'), 'export const sanitize = (s) => s\n')
  g('add', '-A')
  g('commit', '-qm', 'base: vulnerable')
  // Fix en una rama: escapa la entrada + el test de regresion.
  g('checkout', '-q', '-b', 'work')
  writeFileSync(join(dir, 'src/sanitize.mjs'), "export const sanitize = (s) => s.replace(/</g, '&lt;')\n")
  writeFileSync(join(dir, 'tests/sanitize.test.mjs'), testBody)
  for (const [p, body] of Object.entries(extraFixFiles)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
  g('add', '-A')
  g('commit', '-qm', 'fix + regresion')
  return { dir, g }
}

// El test ejercita el vector real: falla con el codigo base (no escapa) y pasa con el fix.
const VECTOR_TEST = `import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitize } from '../src/sanitize.mjs'
test('no deja pasar <', () => { assert.ok(!sanitize('<x').includes('<')) })
`

function worktreeList(dir, g) {
  return g('worktree', 'list').trim().split('\n')
}

test('verifyFinding: closed when the test is red at base and green at HEAD', () => {
  const { dir, g } = makeFixRepo({ testBody: VECTOR_TEST })
  const before = g('status', '--porcelain')
  const r = verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(r.status, 'closed', r.reason)
  // El arbol principal, el index y la lista de worktrees quedan como estaban.
  assert.equal(g('status', '--porcelain'), before)
  assert.equal(worktreeList(dir, g).length, 1)
})

test('verifyFinding: unverified when the test imports a fixture only the fix adds (load fails at base)', () => {
  // El test importa un fixture que solo existe en el commit del fix: en la base import() rechaza.
  const testBody = `import './fixture-solo-en-fix.mjs'
${VECTOR_TEST}`
  const { dir, g } = makeFixRepo({
    testBody,
    extraFixFiles: { 'tests/fixture-solo-en-fix.mjs': 'export const x = 1\n' },
  })
  const r = verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(r.status, 'unverified')
  assert.match(r.reason, /carga|load|fixture|modulo/i)
  assert.equal(worktreeList(dir, g).length, 1)
})

test('verifyFinding: unverified when the test passes at base (does not exercise the vector)', () => {
  const testBody = `import { test } from 'node:test'
test('tautologia', () => {})
`
  const { dir } = makeFixRepo({ testBody })
  const r = verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(r.status, 'unverified')
  assert.match(r.reason, /base|reprodu|paso|pass/i)
})

test('verifyFinding: unverified when the test does not pass at HEAD', () => {
  const testBody = `import { test } from 'node:test'
import assert from 'node:assert/strict'
test('roto en HEAD', () => { assert.equal(1, 2) })
`
  const { dir } = makeFixRepo({ testBody })
  const r = verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(r.status, 'unverified')
  assert.match(r.reason, /HEAD/i)
})

test('verifyFinding: never leaves a worktree or touches the tree even on the unverified paths', () => {
  const { dir, g } = makeFixRepo({ testBody: VECTOR_TEST })
  const before = g('status', '--porcelain')
  verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(g('status', '--porcelain'), before)
  assert.equal(worktreeList(dir, g).length, 1)
})

// validateRegresionPath: el path del reporte es dato hostil.
test('validateRegresionPath rejects option injection, absolute paths, traversal and NUL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relverify-path-'))
  mkdirSync(join(dir, 'tests'))
  writeFileSync(join(dir, 'tests/ok.test.mjs'), '')
  assert.equal(validateRegresionPath(dir, '--import=data:text/javascript,x'), null)
  assert.equal(validateRegresionPath(dir, '/etc/passwd'), null)
  assert.equal(validateRegresionPath(dir, '../../../etc/passwd'), null)
  assert.equal(validateRegresionPath(dir, 'tests/../../../etc/passwd'), null)
  assert.equal(validateRegresionPath(dir, 'no-existe.mjs'), null)
  assert.equal(validateRegresionPath(dir, 'tests/ok.test.mjs'), join(dir, 'tests/ok.test.mjs'))
})

test('branchBase returns the merge-base with the default branch', () => {
  const { dir, g } = makeFixRepo({ testBody: VECTOR_TEST })
  const base = branchBase(dir)
  const expected = g('merge-base', 'HEAD', 'main').trim()
  assert.equal(base, expected)
})

// La CLI es la interfaz real que invoca el agente release-verifier: imprime una linea JSON y sale 0.
test('CLI prints a closed JSON line for a genuine fix', () => {
  const { dir } = makeFixRepo({ testBody: VECTOR_TEST })
  const r = spawnSync(process.execPath, [MODULE, 'tests/sanitize.test.mjs'], { cwd: dir, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), { status: 'closed', reason: '' })
})

test('CLI returns unverified without crashing when given no path', () => {
  const { dir } = makeFixRepo({ testBody: VECTOR_TEST })
  const r = spawnSync(process.execPath, [MODULE], { cwd: dir, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(JSON.parse(r.stdout).status, 'unverified')
})

// Un test que es symlink hacia fuera de la raiz no debe ejecutarse: realpath lo saca del arbol.
test('verifyFinding is unverified when the test is a symlink out of the repo', () => {
  const { dir } = makeFixRepo({ testBody: VECTOR_TEST })
  const outside = mkdtempSync(join(tmpdir(), 'relverify-out-'))
  writeFileSync(join(outside, 'evil.mjs'), 'export const x = 1\n')
  symlinkSync(join(outside, 'evil.mjs'), join(dir, 'tests/link.test.mjs'))
  assert.equal(validateRegresionPath(dir, 'tests/link.test.mjs'), null)
  assert.equal(verifyFinding(dir, 'tests/link.test.mjs').status, 'unverified')
})

// Un exit distinto de 0/1/3 (p.ej. process.exit(2)) es ambiguo: cae a unverified, no a closed.
test('verifyFinding treats an ambiguous probe exit at base as unverified', () => {
  const testBody = `import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitize } from '../src/sanitize.mjs'
if (sanitize('<x').includes('<')) process.exit(2)  // en la base (vulnerable) sale 2, no 1
test('no deja pasar <', () => { assert.ok(!sanitize('<x').includes('<')) })
`
  const { dir } = makeFixRepo({ testBody })
  const r = verifyFinding(dir, 'tests/sanitize.test.mjs')
  assert.equal(r.status, 'unverified')
  assert.match(r.reason, /ambiguo|exit/i)
})
