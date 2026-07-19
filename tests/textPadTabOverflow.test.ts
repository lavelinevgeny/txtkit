import {
  normalizeVisibleTabIds,
  promoteOverflowTab,
} from '../src/components/textPadTabOverflow'

describe('Text Pad tab overflow helpers', () => {
  it('fills all visible slots in open-tab order', () => {
    expect(normalizeVisibleTabIds(['a', 'b', 'c'], [], 3, 'a')).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('keeps the active open tab visible', () => {
    expect(
      normalizeVisibleTabIds(['a', 'b', 'c', 'd'], ['a', 'b'], 2, 'd'),
    ).toEqual(['a', 'd'])
  })

  it('discards closed visible tab IDs before filling slots', () => {
    expect(
      normalizeVisibleTabIds(['a', 'c', 'd'], ['a', 'b'], 2, 'a'),
    ).toEqual(['a', 'c'])
  })

  it('replaces the final visible tab when promoting an overflow tab', () => {
    expect(promoteOverflowTab(['a', 'b'], 'd')).toEqual(['a', 'd'])
  })
})
