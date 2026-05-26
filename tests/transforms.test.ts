import { describe, it, expect } from 'vitest'
import { transformsTool } from '../src/tools/transforms'

describe('transformsTool', () => {
  it('has correct id and category', () => {
    expect(transformsTool.id).toBe('transforms')
    expect(transformsTool.category).toBe('transform')
  })

  it('reverses text', () => {
    const results = transformsTool.transform('hello')
    const r = results.find(r => r.label === 'Reverse')
    expect(r!.value).toBe('olleh')
  })

  it('trims whitespace', () => {
    const results = transformsTool.transform('  hello  world  ')
    const r = results.find(r => r.label === 'Trim')
    expect(r!.value).toBe('hello  world')
  })

  it('capitalizes first letter', () => {
    const results = transformsTool.transform('hello world')
    const r = results.find(r => r.label === 'Capitalize')
    expect(r!.value).toBe('Hello World')
  })

  it('uncapitalizes', () => {
    const results = transformsTool.transform('HELLO WORLD')
    const r = results.find(r => r.label === 'Uncapitalize')
    expect(r!.value).toBe('hello world')
  })

  it('slugifies', () => {
    const results = transformsTool.transform('Hello World! Example #1')
    const r = results.find(r => r.label === 'Slugify')
    expect(r!.value).toBe('hello-world-example-1')
  })

  it('removes duplicate lines', () => {
    const results = transformsTool.transform('hello\nworld\nhello\nfoo')
    const r = results.find(r => r.label === 'Remove duplicates')
    expect(r!.value).toBe('hello\nworld\nfoo')
  })

  it('sorts lines', () => {
    const results = transformsTool.transform('cherry\napple\nbanana')
    const r = results.find(r => r.label === 'Sort lines')
    expect(r!.value).toBe('apple\nbanana\ncherry')
  })

  it('converts to leet speak', () => {
    const results = transformsTool.transform('hello')
    const r = results.find(r => r.label === 'Leet speak')
    expect(r!.value).toBe('h3ll0')
  })

  it('converts to morse code', () => {
    const results = transformsTool.transform('SOS')
    const r = results.find(r => r.label === 'Morse code')
    expect(r!.value).toBe('... --- ...')
  })

  it('converts to binary', () => {
    const results = transformsTool.transform('A')
    const r = results.find(r => r.label === 'Binary')
    expect(r!.value).toBe('01000001')
  })

  it('returns 10 transforms', () => {
    const results = transformsTool.transform('hello')
    expect(results.length).toBe(10)
  })

  it('handles empty input', () => {
    expect(transformsTool.transform('')).toEqual([])
  })
})
