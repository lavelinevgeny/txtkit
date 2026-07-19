import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import {
  commitWorkspace,
  deleteDocuments,
  getAllDocuments,
  getWorkspace,
  resetTextPadRepositoryForTests,
  updateDocument,
} from '../src/db/textPadRepository'
import type { DocumentRecord, WorkspaceRecord } from '../src/tools/text-pad/types'

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'a1', title: 'pad1', content: 'initial', selection: null, scrollTop: 0,
    contentRevision: 0, createdAt: 1, updatedAt: 1, ...overrides,
  }
}

function makeWorkspace(overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  return {
    key: 'current', activeTabId: 'a1', openTabIds: ['a1'], nextUntitledNumber: 2,
    migrations: { legacyLocalStorageMigrationCompleted: true }, ...overrides,
  }
}

beforeEach(async () => {
  await resetTextPadRepositoryForTests()
  for (const db of await indexedDB.databases()) {
    if (db.name) await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(db.name!)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
})

describe('textPadRepository', () => {
  it('creates document and workspace atomically', async () => {
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [makeDocument()] })
    expect((await getWorkspace())?.openTabIds).toEqual(['a1'])
    expect(await getAllDocuments()).toHaveLength(1)
  })

  it('preserves document fields outside a content patch', async () => {
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [makeDocument({ title: 'original', createdAt: 7 })] })
    await updateDocument('a1', { content: 'new', selection: null, scrollTop: 12, contentRevision: 1, updatedAt: 2 })
    expect((await getAllDocuments())[0]).toMatchObject({ title: 'original', createdAt: 7, content: 'new', scrollTop: 12 })
  })

  it('rejects older document and workspace snapshots', async () => {
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [makeDocument({ content: 'revision 6', contentRevision: 6, updatedAt: 6 })] })
    await expect(updateDocument('a1', { content: 'revision 5', selection: null, scrollTop: 0, contentRevision: 5, updatedAt: 7 })).resolves.toBe('superseded')
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [makeDocument({ content: 'stale', contentRevision: 6, updatedAt: 5 })] })
    expect((await getAllDocuments())[0]).toMatchObject({ content: 'revision 6', contentRevision: 6, updatedAt: 6 })
  })

  it('deletes multiple documents', async () => {
    await commitWorkspace({ workspace: makeWorkspace({ openTabIds: ['a1', 'a2'] }), putDocuments: [makeDocument(), makeDocument({ id: 'a2' })] })
    await deleteDocuments(['a1', 'a2'])
    expect(await getAllDocuments()).toHaveLength(0)
  })
})
