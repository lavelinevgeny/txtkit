import { describe, it, expect } from 'vitest'
import { jsonTool } from '../src/tools/json'

describe('jsonTool', () => {
  it('has correct id and category', () => {
    expect(jsonTool.id).toBe('json')
    expect(jsonTool.category).toBe('json')
  })

  it('handles empty input', () => {
    expect(jsonTool.transform('')).toEqual([])
  })

  describe('Validate', () => {
    it('validates valid JSON object', () => {
      const results = jsonTool.transform('{"a":1}')
      const r = results.find(r => r.label === 'Validate')
      expect(r!.value).toBe('Valid JSON')
    })

    it('validates valid JSON array', () => {
      const results = jsonTool.transform('[1,2,3]')
      const r = results.find(r => r.label === 'Validate')
      expect(r!.value).toBe('Valid JSON')
    })

    it('reports invalid JSON', () => {
      const results = jsonTool.transform('{invalid}')
      const r = results.find(r => r.label === 'Validate')
      expect(r!.value).toContain('Error')
    })
  })

  describe('Pretty print', () => {
    it('pretty prints JSON', () => {
      const results = jsonTool.transform('{"a":1,"b":2}')
      const r = results.find(r => r.label === 'Pretty print')
      expect(r!.value).toBe('{\n  "a": 1,\n  "b": 2\n}')
    })

    it('returns error for invalid JSON', () => {
      const results = jsonTool.transform('{bad}')
      const r = results.find(r => r.label === 'Pretty print')
      expect(r!.value).toContain('Error')
    })
  })

  describe('Minify', () => {
    it('minifies JSON', () => {
      const results = jsonTool.transform('{\n  "a": 1\n}')
      const r = results.find(r => r.label === 'Minify')
      expect(r!.value).toBe('{"a":1}')
    })
  })

  describe('Flatten', () => {
    it('flattens nested JSON', () => {
      const results = jsonTool.transform('{"a":{"b":1}}')
      const r = results.find(r => r.label === 'Flatten')
      expect(r!.value).toBe('{\n  "a.b": 1\n}')
    })
  })

  describe('Unflatten', () => {
    it('unflattens dot-notation JSON', () => {
      const results = jsonTool.transform('{"a.b":1}')
      const r = results.find(r => r.label === 'Unflatten')
      expect(r!.value).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
    })
  })

  describe('JSON → YAML', () => {
    it('converts JSON to YAML', () => {
      const results = jsonTool.transform('{"name":"test","count":5}')
      const r = results.find(r => r.label === 'JSON → YAML')
      expect(r!.value).toContain('name: test')
      expect(r!.value).toContain('count: 5')
    })

    it('returns error for invalid JSON', () => {
      const results = jsonTool.transform('{bad}')
      const r = results.find(r => r.label === 'JSON → YAML')
      expect(r!.value).toContain('Error')
    })
  })

  describe('YAML → JSON', () => {
    it('converts YAML to JSON', () => {
      const results = jsonTool.transform('name: test\ncount: 5')
      const r = results.find(r => r.label === 'YAML → JSON')
      expect(r!.value).toContain('"name": "test"')
      expect(r!.value).toContain('"count": 5')
    })
  })

  describe('Structure analysis', () => {
    it('analyzes JSON structure', () => {
      const results = jsonTool.transform('{"a":1,"b":"hello"}')
      const r = results.find(r => r.label === 'Structure')
      expect(r!.value).toContain('Ключей: 2')
    })
  })

  describe('JSON escape', () => {
    it('escapes string to JSON', () => {
      const results = jsonTool.transform('hello "world"')
      const r = results.find(r => r.label === 'JSON escape')
      expect(r!.value).toBe('"hello \\"world\\""')
    })
  })

  describe('JSON unescape', () => {
    it('unescapes JSON string', () => {
      const results = jsonTool.transform('"hello \\"world\\""')
      const r = results.find(r => r.label === 'JSON unescape')
      expect(r!.value).toBe('hello "world"')
    })
  })

  it('returns expected number of results for valid JSON', () => {
    const results = jsonTool.transform('{"a":1}')
    expect(results.length).toBe(10)
  })
})
