import { describe, it, expect } from 'vitest'
import { encodeTool } from '../src/tools/encode'

describe('encodeTool', () => {
  it('has correct id and category', () => {
    expect(encodeTool.id).toBe('encode')
    expect(encodeTool.category).toBe('encoding')
  })

  it('encodes to Base64', () => {
    const results = encodeTool.transform('hello')
    const r = results.find(r => r.label === 'Base64 encode')
    expect(r!.value).toBe('aGVsbG8=')
  })

  it('decodes from Base64', () => {
    const results = encodeTool.transform('aGVsbG8=')
    const r = results.find(r => r.label === 'Base64 decode')
    expect(r!.value).toBe('hello')
  })

  it('URL-encodes', () => {
    const results = encodeTool.transform('hello world')
    const r = results.find(r => r.label === 'URL encode')
    expect(r!.value).toBe('hello%20world')
  })

  it('URL-decodes', () => {
    const results = encodeTool.transform('hello%20world')
    const r = results.find(r => r.label === 'URL decode')
    expect(r!.value).toBe('hello world')
  })

  it('HTML-escapes', () => {
    const results = encodeTool.transform('<div>hello</div>')
    const r = results.find(r => r.label === 'HTML escape')
    expect(r!.value).toBe('&lt;div&gt;hello&lt;/div&gt;')
  })

  it('HTML-unescapes', () => {
    const results = encodeTool.transform('&lt;div&gt;hello&lt;/div&gt;')
    const r = results.find(r => r.label === 'HTML unescape')
    expect(r!.value).toBe('<div>hello</div>')
  })

  it('returns 8 encode/decode results', () => {
    const results = encodeTool.transform('hello')
    expect(results.length).toBe(8)
  })

  it('handles empty input', () => {
    expect(encodeTool.transform('')).toEqual([])
  })

  it('Base64 decode returns error for invalid input', () => {
    const results = encodeTool.transform('not-valid-base64!!!')
    const r = results.find(r => r.label === 'Base64 decode')
    expect(r!.value).toContain('Error')
  })
})
