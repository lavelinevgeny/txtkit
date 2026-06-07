import { describe, it, expect } from 'vitest'
import { detectInputTypes } from '../src/tools/detect'

describe('detectInputTypes', () => {
  it('detects Base64', () => {
    const results = detectInputTypes('SGVsbG8gV29ybGQ=')
    const b64 = results.find(r => r.type === 'base64')
    expect(b64).toBeDefined()
    expect(b64!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('detects URL-encoded text', () => {
    const results = detectInputTypes('hello%20world%21')
    const url = results.find(r => r.type === 'url-encoded')
    expect(url).toBeDefined()
  })

  it('detects HTML entities', () => {
    const results = detectInputTypes('&lt;div&gt;hello&lt;/div&gt;')
    const html = results.find(r => r.type === 'html-entities')
    expect(html).toBeDefined()
  })

  it('detects JSON object', () => {
    const results = detectInputTypes('{"name":"John","age":30}')
    const json = results.find(r => r.type === 'json')
    expect(json).toBeDefined()
  })

  it('detects JSON array', () => {
    const results = detectInputTypes('[1,2,3]')
    const json = results.find(r => r.type === 'json')
    expect(json).toBeDefined()
  })

  it('detects camelCase', () => {
    const results = detectInputTypes('helloWorldExample')
    const camel = results.find(r => r.type === 'camelCase')
    expect(camel).toBeDefined()
  })

  it('detects PascalCase', () => {
    const results = detectInputTypes('HelloWorldExample')
    const pascal = results.find(r => r.type === 'PascalCase')
    expect(pascal).toBeDefined()
  })

  it('detects snake_case', () => {
    const results = detectInputTypes('hello_world_example')
    const snake = results.find(r => r.type === 'snake_case')
    expect(snake).toBeDefined()
  })

  it('detects kebab-case', () => {
    const results = detectInputTypes('hello-world-example')
    const kebab = results.find(r => r.type === 'kebab-case')
    expect(kebab).toBeDefined()
  })

  it('detects multi-word space-separated', () => {
    const results = detectInputTypes('hello world example')
    const multi = results.find(r => r.type === 'multi-word')
    expect(multi).toBeDefined()
  })

  it('detects single word as fallback', () => {
    const results = detectInputTypes('hello')
    const single = results.find(r => r.type === 'single-word')
    expect(single).toBeDefined()
  })

  it('returns results sorted by confidence descending', () => {
    const results = detectInputTypes('SGVsbG8gV29ybGQ=')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence)
    }
  })

  it('returns multi-detection for ambiguous input', () => {
    const results = detectInputTypes('hello_world example')
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('returns empty array for empty input', () => {
    const results = detectInputTypes('')
    expect(results).toEqual([])
  })

  it('detects YAML', () => {
    const results = detectInputTypes('name: test\ncount: 5')
    const yaml = results.find(r => r.type === 'yaml')
    expect(yaml).toBeDefined()
    expect(yaml!.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('does not detect JSON object as YAML', () => {
    const results = detectInputTypes('{"name":"test"}')
    const yaml = results.find(r => r.type === 'yaml')
    expect(yaml).toBeUndefined()
  })

  it('detects 1C Blocks format', () => {
    const input = `{20260416130000,N,\n{0,0},2,1,2,38424377,1,W,"{""key"":""val""}",0,\n{"U"},"",1,1,0,182954,0,\n{0}\n}`
    const results = detectInputTypes(input)
    const blocks = results.find(r => r.type === '1c-blocks')
    expect(blocks).toBeDefined()
    expect(blocks!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('does not detect JSON object as 1C Blocks', () => {
    const results = detectInputTypes('{"name":"test","age":30}')
    const blocks = results.find(r => r.type === '1c-blocks')
    expect(blocks).toBeUndefined()
  })

  it('detects a list when at least half of non-empty lines are marked', () => {
    const results = detectInputTypes('1. First\nSecond continuation\n- Third\nFourth')
    expect(results.find(r => r.type === 'list')).toBeDefined()
  })

  it('does not detect an ordinary multiline text as a list', () => {
    const results = detectInputTypes('First line\nSecond line\nThird line')
    expect(results.find(r => r.type === 'list')).toBeUndefined()
  })

  it('does not detect a single marked line as a list', () => {
    const results = detectInputTypes('- First\nSecond\nThird')
    expect(results.find(r => r.type === 'list')).toBeUndefined()
  })
})
