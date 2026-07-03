import { describe, it, expect } from 'vitest'
import {
  addPrefixSuffix,
  normalizeLineEndings,
  type LineEnding,
  regexReplaceAll,
  removeDuplicateLines,
  removeEmptyLines,
  shuffleLines,
  sortLines,
  trimLines,
} from '../src/utils/text-ops'

describe('removeDuplicateLines', () => {
  it('returns empty string unchanged', () => {
    expect(removeDuplicateLines('')).toBe('')
  })

  it('keeps a single line unchanged', () => {
    expect(removeDuplicateLines('only')).toBe('only')
  })

  it('removes consecutive duplicates', () => {
    expect(removeDuplicateLines('a\na\nb')).toBe('a\nb')
  })

  it('removes non-consecutive duplicates keeping first occurrence', () => {
    expect(removeDuplicateLines('a\nb\na\nc')).toBe('a\nb\nc')
  })
})

describe('sortLines', () => {
  it('returns empty string unchanged', () => {
    expect(sortLines('')).toBe('')
  })

  it('keeps a single line unchanged', () => {
    expect(sortLines('only')).toBe('only')
  })

  it('sorts lines using locale-aware order', () => {
    expect(sortLines('banana\napple\ncherry')).toBe('apple\nbanana\ncherry')
  })

  it('sorts cyrillic lines', () => {
    expect(sortLines('в\nа\nб')).toBe('а\nб\nв')
  })
})

describe('removeEmptyLines', () => {
  it('returns empty string unchanged', () => {
    expect(removeEmptyLines('')).toBe('')
  })

  it('removes whitespace-only lines', () => {
    expect(removeEmptyLines('a\n   \nb')).toBe('a\nb')
  })

  it('removes truly empty lines', () => {
    expect(removeEmptyLines('a\n\nb\n\n')).toBe('a\nb')
  })

  it('keeps lines with content', () => {
    expect(removeEmptyLines('keep\nme')).toBe('keep\nme')
  })
})

describe('trimLines', () => {
  it('returns empty string unchanged', () => {
    expect(trimLines('')).toBe('')
  })

  it('trims surrounding whitespace from each line', () => {
    expect(trimLines('  hi  \n  bye ')).toBe('hi\nbye')
  })

  it('leaves already trimmed lines unchanged', () => {
    expect(trimLines('hi\nbye')).toBe('hi\nbye')
  })
})

describe('shuffleLines', () => {
  it('returns empty string unchanged', () => {
    expect(shuffleLines('')).toBe('')
  })

  it('leaves a single line unchanged', () => {
    expect(shuffleLines('only')).toBe('only')
  })

  it('preserves the set of lines and count', () => {
    const input = 'a\nb\nc\nd\ne\nf\ng\nh'
    const out = shuffleLines(input)
    const outLines = out.split('\n')
    expect(outLines.length).toBe(8)
    expect(new Set(outLines)).toEqual(new Set(input.split('\n')))
  })
})

describe('addPrefixSuffix', () => {
  it('returns empty string unchanged with default opts', () => {
    expect(addPrefixSuffix('', {})).toBe('')
  })

  it('adds prefix only', () => {
    expect(addPrefixSuffix('a\nb', { prefix: '> ' })).toBe('> a\n> b')
  })

  it('adds suffix only', () => {
    expect(addPrefixSuffix('a\nb', { suffix: ';' })).toBe('a;\nb;')
  })

  it('adds both prefix and suffix', () => {
    expect(addPrefixSuffix('a\nb', { prefix: '<', suffix: '>' })).toBe('<a>\n<b>')
  })

  it('defaults to no prefix and no suffix', () => {
    expect(addPrefixSuffix('a\nb', {})).toBe('a\nb')
  })
})

describe('normalizeLineEndings', () => {
  it('keeps LF as LF', () => {
    expect(normalizeLineEndings('a\nb\nc', 'LF')).toBe('a\nb\nc')
  })

  it('converts CRLF input to LF when target is LF', () => {
    expect(normalizeLineEndings('a\r\nb\r\nc', 'LF')).toBe('a\nb\nc')
  })

  it('normalizes mixed line endings to LF', () => {
    const target: LineEnding = 'LF'
    expect(normalizeLineEndings('a\r\nb\rc\nd', target)).toBe('a\nb\nc\nd')
  })

  it('converts LF input to CRLF when target is CRLF', () => {
    expect(normalizeLineEndings('a\nb\nc', 'CRLF')).toBe('a\r\nb\r\nc')
  })

  it('normalizes mixed line endings to CRLF', () => {
    expect(normalizeLineEndings('a\r\nb\rc\nd', 'CRLF')).toBe('a\r\nb\r\nc\r\nd')
  })
})

describe('regexReplaceAll', () => {
  it('adds global flag for RegExp without g', () => {
    expect(regexReplaceAll('a1b2', /\d/, 'X')).toBe('aXbX')
  })

  it('works with RegExp that already has g flag', () => {
    expect(regexReplaceAll('a1b2', /\d/g, 'X')).toBe('aXbX')
  })

  it('works with string pattern', () => {
    expect(regexReplaceAll('a1b2', '\\d', 'X')).toBe('aXbX')
  })

  it('returns input unchanged when no matches', () => {
    expect(regexReplaceAll('abc', /\d/, 'X')).toBe('abc')
  })

  it('preserves other flags like case-insensitivity', () => {
    expect(regexReplaceAll('aAbB', /a/i, 'X')).toBe('XXbB')
  })

  it('supports replacement patterns', () => {
    expect(regexReplaceAll('hello world', /(\w+)\s(\w+)/, '$2 $1')).toBe('world hello')
  })
})
