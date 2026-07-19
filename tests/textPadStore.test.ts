import { beforeEach, describe, expect, it } from 'vitest'
import { useTextPadStore } from '../src/tools/text-pad/useTextPadStore'

beforeEach(() => {
  useTextPadStore.setState({
    activeTabId: null, openTabIds: [], tabsById: {}, nextUntitledNumber: 1,
    persistenceStatus: 'initializing', currentRevisionById: {}, savedRevisionById: {},
    saveErrorById: {}, workspaceSaveError: false,
  })
})

describe('TextPad store', () => {
  it('adds tabs and tracks the next untitled number', () => {
    useTextPadStore.getState().addTab('a', 'pad1', 2)
    expect(useTextPadStore.getState().openTabIds).toEqual(['a'])
    expect(useTextPadStore.getState().nextUntitledNumber).toBe(2)
  })

  it('keeps the active tab when closing a background tab', () => {
    const store = useTextPadStore.getState()
    store.addTab('a', 'pad1', 2); store.addTab('b', 'pad2', 3); store.addTab('c', 'pad3', 4)
    store.setActiveTab('c')
    expect(store.closeTab('a')).toEqual({ removedId: 'a', removedIndex: 0 })
    expect(useTextPadStore.getState().activeTabId).toBe('c')
  })

  it('restores a closed tab with its revisions', () => {
    const store = useTextPadStore.getState()
    store.addTab('a', 'pad1', 2); store.addTab('b', 'pad2', 3); store.closeTab('a')
    store.undoCloseTab('a', 0, 'pad1', 4, 2)
    expect(useTextPadStore.getState().openTabIds).toEqual(['a', 'b'])
    expect(useTextPadStore.getState().currentRevisionById.a).toBe(4)
    expect(useTextPadStore.getState().savedRevisionById.a).toBe(2)
  })

  it('never moves a saved revision backwards', () => {
    const store = useTextPadStore.getState()
    store.addTab('a', 'pad1', 2); store.markSaved('a', 5); store.markSaved('a', 3)
    expect(useTextPadStore.getState().savedRevisionById.a).toBe(5)
  })
})
