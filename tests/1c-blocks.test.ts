import { describe, it, expect } from 'vitest'
import { blocksTool } from '../src/tools/1c-blocks'

describe('blocksTool', () => {
  it('has correct id and category', () => {
    expect(blocksTool.id).toBe('1c-blocks')
    expect(blocksTool.category).toBe('dev')
  })

  it('handles empty input', () => {
    expect(blocksTool.transform('')).toEqual([])
  })

  const sampleInput = `{20260416130000,N,
{0,0},2,1,2,38424377,1,W,"{""short_message"":""test""}",0,
{"U"},"",1,1,0,182954,0,
{0}
}`

  it('returns 9 transform results', () => {
    const results = blocksTool.transform(sampleInput)
    expect(results.length).toBe(9)
  })

  describe('Validate', () => {
    it('validates correct input', () => {
      const results = blocksTool.transform('{1,2,3}')
      const r = results.find(r => r.label === 'Validate')
      expect(r!.value).toContain('Valid')
    })

    it('reports errors for invalid input', () => {
      const results = blocksTool.transform('{1,{2}')
      const r = results.find(r => r.label === 'Validate')
      expect(r!.value).toContain('Error')
    })
  })

  describe('Pretty print', () => {
    it('pretty prints formatted output', () => {
      const results = blocksTool.transform('{1,2}')
      const r = results.find(r => r.label === 'Pretty print')
      expect(r!.value).toContain('\n')
    })
  })

  describe('Block count', () => {
    it('shows block statistics', () => {
      const results = blocksTool.transform(sampleInput)
      const r = results.find(r => r.label === 'Block count')
      expect(r!.value).toContain('Blocks:')
      expect(r!.value).toContain('Depth:')
    })
  })

  describe('To JSON', () => {
    it('converts to JSON', () => {
      const results = blocksTool.transform('{1,2}')
      const r = results.find(r => r.label === 'To JSON')
      const parsed = JSON.parse(r!.value)
      expect(parsed.children).toEqual([1, 2])
    })
  })

  describe('Extract JSON', () => {
    it('extracts embedded JSON', () => {
      const results = blocksTool.transform(sampleInput)
      const r = results.find(r => r.label === 'Extract JSON')
      expect(r!.value).toContain('short_message')
    })

    it('shows message when no JSON found', () => {
      const results = blocksTool.transform('{1,2,3}')
      const r = results.find(r => r.label === 'Extract JSON')
      expect(r!.value).toContain('No embedded JSON')
    })
  })

  describe('Minify', () => {
    it('minifies blocks', () => {
      const results = blocksTool.transform('{ 1 , 2 }')
      const r = results.find(r => r.label === 'Minify')
      expect(r!.value).toBe('{1,2}')
    })
  })

  describe('Split blocks', () => {
    it('splits multiple blocks', () => {
      const results = blocksTool.transform('{1},{2}')
      const r = results.find(r => r.label === 'Split blocks')
      expect(r!.value).toContain('Block 1')
      expect(r!.value).toContain('Block 2')
    })
  })

  describe('1C log tree', () => {
    it('returns tree result with AST data', () => {
      const results = blocksTool.transform('{1,{2}}')
      const r = results.find(r => r.label === '1C log tree')
      expect(r).toBeDefined()
      expect(r!.isTree).toBe(true)
      expect(r!.treeKey).toBe('1c-log-blocks')
      expect(r!.treeData).toBeDefined()
    })
  })

  describe('Log fields', () => {
    it('returns named fields list for valid log', () => {
      const results = blocksTool.transform(sampleInput)
      const r = results.find(r => r.label === 'Log fields')
      expect(r).toBeDefined()
      expect(r!.value).toContain('DateTime')
      expect(r!.value).toContain('20260416130000')
      expect(r!.value).toContain('TransactionStatus')
      expect(r!.value).toContain('UserID*')
      expect(r!.value).toContain('EventID*')
      expect(r!.value).toContain('1Cv8.lgf')
    })

    it('omits Log fields for invalid input', () => {
      const results = blocksTool.transform('{1,{2}')
      const r = results.find(r => r.label === 'Log fields')
      expect(r).toBeUndefined()
    })
  })

  describe('detect', () => {
    it('detects valid 1C blocks format', () => {
      const result = blocksTool.detect!(sampleInput)
      expect(result).not.toBeNull()
      expect(result!.type).toBe('1c-blocks')
      expect(result!.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('does not detect simple JSON', () => {
      const result = blocksTool.detect!('{"name":"test","age":30}')
      expect(result).toBeNull()
    })

    it('does not detect empty input', () => {
      const result = blocksTool.detect!('')
      expect(result).toBeNull()
    })
  })
})
