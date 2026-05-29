import { describe, expect, it } from 'vitest'
import { getUtf8ByteLength, MAX_INPUT_BYTES, truncateUtf8ByBytes } from '../src/utils/text-limit'

describe('getUtf8ByteLength', () => {
  it('counts ascii bytes', () => {
    expect(getUtf8ByteLength('hello')).toBe(5)
  })

  it('counts multibyte utf-8 text', () => {
    expect(getUtf8ByteLength('привет')).toBe(12)
    expect(getUtf8ByteLength('🙂')).toBe(4)
  })
})

describe('truncateUtf8ByBytes', () => {
  it('leaves text unchanged when within the limit', () => {
    expect(truncateUtf8ByBytes('hello', MAX_INPUT_BYTES)).toBe('hello')
  })

  it('truncates by utf-8 bytes without splitting characters', () => {
    expect(truncateUtf8ByBytes('ab🙂', 6)).toBe('ab🙂')
    expect(truncateUtf8ByBytes('ab🙂', 5)).toBe('ab')
  })

  it('truncates multibyte cyrillic text safely', () => {
    expect(truncateUtf8ByBytes('привет', 5)).toBe('пр')
  })
})