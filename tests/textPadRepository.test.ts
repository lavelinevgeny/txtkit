import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import {
  commitWorkspace,
  deleteDocuments,
  getAllDocuments,
  getWorkspace,
  getDocumentVersion,
  readPadImage,
  subscribePadDatabaseBlocked,
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

describe('text pad image storage', () => {
  const name = 'txtkit-text-pad'
  const file = { mimeType: 'image/png', bytes: new Uint8Array([0, 1, 255]) }
  async function expectSavedFile(docId: string, imageId: string) {
    const saved = await readPadImage(docId, imageId)
    expect(saved?.mimeType).toBe(file.mimeType)
    expect(Array.from(saved!.bytes)).toEqual(Array.from(file.bytes))
  }

  const withImage = () => makeDocument({
    content: 'x\uFFFC', images: [{ offset: 1, imageId: 'photo' }], imageFiles: { photo: file },
  })

  it('waits for an old connection, migrates v1 without changing text and closes on versionchange', async () => {
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('documents', { keyPath: 'id' })
        db.createObjectStore('workspace', { keyPath: 'key' })
      },
    })
    await old.put('documents', makeDocument({ content: '\uFFFC' }))
    const blocked = vi.fn()
    const unsub = subscribePadDatabaseBlocked(blocked)
    const opening = getAllDocuments()
    await vi.waitFor(() => expect(blocked).toHaveBeenCalledWith(true))
    old.close()
    expect(await opening).toEqual([makeDocument({ content: '\uFFFC', images: [], recovery: [] })])
    expect(blocked).toHaveBeenLastCalledWith(false)
    unsub()
    const newer = await openDB(name, 3)
    newer.close()
    await expect(getAllDocuments()).rejects.toMatchObject({ name: 'VersionError' })
    await expect(getAllDocuments()).rejects.toMatchObject({ name: 'VersionError' })
  })

  it('enumerates only metadata, skips existing bytes, and reinserts deleted files from a snapshot', async () => {
    const doc = withImage()
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [doc] })
    const raw = await openDB(name, 2)
    expect(await raw.get('documents', doc.id)).not.toHaveProperty('imageFiles')
    raw.close()

    const get = vi.spyOn(IDBObjectStore.prototype, 'get')
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll')
    const add = vi.spyOn(IDBObjectStore.prototype, 'add')
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    try {
      expect((await getAllDocuments())[0].images).toEqual(doc.images)
      expect(getAll.mock.contexts.some(store => store.name === 'documents')).toBe(true)
      expect(get.mock.contexts.some(store => store.name === 'images')).toBe(false)
      expect(getAll.mock.contexts.some(store => store.name === 'images')).toBe(false)
      await updateDocument(doc.id, {
        ...doc, content: '🙌\uFFFC', images: [{ offset: 2, imageId: 'photo', scale: 150 }], contentRevision: 1,
      })
      expect((await getAllDocuments())[0].images).toEqual([{ offset: 2, imageId: 'photo', scale: 150 }])
      expect(add.mock.contexts.some(store => store.name === 'images')).toBe(false)
      expect(put.mock.contexts.some(store => store.name === 'images')).toBe(false)
      expect(put.mock.contexts.some(store => store.name === 'documents')).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
    expect(await updateDocument(doc.id, { ...doc, content: '', images: [] })).toBe('superseded')
    expect(await getDocumentVersion(doc.id)).toEqual({ contentRevision: 1, updatedAt: 1 })
    await expectSavedFile(doc.id, 'photo')
    await updateDocument(doc.id, { ...doc, contentRevision: 2, content: '', images: [] })
    expect(await readPadImage(doc.id, 'photo')).toBeUndefined()
    await updateDocument(doc.id, { ...doc, contentRevision: 3 })
    await expectSavedFile(doc.id, 'photo')
  })

  it('rolls back document, workspace and already written images on failure', async () => {
    await commitWorkspace({ workspace: makeWorkspace(), putDocuments: [withImage()] })
    await expect(commitWorkspace({
      workspace: makeWorkspace({ activeTabId: 'broken' }),
      putDocuments: [
        makeDocument({ content: 'changed', images: [], contentRevision: 1 }),
        makeDocument({
          id: 'broken', content: '\uFFFC\uFFFC',
          images: [{ imageId: 'first', offset: 0 }, { imageId: 'missing', offset: 1 }],
          imageFiles: { first: file },
        }),
      ],
    })).rejects.toThrow('Missing image')
    expect(await getWorkspace()).toEqual(makeWorkspace())
    expect((await getAllDocuments()).map(doc => doc.content)).toEqual(['x\uFFFC'])
    await expectSavedFile('a1', 'photo')
    expect(await readPadImage('broken', 'first')).toBeUndefined()
  })

  it('retains every conflicting, misplaced, missing or orphaned image across writes and reloads', async () => {
    await getWorkspace()
    const raw = await openDB(name, 2)
    const images = [
      { imageId: 'last', offset: 8, scale: 37 }, { imageId: 'conflictA', offset: 1 }, { imageId: 'conflictB', offset: 1 },
      { imageId: 'same', offset: 3 }, { imageId: 'same', offset: 4 }, { imageId: 'text', offset: 0 },
      { imageId: 'outside', offset: 99 }, { imageId: 'missing', offset: 6 }, { imageId: 'first', offset: 2 },
    ]
    await raw.put('documents', makeDocument({ content: 'x' + '\uFFFC'.repeat(8), images }))
    const fileIds = [...new Set(images.map(({ imageId }) => imageId)), 'orphan'].filter(id => id !== 'missing')
    for (const imageId of fileIds) await raw.put('images', { docId: 'a1', imageId, ...file })
    await raw.put('images', { docId: 'another', imageId: 'orphan', ...file })
    raw.close()

    const [loaded] = await getAllDocuments()
    expect(loaded.images).toEqual([{ imageId: 'first', offset: 2 }, { imageId: 'last', offset: 8 }])
    expect(loaded.recovery).toEqual([
      { imageId: 'conflictA', offset: 1, reason: 'conflicting-binding' },
      { imageId: 'conflictB', offset: 1, reason: 'conflicting-binding' },
      { imageId: 'same', offset: 3, reason: 'conflicting-binding' },
      { imageId: 'same', offset: 4, reason: 'conflicting-binding' },
      { imageId: 'text', offset: 0, reason: 'invalid-offset' },
      { imageId: 'outside', offset: 99, reason: 'invalid-offset' },
      { imageId: 'missing', offset: 6, reason: 'missing-file' },
      { imageId: 'orphan', reason: 'unbound-file' },
    ])
    await updateDocument(loaded.id, {
      ...loaded, contentRevision: 1, content: 'added' + loaded.content,
      images: loaded.images!.map(image => ({ ...image, offset: image.offset + 5 })),
    })
    await resetTextPadRepositoryForTests()
    const [saved] = await getAllDocuments()
    await updateDocument(saved.id, { ...saved, contentRevision: 2 })
    expect((await getAllDocuments())[0].recovery).toEqual(loaded.recovery)
    for (const id of fileIds) await expectSavedFile(saved.id, id)
    await deleteDocuments([saved.id])
    for (const id of fileIds) expect(await readPadImage(saved.id, id)).toBeUndefined()
    await expectSavedFile('another', 'orphan')
  })
})
