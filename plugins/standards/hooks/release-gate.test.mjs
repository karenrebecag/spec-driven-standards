import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isDeployCommand, evaluateRelease, reportChecker } from './release-gate.mjs'

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'release-gate.mjs')

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

test('evaluateRelease allows an exposed dossier when both reports exist', () => {
  assert.equal(evaluateRelease(exposed(), SHA, NOW, { reportExists: always }).allow, true)
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

test('the hook entrypoint allows an exposed release whose reports exist with content', () => {
  const r = runHook(e2eDossier({ superficie_expuesta: true, security_report: 'reports/pentest.md', qa_report: 'reports/qa.md' }))
  // El dir ya existe; escribimos los reportes reales y re-corremos contra ese mismo dossier.
  mkdirSync(join(r.dir, 'reports'))
  writeFileSync(join(r.dir, 'reports/pentest.md'), '# pentest\nok')
  writeFileSync(join(r.dir, 'reports/qa.md'), '# qa\nok')
  const r2 = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command: 'vercel --prod --yes' }, cwd: r.dir }),
    encoding: 'utf8',
  })
  assert.equal(r2.status, 0, `stderr: ${r2.stderr}`)
  assert.equal(r2.stdout.trim(), '', 'sin payload de deny: el deploy queda habilitado por el gate')
})

test('the hook entrypoint ignores a non-deploy command', () => {
  const r = runHook(null, 'vercel ls')
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '')
})
