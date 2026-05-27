import { describe, it, expect } from 'vitest'
import { getAllTools, getToolsByCategory } from '../src/tools/registry'

describe('tool registry', () => {
  it('returns all 6 tools', () => {
    const tools = getAllTools()
    expect(tools.length).toBe(6)
  })

  it('each tool has unique id', () => {
    const tools = getAllTools()
    const ids = tools.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups tools by category', () => {
    const groups = getToolsByCategory()
    expect(Object.keys(groups).sort()).toEqual(['analysis', 'dev', 'encoding', 'json', 'transform'].sort())
  })

  it('transform category has 2 tools', () => {
    const groups = getToolsByCategory()
    expect(groups['transform'].length).toBe(2)
  })

  it('analysis category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['analysis'].length).toBe(1)
  })

  it('encoding category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['encoding'].length).toBe(1)
  })

  it('dev category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['dev'].length).toBe(1)
  })
})
