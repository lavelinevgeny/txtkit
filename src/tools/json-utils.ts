import { t } from '../i18n/translate'

export function flattenJson(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj === null || typeof obj !== 'object') return result

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const key = prefix ? `${prefix}.${i}` : `${i}`
      if (obj[i] !== null && typeof obj[i] === 'object') {
        Object.assign(result, flattenJson(obj[i], key))
      } else {
        result[key] = obj[i]
      }
    }
    return result
  }

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') {
      Object.assign(result, flattenJson(v, key))
    } else {
      result[key] = v
    }
  }

  return result
}

export function unflattenJson(obj: Record<string, unknown>): unknown {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split('.')
    let current: Record<string, unknown> = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      const nextPart = parts[i + 1]
      const isArrayKey = /^\d+$/.test(nextPart)

      if (!(part in current)) {
        current[part] = isArrayKey ? [] : {}
      }

      const next = current[part]
      if (Array.isArray(next)) {
        const idx = parseInt(nextPart, 10)
        while (next.length <= idx) next.push(undefined as unknown)
        if (i + 1 < parts.length - 1) {
          if (next[idx] === undefined || next[idx] === null) {
            next[idx] = /^\d+$/.test(parts[i + 2]) ? [] : {}
          }
        }
        current = next as unknown as Record<string, unknown>
      } else {
        current = next as Record<string, unknown>
      }
    }

    const lastPart = parts[parts.length - 1]
    if (/^\d+$/.test(lastPart) && Array.isArray(current)) {
      current[parseInt(lastPart, 10)] = value
    } else {
      current[lastPart] = value
    }
  }

  return result
}

export interface StructureAnalysis {
  keyCount: number
  maxDepth: number
  types: string[]
  arrayCount: number
  totalElements: number
  isArray: boolean
  report: string
}

export function analyzeStructure(data: unknown, depth = 0): StructureAnalysis {
  if (data === null || typeof data !== 'object') {
    return { keyCount: 0, maxDepth: depth, types: [], arrayCount: 0, totalElements: 0, isArray: false, report: '' }
  }

  const types = new Set<string>()
  let keyCount = 0
  let maxDepth = depth + 1
  let arrayCount = 0
  let totalElements = 0

  if (Array.isArray(data)) {
    arrayCount++
    totalElements += data.length
    for (const item of data) {
      types.add(typeof item)
      if (item !== null && typeof item === 'object') {
        const child = analyzeStructure(item, depth + 1)
        keyCount += child.keyCount
        maxDepth = Math.max(maxDepth, child.maxDepth)
        arrayCount += child.arrayCount
        totalElements += child.totalElements
        for (const t of child.types) types.add(t)
      }
    }
  } else {
    const entries = Object.entries(data as Record<string, unknown>)
    keyCount = entries.length
    for (const [, v] of entries) {
      types.add(v === null ? 'null' : typeof v)
      if (v !== null && typeof v === 'object') {
        const child = analyzeStructure(v, depth + 1)
        keyCount += child.keyCount
        maxDepth = Math.max(maxDepth, child.maxDepth)
        arrayCount += child.arrayCount
        totalElements += child.totalElements
        for (const t of child.types) types.add(t)
      }
    }
  }

  const uniqueTypes = [...types]
  const isArray = Array.isArray(data)

  const lines = [
    t('json.keys', { n: keyCount }),
    t('json.depth', { n: maxDepth }),
    t('json.types', { types: uniqueTypes.join(', ') }),
    t('json.arrays', { n: arrayCount }),
    t('json.elements', { n: totalElements }),
    isArray ? t('json.formatArray') : t('json.formatObject'),
  ]
  const report = lines.join('\n')

  return { keyCount, maxDepth, types: uniqueTypes, arrayCount, totalElements, isArray, report }
}

interface LintIssue {
  position: number
  length: number
  message: string
}

function extractV8Position(errorMessage: string, input: string): number | null {
  const posMatch = errorMessage.match(/position\s+(\d+)/i)
  if (posMatch) return parseInt(posMatch[1], 10)

  const colMatch = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (colMatch) {
    const line = parseInt(colMatch[1], 10)
    const col = parseInt(colMatch[2], 10)
    let pos = 0
    let currentLine = 1
    while (pos < input.length && currentLine < line) {
      if (input[pos] === '\n') currentLine++
      pos++
    }
    return pos + col - 1
  }

  const tokenMatch = errorMessage.match(/Unexpected token '(.)'/)
  if (tokenMatch) {
    const token = tokenMatch[1]
    const idx = input.indexOf(token)
    if (idx >= 0) return idx
  }

  const endMatch = errorMessage.match(/Unexpected end of JSON input/)
  if (endMatch) {
    return input.length
  }

  return null
}

function checkBracketBalance(input: string): LintIssue[] {
  const issues: LintIssue[] = []
  const stack: Array<{ char: string; pos: number }> = []
  const pairs: Record<string, string> = { '{': '}', '[': ']' }

  let inString = false
  let escapeNext = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (ch === '\\' && inString) {
      escapeNext = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{' || ch === '[') {
      stack.push({ char: ch, pos: i })
    } else if (ch === '}' || ch === ']') {
      if (stack.length === 0) {
        issues.push({
          position: i,
          length: 1,
          message: t('jsonLint.unexpectedBracket', { char: ch }),
        })
      } else {
        const top = stack[stack.length - 1]
        if (pairs[top.char] !== ch) {
          issues.push({
            position: i,
            length: 1,
            message: t('jsonLint.mismatchedBracket', { expected: pairs[top.char], found: ch }),
          })
        } else {
          stack.pop()
        }
      }
    }
  }

  for (const unclosed of stack) {
    issues.push({
      position: unclosed.pos,
      length: 1,
      message: t('jsonLint.unclosedBracket', { char: unclosed.char }),
    })
  }

  return issues
}

function checkUnicodeEscapes(input: string): LintIssue[] {
  const issues: LintIssue[] = []
  const re = /\\u([0-9a-fA-F]{0,3})(?=[^0-9a-fA-F"\\])/g
  let match: RegExpExecArray | null

  while ((match = re.exec(input)) !== null) {
    const hexPart = match[1]
    if (hexPart.length < 4) {
      issues.push({
        position: match.index,
        length: 2 + hexPart.length,
        message: t('jsonLint.badUnicode', { found: '\\u' + hexPart }),
      })
    }
  }

  const badSlashU = /\\(d[0-9a-fA-F]{2,3})/gi
  while ((match = badSlashU.exec(input)) !== null) {
    if (!/\\u[0-9a-fA-F]{4}/.test(input.slice(match.index, match.index + 6))) {
      issues.push({
        position: match.index,
        length: 1 + match[1].length,
        message: t('jsonLint.badUnicodeChar', { found: '\\' + match[1] }),
      })
    }
  }

  return issues
}

function checkDoubleEscaping(input: string): LintIssue | null {
  const trimmed = input.trim()
  const doubleDoubleQuoteCount = (trimmed.match(/""/g) || []).length
  if (doubleDoubleQuoteCount >= 3 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return {
      position: 0,
      length: Math.min(trimmed.length, 20),
      message: t('jsonLint.doubleEscaped'),
    }
  }
  const backslashQuoteCount = (trimmed.match(/\\"/g) || []).length
  if (backslashQuoteCount >= 6) {
    return {
      position: 0,
      length: Math.min(trimmed.length, 20),
      message: t('jsonLint.doubleEscaped'),
    }
  }
  return null
}

function buildContextSnippet(input: string, pos: number, len: number): string {
  const contextRadius = 40
  const start = Math.max(0, pos - contextRadius)
  const end = Math.min(input.length, pos + len + contextRadius)

  const prefix = start > 0 ? '...' : ''
  const suffix = end < input.length ? '...' : ''
  const snippet = prefix + input.slice(start, end) + suffix

  const pointerOffset = prefix.length + (pos - start)
  const pointerLen = Math.max(len, 1)
  const pointer = ' '.repeat(pointerOffset) + '^'.repeat(pointerLen)

  return snippet + '\n' + pointer
}

export function lintJson(input: string): string {
  let parseError: string
  try {
    JSON.parse(input)
    return t('jsonLint.valid')
  } catch (e) {
    parseError = (e as Error).message
  }

  const errorMessage = parseError!
  const parts: string[] = []

  parts.push(t('jsonLint.errorPrefix') + errorMessage)

  const v8Pos = extractV8Position(errorMessage, input)
  if (v8Pos !== null) {
    parts.push('')
    parts.push(buildContextSnippet(input, v8Pos, 1))
    parts.push(t('jsonLint.position', { pos: v8Pos }))
  }

  const unicodeIssues = checkUnicodeEscapes(input)
  if (unicodeIssues.length > 0) {
    parts.push('')
    parts.push(t('jsonLint.unicodeIssues'))
    for (const issue of unicodeIssues.slice(0, 5)) {
      parts.push('  ' + issue.message)
      parts.push('  ' + buildContextSnippet(input, issue.position, issue.length))
    }
    if (unicodeIssues.length > 5) {
      parts.push(t('jsonLint.moreIssues', { n: unicodeIssues.length - 5 }))
    }
  }

  const doubleEscape = checkDoubleEscaping(input)
  if (doubleEscape) {
    parts.push('')
    parts.push(t('jsonLint.hint') + ' ' + doubleEscape.message)
  }

  if (v8Pos === null && unicodeIssues.length === 0) {
    const bracketIssues = checkBracketBalance(input)
    if (bracketIssues.length > 0) {
      parts.push('')
      parts.push(t('jsonLint.bracketIssues'))
      for (const issue of bracketIssues) {
        parts.push('  ' + issue.message)
        if (issue.position < input.length) {
          parts.push('  ' + buildContextSnippet(input, issue.position, issue.length))
        }
      }
    }
  }

  return parts.join('\n')
}
