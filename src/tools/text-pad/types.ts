import type { EditorState } from '@codemirror/state'

export interface SerializedSelection {
  ranges: Array<{ anchor: number; head: number }>
  main: number
}

export interface PadImageBinding {
  offset: number
  imageId: string
}

export interface PadImageFile {
  mimeType: string
  bytes: Uint8Array
}

export interface PadImageRecovery {
  imageId: string
  reason: string
  offset?: number
}

interface DocumentImages {
  images?: PadImageBinding[]
  recovery?: PadImageRecovery[]
  /** Bytes held by this snapshot. Persisted separately from document metadata. */
  imageFiles?: Record<string, PadImageFile>
}

export interface DocumentRecord extends DocumentImages {
  id: string
  title: string
  content: string
  selection: SerializedSelection | null
  scrollTop: number
  contentRevision: number
  createdAt: number
  updatedAt: number
}

export interface DocumentContentPatch extends DocumentImages {
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
