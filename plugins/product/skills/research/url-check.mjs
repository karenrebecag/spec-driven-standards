// Comprobacion de URLs de un brief. Las URLs las escribe un LLM: se tratan como entrada hostil (SSRF).
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_REDIRECTS = 5
const TIMEOUT_MS = 10_000
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
// Algunos servidores rechazan HEAD con estos codigos aunque el recurso exista.
const HEAD_FALLBACK = new Set([405, 403, 501])
const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.goog', 'metadata.google.internal', 'instance-data'])

export class UrlCheckError extends Error {}

const blocked = () => new UrlCheckError('bloqueada: red privada')

function isPrivateV4([a, b, c]) {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return true
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true
  if (a === 203 && b === 0 && c === 113) return true
  return a === 100 && b >= 64 && b <= 127
}

// Expande a 8 grupos de 16 bits; el sufijo IPv4 embebido (::ffff:1.2.3.4) cuenta como dos grupos.
function expandV6(ip) {
  let text = ip.split('%')[0].toLowerCase()
  const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (tail) {
    const [, a, b, c, d] = tail.map(Number)
    text = text.replace(/\d+\.\d+\.\d+\.\d+$/, `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`)
  }
  const [head, rest] = text.split('::')
  const left = head ? head.split(':') : []
  const right = rest === undefined ? [] : rest ? rest.split(':') : []
  const fill = rest === undefined ? [] : Array(8 - left.length - right.length).fill('0')
  return [...left, ...fill, ...right].map((g) => parseInt(g, 16))
}

const v4FromGroups = (hi, lo) => [hi >> 8, hi & 255, lo >> 8, lo & 255]

function isPrivateV6(ip) {
  const g = expandV6(ip)
  if (g.length !== 8 || g.some(Number.isNaN)) return true
  const zeros = (n) => g.slice(0, n).every((x) => x === 0)
  if (zeros(7) && g[7] <= 1) return true
  if ((g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80) return true
  // 6to4 y Teredo (solo 2001:0000::/32, no todo 2001::/16) embeben un IPv4 arbitrario; NAT64 de uso local 64:ff9b:1::/48.
  if (g[0] === 0x2002 || (g[0] === 0x2001 && g[1] === 0) || (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1)) return true
  const embedsV4 = (zeros(5) && g[5] === 0xffff) || zeros(6) || (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
  return embedsV4 && isPrivateV4(v4FromGroups(g[6], g[7]))
}

export function isPrivateAddress(address) {
  const family = isIP(address)
  if (family === 4) return isPrivateV4(address.split('.').map(Number))
  return family === 6 ? isPrivateV6(address) : true
}

// HACK: validar y luego hacer fetch deja una ventana de DNS rebinding (el fetch resuelve otra vez).
// Si los briefs llegan alguna vez de autores no confiables, fijar la IP resuelta con un lookup
// propio en el dispatcher de undici.
async function assertPublic(urlText, lookup) {
  let url
  try {
    url = new URL(urlText)
  } catch {
    throw new UrlCheckError('URL invalida')
  }
  if (url.protocol !== 'https:') throw new UrlCheckError('esquema no permitido')
  if (url.username || url.password) throw new UrlCheckError('bloqueada: credenciales en la URL')
  if (url.port) throw new UrlCheckError('puerto no permitido')
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  if (BLOCKED_HOSTS.has(host)) throw blocked()
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw blocked()
    return url
  }
  let records
  try {
    records = await lookup(host, { all: true })
  } catch {
    throw new UrlCheckError('no resuelve')
  }
  if (!records?.length) throw new UrlCheckError('no resuelve')
  if (records.some((r) => isPrivateAddress(r.address))) throw blocked()
  return url
}

const discard = (res) => res.body?.cancel?.().catch?.(() => {})

// Cada salto se revalida: un 302 a la red interna es la forma habitual de saltarse la primera comprobacion.
async function request(method, start, { lookup, fetchImpl }) {
  let current = start
  for (let hops = 0; ; hops++) {
    const url = await assertPublic(current, lookup)
    const res = await fetchImpl(url.href, { method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    const location = res.headers?.get?.('location')
    if (!REDIRECT_STATUS.has(res.status) || !location) return res
    await discard(res)
    if (hops >= MAX_REDIRECTS) throw new UrlCheckError('demasiadas redirecciones')
    try {
      current = new URL(location, url).href
    } catch {
      throw new UrlCheckError('URL invalida')
    }
  }
}

// fetcher(url) -> { ok, status }; lanza UrlCheckError (motivo generico) o el error crudo de red.
export function createFetcher({ lookup = dnsLookup, fetchImpl = fetch } = {}) {
  const deps = { lookup, fetchImpl }
  return async (url) => {
    let res = await request('HEAD', url, deps)
    if (HEAD_FALLBACK.has(res.status)) {
      await discard(res)
      res = await request('GET', url, deps)
    }
    await discard(res)
    return { ok: res.ok, status: res.status }
  }
}

// El mensaje crudo de un error de red puede filtrar hosts internos; solo se imprimen motivos genericos.
function reasonFor(e) {
  if (e instanceof UrlCheckError) return e.message
  return e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'error de red'
}

export async function checkUrls(urls, fetcher = createFetcher()) {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetcher(url)
        return res.ok ? null : { url, reason: `HTTP ${res.status}` }
      } catch (e) {
        return { url, reason: reasonFor(e) }
      }
    }),
  )
  return results.filter(Boolean)
}
