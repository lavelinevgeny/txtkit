import type { DocumentRecord, WorkspaceRecord } from './types'

type Version = Pick<DocumentRecord, 'contentRevision' | 'updatedAt'>

export function compareDocumentVersions(left: Version, right: Version): number {
  return left.contentRevision - right.contentRevision || left.updatedAt - right.updatedAt
}

// These snapshots outlive the editor, the close-undo timer, and failed transactions.
const documents = new Map<string, DocumentRecord>()
let workspace: WorkspaceRecord | undefined
let openSession: { workspace: WorkspaceRecord; documents: DocumentRecord[] } | undefined

// A failed write can coincide with loss of read access. Keep enough of the open
// session to rebuild it until every outstanding write is confirmed.
export function rememberOpenSession(value: WorkspaceRecord, openDocuments: DocumentRecord[]): void {
  openSession = { workspace: value, documents: openDocuments }
}

export function pendingOpenSession() {
  return openSession
}

function releaseConfirmedSession(): void {
  if (!documents.size && !workspace) openSession = undefined
}

export function newestDocuments(...groups: Iterable<DocumentRecord>[]): DocumentRecord[] {
  const result = new Map<string, DocumentRecord>()
  for (const group of groups) {
    for (const doc of group) {
      const previous = result.get(doc.id)
      if (!previous || compareDocumentVersions(doc, previous) >= 0) result.set(doc.id, doc)
    }
  }
  return [...result.values()]
}

export function rememberDocument(document: DocumentRecord): void {
  const previous = documents.get(document.id)
  if (!previous || compareDocumentVersions(document, previous) >= 0) {
    documents.set(document.id, document)
  }
}

export function confirmDocument(id: string, persisted: Version): void {
  const pending = documents.get(id)
  if (pending && compareDocumentVersions(persisted, pending) >= 0) documents.delete(id)
  releaseConfirmedSession()
}

export function pendingDocuments(): ReadonlyMap<string, DocumentRecord> {
  return documents
}

export function rememberWorkspace(value: WorkspaceRecord): void {
  workspace = value
}

export function pendingWorkspace(): WorkspaceRecord | undefined {
  return workspace
}

export function confirmWorkspace(value: WorkspaceRecord): void {
  if (workspace === value) workspace = undefined
  releaseConfirmedSession()
}

export function resetPendingWritesForTests(): void {
  documents.clear()
  workspace = undefined
  openSession = undefined
}
