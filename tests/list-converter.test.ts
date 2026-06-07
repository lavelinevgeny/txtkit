import { describe, expect, it } from 'vitest'
import { hasListMarker, listConverterTool } from '../src/tools/list-converter'

function result(input: string, label: string): string {
  return listConverterTool.transform(input).find(item => item.label === label)!.value
}

describe('listConverterTool', () => {
  const mixedList = '1. First\n2) Second\n• Third\n- [x] Fourth'

  it('has the correct identity and category', () => {
    expect(listConverterTool.id).toBe('list-converter')
    expect(listConverterTool.category).toBe('transform')
  })

  it.each([
    '1. Item',
    '2) Item',
    '(3) Item',
    'a. Item',
    'A) Item',
    'а. Item',
    '- Item',
    '* Item',
    '+ Item',
    '• Item',
    '— Item',
    '- [ ] Item',
    '- [x] Item',
    '- [X] Item',
  ])('recognizes marker in %s', (line) => {
    expect(hasListMarker(line)).toBe(true)
  })

  it('does not recognize punctuation without separator whitespace', () => {
    expect(hasListMarker('-not a list item')).toBe(false)
  })

  it('returns all marker conversion variants', () => {
    expect(result(mixedList, 'Hyphen list')).toBe('- First\n- Second\n- Third\n- Fourth')
    expect(result(mixedList, 'Asterisk list')).toBe('* First\n* Second\n* Third\n* Fourth')
    expect(result(mixedList, 'Bullet list')).toBe('• First\n• Second\n• Third\n• Fourth')
    expect(result(mixedList, 'Numbered list')).toBe('1. First\n2. Second\n3. Third\n4. Fourth')
    expect(result(mixedList, 'Checkbox list')).toBe('- [ ] First\n- [ ] Second\n- [ ] Third\n- [ ] Fourth')
    expect(result(mixedList, 'Remove markers')).toBe('First\nSecond\nThird\nFourth')
  })

  it('preserves empty lines and does not number them', () => {
    const input = '1. First\n\n2. Second'
    expect(result(input, 'Numbered list')).toBe('1. First\n\n2. Second')
    expect(result(input, 'Remove markers')).toBe('First\n\nSecond')
  })

  it('treats unmarked lines as list items when opened manually', () => {
    expect(result('First\nSecond', 'Hyphen list')).toBe('- First\n- Second')
  })

  it('sorts by item text and preserves the first marker format', () => {
    expect(result('* Zebra\n- Apple\n• Mango\n\n', 'Sort list')).toBe('* Apple\n* Mango\n* Zebra')
  })

  it('normalizes numbered and checkbox formats for sorting', () => {
    expect(result('b) Zebra\na) Apple', 'Sort list')).toBe('1. Apple\n2. Zebra')
    expect(result('- [x] Zebra\n- [ ] Apple', 'Sort list')).toBe('- [ ] Apple\n- [ ] Zebra')
  })

  it('removes exact duplicates, preserves the first occurrence, and collapses empty lines', () => {
    const input = '1. Beta\n\n\n2. Alpha\n3. Beta\n\n4. alpha'
    expect(result(input, 'Remove duplicates')).toBe('1. Beta\n\n2. Alpha\n\n3. alpha')
  })

  it('returns no results for empty input', () => {
    expect(listConverterTool.transform('')).toEqual([])
  })
})
