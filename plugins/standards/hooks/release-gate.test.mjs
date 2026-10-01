import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isDeployCommand, evaluateRelease, reportChecker, parseReleaseVerdict, resolveStatePath, dirtyPaths } from './release-gate.mjs'

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'release-gate.mjs')

// Reporte por defecto: dos hallazgos, cada uno con su linea Regresion apuntando a un test real del
// repo. Coincide con el conteo por defecto de releaseLine (findings=2), que es lo que el hook cruza.
const DEFAULT_REPORT = `# pentest
- id CN-001 CRITICAL
  Regresion: tests/a.test.mjs::vuln a
- id CN-002 HIGH
  Regresion: tests/b.test.mjs::vuln b
`

// Crea un repo git real con un reporte de pentest y los tests que nombra, para probar los caminos
// que dependen de HEAD y del git-dir (persistencia del veredicto, atadura por SHA y por hash).
function makeRepo({ reportBody = DEFAULT_REPORT, reportPath = 'reports/pentest.md' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'release-repo-'))
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  g('init', '-q')
  g('config', 'user.email', 't@t.t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'reports'), { recursive: true })
  mkdirSync(join(dir, 'tests'), { recursive: true })
  writeFileSync(join(dir, reportPath), reportBody)
  writeFileSync(join(dir, 'reports/qa.md'), '# qa\nok')
  writeFileSync(join(dir, 'tests/a.test.mjs'), '// a\n')
  writeFileSync(join(dir, 'tests/b.test.mjs'), '// b\n')
  g('add', '-A')
  g('commit', '-qm', 'seed')
  const sha = g('rev-parse', 'HEAD').trim().slice(0, 8)
  const reportHash = createHash('sha256').update(reportBody).digest('hex')
  return { dir, sha, reportHash, g }
}

// Repo con una rama de feature: la base (main) NO trae los tests de regresion; la rama los anade.
// Asi branchBase(HEAD) es el commit base y el diff de la rama contiene los tests (atadura por diff).
function makeBranchRepo({ reportBody = DEFAULT_REPORT, baseFiles = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'release-branch-'))
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t.t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src/x.mjs'), '// base\n')
  for (const [p, body] of Object.entries(baseFiles)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
  g('add', '-A')
  g('commit', '-qm', 'base')
  g('checkout', '-q', '-b', 'work')
  mkdirSync(join(dir, 'tests'), { recursive: true })
  mkdirSync(join(dir, 'reports'), { recursive: true })
  writeFileSync(join(dir, 'tests/a.test.mjs'), '// a\n')
  writeFileSync(join(dir, 'tests/b.test.mjs'), '// b\n')
  writeFileSync(join(dir, 'reports/pentest.md'), reportBody)
  writeFileSync(join(dir, 'reports/qa.md'), '# qa\nok')
  g('add', '-A')
  g('commit', '-qm', 'fix + tests de regresion')
  const sha = g('rev-parse', 'HEAD').trim().slice(0, 8)
  return { dir, g, sha }
}

// Invoca el hook en modo subagent-stop (SubagentStop) con un payload por stdin.
function runSubagentStop(dir, { agent_type = 'release-verifier', last_assistant_message = '', stop_hook_active = false } = {}) {
  return spawnSync(process.execPath, [HOOK, 'subagent-stop'], {
    input: JSON.stringify({ agent_type, last_assistant_message, stop_hook_active, cwd: dir }),
    encoding: 'utf8',
  })
}

function readReviewState(dir) {
  const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: dir, encoding: 'utf8' }).trim()
  const p = join(dir, gitDir, 'claude-review.json')
  return JSON.parse(readFileSync(p, 'utf8'))
}

const releaseLine = ({ verdict = 'CLOSED', sha, findings = 2, closed = 2, unverified = 0 }) =>
  `RELEASE: ${verdict} sha=${sha} findings=${findings} closed=${closed} unverified=${unverified}`

// Corre el hook como subproceso (como lo invoca Claude Code) con un payload PreToolUse por stdin.
function runHook(dossier, command = 'vercel --prod --yes') {
  const dir = mkdtempSync(join(tmpdir(), 'release-e2e-'))
  if (dossier) writeFileSync(join(dir, '.release-approval.json'), JSON.stringify(dossier))
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command }, cwd: dir }),
    encoding: 'utf8',
  })
  return { ...r, dir }
}

// Dossier valido salvo por lo que cada test cambie. sha vacio casa con el fallback de un cwd que
// no es repo git (git rev-parse falla -> sha='').
const e2eDossier = (extra = {}) => ({
  sha: '',
  ci_green: true,
  approvals: { qa: true, security: true, release: true },
  rollback_plan: 'revertir alias',
  migrations_state: 'none',
  owner: 'karen',
  ...extra,
})

test('isDeployCommand matches production deploy and destructive db pushes', () => {
  assert.equal(isDeployCommand('vercel --prod --yes'), true)
  assert.equal(isDeployCommand('vercel deploy --prod'), true)
  assert.equal(isDeployCommand('supabase db push'), true)
  assert.equal(isDeployCommand('npx supabase db reset'), true)
})

test('isDeployCommand ignores non-deploy commands', () => {
  assert.equal(isDeployCommand('vercel ls'), false)
  assert.equal(isDeployCommand('vercel --help'), false)
  assert.equal(isDeployCommand('git status'), false)
  assert.equal(isDeployCommand('supabase start'), false)
  assert.equal(isDeployCommand(''), false)
})

const SHA = 'deadbeef'
const NOW = Date.parse('2026-09-18T00:00:00Z')
const dossier = (extra = {}) => ({
  sha: SHA,
  ci_green: true,
  approvals: { qa: true, security: true, release: true },
  rollback_plan: 'revert deploy, restore prior alias',
  migrations_state: 'none',
  owner: 'karen',
  ...extra,
})

test('evaluateRelease allows a complete dossier for the current SHA', () => {
  assert.equal(evaluateRelease(dossier(), SHA, NOW).allow, true)
})

test('evaluateRelease blocks a dirty working tree (deploy would ship uncommitted code)', () => {
  const r = evaluateRelease(dossier(), SHA, NOW, { treeDirty: true })
  assert.equal(r.allow, false)
  assert.match(r.reason, /arbol|sin commitear|no revisad/i)
})

test('evaluateRelease allows a clean tree (treeDirty false is the default)', () => {
  assert.equal(evaluateRelease(dossier(), SHA, NOW, { treeDirty: false }).allow, true)
})

test('evaluateRelease blocks when no dossier exists', () => {
  const r = evaluateRelease(null, SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /dossier|release|\.release-approval/i)
})

test('evaluateRelease blocks when the dossier is for a different SHA', () => {
  const r = evaluateRelease(dossier({ sha: 'other' }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /SHA|stale|desactualiz/i)
})

test('evaluateRelease blocks when CI is not green', () => {
  const r = evaluateRelease(dossier({ ci_green: false }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /CI/i)
})

test('evaluateRelease blocks when an approval is missing', () => {
  const r = evaluateRelease(dossier({ approvals: { qa: true, security: false, release: true } }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /security/i)
})

test('evaluateRelease blocks when the rollback plan is empty', () => {
  const r = evaluateRelease(dossier({ rollback_plan: '' }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /rollback/i)
})

test('evaluateRelease blocks when migrations_state is absent', () => {
  const d = dossier()
  delete d.migrations_state
  const r = evaluateRelease(d, SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /migra/i)
})

test('evaluateRelease blocks when there is no on-call owner', () => {
  const r = evaluateRelease(dossier({ owner: '' }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /owner|on-?call/i)
})

test('evaluateRelease blocks an expired dossier', () => {
  const r = evaluateRelease(dossier({ expires: '2026-01-01T00:00:00Z' }), SHA, NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /expir|venci|caduc/i)
})

// Superficie expuesta: cuando /spec marco el cambio como expuesto, el booleano no basta,
// el dossier debe apuntar a reportes de pentest y QA que existan para este SHA.
const exposed = (extra = {}) =>
  dossier({ superficie_expuesta: true, security_report: 'reports/pentest-deadbeef.md', qa_report: 'reports/qa-deadbeef.md', ...extra })
const always = () => true
const never = () => false

// Veredicto del release-verifier atado a este SHA y al hash del reporte vigente.
const REPORT_HASH = 'abc123'
const goodVerifier = (extra = {}) => ({ verdict: 'CLOSED', findings: 2, closed: 2, unverified: 0, sha: SHA, reportHash: REPORT_HASH, tests: ['t.mjs'], ...extra })
// Opciones que hacen pasar un dossier expuesto: reportes presentes + verificador CLOSED vigente.
const exposedOk = { reportExists: always, verifierState: goodVerifier(), currentReportHash: REPORT_HASH }

test('evaluateRelease allows an exposed dossier when both reports exist and the verifier closed every finding', () => {
  assert.equal(evaluateRelease(exposed(), SHA, NOW, exposedOk).allow, true)
})

test('evaluateRelease blocks an exposed dossier when the release-verifier verdict is missing', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { reportExists: always, currentReportHash: REPORT_HASH })
  assert.equal(r.allow, false)
  assert.match(r.reason, /release-verifier/i)
})

test('evaluateRelease blocks an exposed dossier when the verifier reported OPEN', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, verifierState: goodVerifier({ verdict: 'OPEN', closed: 1, unverified: 1 }) })
  assert.equal(r.allow, false)
  assert.match(r.reason, /OPEN|cerr|unverified/i)
})

test('evaluateRelease blocks an exposed dossier when findings remain unverified', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, verifierState: goodVerifier({ unverified: 1 }) })
  assert.equal(r.allow, false)
  assert.match(r.reason, /unverified/i)
})

test('evaluateRelease blocks an exposed dossier when closed does not match findings', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, verifierState: goodVerifier({ closed: 1 }) })
  assert.equal(r.allow, false)
  assert.match(r.reason, /cerr|closed|hallazgo/i)
})

test('evaluateRelease blocks an exposed dossier when the verifier verdict is for another SHA', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, verifierState: goodVerifier({ sha: 'other123' }) })
  assert.equal(r.allow, false)
  assert.match(r.reason, /SHA|commit/i)
})

test('evaluateRelease blocks an exposed dossier when the report changed since it was verified', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, currentReportHash: 'different' })
  assert.equal(r.allow, false)
  assert.match(r.reason, /hash|cambi/i)
})

test('evaluateRelease fails closed when the current report hash cannot be computed', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { reportExists: always, verifierState: goodVerifier(), currentReportHash: undefined })
  assert.equal(r.allow, false)
  assert.match(r.reason, /hash|cambi/i)
})

test('evaluateRelease blocks an exposed dossier when security_report is missing', () => {
  const r = evaluateRelease(exposed({ security_report: '' }), SHA, NOW, { reportExists: always })
  assert.equal(r.allow, false)
  assert.match(r.reason, /security_report/i)
})

test('evaluateRelease blocks an exposed dossier when qa_report points at a non-existent file', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { reportExists: (p) => p !== 'reports/qa-deadbeef.md' })
  assert.equal(r.allow, false)
  assert.match(r.reason, /qa_report/i)
})

test('evaluateRelease blocks an exposed dossier listing both missing reports', () => {
  const r = evaluateRelease(exposed(), SHA, NOW, { reportExists: never })
  assert.equal(r.allow, false)
  assert.match(r.reason, /security_report/i)
  assert.match(r.reason, /qa_report/i)
})

test('evaluateRelease never consults reportExists when the surface is not exposed', () => {
  const boom = () => { throw new Error('reportExists must not be called when superficie_expuesta is falsy') }
  assert.equal(evaluateRelease(dossier(), SHA, NOW, { reportExists: boom }).allow, true)
  assert.equal(evaluateRelease(dossier({ superficie_expuesta: false }), SHA, NOW, { reportExists: boom }).allow, true)
})

test('evaluateRelease treats a non-boolean superficie_expuesta as exposed (fail closed)', () => {
  // Un dossier escrito a mano con "true" o 1 no debe saltarse el gate de reportes.
  for (const val of ['true', 1, 'yes']) {
    const r = evaluateRelease(dossier({ superficie_expuesta: val }), SHA, NOW, { reportExists: never })
    assert.equal(r.allow, false, `superficie_expuesta=${JSON.stringify(val)} deberia exigir reportes`)
    assert.match(r.reason, /security_report/i)
  }
})

test('evaluateRelease blocks an exposed dossier when qa_report is empty (symmetry with security_report)', () => {
  const r = evaluateRelease(exposed({ qa_report: '   ' }), SHA, NOW, { reportExists: always })
  assert.equal(r.allow, false)
  assert.match(r.reason, /qa_report/i)
})

test('evaluateRelease blocks when a report path is a non-string value', () => {
  const r = evaluateRelease(exposed({ security_report: {} }), SHA, NOW, { reportExists: always })
  assert.equal(r.allow, false)
  assert.match(r.reason, /security_report/i)
})

// reportChecker es el verificador real contra disco que usa el hook: resuelve rutas relativas al
// cwd del proyecto y exige un ARCHIVO con contenido (no un directorio, no vacio).
test('reportChecker resolves relative paths and requires a non-empty file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-'))
  writeFileSync(join(dir, 'ok.md'), '# reporte\ncontenido')
  writeFileSync(join(dir, 'empty.md'), '')
  mkdirSync(join(dir, 'reports'))
  const check = reportChecker(dir)
  assert.equal(check('ok.md'), true, 'archivo relativo con contenido')
  assert.equal(check(join(dir, 'ok.md')), true, 'ruta absoluta con contenido')
  assert.equal(check('empty.md'), false, 'archivo vacio no es evidencia')
  assert.equal(check('reports'), false, 'un directorio no es evidencia')
  assert.equal(check('no-existe.md'), false, 'archivo inexistente')
})

// parseReleaseVerdict: la ultima linea no vacia debe casar EXACTO con el formato; cualquier
// desviacion (prosa despues, orden distinto, sha no hex, conteos ausentes) devuelve null (falla cerrado).
test('parseReleaseVerdict reads a well-formed last line', () => {
  const v = parseReleaseVerdict('bla bla\nRELEASE: CLOSED sha=deadbeef findings=3 closed=3 unverified=0')
  assert.deepEqual(v, { verdict: 'CLOSED', sha: 'deadbeef', findings: 3, closed: 3, unverified: 0 })
})

test('parseReleaseVerdict reads OPEN with unverified counts', () => {
  const v = parseReleaseVerdict('RELEASE: OPEN sha=deadbeef findings=3 closed=1 unverified=2')
  assert.deepEqual(v, { verdict: 'OPEN', sha: 'deadbeef', findings: 3, closed: 1, unverified: 2 })
})

test('parseReleaseVerdict rejects text trailing after the verdict line', () => {
  assert.equal(parseReleaseVerdict('RELEASE: CLOSED sha=deadbeef findings=1 closed=1 unverified=0\ngracias'), null)
})

test('parseReleaseVerdict rejects a non-hex or wrong-length sha', () => {
  assert.equal(parseReleaseVerdict('RELEASE: CLOSED sha=zzzz findings=1 closed=1 unverified=0'), null)
  assert.equal(parseReleaseVerdict('RELEASE: CLOSED sha=deadbeefff findings=1 closed=1 unverified=0'), null)
})

test('parseReleaseVerdict rejects a missing field and non-string input', () => {
  assert.equal(parseReleaseVerdict('RELEASE: CLOSED sha=deadbeef findings=1 closed=1'), null)
  assert.equal(parseReleaseVerdict(null), null)
  assert.equal(parseReleaseVerdict(''), null)
})

// --- subagent-stop: persiste el veredicto atado a (HEAD8, sha256(reporte)) en claude-review.json.
test('subagent-stop persists a CLOSED verdict bound to HEAD and the report hash', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  const state = readReviewState(repo.dir)['release-verifier']
  assert.equal(state.verdict, 'CLOSED')
  assert.equal(state.sha, repo.sha)
  assert.equal(state.reportHash, repo.reportHash)
  assert.equal(state.unverified, 0)
})

test('subagent-stop blocks when the verifier did not write the exact RELEASE line', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: 'cerre todo, confia en mi' })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /RELEASE:/)
})

test('subagent-stop blocks a verdict whose sha does not match HEAD, and persists nothing', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: 'aaaaaaaa' }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /HEAD|commit|SHA/i)
  assert.throws(() => readReviewState(repo.dir), /ENOENT|Unexpected/)
})

test('subagent-stop refuses to sign over a dirty tree', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  writeFileSync(join(repo.dir, 'reports/pentest.md'), '# pentest\nchanged after commit')
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /suci|limpio|dirty/i)
})

// Atadura por diff (D2, sign-time sobre la rama): un CLOSED solo persiste si cada test de
// regresion aparece en el diff de la rama; un test que no es parte de este cambio lo rechaza.
test('subagent-stop persists a CLOSED whose regression tests are in the branch diff', () => {
  const repo = makeBranchRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readReviewState(repo.dir)['release-verifier'].tests, ['tests/a.test.mjs', 'tests/b.test.mjs'])
})

test('subagent-stop rejects a CLOSED whose regression test is not in the branch diff', () => {
  // El reporte nombra un test que ya existia en la base (no lo introduce este cambio): no esta en
  // el diff de la rama, asi que no puede sostener un cierre de este release.
  const body = `# pentest
Regresion: tests/a.test.mjs::nuevo
Regresion: src/preexistente.test.mjs::viejo
`
  const repo = makeBranchRepo({ reportBody: body, baseFiles: { 'src/preexistente.test.mjs': '// ya existia en la base\n' } })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, findings: 2, closed: 2 }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /src\/preexistente\.test\.mjs/, 'nombra el archivo infractor')
  assert.doesNotMatch(out.reason, /tests\/a\.test\.mjs/, 'no culpa al test que si esta en el diff')
  assert.throws(() => readReviewState(repo.dir))
})

test('subagent-stop accepts a Regresion path written with ./ or // (normalized before diff match)', () => {
  const body = `# pentest
Regresion: ./tests/a.test.mjs::x
Regresion: tests//b.test.mjs::y
`
  const repo = makeBranchRepo({ reportBody: body })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readReviewState(repo.dir)['release-verifier'].tests, ['tests/a.test.mjs', 'tests/b.test.mjs'])
})

test('subagent-stop accepts a pre-existing test that the branch MODIFIES (introduce o toca)', () => {
  // El test existia en la base pero la rama lo toca: aparece en el diff, asi que sostiene el cierre.
  const body = `# pentest
Regresion: tests/touched.test.mjs::x
`
  const repo = makeBranchRepo({ reportBody: body, baseFiles: { 'tests/touched.test.mjs': '// v1\n' } })
  writeFileSync(join(repo.dir, 'tests/touched.test.mjs'), '// v2 modificado en la rama\n')
  repo.g('add', '-A')
  repo.g('commit', '-qm', 'toca el test existente')
  const sha = repo.g('rev-parse', 'HEAD').trim().slice(0, 8)
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha, findings: 1, closed: 1 }) })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readReviewState(repo.dir)['release-verifier'].tests, ['tests/touched.test.mjs'])
})

test('subagent-stop omits the diff binding on main (HEAD === base) and still persists', () => {
  // makeRepo firma en main de un solo commit: no hay rama, la atadura por diff se omite.
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readReviewState(repo.dir)['release-verifier'].verdict, 'CLOSED')
})

test('subagent-stop omits the diff binding when there is no default branch ref (no silent nullify)', () => {
  // Rama sin main/master/origin: branchBase(allowRoot:false) da null -> se omite (no se diffea
  // contra el commit raiz, que anularia la atadura en silencio dejando pasar cualquier test).
  const repo = makeBranchRepo()
  repo.g('branch', '-D', 'main')
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readReviewState(repo.dir)['release-verifier'].verdict, 'CLOSED')
})

test('subagent-stop ignores a non-release-verifier agent', () => {
  const repo = makeRepo()
  const r = runSubagentStop(repo.dir, { agent_type: 'code-reviewer', last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '')
})

test('subagent-stop persists the dedup Regresion paths (backticks tolerated) in tests', () => {
  // Formato real del SKILL: los backticks envuelven toda la expresion `Regresion: path::test`.
  const body = `# pentest
- **\`Regresion: tests/a.test.mjs::x\`**
- Regresion: tests/a.test.mjs::y
- Regresion: tests/b.test.mjs::z
`
  const repo = makeRepo({ reportBody: body })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, findings: 3, closed: 3 }) })
  assert.equal(r.status, 0, r.stderr)
  const state = readReviewState(repo.dir)['release-verifier']
  assert.deepEqual(state.tests, ['tests/a.test.mjs', 'tests/b.test.mjs'])
})

test('subagent-stop drops hostile Regresion paths (traversal, absolute) from tests', () => {
  const body = `# pentest
Regresion: tests/a.test.mjs::ok
Regresion: ../../../etc/passwd::evil
Regresion: /etc/passwd::evil
`
  const repo = makeRepo({ reportBody: body })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  // Verdicto OPEN para no chocar con el cross-check de findings (solo probamos el filtrado de tests).
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, verdict: 'OPEN', findings: 3, closed: 1, unverified: 2 }) })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readReviewState(repo.dir)['release-verifier'].tests, ['tests/a.test.mjs'])
})

test('subagent-stop blocks a CLOSED verdict when a Regresion path is invalid (cannot be closed)', () => {
  const body = `# pentest
Regresion: tests/a.test.mjs::ok
Regresion: ../../../etc/passwd::evil
`
  const repo = makeRepo({ reportBody: body })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, findings: 2, closed: 2 }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /invalida|sale del repo|cerrad/i)
  assert.throws(() => readReviewState(repo.dir))
})

test('subagent-stop does not count a prose mention of Regresion without a path', () => {
  // Solo las lineas con `path::test` cuentan; una mencion en prosa no infla el conteo.
  const body = `# pentest
Regresion: ver mas abajo
Regresion: tests/a.test.mjs::x
Regresion: tests/b.test.mjs::y
`
  const repo = makeRepo({ reportBody: body })
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, findings: 2, closed: 2 }) })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readReviewState(repo.dir)['release-verifier'].tests, ['tests/a.test.mjs', 'tests/b.test.mjs'])
})

test('subagent-stop blocks a CLOSED verdict whose findings do not match the report', () => {
  const repo = makeRepo() // reporte con 2 lineas Regresion
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, findings: 0, closed: 0 }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /cuadra|Regresion|conteo/i)
  assert.throws(() => readReviewState(repo.dir))
})

test('subagent-stop blocks when the dossier has no security_report', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ migrations_state: 'none' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /security_report/i)
})

test('subagent-stop blocks when the named report is unreadable', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/no-existe.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /reporte|leer/i)
})

test('subagent-stop with stop_hook_active persists a corrected verdict without emitting block', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }), stop_hook_active: true })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), '', 'no re-bloquea en bucle')
  assert.equal(readReviewState(repo.dir)['release-verifier'].verdict, 'CLOSED')
})

test('subagent-stop refuses a dirty tree even when the modified file sorts before the dossier', () => {
  // Regresion del bug del trim: una primera entrada del porcelain es " M tests/a.test.mjs". Con el
  // dossier tambien presente (sin trackear), la suciedad real no debe quedar exenta.
  const repo = makeRepo()
  writeFileSync(join(repo.dir, 'tests/a.test.mjs'), '// a modificado\n')
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  const out = JSON.parse(r.stdout)
  assert.equal(out.decision, 'block')
  assert.match(out.reason, /suci|limpio/i)
})

test('subagent-stop preserves other agents already in claude-review.json', () => {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({ security_report: 'reports/pentest.md' }))
  const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repo.dir, encoding: 'utf8' }).trim()
  writeFileSync(join(repo.dir, gitDir, 'claude-review.json'), JSON.stringify({ 'code-reviewer': { verdict: 'APPROVE' } }))
  const r = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(r.status, 0, r.stderr)
  const state = readReviewState(repo.dir)
  assert.equal(state['code-reviewer'].verdict, 'APPROVE', 'la entrada previa sobrevive')
  assert.equal(state['release-verifier'].verdict, 'CLOSED')
})

test('the deploy gate denies an exposed release with a persisted OPEN verdict', () => {
  const repo = makeRepo()
  const dossier = {
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
    superficie_expuesta: true, security_report: 'reports/pentest.md', qa_report: 'reports/qa.md',
  }
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify(dossier))
  runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha, verdict: 'OPEN', findings: 2, closed: 1, unverified: 1 }) })
  const deploy = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  const out = JSON.parse(deploy.stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /OPEN|unverified|cerr/i)
})

test('the deploy gate denies an exposed release that was never signed', () => {
  const repo = makeRepo()
  const dossier = {
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
    superficie_expuesta: true, security_report: 'reports/pentest.md', qa_report: 'reports/qa.md',
  }
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify(dossier))
  const deploy = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  const out = JSON.parse(deploy.stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /release-verifier/i)
})

test('the deploy gate denies a dirty working tree even with a complete signed dossier', () => {
  const repo = makeRepo()
  const dossier = {
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
  }
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify(dossier))
  // Un archivo trackeado modificado tras el commit: el deploy subiria eso, no HEAD.
  writeFileSync(join(repo.dir, 'tests/a.test.mjs'), '// a modificado sin commitear\n')
  const deploy = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  const out = JSON.parse(deploy.stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /arbol|sin commitear/i)
})

test('the deploy gate allows when only the untracked dossier is present (clean otherwise)', () => {
  const repo = makeRepo()
  const dossier = {
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
  }
  // El dossier vive sin trackear a proposito: no cuenta como arbol sucio.
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify(dossier))
  const deploy = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  assert.equal(deploy.stdout.trim(), '', `deberia permitir; stdout: ${deploy.stdout}`)
})

// El valor del check esta en atrapar lo que vercel SUBIRIA y el commit nunca vio: un archivo nuevo
// sin trackear, y cambios solo en el index. Si una regresion abriera esos caminos, estos fallarian.
function signedCleanRepo() {
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
  }))
  return repo
}
const deployHook = (dir) =>
  spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: dir }), encoding: 'utf8' })

test('the deploy gate denies an untracked file that is not the dossier (vercel would upload it)', () => {
  const repo = signedCleanRepo()
  writeFileSync(join(repo.dir, 'src-new.mjs'), 'export const x = 1\n')
  const out = JSON.parse(deployHook(repo.dir).stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /arbol|sin commitear/i)
})

test('the deploy gate denies changes that are staged but not committed', () => {
  const repo = signedCleanRepo()
  writeFileSync(join(repo.dir, 'tests/a.test.mjs'), '// staged, sin commit\n')
  repo.g('add', 'tests/a.test.mjs')
  const out = JSON.parse(deployHook(repo.dir).stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /arbol|sin commitear/i)
})

test('the deploy gate exemption is the exact root dossier path, not a lookalike', () => {
  const repo = signedCleanRepo()
  writeFileSync(join(repo.dir, '.release-approval.json.bak'), 'x')
  const out = JSON.parse(deployHook(repo.dir).stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /arbol|sin commitear/i)
})

test('the deploy gate denies an uncommitted rename', () => {
  const repo = signedCleanRepo()
  repo.g('mv', 'tests/a.test.mjs', 'tests/a-renamed.test.mjs')
  const out = JSON.parse(deployHook(repo.dir).stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /arbol|sin commitear/i)
})

// Regresion del parseo -z: un rename de un archivo de nombre corto HACIA la ruta del dossier no
// debe quedar oculto. La ruta vieja va como entrada aparte sin prefijo XY; el parser con estado la
// consume y cuenta la nueva (tracked rename, no un `??` untracked) como suciedad.
test('dirtyPaths sees a rename onto the dossier path (short old name) as dirty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-rename-'))
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  g('init', '-q')
  g('config', 'user.email', 't@t.t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'a'), 'x\n')
  g('add', '-A')
  g('commit', '-qm', 'seed')
  g('mv', 'a', '.release-approval.json')
  const dirty = dirtyPaths(dir)
  assert.ok(dirty.length > 0, 'un rename hacia el dossier no debe quedar oculto')
  assert.ok(dirty.includes('.release-approval.json'))
})

test('resolveStatePath keeps an absolute git-dir out of the working tree', () => {
  const abs = resolveStatePath('/proj', '/var/repo/.git')
  assert.equal(abs, '/var/repo/.git/claude-review.json')
  const rel = resolveStatePath('/proj', '.git')
  assert.equal(rel, '/proj/.git/claude-review.json')
})

test('evaluateRelease blocks an exposed OPEN verdict with internally consistent counts', () => {
  // Aun con closed===findings y unverified consistente, OPEN nunca habilita el deploy.
  const r = evaluateRelease(exposed(), SHA, NOW, { ...exposedOk, verifierState: goodVerifier({ verdict: 'OPEN' }) })
  assert.equal(r.allow, false)
  assert.match(r.reason, /OPEN|cerr/i)
})

// pre-deploy end-to-end sobre un repo real: con el veredicto persistido, el deploy pasa; si el
// reporte cambia despues de firmar, el gate lo detecta por el hash y deniega.
test('the deploy gate allows an exposed release once the verifier signed, and blocks if the report then changes', () => {
  const repo = makeRepo()
  const dossier = {
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen',
    superficie_expuesta: true, security_report: 'reports/pentest.md', qa_report: 'reports/qa.md',
  }
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify(dossier))
  const sign = runSubagentStop(repo.dir, { last_assistant_message: releaseLine({ sha: repo.sha }) })
  assert.equal(sign.status, 0, sign.stderr)

  const deploy = () => spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  const ok = deploy()
  assert.equal(ok.stdout.trim(), '', `deberia permitir; stdout: ${ok.stdout}`)

  // El reporte cambia despues de firmar: el hash ya no casa -> deny.
  writeFileSync(join(repo.dir, 'reports/pentest.md'), '# pentest\notro contenido')
  const blocked = JSON.parse(deploy().stdout)
  assert.equal(blocked.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(blocked.hookSpecificOutput.permissionDecisionReason, /hash|cambi/i)
})

// --- entrypoint (spawn): sin esto, un main() que referencia una funcion no importada crashea
// (ReferenceError, exit 1) y NO deniega, dejando pasar el deploy. El unit test no lo veria.
test('the hook entrypoint denies an exposed release whose reports are missing, without crashing', () => {
  const r = runHook(e2eDossier({ superficie_expuesta: true, security_report: 'reports/pentest.md', qa_report: 'reports/qa.md' }))
  assert.equal(r.status, 0, `no debe crashear; stderr: ${r.stderr}`)
  // El "fatal: not a git repository" del rev-parse en un dir temporal es benigno y ya esta
  // capturado; lo que NO debe aparecer es un crash del propio hook.
  assert.doesNotMatch(r.stderr, /ReferenceError|TypeError|is not defined/, `sin crash; stderr: ${r.stderr}`)
  const out = JSON.parse(r.stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /security_report|qa_report/i)
})

test('the hook entrypoint allows a non-exposed release without consulting the verifier', () => {
  // Sin superficie expuesta, el gate no exige reportes ni veredicto; pero si necesita un HEAD real.
  const repo = makeRepo()
  writeFileSync(join(repo.dir, '.release-approval.json'), JSON.stringify({
    sha: repo.sha, ci_green: true, approvals: { qa: true, security: true, release: true },
    rollback_plan: 'revert', migrations_state: 'none', owner: 'karen', superficie_expuesta: false,
  }))
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: repo.dir }),
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, `stderr: ${r.stderr}`)
  assert.equal(r.stdout.trim(), '', 'sin payload de deny: el deploy queda habilitado por el gate')
})

test('evaluateRelease blocks when HEAD is not a resolvable 8-hex sha (empty), even if the dossier matches', () => {
  // Un dossier forjado con sha:'' no debe satisfacer la comprobacion cuando no hay HEAD resoluble.
  const r = evaluateRelease(dossier({ sha: '' }), '', NOW)
  assert.equal(r.allow, false)
  assert.match(r.reason, /SHA|commit/i)
})

test('the hook entrypoint ignores a non-deploy command', () => {
  const r = runHook(null, 'vercel ls')
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '')
})
