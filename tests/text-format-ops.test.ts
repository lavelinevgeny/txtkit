import { describe, it, expect } from 'vitest'
import { formatJson, minifyJson } from '../src/utils/text-format-ops'

describe('formatJson', () => {
  it('pretty-prints a compact object', () => {
    expect(formatJson('{"a":1,"b":2}')).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it('is idempotent on already pretty JSON', () => {
    const pretty = '{\n  "a": 1\n}'
    expect(formatJson(pretty)).toBe(pretty)
  })

  it('preserves nested structure', () => {
    expect(formatJson('{"a":{"b":[1,2]}}')).toBe('{\n  "a": {\n    "b": [\n      1,\n      2\n    ]\n  }\n}')
  })

  it('throws on invalid JSON', () => {
    expect(() => formatJson('{invalid}')).toThrow()
  })
})

describe('minifyJson', () => {
  it('minifies pretty JSON', () => {
    expect(minifyJson('{\n  "a": 1,\n  "b": 2\n}')).toBe('{"a":1,"b":2}')
  })

  it('is idempotent on already minified JSON', () => {
    const min = '{"a":1}'
    expect(minifyJson(min)).toBe(min)
  })

  it('throws on invalid JSON', () => {
    expect(() => minifyJson('{invalid}')).toThrow()
  })
})
