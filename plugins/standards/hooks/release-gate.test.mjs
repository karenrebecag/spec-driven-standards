import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isDeployCommand, evaluateRelease } from './release-gate.mjs'

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
