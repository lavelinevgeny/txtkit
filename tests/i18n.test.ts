import { describe, it, expect } from 'vitest'
import { pluralRu } from '../src/i18n/plural'
import { t } from '../src/i18n/context'
import en from '../src/i18n/locales/en.json'
import ru from '../src/i18n/locales/ru.json'

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

describe('locale files', () => {
  it('en and ru have identical keys', () => {
    const enKeys = Object.keys(en).sort()
    const ruKeys = Object.keys(ru).sort()
    expect(enKeys).toEqual(ruKeys)
  })

  it('all keys are non-empty in both locales', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v.length, `en key "${k}" is empty`).toBeGreaterThan(0)
    }
    for (const [k, v] of Object.entries(ru)) {
      expect(v.length, `ru key "${k}" is empty`).toBeGreaterThan(0)
    }
  })

  it('interpolation placeholders match between locales', () => {
    const placeholderRe = /\{(\w+)\}/g
    for (const [k, enVal] of Object.entries(en)) {
      const enPlaceholders = [...enVal.matchAll(placeholderRe)].map(m => m[1]).sort()
      const ruPlaceholders = [...ru[k].matchAll(placeholderRe)].map(m => m[1]).sort()
      expect(ruPlaceholders, `key "${k}" placeholder mismatch`).toEqual(enPlaceholders)
    }
  })
})

describe('t function', () => {
  it('returns translated string for valid key', () => {
    const result = t('smartInput.placeholder')
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  it('interpolates parameters', () => {
    const result = t('smartInput.lengthWarning', { max: 5000 })
    expect(result).toContain('5000')
  })

  it('returns key itself when not found', () => {
    const result = t('nonexistent.key.xyz')
    expect(result).toBe('nonexistent.key.xyz')
  })
})
