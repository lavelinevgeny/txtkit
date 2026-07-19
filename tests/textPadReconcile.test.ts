import { beforeEach, describe, expect, it } from 'vitest'
import { useTextPadStore } from '../src/tools/text-pad/useTextPadStore'
import { reconcileClosedDocumentCommit } from '../src/tools/views/TextPadView'
import type { ClosedTabUndoEntry } from '../src/tools/text-pad/types'

beforeEach(() => {
  useTextPadStore.setState({ activeTabId: null, openTabIds: [], tabsById: {}, nextUntitledNumber: 1, persistenceStatus: 'ready', currentRevisionById: {}, savedRevisionById: {}, saveErrorById: {}, workspaceSaveError: false })
})

describe('reconcileClosedDocumentCommit', () => {
  it('updates the undo entry while the tab remains closed', () => {
    const entries = new Map<string, ClosedTabUndoEntry>()
    entries.set('a', { id: 'a', index: 0, runtimeState: { editorState: null as never, scrollTop: 0, title: 'pad1', createdAt: 1 }, currentRevision: 3, savedRevision: 1 })
    reconcileClosedDocumentCommit('a', 3, entries)
    expect(entries.get('a')?.savedRevision).toBe(3)
  })

  it('marks a restored matching revision as saved but not a newer one', () => {
    useTextPadStore.setState({ activeTabId: 'a', openTabIds: ['a'], tabsById: { a: { title: 'pad1' } }, currentRevisionById: { a: 4 }, savedRevisionById: { a: 1 }, saveErrorById: { a: false } })
    reconcileClosedDocumentCommit('a', 4, new Map())
    expect(useTextPadStore.getState().savedRevisionById.a).toBe(4)
    useTextPadStore.setState({ currentRevisionById: { a: 7 }, savedRevisionById: { a: 1 } })
    reconcileClosedDocumentCommit('a', 4, new Map())
    expect(useTextPadStore.getState().savedRevisionById.a).toBe(1)
  })
})
