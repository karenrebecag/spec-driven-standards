import { readFileSync } from 'node:fs'

const HANDBACK_TOOL = 'SubagentHandback'
const TRANSCRIPT_FULL_READ_WARN_BYTES = 8 * 1024 * 1024

function transcriptNotice(path, message, noticePrefix) {
  const prefix = typeof noticePrefix === 'string' && noticePrefix ? noticePrefix : 'handback'
  try {
    process.stderr.write(`${prefix}: transcript ${path}: ${message}\n`)
  } catch {
    // sin stderr usable: no tumbar el hook
  }
}

export function readHandbackMessage(line) {
  if (!line || typeof line !== 'object' || line.type !== 'assistant') return undefined
  const message = line.message
  if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return undefined

  let last
  for (const block of message.content) {
    if (!block || typeof block !== 'object') continue
    if (block.type !== 'tool_use') continue
    if (block.name !== HANDBACK_TOOL) continue
    const input = block.input
    if (!input || typeof input !== 'object') continue
    if (typeof input.message !== 'string') continue
    last = input.message
  }
  return last
}

export function handbackFromTranscript(path, noticePrefix) {
  if (typeof path !== 'string' || !path) return ''
  try {
    const transcript = readFileSync(path, 'utf8')
    if (transcript.length > TRANSCRIPT_FULL_READ_WARN_BYTES) {
      // HACK: hoy se lee todo el JSONL; migrar a lectura desde el final cuando sea grande.
      transcriptNotice(
        path,
        `lee todo el JSONL (${transcript.length} bytes); pasar a lectura desde el final sobre ${TRANSCRIPT_FULL_READ_WARN_BYTES} bytes`,
        noticePrefix,
      )
    }
    let last = ''
    const lines = transcript.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim()
      if (!t) continue
      try {
        const msg = readHandbackMessage(JSON.parse(t))
        if (msg !== undefined) last = msg
      } catch {
        // linea no JSON (o parcial): se ignora para no tumbar el stop hook
        transcriptNotice(path, `linea ${i + 1} no JSON; se ignora`, noticePrefix)
      }
    }
    return last
  } catch {
    return ''
  }
}

function hasPattern(text, pattern) {
  if (typeof text !== 'string') return false
  if (typeof pattern === 'string') return text.includes(pattern)
  if (pattern instanceof RegExp) return new RegExp(pattern.source, pattern.flags).test(text)
  return true
}

// Hooks docs: https://code.claude.com/docs/en/hooks.md
// En SubagentStop, cuando hay SubagentHandback, el reporte va en `input.message` del `tool_use`.
export function finalReport(input) {
  const direct = input && typeof input.last_assistant_message === 'string' ? input.last_assistant_message : ''
  if (hasPattern(direct, input && input.pattern)) return direct
  return handbackFromTranscript(input && input.agent_transcript_path, input && input.noticePrefix)
}
