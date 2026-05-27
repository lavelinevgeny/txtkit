import { describe, it, expect } from 'vitest'
import { pluralRu } from '../src/i18n/plural'

describe('pluralRu', () => {
  it('returns form 0 for 1', () => {
    expect(pluralRu(1, ['слово', 'слова', 'слов'])).toBe('слово')
  })

  it('returns form 1 for 2-4', () => {
    expect(pluralRu(2, ['слово', 'слова', 'слов'])).toBe('слова')
    expect(pluralRu(3, ['слово', 'слова', 'слов'])).toBe('слова')
    expect(pluralRu(4, ['слово', 'слова', 'слов'])).toBe('слова')
  })

  it('returns form 2 for 5-20', () => {
    expect(pluralRu(5, ['слово', 'слова', 'слов'])).toBe('слов')
    expect(pluralRu(11, ['слово', 'слова', 'слов'])).toBe('слов')
    expect(pluralRu(20, ['слово', 'слова', 'слов'])).toBe('слов')
  })

  it('returns form 0 for 21', () => {
    expect(pluralRu(21, ['слово', 'слова', 'слов'])).toBe('слово')
  })

  it('returns form 1 for 22-24', () => {
    expect(pluralRu(22, ['слово', 'слова', 'слов'])).toBe('слова')
    expect(pluralRu(23, ['слово', 'слова', 'слов'])).toBe('слова')
    expect(pluralRu(24, ['слово', 'слова', 'слов'])).toBe('слова')
  })

  it('returns form 2 for 25-30', () => {
    expect(pluralRu(25, ['слово', 'слова', 'слов'])).toBe('слов')
    expect(pluralRu(30, ['слово', 'слова', 'слов'])).toBe('слов')
  })

  it('returns form 2 for 0', () => {
    expect(pluralRu(0, ['слово', 'слова', 'слов'])).toBe('слов')
  })

  it('returns form 2 for 111-114 (teens override)', () => {
    expect(pluralRu(111, ['слово', 'слова', 'слов'])).toBe('слов')
    expect(pluralRu(112, ['слово', 'слова', 'слов'])).toBe('слов')
  })
})
