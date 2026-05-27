import { describe, it, expect } from 'vitest'
import {
  parseBlocks,
  prettyPrint,
  minifyBlocks,
  blockStats,
  extractEmbeddedJSON,
  splitBlocks,
  blocksToJSON,
  type BlockNode,
} from '../src/tools/1c-blocks-utils'

describe('parseBlocks', () => {
  it('parses a simple flat block', () => {
    const result = parseBlocks('{1,2,3}')
    expect(result.errors).toEqual([])
    const blocks = result.topLevel
    expect(blocks.length).toBe(1)
    const block = blocks[0] as BlockNode
    expect(block.type).toBe('block')
    expect(block.children.length).toBe(3)
    expect(block.children[0]).toEqual({ type: 'number', value: '1' })
    expect(block.children[1]).toEqual({ type: 'number', value: '2' })
    expect(block.children[2]).toEqual({ type: 'number', value: '3' })
  })

  it('parses nested blocks', () => {
    const result = parseBlocks('{1,{2,3},4}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children.length).toBe(3)
    expect((block.children[1] as BlockNode).type).toBe('block')
    expect((block.children[1] as BlockNode).children.length).toBe(2)
  })

  it('parses strings with escaped quotes', () => {
    const result = parseBlocks('{"hello ""world"""}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children[0]).toEqual({ type: 'string', value: 'hello "world"' })
  })

  it('parses identifiers', () => {
    const result = parseBlocks('{N,W,U}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children[0]).toEqual({ type: 'identifier', value: 'N' })
    expect(block.children[1]).toEqual({ type: 'identifier', value: 'W' })
    expect(block.children[2]).toEqual({ type: 'identifier', value: 'U' })
  })

  it('parses empty block', () => {
    const result = parseBlocks('{}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children.length).toBe(0)
  })

  it('parses multiple top-level blocks', () => {
    const result = parseBlocks('{1,2},\n{3,4}')
    expect(result.errors).toEqual([])
    expect(result.topLevel.length).toBe(2)
  })

  it('reports unmatched opening brace', () => {
    const result = parseBlocks('{1,{2}')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Unterminated')
  })

  it('reports unmatched closing brace', () => {
    const result = parseBlocks('{1}}')
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('reports unterminated string', () => {
    const result = parseBlocks('{"hello}')
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('handles trailing comma inside block', () => {
    const result = parseBlocks('{1,2,}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children.length).toBe(2)
  })

  it('handles empty string value', () => {
    const result = parseBlocks('{""}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    expect(block.children[0]).toEqual({ type: 'string', value: '' })
  })

  it('handles block with only a nested block', () => {
    const result = parseBlocks('{{"U"}}')
    expect(result.errors).toEqual([])
    const block = result.topLevel[0] as BlockNode
    const inner = block.children[0] as BlockNode
    expect(inner.type).toBe('block')
    expect(inner.children[0]).toEqual({ type: 'string', value: 'U' })
  })

  it('handles complex real-world input', () => {
    const input = `{20260416130000,N,
{0,0},2,1,2,38424377,1,W,"{""short_message"":""test""}",0,
{"U"},"",1,1,0,182954,0,
{0}
}`
    const result = parseBlocks(input)
    expect(result.errors).toEqual([])
    expect(result.topLevel.length).toBe(1)
    const block = result.topLevel[0] as BlockNode
    expect(block.children.length).toBeGreaterThan(5)
  })
})

describe('prettyPrint', () => {
  it('formats a flat block', () => {
    expect(prettyPrint('{1,2,3}')).toBe('{\n  1,\n  2,\n  3\n}')
  })

  it('formats nested blocks with indentation', () => {
    expect(prettyPrint('{1,{2,3}}')).toBe('{\n  1,\n  {\n    2,\n    3\n  }\n}')
  })

  it('formats strings preserving quotes', () => {
    expect(prettyPrint('{"hello"}')).toBe('{\n  "hello"\n}')
  })

  it('formats multiple top-level blocks', () => {
    const result = prettyPrint('{1},{2}')
    expect(result).toContain('{\n  1\n}')
    expect(result).toContain('{\n  2\n}')
  })
})

describe('minifyBlocks', () => {
  it('removes all whitespace', () => {
    expect(minifyBlocks('{ 1 , 2 , 3 }')).toBe('{1,2,3}')
  })

  it('minifies nested blocks', () => {
    expect(minifyBlocks('{ 1 , { 2 , 3 } }')).toBe('{1,{2,3}}')
  })

  it('preserves string content', () => {
    expect(minifyBlocks('{"hello world"}')).toBe('{"hello world"}')
  })
})

describe('blockStats', () => {
  it('counts top-level and nested blocks', () => {
    const stats = blockStats('{1,{2,{3}},{4}}')
    expect(stats.topLevelBlocks).toBe(1)
    expect(stats.totalBlocks).toBe(4)
    expect(stats.maxDepth).toBe(3)
    expect(stats.totalValues).toBe(4)
  })

  it('counts multiple top-level blocks', () => {
    const stats = blockStats('{1},{2}')
    expect(stats.topLevelBlocks).toBe(2)
    expect(stats.totalBlocks).toBe(2)
    expect(stats.maxDepth).toBe(1)
  })

  it('counts strings and identifiers', () => {
    const stats = blockStats('{N,"hello",1}')
    expect(stats.totalValues).toBe(3)
    expect(stats.stringCount).toBe(1)
    expect(stats.numberCount).toBe(1)
    expect(stats.identifierCount).toBe(1)
  })
})

describe('extractEmbeddedJSON', () => {
  it('extracts JSON strings from string values', () => {
    const input = `{1,W,"{""key"":""value""}"}`
    const results = extractEmbeddedJSON(input)
    expect(results.length).toBe(1)
    expect(results[0]).toContain('"key"')
    expect(results[0]).toContain('"value"')
  })

  it('returns empty array when no JSON found', () => {
    const results = extractEmbeddedJSON('{1,2,3}')
    expect(results).toEqual([])
  })

  it('extracts multiple JSON strings', () => {
    const input = `{W,"{""a"":1}"},\n{W,"{""b"":2}"}`
    const results = extractEmbeddedJSON(input)
    expect(results.length).toBe(2)
  })
})

describe('splitBlocks', () => {
  it('splits into individual top-level block strings', () => {
    const result = splitBlocks('{1,2},\n{3,4}')
    expect(result.length).toBe(2)
    expect(result[0]).toBe('{1,2}')
    expect(result[1]).toBe('{3,4}')
  })

  it('handles single block', () => {
    const result = splitBlocks('{1}')
    expect(result.length).toBe(1)
    expect(result[0]).toBe('{1}')
  })

  it('preserves strings with commas inside', () => {
    const result = splitBlocks('{"a,b"},{2}')
    expect(result.length).toBe(2)
    expect(result[0]).toBe('{"a,b"}')
  })
})

describe('blocksToJSON', () => {
  it('converts simple block to JSON', () => {
    const result = blocksToJSON('{1,2,3}')
    const parsed = JSON.parse(result)
    expect(parsed).toEqual({ type: 'block', children: [1, 2, 3] })
  })

  it('converts nested blocks', () => {
    const result = blocksToJSON('{1,{2}}')
    const parsed = JSON.parse(result)
    expect(parsed.children[1]).toEqual({ type: 'block', children: [2] })
  })

  it('converts strings and identifiers', () => {
    const result = blocksToJSON('{N,"hello"}')
    const parsed = JSON.parse(result)
    expect(parsed.children[0]).toEqual({ type: 'identifier', value: 'N' })
    expect(parsed.children[1]).toBe('hello')
  })

  it('handles multiple top-level blocks as array', () => {
    const result = blocksToJSON('{1},{2}')
    const parsed = JSON.parse(result)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
  })
})
