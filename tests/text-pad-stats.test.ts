import { describe, it, expect } from 'vitest'
import {
  getTextPadStats,
  LIVE_DETAILED_STATS_LIMIT_CHARS,
} from '../src/tools/views/textPadStats'

describe('getTextPadStats', () => {
  it('exposes the live detailed stats limit constant', () => {
    expect(LIVE_DETAILED_STATS_LIMIT_CHARS).toBe(500_000)
  })

  it('handles empty string', () => {
    expect(getTextPadStats('')).toEqual({
      chars: 0,
      lines: 0,
      words: 0,
      paragraphs: 0,
      detailedStatsDisabled: false,
    })
  })

  it('counts a single line', () => {
    expect(getTextPadStats('hello world')).toEqual({
      chars: 11,
      lines: 1,
      words: 2,
      paragraphs: 1,
      detailedStatsDisabled: false,
    })
  })

  it('counts multiple lines as one paragraph', () => {
    expect(getTextPadStats('a\nb\nc')).toEqual({
      chars: 5,
      lines: 3,
      words: 3,
      paragraphs: 1,
      detailedStatsDisabled: false,
    })
  })

  it('counts two paragraphs separated by a blank line', () => {
    expect(getTextPadStats('a\n\nb')).toEqual({
      chars: 4,
      lines: 3,
      words: 2,
      paragraphs: 2,
      detailedStatsDisabled: false,
    })
  })

  it('treats whitespace-only lines as paragraph separators', () => {
    expect(getTextPadStats('a\n   \nb')).toEqual({
      chars: 7,
      lines: 3,
      words: 2,
      paragraphs: 2,
      detailedStatsDisabled: false,
    })
  })

  it('handles whitespace-only input', () => {
    expect(getTextPadStats('   \n\t \n   ')).toEqual({
      chars: 10,
      lines: 3,
      words: 0,
      paragraphs: 0,
      detailedStatsDisabled: false,
    })
  })

  it('keeps detailed stats enabled at exactly the limit (boundary is > not >=)', () => {
    const input = 'x'.repeat(LIVE_DETAILED_STATS_LIMIT_CHARS)
    expect(input.length).toBe(LIVE_DETAILED_STATS_LIMIT_CHARS)
    const stats = getTextPadStats(input)
    expect(stats.detailedStatsDisabled).toBe(false)
    expect(stats.words).not.toBeNull()
    expect(stats.words).toBe(1)
    expect(stats.paragraphs).toBe(1)
  })

  it('disables detailed stats above the limit', () => {
    const input = 'x'.repeat(LIVE_DETAILED_STATS_LIMIT_CHARS + 1)
    expect(input.length).toBe(500_001)
    const stats = getTextPadStats(input)
    expect(stats.chars).toBe(500_001)
    expect(stats.lines).toBe(1)
    expect(stats.words).toBeNull()
    expect(stats.paragraphs).toBeNull()
    expect(stats.detailedStatsDisabled).toBe(true)
  })

  it('still counts chars and lines for a huge multi-line document', () => {
    const input = 'a\n'.repeat(300_000)
    expect(input.length).toBe(600_000)
    const stats = getTextPadStats(input)
    expect(stats.chars).toBe(600_000)
    expect(stats.lines).toBe(300_001)
    expect(stats.words).toBeNull()
    expect(stats.paragraphs).toBeNull()
    expect(stats.detailedStatsDisabled).toBe(true)
  })
})
