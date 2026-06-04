import { describe, it, expect } from 'vitest'
import { yamlTool } from '../src/tools/yaml'

describe('yamlTool', () => {
  it('has correct id and category', () => {
    expect(yamlTool.id).toBe('yaml')
    expect(yamlTool.category).toBe('yaml')
  })

  it('handles empty input', () => {
    expect(yamlTool.transform('')).toEqual([])
  })

  describe('Validate', () => {
    it('validates a valid YAML mapping', () => {
      const results = yamlTool.transform('name: test\ncount: 5')
      const result = results.find(r => r.label === 'Validate')
      expect(result!.value).toBe('Valid YAML')
    })

    it('validates a valid YAML scalar', () => {
      const results = yamlTool.transform('hello')
      const result = results.find(r => r.label === 'Validate')
      expect(result!.value).toBe('Valid YAML')
    })

    it('reports invalid YAML with location details', () => {
      const results = yamlTool.transform('name: test\n  bad: nope')
      const result = results.find(r => r.label === 'Validate')
      expect(result!.value).toContain('Error')
      expect(result!.value).toContain('invalid YAML')
      expect(result!.value).toContain('Line')
      expect(result!.value).toContain('column')
    })
  })

  describe('Pretty print', () => {
    it('normalizes valid YAML', () => {
      const results = yamlTool.transform('name: test\nitems:\n- one\n- two')
      const result = results.find(r => r.label === 'Pretty print')
      expect(result!.value).toContain('name: test')
      expect(result!.value).toContain('items:')
      expect(result!.value).toContain('- one')
    })
  })

  describe('YAML → JSON', () => {
    it('converts YAML to JSON', () => {
      const results = yamlTool.transform('name: test\ncount: 5')
      const result = results.find(r => r.label === 'YAML → JSON')
      expect(result!.value).toContain('"name": "test"')
      expect(result!.value).toContain('"count": 5')
    })
  })

  describe('Structure', () => {
    it('analyzes YAML mappings', () => {
      const results = yamlTool.transform('name: test\ncount: 5')
      const result = results.find(r => r.label === 'Structure')
      expect(result!.value).toContain('Keys: 2')
    })

    it('describes YAML scalars without tree results', () => {
      const results = yamlTool.transform('hello')
      const result = results.find(r => r.label === 'Structure')
      expect(result!.value).toBe('Format: scalar (string)')
      expect(results.some(r => r.label === 'YAML tree')).toBe(false)
    })
  })

  it('includes YAML tree for structured YAML', () => {
    const results = yamlTool.transform('name: test\ncount: 5')
    const result = results.find(r => r.label === 'YAML tree')
    expect(result).toBeDefined()
    expect(result!.isTree).toBe(true)
    expect(result!.treeKey).toBe('yaml')
    expect(result!.treeData).toEqual({ name: 'test', count: 5 })
  })

  it('handles circular YAML aliases without crashing', () => {
    const results = yamlTool.transform('a: &a\n  b: *a')
    const validate = results.find(r => r.label === 'Validate')
    const yamlToJson = results.find(r => r.label === 'YAML → JSON')
    const structure = results.find(r => r.label === 'Structure')

    expect(validate!.value).toBe('Valid YAML')
    expect(yamlToJson!.value).toContain('circular references')
    expect(structure!.value).toContain('circular references')
    expect(results.some(r => r.label === 'YAML tree')).toBe(false)
  })
})
