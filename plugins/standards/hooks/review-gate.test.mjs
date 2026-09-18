import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseVerdict, isCodeDiff, evaluateCommit } from './review-gate.mjs'

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
