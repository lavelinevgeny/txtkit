import { describe, it, expect } from 'vitest'
import { diffRows, diffStats, type DiffRow } from '../src/utils/text-diff-ops'

const text = (segs: DiffRow['left']) => (segs === null ? null : segs.map((s) => s.text).join(''))

describe('diffRows', () => {
  it('returns no rows for two empty texts', () => {
    expect(diffRows('', '')).toEqual([])
  })

  it('marks identical lines as equal', () => {
    const rows = diffRows('a\nb', 'a\nb')
    expect(rows.map((r) => r.op)).toEqual(['equal', 'equal'])
    expect(text(rows[0].left)).toBe('a')
    expect(text(rows[0].right)).toBe('a')
  })

  it('marks an added line with a gap on the left', () => {
    const rows = diffRows('a', 'a\nb')
    const added = rows.find((r) => r.op === 'add')!
    expect(added.left).toBeNull()
    expect(text(added.right)).toBe('b')
  })

  it('marks a removed line with a gap on the right', () => {
    const rows = diffRows('a\nb', 'a')
    const removed = rows.find((r) => r.op === 'remove')!
    expect(text(removed.left)).toBe('b')
    expect(removed.right).toBeNull()
  })

  it('pairs a removed+added line into a single replace row', () => {
    const rows = diffRows('hello', 'world')
    expect(rows).toHaveLength(1)
    expect(rows[0].op).toBe('replace')
    expect(text(rows[0].left)).toBe('hello')
    expect(text(rows[0].right)).toBe('world')
  })

  it('respects ignoreCase', () => {
    const rows = diffRows('Hello', 'hello', { ignoreCase: true })
    expect(rows.every((r) => r.op === 'equal')).toBe(true)
  })

  it('respects ignoreWhitespace (leading/trailing)', () => {
    const rows = diffRows('  a b  ', 'a b', { ignoreWhitespace: true })
    expect(rows.every((r) => r.op === 'equal')).toBe(true)
  })

  it('produces word-level segments when wordLevel is on', () => {
    const rows = diffRows('the quick fox', 'the slow fox', { wordLevel: true })
    const row = rows[0]
    expect(row.op).toBe('replace')
    const changedLeft = row.left!.filter((s) => s.changed).map((s) => s.text)
    const changedRight = row.right!.filter((s) => s.changed).map((s) => s.text)
    expect(changedLeft.join('')).toContain('quick')
    expect(changedRight.join('')).toContain('slow')
    // unchanged words stay unchanged
    expect(row.left!.some((s) => !s.changed && s.text.includes('the'))).toBe(true)
  })

  it('keeps whole lines as single unchanged segment without wordLevel', () => {
    const rows = diffRows('the quick fox', 'the slow fox')
    expect(rows[0].left).toEqual([{ text: 'the quick fox', changed: false }])
  })
})

describe('diffStats', () => {
  it('counts adds, removes and changes', () => {
    const rows = diffRows('a\nold\nc\nd', 'a\nnew\nc')
    const stats = diffStats(rows)
    expect(stats.changed).toBe(1)
    expect(stats.removed).toBe(1)
    expect(stats.added).toBe(0)
  })

  it('counts contiguous non-equal runs as blocks', () => {
    const rows = diffRows('a\nX\nc\nY', 'a\nP\nc\nQ')
    // two separate difference blocks (line 2 and line 4)
    expect(diffStats(rows).blocks).toBe(2)
  })

  it('reports zero blocks for identical texts', () => {
    expect(diffStats(diffRows('a\nb', 'a\nb')).blocks).toBe(0)
  })
})
