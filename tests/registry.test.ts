import { describe, it, expect } from 'vitest'
import { getAllTools, getToolsByCategory, getToolById } from '../src/tools/registry'

describe('tool registry', () => {
  it('returns all 11 tools', () => {
    const tools = getAllTools()
    expect(tools.length).toBe(11)
  })

  it('each tool has unique id', () => {
    const tools = getAllTools()
    const ids = tools.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups tools by category', () => {
    const groups = getToolsByCategory()
    expect(Object.keys(groups).sort()).toEqual(['analysis', 'dev', 'encoding', 'json', 'transform', 'yaml'].sort())
  })

  it('transform category has 4 tools', () => {
    const groups = getToolsByCategory()
    expect(groups['transform'].length).toBe(4)
    expect(groups['transform'].some(tool => tool.id === 'list-converter')).toBe(true)
  })

  it('text-pad is a custom-view tool', () => {
    const tool = getToolById('text-pad')
    expect(tool).toBeDefined()
    expect(tool!.view).toBe('custom')
  })

  it('analysis category has 2 tools', () => {
    const groups = getToolsByCategory()
    expect(groups['analysis'].length).toBe(2)
    expect(groups['analysis'].some(tool => tool.id === 'text-diff')).toBe(true)
  })

  it('text-diff is a custom-view tool', () => {
    const tool = getToolById('text-diff')
    expect(tool).toBeDefined()
    expect(tool!.view).toBe('custom')
  })

  it('encoding category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['encoding'].length).toBe(1)
  })

  it('yaml category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['yaml'].length).toBe(1)
  })

  it('dev category has 2 tools', () => {
    const groups = getToolsByCategory()
    expect(groups['dev'].length).toBe(2)
  })
})
