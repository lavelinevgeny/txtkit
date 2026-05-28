import { lintJson } from '../src/tools/json-utils'
import { jsonTool } from '../src/tools/json'

describe('lintJson', () => {
  it('returns valid for correct JSON', () => {
    const result = lintJson('{"a":1}')
    expect(result).toBe('Valid JSON')
  })

  it('returns valid for correct JSON array', () => {
    const result = lintJson('[1,2,3]')
    expect(result).toBe('Valid JSON')
  })

  it('shows error with position for syntax error', () => {
    const result = lintJson('{"a": }')
    expect(result).toContain('Error')
    expect(result).toContain('Position')
  })

  it('detects unclosed bracket', () => {
    const result = lintJson('{"a": 1')
    expect(result).toContain('Error')
  })

  it('detects unexpected closing bracket', () => {
    const result = lintJson('{"a": 1}}')
    expect(result).toContain('Error')
  })

  it('detects bad unicode escape sequences', () => {
    const result = lintJson('{"text": "\\d83d\\de2d"}')
    expect(result).toContain('Error')
    expect(result).toContain('Unicode')
  })

  it('detects truncated \\uXXXX sequences', () => {
    const result = lintJson('{"text": "\\u004"}')
    expect(result).toContain('Error')
    expect(result).toContain('Unicode')
  })

  it('includes context snippet with pointer', () => {
    const result = lintJson('{"a": }')
    expect(result).toContain('^')
  })

  it('detects double-escaped JSON hint', () => {
    const input = '"{""a"":""b"",""c"":""d"",""e"":""f""}"'
    const result = lintJson(input)
    expect(result).toContain('double escaping')
  })
})

describe('jsonTool Lint transform', () => {
  it('includes Lint in results', () => {
    const results = jsonTool.transform('{"a":1}')
    const lint = results.find(r => r.label === 'Lint')
    expect(lint).toBeDefined()
    expect(lint!.value).toBe('Valid JSON')
  })

  it('Lint shows error details for invalid JSON', () => {
    const results = jsonTool.transform('{"a": }')
    const lint = results.find(r => r.label === 'Lint')
    expect(lint).toBeDefined()
    expect(lint!.value).toContain('Error')
  })

  it('increases total results count to 12', () => {
    const results = jsonTool.transform('{"a":1}')
    expect(results.length).toBe(12)
  })
})
