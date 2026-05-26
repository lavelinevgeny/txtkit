import { describe, it, expect } from 'vitest'
import { flattenJson, unflattenJson, analyzeStructure } from '../src/tools/json-utils'

describe('flattenJson', () => {
  it('flattens nested object', () => {
    expect(flattenJson({ a: { b: { c: 1 } } })).toEqual({ 'a.b.c': 1 })
  })

  it('flattens object with arrays', () => {
    expect(flattenJson({ a: { b: [1, 2] } })).toEqual({ 'a.b.0': 1, 'a.b.1': 2 })
  })

  it('handles flat object', () => {
    expect(flattenJson({ a: 1, b: 'hello' })).toEqual({ a: 1, b: 'hello' })
  })

  it('handles empty object', () => {
    expect(flattenJson({})).toEqual({})
  })
})

describe('unflattenJson', () => {
  it('unflattens dot-notation keys', () => {
    expect(unflattenJson({ 'a.b.c': 1 })).toEqual({ a: { b: { c: 1 } } })
  })

  it('unflattens with array indices', () => {
    expect(unflattenJson({ 'a.0': 'x', 'a.1': 'y' })).toEqual({ a: ['x', 'y'] })
  })

  it('handles flat keys', () => {
    expect(unflattenJson({ a: 1, b: 'hello' })).toEqual({ a: 1, b: 'hello' })
  })

  it('handles empty object', () => {
    expect(unflattenJson({})).toEqual({})
  })
})

describe('analyzeStructure', () => {
  it('analyzes simple object', () => {
    const result = analyzeStructure({ name: 'test', count: 5, active: true })
    expect(result.keyCount).toBe(3)
    expect(result.maxDepth).toBe(1)
    expect(result.types).toContain('string')
    expect(result.types).toContain('number')
    expect(result.types).toContain('boolean')
  })

  it('analyzes nested object depth', () => {
    const result = analyzeStructure({ a: { b: { c: 1 } } })
    expect(result.maxDepth).toBe(3)
    expect(result.keyCount).toBe(3)
  })

  it('counts array elements', () => {
    const result = analyzeStructure({ items: [1, 2, 3] })
    expect(result.arrayCount).toBe(1)
    expect(result.totalElements).toBe(3)
  })

  it('handles empty object', () => {
    const result = analyzeStructure({})
    expect(result.keyCount).toBe(0)
    expect(result.maxDepth).toBe(1)
  })

  it('handles top-level array', () => {
    const result = analyzeStructure([1, 'two', true])
    expect(result.isArray).toBe(true)
    expect(result.totalElements).toBe(3)
  })

  it('formats report string', () => {
    const result = analyzeStructure({ a: 1 })
    expect(result.report).toContain('1')
    expect(result.report).toContain('Ключей')
  })
})
