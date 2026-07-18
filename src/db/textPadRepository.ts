import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import type {
  DocumentRecord,
  DocumentContentPatch,
  WorkspaceRecord,
  WriteResult,
} from '../tools/text-pad/types'

const DB_NAME = 'txtkit-text-pad'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          const store = db.createObjectStore('documents', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('workspace')) {
          db.createObjectStore('workspace', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  const db = await getDB()
  return db.getAll('documents')
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

export async function updateDocument(
  id: string,
  patch: DocumentContentPatch,
): Promise<WriteResult> {
  const db = await getDB()
  const tx = db.transaction('documents', 'readwrite')
  const store = tx.store

  const existing = await store.get(id)
  if (!existing) {
    await tx.done
    throw new Error(`Document ${id} not found`)
  }

  if (isOlderDocumentVersion(existing, patch)) {
    await tx.done
    return 'superseded'
  }

  await store.put({
    ...existing,
    content: patch.content,
    selection: patch.selection,
    scrollTop: patch.scrollTop,
    contentRevision: patch.contentRevision,
    updatedAt: patch.updatedAt,
  })

  await tx.done
  return 'written'
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
  const tx = db.transaction(['workspace', 'documents'], 'readwrite')
  await tx.objectStore('workspace').put(params.workspace)
  if (params.putDocuments && params.putDocuments.length > 0) {
    const docStore = tx.objectStore('documents')
    for (const doc of params.putDocuments) {
      const existing = await docStore.get(doc.id)
      if (existing && isOlderDocumentVersion(existing, doc)) {
        continue
      }
      await docStore.put(doc)
    }
  }
  await tx.done
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDB()
  const tx = db.transaction('documents', 'readwrite')
  for (const id of ids) {
    await tx.store.delete(id)
  }
  await tx.done
}

export async function resetTextPadRepositoryForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}
