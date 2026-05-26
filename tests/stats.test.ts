import { describe, it, expect } from 'vitest'
import { statsTool } from '../src/tools/stats'

describe('statsTool', () => {
  it('has correct id and category', () => {
    expect(statsTool.id).toBe('stats')
    expect(statsTool.category).toBe('analysis')
  })

  it('counts characters', () => {
    const results = statsTool.transform('hello')
    const r = results.find(r => r.label === 'Characters')
    expect(r!.value).toBe('5')
  })

  it('counts characters with spaces', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'Characters')
    expect(r!.value).toBe('11')
  })

  it('counts words', () => {
    const results = statsTool.transform('hello world example')
    const r = results.find(r => r.label === 'Words')
    expect(r!.value).toBe('3')
  })

  it('counts characters without spaces', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'No spaces')
    expect(r!.value).toBe('10')
  })

  it('counts lines', () => {
    const results = statsTool.transform('hello\nworld\nfoo')
    const r = results.find(r => r.label === 'Lines')
    expect(r!.value).toBe('3')
  })

  it('counts sentences', () => {
    const results = statsTool.transform('Hello. World! How are you?')
    const r = results.find(r => r.label === 'Sentences')
    expect(r!.value).toBe('3')
  })

  it('counts unique words', () => {
    const results = statsTool.transform('hello hello world')
    const r = results.find(r => r.label === 'Unique words')
    expect(r!.value).toBe('2')
  })

  it('counts bytes', () => {
    const results = statsTool.transform('hello')
    const r = results.find(r => r.label === 'Bytes (UTF-8)')
    expect(r!.value).toBe('5 B')
  })

  it('counts bytes with multibyte chars', () => {
    const results = statsTool.transform('привет')
    const r = results.find(r => r.label === 'Bytes (UTF-8)')
    expect(r!.value).toBe('12 B')
  })

  it('estimates reading time', () => {
    const words = 'word '.repeat(250).trim()
    const results = statsTool.transform(words)
    const r = results.find(r => r.label === 'Reading time')
    expect(r!.value).toBe('~1 min')
  })

  it('estimates short reading time', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'Reading time')
    expect(r!.value).toBe('~0 sec')
  })

  it('returns 8 metrics', () => {
    const results = statsTool.transform('hello')
    expect(results.length).toBe(8)
  })

  it('handles empty input', () => {
    const results = statsTool.transform('')
    expect(results).toEqual([])
  })
})
