import { commitWorkspace } from '../../db/textPadRepository'
import { useTextPadStore } from './useTextPadStore'
import type { DocumentRecord, WorkspaceMutation, WorkspaceRecord } from './types'

let workspacePersistenceDisabled = false
let wsQueue: Promise<void> = Promise.resolve()

interface CreationDeferred {
  promise: Promise<void>
  resolve: () => void
  reject: (err: unknown) => void
}

const docCreations = new Map<string, CreationDeferred>()

export function waitForDocumentCreation(id: string): Promise<void> {
  const existing = docCreations.get(id)
  if (existing) return existing.promise
  return Promise.resolve()
}

let recoverySnapshotFn: (() => DocumentRecord[]) | null = null

export function setRecoverySnapshotFn(fn: () => DocumentRecord[]): void {
  recoverySnapshotFn = fn
}

export function clearRecoverySnapshotFn(): void {
  recoverySnapshotFn = null
}

export async function resumeWorkspacePersistence(): Promise<void> {
  const store = useTextPadStore.getState()
  if (store.openTabIds.length === 0 || !recoverySnapshotFn) {
    throw new Error('Recovery snapshot is unavailable')
  }

  const docs = recoverySnapshotFn()
  if (docs.length === 0) {
    throw new Error('Recovery snapshot is empty')
  }

  workspacePersistenceDisabled = false

  const workspace: WorkspaceRecord = {
    key: 'current',
    activeTabId: store.activeTabId,
    openTabIds: [...store.openTabIds],
    nextUntitledNumber: store.nextUntitledNumber,
    migrations: { legacyLocalStorageMigrationCompleted: true },
  }

  try {
    await enqueueWorkspaceMutation({
      workspace,
      putDocuments: docs,
      createdDocumentIds: docs.map((doc) => doc.id),
    })
  } catch (error) {
    workspacePersistenceDisabled = true
    useTextPadStore.getState().setPersistenceStatus('memory-only')
    throw error
  }
}

export function resetWorkspaceQueueForTests(): void {
  workspacePersistenceDisabled = false
  wsQueue = Promise.resolve()
  docCreations.clear()
  recoverySnapshotFn = null
}

export function enqueueWorkspaceMutation(
  mutation: WorkspaceMutation,
): Promise<void> {
  const createdIds = mutation.createdDocumentIds ?? []
  const putIds = new Set(mutation.putDocuments?.map((doc) => doc.id) ?? [])
  for (const id of createdIds) {
    if (!putIds.has(id)) {
      return Promise.reject(
        new Error(
          `createdDocumentIds contains '${id}', but putDocuments does not include it`,
        ),
      )
    }
  }

  if (mutation.createdDocumentIds && mutation.createdDocumentIds.length > 0) {
    for (const docId of mutation.createdDocumentIds) {
      if (!docCreations.has(docId)) {
        let resolve: () => void = () => {}
        let reject: (err: unknown) => void = () => {}
        const promise = new Promise<void>((res, rej) => {
          resolve = res
          reject = rej
        })
        void promise.catch(() => {})
        docCreations.set(docId, { promise, resolve, reject })
      }
    }
  }

  const operation = wsQueue.then(async () => {
    if (workspacePersistenceDisabled) {
      const skipErr = new Error('Workspace persistence disabled')
      if (mutation.createdDocumentIds) {
        for (const docId of mutation.createdDocumentIds) {
          const creation = docCreations.get(docId)
          if (creation) {
            creation.reject(skipErr)
            docCreations.delete(docId)
          }
        }
      }
      throw skipErr
    }

    await commitWorkspace({
      workspace: mutation.workspace,
      putDocuments: mutation.putDocuments,
    })

    if (mutation.createdDocumentIds) {
      for (const docId of mutation.createdDocumentIds) {
        const creation = docCreations.get(docId)
        if (creation) {
          creation.resolve()
          docCreations.delete(docId)
        }
      }
    }
    useTextPadStore.getState().setWorkspaceSaveError(false)
    useTextPadStore.getState().checkSaveErrorRecovery()
  })

  function handleWorkspaceFailure(error: unknown): void {
    if (mutation.createdDocumentIds) {
      for (const docId of mutation.createdDocumentIds) {
        const creation = docCreations.get(docId)
        if (creation) {
          creation.reject(error)
          docCreations.delete(docId)
        }
      }
    }

    if (mutation.createdDocumentIds && mutation.createdDocumentIds.length > 0) {
      workspacePersistenceDisabled = true
      useTextPadStore.getState().setPersistenceStatus('memory-only')
    } else {
      useTextPadStore.getState().setPersistenceStatus('save-error')
    }
    useTextPadStore.getState().setWorkspaceSaveError(true)
  }

  const publicOperation = operation.then(
    () => {},
    (error) => {
      handleWorkspaceFailure(error)
      throw error
    },
  )

  wsQueue = publicOperation.catch(() => undefined)

  return publicOperation
}
