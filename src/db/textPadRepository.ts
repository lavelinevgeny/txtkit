import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb'
import type {
  DocumentRecord,
  DocumentContentPatch,
  PadImageBinding,
  PadImageFile,
  PadImageRecovery,
  WorkspaceRecord,
  WriteResult,
} from '../tools/text-pad/types'

const DB_NAME = 'txtkit-text-pad'
const DB_VERSION = 2

interface PadSchema extends DBSchema {
  documents: {
    key: string
    value: Omit<DocumentRecord, 'imageFiles'>
    indexes: { updatedAt: number }
  }
  workspace: { key: string; value: WorkspaceRecord }
  images: {
    key: [string, string]
    value: PadImageFile & { docId: string; imageId: string }
  }
}

let dbPromise: Promise<IDBPDatabase<PadSchema>> | null = null
let blocked = false
const blockedListeners = new Set<(blocked: boolean) => void>()

function setBlocked(next: boolean) {
  if (next === blocked) return
  blocked = next
  for (const listener of blockedListeners) listener(next)
}

export function subscribePadDatabaseBlocked(listener: (blocked: boolean) => void): () => void {
  blockedListeners.add(listener)
  listener(blocked)
  return () => blockedListeners.delete(listener)
}

function getDB(): Promise<IDBPDatabase<PadSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PadSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          const store = db.createObjectStore('documents', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('workspace')) {
          db.createObjectStore('workspace', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: ['docId', 'imageId'] })
        }
      },
      blocked: () => setBlocked(true),
      blocking(_current, _next, event) {
        const database = event.target as IDBDatabase
        database.close()
        dbPromise = null
      },
      terminated() { dbPromise = null },
    }).then(db => {
      setBlocked(false)
      return db
    }, error => {
      dbPromise = null
      setBlocked(false)
      throw error
    })
  }
  return dbPromise
}

function validatedImages(doc: DocumentRecord, fileIds: Set<string>) {
  const bindings = doc.images ?? []
  const countsByOffset = new Map<number, number>()
  const countsById = new Map<string, number>()
  for (const { imageId, offset } of bindings) {
    countsByOffset.set(offset, (countsByOffset.get(offset) ?? 0) + 1)
    countsById.set(imageId, (countsById.get(imageId) ?? 0) + 1)
  }

  const images: PadImageBinding[] = []
  const recovery = [...doc.recovery ?? []]
  const knownIds = new Set(recovery.map(entry => entry.imageId))
  const diagnosed = new Set(recovery.map(({ imageId, reason, offset }) =>
    JSON.stringify([imageId, reason, offset])))
  for (const { offset, imageId } of bindings) {
    knownIds.add(imageId)
    let reason: string | undefined
    if (countsByOffset.get(offset)! > 1 || countsById.get(imageId)! > 1) reason = 'conflicting-binding'
    else if (!Number.isInteger(offset) || doc.content[offset] !== '\uFFFC') reason = 'invalid-offset'
    else if (!fileIds.has(imageId)) reason = 'missing-file'

    if (!reason) {
      images.push({ imageId, offset })
    } else if (!diagnosed.has(JSON.stringify([imageId, reason, offset]))) {
      const entry: PadImageRecovery = { imageId, reason }
      if (typeof offset === 'number' && Number.isFinite(offset)) entry.offset = offset
      recovery.push(entry)
    }
  }
  for (const imageId of fileIds) {
    if (!knownIds.has(imageId)) recovery.push({ imageId, reason: 'unbound-file' })
  }
  images.sort((a, b) => a.offset - b.offset)
  return { images, recovery }
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  const db = await getDB()
  const tx = db.transaction(['documents', 'images'])
  const [documents, keys] = await Promise.all([
    tx.objectStore('documents').getAll(),
    tx.objectStore('images').getAllKeys(),
  ])
  const filesByDoc = new Map<string, Set<string>>()
  for (const [docId, imageId] of keys) {
    const ids = filesByDoc.get(docId) ?? new Set<string>()
    ids.add(imageId)
    filesByDoc.set(docId, ids)
  }
  return documents.map(doc => ({ ...doc, ...validatedImages(doc, filesByDoc.get(doc.id) ?? new Set()) }))
}

export async function getDocumentVersion(id: string): Promise<Pick<DocumentRecord, 'contentRevision' | 'updatedAt'> | undefined> {
  const db = await getDB()
  const doc = await db.get('documents', id)
  return doc && { contentRevision: doc.contentRevision, updatedAt: doc.updatedAt }
}

export async function getStoredPadImageIds(docId: string): Promise<Set<string>> {
  const db = await getDB()
  const keys = await db.getAllKeys('images', documentImageRange(docId))
  return new Set(keys.map(key => key[1]))
}

export async function readPadImage(docId: string, imageId: string): Promise<PadImageFile | undefined> {
  const db = await getDB()
  const file = await db.get('images', [docId, imageId])
  return file && { mimeType: file.mimeType, bytes: file.bytes }
}

function isOlderDocumentVersion(
  existing: { contentRevision: number; updatedAt: number },
  incoming: { contentRevision: number; updatedAt: number },
): boolean {
  if (existing.contentRevision > incoming.contentRevision) return true
  return (
    existing.contentRevision === incoming.contentRevision &&
    existing.updatedAt > incoming.updatedAt
  )
}

type WriteTransaction = IDBPTransaction<PadSchema, ('documents' | 'images' | 'workspace')[], 'readwrite'>

function documentImageRange(docId: string) {
  // Array keys sort after strings, so this includes every string ID for this document.
  return IDBKeyRange.bound([docId], [docId, []])
}

async function writeSnapshot(tx: WriteTransaction, doc: DocumentRecord, existing?: DocumentRecord) {
  const files = tx.objectStore('images')
  const existingIds = new Set((await files.getAllKeys(documentImageRange(doc.id))).map(key => key[1]))
  const prior = existing && validatedImages(existing, existingIds)
  const images = [...doc.images ?? prior?.images ?? []].sort((a, b) => a.offset - b.offset)
  // Recovery entries protect their original files until the whole note is deleted,
  // including diagnostics discovered by a different tab.
  const recovery = [...doc.recovery ?? []]
  for (const entry of prior?.recovery ?? []) {
    if (!recovery.some(item => item.imageId === entry.imageId && item.offset === entry.offset && item.reason === entry.reason)) {
      recovery.push(entry)
    }
  }
  const activeIds = new Set(images.map(binding => binding.imageId))
  const retainedIds = new Set([...activeIds, ...recovery.map(entry => entry.imageId)])
  for (const imageId of retainedIds) {
    if (existingIds.has(imageId)) continue
    const file = doc.imageFiles && Object.hasOwn(doc.imageFiles, imageId) && doc.imageFiles[imageId]
    if (file) await files.add({ docId: doc.id, imageId, mimeType: file.mimeType, bytes: file.bytes })
    else if (activeIds.has(imageId)) throw new Error(`Missing image ${imageId} for document ${doc.id}`)
  }
  for (const imageId of existingIds) {
    if (!retainedIds.has(imageId)) await files.delete([doc.id, imageId])
  }
  const metadata = { ...doc, images, recovery }
  delete metadata.imageFiles
  await tx.objectStore('documents').put(metadata)
}

async function rollback(tx: WriteTransaction) {
  try { tx.abort() } catch { /* An IndexedDB request already aborted the transaction. */ }
  await tx.done.catch(() => {})
}

export async function updateDocument(id: string, patch: DocumentContentPatch): Promise<WriteResult> {
  const db = await getDB()
  const tx = db.transaction(['documents', 'images'], 'readwrite')
  try {
    const existing = await tx.objectStore('documents').get(id)
    if (!existing) throw new Error(`Document ${id} not found`)
    if (isOlderDocumentVersion(existing, patch)) {
      await tx.done
      return 'superseded'
    }
    await writeSnapshot(tx, {
      ...existing,
      content: patch.content,
      selection: patch.selection,
      scrollTop: patch.scrollTop,
      updatedAt: patch.updatedAt,
      contentRevision: patch.contentRevision,
      images: patch.images,
      recovery: patch.recovery,
      imageFiles: patch.imageFiles,
    }, existing)
    await tx.done
    return 'written'
  } catch (error) {
    await rollback(tx)
    throw error
  }
}

export async function getWorkspace(): Promise<WorkspaceRecord | undefined> {
  const db = await getDB()
  return db.get('workspace', 'current')
}

export async function commitWorkspace(params: {
  workspace: WorkspaceRecord
  putDocuments?: DocumentRecord[]
}): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['workspace', 'documents', 'images'], 'readwrite')
  try {
    await tx.objectStore('workspace').put(params.workspace)
    for (const doc of params.putDocuments ?? []) {
      const existing = await tx.objectStore('documents').get(doc.id)
      if (existing && isOlderDocumentVersion(existing, doc)) continue
      await writeSnapshot(tx, doc, existing)
    }
    await tx.done
  } catch (error) {
    await rollback(tx)
    throw error
  }
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDB()
  const tx = db.transaction(['documents', 'images'], 'readwrite')
  try {
    for (const id of ids) {
      await tx.objectStore('documents').delete(id)
      await tx.objectStore('images').delete(documentImageRange(id))
    }
    await tx.done
  } catch (error) {
    await rollback(tx)
    throw error
  }
}

export async function resetTextPadRepositoryForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}
