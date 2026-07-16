import { describe, it, expect } from 'vitest'
import { mermaidTool } from '../src/tools/mermaid'

describe('mermaidTool', () => {
  it('has correct id and category', () => {
    expect(mermaidTool.id).toBe('mermaid')
    expect(mermaidTool.category).toBe('dev')
  })

  it('is a custom-view tool', () => {
    expect(mermaidTool.view).toBe('custom')
  })

  it('has a description', () => {
    expect(mermaidTool.description).toBeTruthy()
  })

  it('has features', () => {
    expect(mermaidTool.features).toBeDefined()
    expect(mermaidTool.features!.length).toBeGreaterThanOrEqual(2)
  })
})
