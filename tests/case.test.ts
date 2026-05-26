import { describe, it, expect } from 'vitest'
import { caseTool } from '../src/tools/case'

describe('caseTool', () => {
  it('has correct id and category', () => {
    expect(caseTool.id).toBe('case')
    expect(caseTool.category).toBe('transform')
  })

  it('converts multi-word to all 17 formats', () => {
    const results = caseTool.transform('hello world example')
    expect(results.length).toBe(17)
  })

  it('converts to camelCase', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'camelCase')
    expect(r!.value).toBe('helloWorldExample')
  })

  it('converts to PascalCase', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'PascalCase')
    expect(r!.value).toBe('HelloWorldExample')
  })

  it('converts to snake_case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'snake_case')
    expect(r!.value).toBe('hello_world_example')
  })

  it('converts to kebab-case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'kebab-case')
    expect(r!.value).toBe('hello-world-example')
  })

  it('converts to SCREAMING_SNAKE_CASE', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'SCREAMING_SNAKE_CASE')
    expect(r!.value).toBe('HELLO_WORLD_EXAMPLE')
  })

  it('converts to Title Case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Title Case')
    expect(r!.value).toBe('Hello World Example')
  })

  it('converts to Sentence case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Sentence case')
    expect(r!.value).toBe('Hello world example')
  })

  it('converts to dot.case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'dot.case')
    expect(r!.value).toBe('hello.world.example')
  })

  it('converts to path/case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'path/case')
    expect(r!.value).toBe('hello/world/example')
  })

  it('converts to Train-Case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Train-Case')
    expect(r!.value).toBe('Hello-World-Example')
  })

  it('converts to UPPER', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'UPPER')
    expect(r!.value).toBe('HELLO WORLD EXAMPLE')
  })

  it('converts to lower', () => {
    const results = caseTool.transform('HELLO WORLD EXAMPLE')
    const r = results.find(r => r.label === 'lower')
    expect(r!.value).toBe('hello world example')
  })

  it('converts to Alternating', () => {
    const results = caseTool.transform('hello')
    const r = results.find(r => r.label === 'Alternating')
    expect(r!.value).toBe('hElLo')
  })

  it('converts to Inverse', () => {
    const results = caseTool.transform('Hello World')
    const r = results.find(r => r.label === 'Inverse')
    expect(r!.value).toBe('hELLO wORLD')
  })

  it('handles camelCase input', () => {
    const results = caseTool.transform('helloWorldExample')
    const r = results.find(r => r.label === 'snake_case')
    expect(r!.value).toBe('hello_world_example')
  })

  it('handles snake_case input', () => {
    const results = caseTool.transform('hello_world_example')
    const r = results.find(r => r.label === 'camelCase')
    expect(r!.value).toBe('helloWorldExample')
  })

  it('handles single word', () => {
    const results = caseTool.transform('hello')
    expect(results.length).toBe(17)
    const upper = results.find(r => r.label === 'UPPER')
    expect(upper!.value).toBe('HELLO')
  })
})
