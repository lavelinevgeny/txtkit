export interface NumberNode {
  type: 'number'
  value: string
}

export interface StringNode {
  type: 'string'
  value: string
}

export interface IdentifierNode {
  type: 'identifier'
  value: string
}

export interface BlockNode {
  type: 'block'
  children: BlockChild[]
}

export type BlockChild = NumberNode | StringNode | IdentifierNode | BlockNode

export interface ParseResult {
  topLevel: BlockNode[]
  errors: string[]
}

export function parseBlocks(input: string): ParseResult {
  const errors: string[] = []
  const topLevel: BlockNode[] = []
  let pos = 0

  function peek(): string {
    return input[pos] ?? ''
  }

  function advance(): string {
    return input[pos++] ?? ''
  }

  function skipWhitespace(): void {
    while (pos < input.length && /\s/.test(input[pos])) {
      pos++
    }
  }

  function readString(): StringNode {
    advance()
    let value = ''
    while (pos < input.length) {
      const ch = advance()
      if (ch === '"') {
        if (peek() === '"') {
          advance()
          value += '"'
        } else {
          break
        }
      } else {
        value += ch
      }
    }
    return { type: 'string', value }
  }

  function readToken(): NumberNode | IdentifierNode {
    let token = ''
    while (pos < input.length && !/[{},\s]/.test(input[pos])) {
      token += advance()
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return { type: 'number', value: token }
    }
    return { type: 'identifier', value: token }
  }

  function parseBlock(): BlockNode | null {
    const children: BlockChild[] = []

    skipWhitespace()
    if (peek() !== '{') {
      errors.push(`Expected '{' at position ${pos}`)
      return null
    }
    advance()

    while (pos < input.length) {
      skipWhitespace()
      if (peek() === '}') {
        advance()
        return { type: 'block', children }
      }
      if (peek() === '{') {
        const child = parseBlock()
        if (child) children.push(child)
        skipWhitespace()
        if (peek() === ',') advance()
        continue
      }
      if (peek() === '"') {
        children.push(readString())
        skipWhitespace()
        if (peek() === ',') advance()
        continue
      }
      if (peek() === '') {
        errors.push('Unterminated block')
        return { type: 'block', children }
      }
      children.push(readToken())
      skipWhitespace()
      if (peek() === ',') advance()
    }

    errors.push('Unterminated block')
    return { type: 'block', children }
  }

  while (pos < input.length) {
    skipWhitespace()
    if (pos >= input.length) break
    if (peek() === '{') {
      const block = parseBlock()
      if (block) topLevel.push(block)
      skipWhitespace()
      if (peek() === ',') advance()
    } else {
      errors.push(`Unexpected character '${peek()}' at position ${pos}`)
      advance()
    }
  }

  return { topLevel, errors }
}

export function validateBlocks(input: string): { valid: boolean; errors: string[] } {
  const result = parseBlocks(input)
  return { valid: result.errors.length === 0, errors: result.errors }
}

export function prettyPrint(input: string): string {
  const { topLevel } = parseBlocks(input)

  function formatNode(node: BlockChild, indent: number): string {
    if (node.type === 'block') {
      if (node.children.length === 0) return '{}'
      const pad = '  '.repeat(indent)
      const innerPad = '  '.repeat(indent + 1)
      const items = node.children.map(c => innerPad + formatNode(c, indent + 1))
      return '{\n' + items.join(',\n') + '\n' + pad + '}'
    }
    if (node.type === 'string') return '"' + node.value.replace(/"/g, '""') + '"'
    return node.value
  }

  return topLevel.map(b => formatNode(b, 0)).join(',\n')
}

export function minifyBlocks(input: string): string {
  const { topLevel } = parseBlocks(input)

  function formatNode(node: BlockChild): string {
    if (node.type === 'block') {
      return '{' + node.children.map(c => formatNode(c)).join(',') + '}'
    }
    if (node.type === 'string') return '"' + node.value.replace(/"/g, '""') + '"'
    return node.value
  }

  return topLevel.map(b => formatNode(b)).join(',')
}

export interface BlockStatistics {
  topLevelBlocks: number
  totalBlocks: number
  maxDepth: number
  totalValues: number
  stringCount: number
  numberCount: number
  identifierCount: number
}

export function blockStats(input: string): BlockStatistics {
  const { topLevel } = parseBlocks(input)
  const stats: BlockStatistics = {
    topLevelBlocks: topLevel.length,
    totalBlocks: 0,
    maxDepth: 0,
    totalValues: 0,
    stringCount: 0,
    numberCount: 0,
    identifierCount: 0,
  }

  function walk(nodes: BlockChild[], depth: number): void {
    for (const node of nodes) {
      if (node.type === 'block') {
        stats.totalBlocks++
        stats.maxDepth = Math.max(stats.maxDepth, depth + 1)
        walk(node.children, depth + 1)
      } else if (node.type === 'string') {
        stats.stringCount++
        stats.totalValues++
      } else if (node.type === 'number') {
        stats.numberCount++
        stats.totalValues++
      } else {
        stats.identifierCount++
        stats.totalValues++
      }
    }
  }

  for (const block of topLevel) {
    stats.totalBlocks++
    stats.maxDepth = Math.max(stats.maxDepth, 1)
    walk(block.children, 1)
  }

  return stats
}

export function extractEmbeddedJSON(input: string): string[] {
  const { topLevel } = parseBlocks(input)
  const results: string[] = []

  function walk(nodes: BlockChild[]): void {
    for (const node of nodes) {
      if (node.type === 'string') {
        const trimmed = node.value.trim()
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            const parsed = JSON.parse(trimmed)
            results.push(JSON.stringify(parsed, null, 2))
          } catch {
            // not valid JSON, skip
          }
        }
      }
      if (node.type === 'block') {
        walk(node.children)
      }
    }
  }

  for (const block of topLevel) {
    walk(block.children)
  }

  return results
}

export function splitBlocks(input: string): string[] {
  const { topLevel } = parseBlocks(input)

  function formatNode(node: BlockChild): string {
    if (node.type === 'block') {
      return '{' + node.children.map(c => formatNode(c)).join(',') + '}'
    }
    if (node.type === 'string') return '"' + node.value.replace(/"/g, '""') + '"'
    return node.value
  }

  return topLevel.map(b => formatNode(b))
}

const LOG_FIELD_NAMES_COUNT = 19

const LGF_REF_INDICES = new Set([3, 4, 5, 7, 10, 13, 14, 15])

function formatNodeRaw(node: BlockChild): string {
  if (node.type === 'block') {
    return '{' + node.children.map(c => formatNodeRaw(c)).join(',') + '}'
  }
  if (node.type === 'string') return '"' + node.value.replace(/"/g, '""') + '"'
  return node.value
}

export function logFieldsList(input: string, fieldNames: string[], unknownLabel: string, headerComment: string): string {
  const { topLevel } = parseBlocks(input)
  if (topLevel.length === 0) return ''

  const block = topLevel[0]
  const lines: string[] = [headerComment, '']

  const maxNum = String(block.children.length).length
  const maxName = block.children.reduce((max, _child, i) => {
    const baseName = i < LOG_FIELD_NAMES_COUNT
      ? fieldNames[i]
      : `${unknownLabel} ${i + 1}`
    const name = LGF_REF_INDICES.has(i) ? baseName + '*' : baseName
    return Math.max(max, name.length)
  }, 0)

  for (let i = 0; i < block.children.length; i++) {
    const child = block.children[i]
    const num = String(i + 1).padStart(maxNum)
    const baseName = i < LOG_FIELD_NAMES_COUNT
      ? fieldNames[i]
      : `${unknownLabel} ${i + 1}`
    const name = (LGF_REF_INDICES.has(i) ? baseName + '*' : baseName).padEnd(maxName)
    const value = formatNodeRaw(child)
    lines.push(`${num}  ${name}  ${value}`)
  }

  return lines.join('\n')
}

export function blocksToJSON(input: string): string {
  const { topLevel } = parseBlocks(input)

  function convert(node: BlockChild): unknown {
    if (node.type === 'number') return Number(node.value)
    if (node.type === 'string') return node.value
    if (node.type === 'identifier') return { type: 'identifier', value: node.value }
    return {
      type: 'block',
      children: node.children.map(c => convert(c)),
    }
  }

  if (topLevel.length === 1) {
    return JSON.stringify(convert(topLevel[0]), null, 2)
  }

  return JSON.stringify(topLevel.map(b => convert(b)), null, 2)
}
