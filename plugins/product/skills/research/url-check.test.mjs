import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkUrls, createFetcher } from './url-check.mjs'

const PUBLIC = [{ address: '93.184.216.34', family: 4 }]
const lookupTo = (map = {}) => async (host) => {
  if (map[host] === 'fail') throw Object.assign(new Error('ENOTFOUND secret-detail'), { code: 'ENOTFOUND' })
  return map[host] ?? PUBLIC
}

// Scripted fetch: each call shifts the next response and records method+url.
function scripted(responses) {
  const calls = []
  const cancelled = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts.method, redirect: opts.redirect })
    const r = responses.shift() ?? { status: 200 }
    if (r.throw) throw r.throw
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: new Headers(r.location ? { location: r.location } : {}),
      body: { cancel: async () => void cancelled.push(url) },
    }
  }
  return { fetchImpl, calls, cancelled }
}

const reasonOf = async (url, opts) => {
  const [f] = await checkUrls([url], createFetcher(opts))
  return f?.reason ?? null
}

test('checkUrls returns only failures with generic reasons', async () => {
  const fetcher = async (url) => {
    if (url.includes('boom')) throw new Error('network down at 10.0.0.5')
    return { ok: !url.includes('gone'), status: url.includes('gone') ? 404 : 200 }
  }
  const failures = await checkUrls(['https://ok.com', 'https://gone.com', 'https://boom.com'], fetcher)
  assert.deepEqual(failures, [
    { url: 'https://gone.com', reason: 'HTTP 404' },
    { url: 'https://boom.com', reason: 'error de red' },
  ])
  assert.deepEqual(await checkUrls([], fetcher), [])
})

test('blocks literal private and loopback addresses without fetching', async () => {
  const urls = [
    'https://127.0.0.1/x',
    'https://169.254.169.254/latest/meta-data',
    'https://10.1.2.3/',
    'https://172.16.0.1/',
    'https://192.168.1.1/',
    'https://100.64.0.1/',
    'https://0.0.0.0/',
    'https://[::1]/',
    'https://[fe80::1]/',
    'https://[fd00::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:10.0.0.1]/',
    'https://2130706433/',
  ]
  for (const url of urls) {
    const { fetchImpl, calls } = scripted([])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), 'bloqueada: red privada', url)
    assert.equal(calls.length, 0, url)
  }
})

test('blocks hostnames that resolve to a private address, including one bad record among many', async () => {
  const { fetchImpl, calls } = scripted([])
  const lookup = lookupTo({ 'evil.test': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.9', family: 4 }] })
  assert.equal(await reasonOf('https://evil.test/', { lookup, fetchImpl }), 'bloqueada: red privada')
  assert.equal(calls.length, 0)
})

test('blocks metadata and localhost names', async () => {
  for (const host of ['metadata.google.internal', 'localhost']) {
    const { fetchImpl } = scripted([])
    assert.equal(await reasonOf(`https://${host}/`, { lookup: lookupTo(), fetchImpl }), 'bloqueada: red privada', host)
  }
})

test('rejects non-https schemes and userinfo', async () => {
  const { fetchImpl, calls } = scripted([])
  const opts = { lookup: lookupTo(), fetchImpl }
  assert.equal(await reasonOf('http://docs.acme.dev/', opts), 'esquema no permitido')
  assert.equal(await reasonOf('file:///etc/passwd', opts), 'esquema no permitido')
  assert.equal(await reasonOf('https://user:pw@docs.acme.dev/', opts), 'bloqueada: credenciales en la URL')
  assert.equal(calls.length, 0)
})

test('an unresolvable host reports no resuelve without leaking the error', async () => {
  const { fetchImpl } = scripted([])
  assert.equal(await reasonOf('https://gone.test/', { lookup: lookupTo({ 'gone.test': 'fail' }), fetchImpl }), 'no resuelve')
})

test('a public url passes with HEAD, manual redirects and a cancelled body', async () => {
  const { fetchImpl, calls, cancelled } = scripted([{ status: 200 }])
  assert.equal(await reasonOf('https://docs.acme.dev/a', { lookup: lookupTo(), fetchImpl }), null)
  assert.deepEqual(calls, [{ url: 'https://docs.acme.dev/a', method: 'HEAD', redirect: 'manual' }])
  assert.deepEqual(cancelled, ['https://docs.acme.dev/a'])
})

test('a redirect from public to private is blocked before the second request', async () => {
  const { fetchImpl, calls, cancelled } = scripted([{ status: 302, location: 'https://169.254.169.254/' }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), 'bloqueada: red privada')
  assert.equal(calls.length, 1)
  assert.equal(cancelled.length, 1)
})

test('relative Location headers resolve against the current url', async () => {
  const { fetchImpl, calls } = scripted([{ status: 301, location: '/v2/docs' }, { status: 200 }])
  assert.equal(await reasonOf('https://docs.acme.dev/v1/docs', { lookup: lookupTo(), fetchImpl }), null)
  assert.equal(calls[1].url, 'https://docs.acme.dev/v2/docs')
})

test('a redirect to http is blocked', async () => {
  const { fetchImpl } = scripted([{ status: 302, location: 'http://docs.acme.dev/' }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), 'esquema no permitido')
})

test('five redirects are followed, the sixth is blocked', async () => {
  const hop = (n) => ({ status: 302, location: `https://docs.acme.dev/${n}` })
  const five = scripted([hop(1), hop(2), hop(3), hop(4), hop(5), { status: 200 }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl: five.fetchImpl }), null)
  const six = scripted([hop(1), hop(2), hop(3), hop(4), hop(5), hop(6), { status: 200 }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl: six.fetchImpl }), 'demasiadas redirecciones')
})

test('HEAD 405, 403 and 501 fall back to GET; other statuses do not', async () => {
  for (const status of [405, 403, 501]) {
    const { fetchImpl, calls, cancelled } = scripted([{ status }, { status: 200 }])
    assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), null, String(status))
    assert.deepEqual(calls.map((c) => c.method), ['HEAD', 'GET'])
    assert.equal(cancelled.length, 2)
  }
  const { fetchImpl, calls } = scripted([{ status: 404 }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), 'HTTP 404')
  assert.deepEqual(calls.map((c) => c.method), ['HEAD'])
})

test('a failing GET fallback reports its own status', async () => {
  const { fetchImpl } = scripted([{ status: 405 }, { status: 500 }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), 'HTTP 500')
})

test('timeouts and network errors map to generic reasons', async () => {
  const timeout = scripted([{ throw: Object.assign(new Error('The operation was aborted due to timeout 10.0.0.1'), { name: 'TimeoutError' }) }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl: timeout.fetchImpl }), 'timeout')
  const net = scripted([{ throw: new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.1:443') }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl: net.fetchImpl }), 'error de red')
})

test('blocks reserved, documentation, benchmark and transition-mechanism ranges', async () => {
  const urls = [
    'https://198.18.0.1/',
    'https://198.19.255.254/',
    'https://192.0.2.10/',
    'https://198.51.100.7/',
    'https://203.0.113.9/',
    'https://[2002:808:808::1]/',
    'https://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/',
    'https://[64:ff9b:1::1]/',
    'https://[64:ff9b:1:abcd::1]/',
  ]
  for (const url of urls) {
    const { fetchImpl, calls } = scripted([])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), 'bloqueada: red privada', url)
    assert.equal(calls.length, 0, url)
  }
})

test('neighbours of the new blocked ranges stay allowed, and 2001::/16 is not blocked wholesale', async () => {
  for (const url of ['https://198.17.255.255/', 'https://198.20.0.1/', 'https://198.51.101.1/', 'https://203.0.114.1/', 'https://[2001:4860:4860::8888]/', 'https://[2001:1::1]/']) {
    const { fetchImpl, calls } = scripted([{ status: 200 }])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), null, url)
    assert.equal(calls.length, 1, url)
  }
})

test('hostnames resolving into the new ranges are blocked', async () => {
  const { fetchImpl, calls } = scripted([])
  const lookup = lookupTo({ 'evil.test': [{ address: '203.0.113.5', family: 4 }] })
  assert.equal(await reasonOf('https://evil.test/', { lookup, fetchImpl }), 'bloqueada: red privada')
  assert.equal(calls.length, 0)
})

test('trailing dots are stripped before the blocked-host and IP checks', async () => {
  for (const url of ['https://localhost../', 'https://metadata.google.internal.../', 'https://127.0.0.1../', 'https://localhost./']) {
    const { fetchImpl, calls } = scripted([])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), 'bloqueada: red privada', url)
    assert.equal(calls.length, 0, url)
  }
})

test('only the default https port is allowed', async () => {
  for (const url of ['https://docs.acme.dev:8443/', 'https://docs.acme.dev:80/', 'https://docs.acme.dev:22/']) {
    const { fetchImpl, calls } = scripted([])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), 'puerto no permitido', url)
    assert.equal(calls.length, 0, url)
  }
  for (const url of ['https://docs.acme.dev/', 'https://docs.acme.dev:443/']) {
    const { fetchImpl } = scripted([{ status: 200 }])
    assert.equal(await reasonOf(url, { lookup: lookupTo(), fetchImpl }), null, url)
  }
})

test('a redirect to a non-default port is rejected', async () => {
  const { fetchImpl, calls } = scripted([{ status: 302, location: 'https://docs.acme.dev:8443/x' }])
  assert.equal(await reasonOf('https://docs.acme.dev/', { lookup: lookupTo(), fetchImpl }), 'puerto no permitido')
  assert.equal(calls.length, 1)
})
