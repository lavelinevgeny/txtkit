import type { EditorState } from '@codemirror/state'

export interface SerializedSelection {
  ranges: Array<{ anchor: number; head: number }>
  main: number
}

export interface DocumentRecord {
  id: string
  title: string
  content: string
  selection: SerializedSelection | null
  scrollTop: number
  contentRevision: number
  createdAt: number
  updatedAt: number
}

export interface DocumentContentPatch {
  content: string
  selection: SerializedSelection | null
  scrollTop: number
  contentRevision: number
  updatedAt: number
}

export interface WorkspaceRecord {
  key: 'current'
  activeTabId: string | null
  openTabIds: string[]
  nextUntitledNumber: number
  migrations: {
    legacyLocalStorageMigrationCompleted: boolean
  }
}

export interface RuntimeTabState {
  editorState: EditorState
  scrollTop: number
  title: string
  createdAt: number
}

export interface ClosedTabUndoEntry {
  id: string
  index: number
  runtimeState: RuntimeTabState
  currentRevision: number
  savedRevision: number
}

export type PersistenceStatus =
  | 'initializing'
  | 'ready'
  | 'memory-only'
  | 'quota-error'
  | 'save-error'

export type WriteResult = 'written' | 'superseded'

export interface WorkspaceMutation {
  workspace: WorkspaceRecord
  putDocuments?: DocumentRecord[]
  /** IDs whose existence must not be assumed until this transaction
   *  succeeds. Includes newly created documents and every document
   *  participating in a full recovery transaction.
   *
   *  Ordinary close snapshots that update known persisted documents
   *  must not be included. The repository never sees this field. */
  createdDocumentIds?: string[]
}
