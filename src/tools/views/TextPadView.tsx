/* eslint-disable react-refresh/only-export-components, react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { EditorView, highlightSpecialChars } from '@codemirror/view'
import { SearchQuery, setSearchQuery as cmSetSearchQuery, findNext as cmFindNext, findPrevious as cmFindPrevious, replaceNext as cmReplaceNext, replaceAll as cmReplaceAll } from '@codemirror/search'

import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { useTextPadStore } from '../text-pad/useTextPadStore'
import { enqueueDocumentWrite } from '../text-pad/useDocumentWriteQueue'
import {
  enqueueWorkspaceMutation,
  resumeWorkspacePersistence,
  setRecoverySnapshotFn,
  clearRecoverySnapshotFn,
} from '../text-pad/useWorkspaceQueue'
import { getWorkspace, getAllDocuments } from '../../db/textPadRepository'
import { TextPadTabBar } from '../../components/TextPadTabBar'
import { createEditorState, wrappingCompartment, whitespaceCompartment } from '../text-pad/editorStateFactory'
import { getTextPadStats } from './textPadStats'
import { downloadTextFile, downloadJsonBackup } from './textPadFile'
import { copyToClipboard } from '../../utils/clipboard'

import {
  removeEmptyLines,
  removeDuplicateLines,
  sortLines,
  trimLines,
  shuffleLines,
  addPrefixSuffix,
} from '../../utils/text-ops'
import { toLowerCase, toUpperCase, toSentenceCase, toTitleCase } from '../../utils/text-case-ops'
import { htmlEscape, htmlUnescape, urlEncode, urlDecode } from '../../utils/text-encode-ops'
import { formatJson, minifyJson } from '../../utils/text-format-ops'

import type {
  RuntimeTabState,
  ClosedTabUndoEntry,
  DocumentRecord,
  DocumentContentPatch,
  WorkspaceRecord,
  PersistenceStatus,
} from '../text-pad/types'

// =====================================================================
// Module-level bootstrap. Pure function — returns data, does NOT touch
// any React refs or state. Each TextPadView instance applies the result.
// Memoized so React Strict Mode (mount → unmount → re-mount) only runs
// the actual IndexedDB bootstrap once.
// =====================================================================

interface BootstrapResult {
  activeTabId: string | null
  openTabIds: string[]
  tabsById: Record<string, { title: string }>
  nextUntitledNumber: number
  persistenceStatus: PersistenceStatus
  currentRevisionById: Record<string, number>
  savedRevisionById: Record<string, number>
  saveErrorById: Record<string, boolean>
  documents: DocumentRecord[]
}

// Normalization guarantees the database invariant after the first successful
// run: a workspace exists, it has at least one openTabId, every openTabId has
// a matching document, and activeTabId is one of the openTabIds.
//
// Normalization is memoized at module level so React Strict Mode
// (mount -> unmount -> re-mount) cannot trigger a second migration or a
// second initial-document creation. If normalization throws, the cache is
// cleared so the next attempt retries.
//
// Document loading is intentionally NOT memoized: every mount reads fresh
// workspace + documents so leaving and reopening Text Pad cannot restore a
// stale snapshot.
interface NormalizationResult {
  persistenceStatus: PersistenceStatus
  // Present only when normalization produced a snapshot that could NOT be
  // committed to IndexedDB. loadBootstrapResult uses these directly instead
  // of re-reading an empty database.
  memoryOnlyWorkspace?: WorkspaceRecord
  memoryOnlyDocuments?: DocumentRecord[]
}

let normalizationPromise: Promise<NormalizationResult> | null = null

export function resetTextPadBootstrapForTests(): void {
  normalizationPromise = null
}

// Called after successful recovery so the next mount does not
// serve a stale memory-only normalization snapshot.
export function invalidateTextPadNormalization(): void {
  normalizationPromise = null
}

function ensureNormalized(): Promise<NormalizationResult> {
  if (!normalizationPromise) {
    normalizationPromise = runNormalization()
      .then((result) => {
        // save-error is retryable — do not cache so the next mount
        // re-attempts the repair. memory-only structural snapshots
        // MUST stay cached for Strict Mode.
        if (result.persistenceStatus === 'save-error') {
          normalizationPromise = null
        }
        return result
      })
      .catch((error) => {
        normalizationPromise = null
        throw error
      })
  }
  return normalizationPromise
}

const LEGACY_KEY = 'txtkit-editor-doc'

async function runNormalization(): Promise<NormalizationResult> {
  const legacy = window.localStorage.getItem(LEGACY_KEY)
  const workspace = await getWorkspace()
  const documents = await getAllDocuments()
  const documentIds = new Set(documents.map((doc) => doc.id))

  const validOpenIds =
    workspace?.openTabIds.filter((id) => documentIds.has(id)) ?? []

  const needsMigration =
    !workspace || !workspace.migrations.legacyLocalStorageMigrationCompleted

  // Case 1: legacy text needs migrating into a new document.
  if (needsMigration && legacy && legacy.length > 0) {
    return migrateLegacy(workspace, documents, validOpenIds, legacy)
  }

  // Case 2: no valid open tabs — first launch (or all tabs pointed at
  // deleted documents). Create the initial pad right here, inside the
  // memoized normalization, so Strict Mode cannot create a second one.
  if (validOpenIds.length === 0) {
    return createInitialDocument(workspace)
  }

  // Case 3: workspace exists with valid tabs but may need repair.
  // Repair is required when:
  //  - openTabIds reference vanished documents (already filtered above),
  //  - activeTabId points to an invalid or missing tab,
  //  - migration flag is still off.
  // The repair is a workspace-only commit; a failure leaves existing
  // documents readable and transitions to 'save-error'.
  if (workspace && validOpenIds.length > 0) {
    const normalizedActiveId =
      workspace.activeTabId &&
      validOpenIds.includes(workspace.activeTabId)
        ? workspace.activeTabId
        : validOpenIds[0]

    const openIdsChanged =
      validOpenIds.length !== workspace.openTabIds.length ||
      validOpenIds.some((id, i) => id !== workspace.openTabIds[i])

    const activeChanged =
      normalizedActiveId !== workspace.activeTabId

    const migrationChanged =
      !workspace.migrations.legacyLocalStorageMigrationCompleted

    if (openIdsChanged || activeChanged || migrationChanged) {
      const normalizedWorkspace: WorkspaceRecord = {
        ...workspace,
        openTabIds: validOpenIds,
        activeTabId: normalizedActiveId,
        migrations: {
          legacyLocalStorageMigrationCompleted: true,
        },
      }

      try {
        await enqueueWorkspaceMutation({
          workspace: normalizedWorkspace,
        })
        return { persistenceStatus: 'ready' }
      } catch {
        return { persistenceStatus: 'save-error' }
      }
    }
  }

  return { persistenceStatus: 'ready' }
}

async function migrateLegacy(
  workspace: WorkspaceRecord | undefined,
  existingDocuments: DocumentRecord[],
  validOpenIds: string[],
  legacy: string,
): Promise<NormalizationResult> {
  const id = crypto.randomUUID()
  const number = workspace?.nextUntitledNumber ?? 1
  const now = Date.now()

  const document: DocumentRecord = {
    id,
    title: `pad${number}`,
    content: legacy,
    selection: null,
    scrollTop: 0,
    contentRevision: 0,
    createdAt: now,
    updatedAt: now,
  }

  // Append the new legacy document to existing valid open tabs so
  // migration never silently removes tabs the user already had open.
  const nextWorkspace: WorkspaceRecord = {
    key: 'current',
    activeTabId: id,
    openTabIds: [
      ...validOpenIds.filter((existingId) => existingId !== id),
      id,
    ],
    nextUntitledNumber: number + 1,
    migrations: { legacyLocalStorageMigrationCompleted: true },
  }

  try {
    await enqueueWorkspaceMutation({
      workspace: nextWorkspace,
      putDocuments: [document],
      createdDocumentIds: [id],
    })
    window.localStorage.removeItem(LEGACY_KEY)
    return { persistenceStatus: 'ready' }
  } catch {
    // Keep legacy text in localStorage as a backup. Return the snapshot
    // so loadBootstrapResult can render it from memory.
    // Include existing documents for the valid open tabs in the
    // memory-only snapshot so the UI does not hide them when the
    // legacy-commit itself fails.
    return {
      persistenceStatus: 'memory-only',
      memoryOnlyWorkspace: nextWorkspace,
      memoryOnlyDocuments: [
        ...existingDocuments.filter((existing) =>
          validOpenIds.includes(existing.id),
        ),
        document,
      ],
    }
  }
}

async function createInitialDocument(
  workspace: WorkspaceRecord | undefined,
): Promise<NormalizationResult> {
  const id = crypto.randomUUID()
  const number = workspace?.nextUntitledNumber ?? 1
  const now = Date.now()

  const document: DocumentRecord = {
    id,
    title: `pad${number}`,
    content: '',
    selection: null,
    scrollTop: 0,
    contentRevision: 0,
    createdAt: now,
    updatedAt: now,
  }

  const nextWorkspace: WorkspaceRecord = {
    key: 'current',
    activeTabId: id,
    openTabIds: [id],
    nextUntitledNumber: number + 1,
    migrations: { legacyLocalStorageMigrationCompleted: true },
  }

  try {
    await enqueueWorkspaceMutation({
      workspace: nextWorkspace,
      putDocuments: [document],
      createdDocumentIds: [id],
    })
    return { persistenceStatus: 'ready' }
  } catch {
    return {
      persistenceStatus: 'memory-only',
      memoryOnlyWorkspace: nextWorkspace,
      memoryOnlyDocuments: [document],
    }
  }
}

interface LoadResult {
  workspace: WorkspaceRecord | undefined
  documents: DocumentRecord[]
  persistenceStatus: PersistenceStatus
}

function buildBootstrapResult(data: LoadResult): BootstrapResult {
  const { workspace, documents: allDocs, persistenceStatus } = data
  const docMap = new Map(allDocs.map((d) => [d.id, d]))

  const validIds = (workspace?.openTabIds ?? []).filter((id) => docMap.has(id))
  let activeId = workspace?.activeTabId ?? null
  if (activeId && !validIds.includes(activeId)) {
    activeId = validIds[0] ?? null
  }
  if (!activeId && validIds.length > 0) {
    activeId = validIds[0]
  }

  const tabs: Record<string, { title: string }> = {}
  const currentRev: Record<string, number> = {}
  const savedRev: Record<string, number> = {}
  const errors: Record<string, boolean> = {}
  const documents: DocumentRecord[] = []

  for (const id of validIds) {
    const d = docMap.get(id)!
    const persistedRevision =
      Number.isFinite(d.contentRevision) ? d.contentRevision : 0

    tabs[id] = { title: d.title }
    documents.push(d)
    currentRev[id] = persistedRevision
    savedRev[id] = persistedRevision
    errors[id] = false
  }

  // Pure: no writes, no mutations, no status guessing. persistenceStatus
  // is decided by normalization and passed through unchanged.
  return {
    activeTabId: activeId,
    openTabIds: validIds,
    tabsById: tabs,
    nextUntitledNumber: workspace?.nextUntitledNumber ?? 1,
    persistenceStatus,
    currentRevisionById: currentRev,
    savedRevisionById: savedRev,
    saveErrorById: errors,
    documents,
  }
}

// Module-level reconciliation for close-commit success. Extracted so the
// close/undo race conditions can be unit-tested without rendering React.
//
// On a successful workspace commit for a closed tab:
//   - if the tab is still in the undo list, bump its savedRevision;
//   - if the tab was already restored via Undo, mark it saved ONLY when
//     the store's current revision still equals the committed revision.
//     Using === (not <=) prevents marking a tab saved at a revision it
//     has already advanced past.
export function reconcileClosedDocumentCommit(
  id: string,
  committedRevision: number,
  undoEntries: Map<string, ClosedTabUndoEntry>,
): void {
  const entry = undoEntries.get(id)
  if (entry) {
    entry.savedRevision = Math.max(entry.savedRevision, committedRevision)
    return
  }
  const state = useTextPadStore.getState()
  if (
    state.openTabIds.includes(id) &&
    (state.currentRevisionById[id] ?? -1) === committedRevision
  ) {
    state.markSaved(id, committedRevision)
  }
}

// Each mount calls this. Normalization is cached; the fresh DB read is not.
async function loadBootstrapResult(): Promise<BootstrapResult> {
  const normalization = await ensureNormalized()

  if (
    normalization.memoryOnlyWorkspace &&
    normalization.memoryOnlyDocuments
  ) {
    return buildBootstrapResult({
      workspace: normalization.memoryOnlyWorkspace,
      documents: normalization.memoryOnlyDocuments,
      persistenceStatus: 'memory-only',
    })
  }

  const workspace = await getWorkspace()
  const documents = await getAllDocuments()

  return buildBootstrapResult({
    workspace,
    documents,
    persistenceStatus: normalization.persistenceStatus,
  })
}

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`
const inputClass =
  'h-8 w-28 rounded-lg border border-border-dim bg-surface-dim px-2 text-xs font-mono text-text outline-none placeholder:text-muted/50 focus:border-accent/50'

export function TextPadView() {
  // ---- Global store (prefs only) ----
  const editorPrefs = useStore((s) => s.editorPrefs)
  const setEditorPrefs = useStore((s) => s.setEditorPrefs)
  const setActiveToolId = useStore((s) => s.setActiveToolId)
  const { t } = useTranslation()

  // ---- TextPad store ----
  const store = useTextPadStore
  const activeTabId = store((s) => s.activeTabId)
  const tabsById = store((s) => s.tabsById)
  const persistenceStatus = store((s) => s.persistenceStatus)

  // ---- Refs ----
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const undoToastsRef = useRef<HTMLElement>(null)
  const undoOverflowButtonRef = useRef<HTMLButtonElement>(null)
  const undoOverflowDialogRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const runtimeTabs = useRef(new Map<string, RuntimeTabState>())
  const undoEntries = useRef(new Map<string, ClosedTabUndoEntry>())
  const undoTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const lastUpdatedAtById = useRef(new Map<string, number>())
  const activeTabIdRef = useRef<string | null>(null)
  const sessionGenerationById = useRef(new Map<string, number>())
  const disposed = useRef(false)
  const currentRAF = useRef<number | null>(null)
  const savingRef = useRef(new Map<string, boolean>())
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [initialized, setInitialized] = useState(false)
  const [undoList, setUndoList] = useState<Array<{ id: string; title: string }>>([])
  const [undoOverflowOpen, setUndoOverflowOpen] = useState(false)
  const undoOverflowId = useId()
  const visibleUndoItems = undoList.slice(-3)
  const hiddenUndoItems = undoList.slice(0, -3)
  const [documentVersion, setDocumentVersion] = useState(0)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [operationsOpen, setOperationsOpen] = useState(false)
  const [goToLineOpen, setGoToLineOpen] = useState(false)
  const [goToLineValue, setGoToLineValue] = useState('')
  const [goToLineError, setGoToLineError] = useState('')
  const [goToLineTotal, setGoToLineTotal] = useState(0)
  const goToLineInputRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceInput = useStore((s) => s.input)
  const [pendingSourceInput, setPendingSourceInput] = useState<string | null>(() =>
    sourceInput.length > 0 ? sourceInput : null,
  )

  useEffect(() => {
    if (hiddenUndoItems.length === 0) setUndoOverflowOpen(false)
  }, [hiddenUndoItems.length])

  useEffect(() => {
    if (!undoOverflowOpen) return undefined

    const closeOverflow = () => {
      setUndoOverflowOpen(false)
      undoOverflowButtonRef.current?.focus()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverflow()
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!undoToastsRef.current?.contains(event.target as Node)) closeOverflow()
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true)
    }
  }, [undoOverflowOpen])

  useEffect(() => {
    if (!undoOverflowOpen) return
    undoOverflowDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [undoOverflowOpen])

  // Keep ref in sync
  activeTabIdRef.current = activeTabId

  const editorPrefsRef = useRef(editorPrefs)
  editorPrefsRef.current = editorPrefs

  const stats = useMemo(() => {
    const text = viewRef.current?.state.doc.toString() ?? ''
    return getTextPadStats(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, documentVersion])

  useEffect(() => {
    if (sourceInput.length > 0) setPendingSourceInput(sourceInput)
  }, [sourceInput])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: cmSetSearchQuery.of(new SearchQuery({ search: searchTerm, replace: replaceText, caseSensitive })) })
  }, [searchTerm, replaceText, caseSensitive])

  // ---- Helpers ----

  function getLoggerRevision(tabId: string): number {
    return store.getState().currentRevisionById[tabId] ?? 0
  }

  function getSavedRevision(tabId: string): number {
    return store.getState().savedRevisionById[tabId] ?? 0
  }

  function isDirty(tabId: string): boolean {
    return getLoggerRevision(tabId) > getSavedRevision(tabId)
  }

  function captureDocument(tabId: string): DocumentContentPatch | null {
    const contentRevision = getLoggerRevision(tabId)
    const currentActive = activeTabIdRef.current
    if (currentActive === tabId && viewRef.current) {
      return {
        content: viewRef.current.state.doc.toString(),
        selection: viewRef.current.state.selection.toJSON(),
        scrollTop: viewRef.current.scrollDOM.scrollTop,
        contentRevision,
        updatedAt: nextDocumentUpdatedAt(tabId),
      }
    }
    const rt = runtimeTabs.current.get(tabId)
    if (!rt) return null
    return {
      content: rt.editorState.doc.toString(),
      selection: rt.editorState.selection.toJSON(),
      scrollTop: rt.scrollTop,
      contentRevision,
      updatedAt: nextDocumentUpdatedAt(tabId),
    }
  }

  function captureRuntimeTabState(id: string): RuntimeTabState | null {
    const currentActive = activeTabIdRef.current
    const existing = runtimeTabs.current.get(id)
    if (id === currentActive && viewRef.current) {
      return {
        editorState: viewRef.current.state,
        scrollTop: viewRef.current.scrollDOM.scrollTop,
        title: store.getState().tabsById[id]?.title ?? existing?.title ?? '',
        createdAt: existing?.createdAt ?? Date.now(),
      }
    }
    return existing ?? null
  }

  function bumpSessionGeneration(id: string): void {
    const current = sessionGenerationById.current.get(id) ?? 0
    sessionGenerationById.current.set(id, current + 1)
  }

  function getSessionGeneration(id: string): number {
    return sessionGenerationById.current.get(id) ?? 0
  }

  function nextDocumentUpdatedAt(id: string): number {
    const previous = lastUpdatedAtById.current.get(id) ?? 0
    const next = Math.max(Date.now(), previous + 1)
    lastUpdatedAtById.current.set(id, next)
    return next
  }

  function canSave(tabId: string): boolean {
    void tabId
    const s = store.getState()
    if (s.persistenceStatus === 'quota-error') return false
    if (s.persistenceStatus === 'memory-only') return false
    if (disposed.current) return false
    return true
  }

  function buildRecoverySnapshots(): DocumentRecord[] {
    const s = store.getState()
    const result: DocumentRecord[] = []
    for (const id of s.openTabIds) {
      const patch = captureDocument(id)
      const rt = runtimeTabs.current.get(id)
      if (!patch || !rt) continue
      result.push({
        id,
        title: s.tabsById[id]?.title ?? id,
        content: patch.content,
        selection: patch.selection,
        scrollTop: patch.scrollTop,
        contentRevision: patch.contentRevision,
        createdAt: rt.createdAt,
        updatedAt: patch.updatedAt,
      })
    }
    return result
  }

  // Unified helper: switch active tab, restore scroll, focus editor.
  // Used by handleSelectTab, handleCloseTab, handleUndoClose.
  function activateRuntimeTab(id: string, runtime: RuntimeTabState): void {
    activeTabIdRef.current = id
    const view = viewRef.current
    if (!view) return
    view.setState(runtime.editorState)
    if (currentRAF.current !== null) cancelAnimationFrame(currentRAF.current)
    const restoreId = id
    const restoreScroll = runtime.scrollTop
    currentRAF.current = requestAnimationFrame(() => {
      if (activeTabIdRef.current === restoreId && viewRef.current) {
        viewRef.current.scrollDOM.scrollTop = restoreScroll
        viewRef.current.focus()
      }
      currentRAF.current = null
    })
  }

  // ---- Initial load effect ----
  // Normalization is memoized at module level so Strict Mode does not
  // duplicate migration or initial-document creation.
  // Workspace and documents are read fresh for every component mount,
  // so leaving and reopening Text Pad cannot restore a stale snapshot.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const result = await loadBootstrapResult()
        if (cancelled) return

        // Clear any leftover runtime state from a prior instance before
        // hydrating, so re-mounts (Strict Mode or route changes) cannot
        // accumulate stale runtime tabs.
        runtimeTabs.current.clear()
        lastUpdatedAtById.current.clear()

        // Apply result to THIS instance's store + refs.
        // workspaceSaveError is reset here — a stale error from a
        // previous instance must not survive remount.
        store.setState({
          activeTabId: result.activeTabId,
          openTabIds: result.openTabIds,
          tabsById: result.tabsById,
          nextUntitledNumber: result.nextUntitledNumber,
          persistenceStatus: result.persistenceStatus,
          currentRevisionById: result.currentRevisionById,
          savedRevisionById: result.savedRevisionById,
          saveErrorById: result.saveErrorById,
          workspaceSaveError: false,
        })

        // Seed updatedAt clock from persisted records and build runtime tabs
        for (const doc of result.documents) {
          lastUpdatedAtById.current.set(doc.id, doc.updatedAt)
          const state = createEditorState({
            doc: doc.content,
            selection: doc.selection,
            lineWrapping: editorPrefs.lineWrapping,
            showWhitespace: editorPrefs.showWhitespace,
          })
          runtimeTabs.current.set(doc.id, {
            editorState: state,
            scrollTop: doc.scrollTop,
            title: doc.title,
            createdAt: doc.createdAt,
          })
        }

        setRecoverySnapshotFn(() => buildRecoverySnapshots())
        setInitialized(true)
      } catch {
        if (cancelled) return
        // Memory-only fallback — clear any stale runtime state first.
        runtimeTabs.current.clear()
        lastUpdatedAtById.current.clear()
        store.getState().setPersistenceStatus('memory-only')
        const docId = crypto.randomUUID()
        const createdAt = Date.now()
        lastUpdatedAtById.current.set(docId, createdAt)
        const state = createEditorState({
          doc: '',
          lineWrapping: editorPrefs.lineWrapping,
          showWhitespace: editorPrefs.showWhitespace,
        })
        runtimeTabs.current.set(docId, {
          editorState: state,
          scrollTop: 0,
          title: 'pad1',
          createdAt,
        })
        store.setState({
          activeTabId: docId,
          openTabIds: [docId],
          tabsById: { [docId]: { title: 'pad1' } },
          nextUntitledNumber: 2,
          persistenceStatus: 'memory-only',
          currentRevisionById: { [docId]: 0 },
          savedRevisionById: { [docId]: 0 },
          saveErrorById: { [docId]: false },
          workspaceSaveError: false,
        })
        setRecoverySnapshotFn(() => buildRecoverySnapshots())
        setInitialized(true)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  // ---- Save loop ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const startSaveLoop = useCallback(
    (tabId: string) => {
      if (savingRef.current.get(tabId)) return
      if (!canSave(tabId)) return

      savingRef.current.set(tabId, true)
      const gen = getSessionGeneration(tabId)
      const run = async () => {
        try {
          while (isDirty(tabId) && canSave(tabId)) {
            const revision = getLoggerRevision(tabId)
            const patch = captureDocument(tabId)
            if (!patch) break

            try {
              const result = await enqueueDocumentWrite(tabId, patch)
              if (result === 'superseded') continue
              if (getSessionGeneration(tabId) !== gen) break
              store.getState().markSaved(tabId, revision)
              store.getState().setSaveError(tabId, false)
              store.getState().checkSaveErrorRecovery()
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'QuotaExceededError') {
                store.getState().setPersistenceStatus('quota-error')
                store.getState().setSaveError(tabId, true)
                break
              }

              store.getState().setSaveError(tabId, true)

              // memory-only and quota-error are sticky. A document-level
              // write failure must not downgrade them to retryable save-error.
              const s = store.getState()
              if (
                s.persistenceStatus === 'memory-only' ||
                s.persistenceStatus === 'quota-error'
              ) {
                break
              }

              store.getState().setPersistenceStatus('save-error')

              await new Promise((r) => setTimeout(r, 2000))

              // After the delay the app may have transitioned to a sticky
              // state (e.g. creation commit for a new tab failed).
              if (!canSave(tabId)) break

              const latestRev = getLoggerRevision(tabId)
              if (latestRev !== revision) continue

              try {
                const retryResult = await enqueueDocumentWrite(tabId, patch)
                if (retryResult === 'superseded') continue
                if (getSessionGeneration(tabId) !== gen) break
                store.getState().markSaved(tabId, revision)
                store.getState().setSaveError(tabId, false)
                store.getState().checkSaveErrorRecovery()
              } catch {
                store.getState().setSaveError(tabId, true)
                break
              }
            }
          }
        } finally {
          savingRef.current.set(tabId, false)
          // If the session generation changed (close → undo → edit),
          // a new save loop may need to start for the same tab id.
          if (
            getSessionGeneration(tabId) !== gen &&
            isDirty(tabId) &&
            canSave(tabId)
          ) {
            startSaveLoop(tabId)
          }
        }
      }
      void run()
    },
    [],
  )

  // ---- CodeMirror setup ----
  // Created once after bootstrap. Tab switching uses view.setState(), never recreates the view.
  useEffect(() => {
    if (!hostRef.current || !initialized) return

    disposed.current = false

    const activeId = activeTabIdRef.current
    let state: import('@codemirror/state').EditorState
    if (activeId && runtimeTabs.current.has(activeId)) {
      state = runtimeTabs.current.get(activeId)!.editorState
    } else {
      state = createEditorState({ doc: '' })
    }

    const view = new EditorView({
      state,
      parent: hostRef.current,
      dispatchTransactions: (trs) => {
        view.update(trs)

        const tabId = activeTabIdRef.current
        if (!tabId) return

        // ALWAYS update runtime cache. Note: scroll is NOT covered by transactions;
        // it's captured explicitly on switch/hidden/unmount.
        const existing = runtimeTabs.current.get(tabId)
        runtimeTabs.current.set(tabId, {
          editorState: view.state,
          scrollTop: view.scrollDOM.scrollTop,
          title: store.getState().tabsById[tabId]?.title ?? existing?.title ?? '',
          createdAt: existing?.createdAt ?? Date.now(),
        })

        // Revision bump + debounce only on content change
        if (trs.some((tr) => tr.docChanged)) {
          store.getState().bumpRevision(tabId)
          setDocumentVersion((v) => v + 1)

          if (debounceTimers.current.has(tabId)) {
            clearTimeout(debounceTimers.current.get(tabId))
          }
          debounceTimers.current.set(
            tabId,
            setTimeout(() => {
              debounceTimers.current.delete(tabId)
              startSaveLoop(tabId)
            }, 300),
          )
        }
      },
    })
    viewRef.current = view

    return () => {
      // Capture final runtime state before destroy
      const currentId = activeTabIdRef.current
      if (currentId && viewRef.current) {
        const existing = runtimeTabs.current.get(currentId)
        runtimeTabs.current.set(currentId, {
          editorState: viewRef.current.state,
          scrollTop: viewRef.current.scrollDOM.scrollTop,
          title: store.getState().tabsById[currentId]?.title ?? existing?.title ?? '',
          createdAt: existing?.createdAt ?? Date.now(),
        })
      }
      view.destroy()
      viewRef.current = null
    }
  }, [initialized])

  // ---- Sync CodeMirror prefs (apply to ALL runtime tabs) ----
  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: wrappingCompartment.reconfigure(
        editorPrefs.lineWrapping ? EditorView.lineWrapping : [],
      ),
    })
    // Update non-active runtime states so they stay consistent on switch
    for (const [id, runtime] of runtimeTabs.current) {
      if (id === activeTabIdRef.current) continue
      const tr = runtime.editorState.update({
        effects: wrappingCompartment.reconfigure(
          editorPrefs.lineWrapping ? EditorView.lineWrapping : [],
        ),
      })
      runtimeTabs.current.set(id, { ...runtime, editorState: tr.state })
    }
  }, [editorPrefs.lineWrapping])

  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: whitespaceCompartment.reconfigure(
        editorPrefs.showWhitespace ? highlightSpecialChars() : [],
      ),
    })
    for (const [id, runtime] of runtimeTabs.current) {
      if (id === activeTabIdRef.current) continue
      const tr = runtime.editorState.update({
        effects: whitespaceCompartment.reconfigure(
          editorPrefs.showWhitespace ? highlightSpecialChars() : [],
        ),
      })
      runtimeTabs.current.set(id, { ...runtime, editorState: tr.state })
    }
  }, [editorPrefs.showWhitespace])

  function persistWorkspaceInBackground(
    workspace: WorkspaceRecord,
    putDocuments?: DocumentRecord[],
    createdDocumentIds?: string[],
  ): void {
    void enqueueWorkspaceMutation({ workspace, putDocuments, createdDocumentIds }).catch(() => {})
  }

  /** Returns the promise so callers can bump savedRevision on success. */
  function persistWorkspace(
    workspace: WorkspaceRecord,
    putDocuments?: DocumentRecord[],
    createdDocumentIds?: string[],
  ): Promise<void> {
    return enqueueWorkspaceMutation({ workspace, putDocuments, createdDocumentIds })
  }

  // ---- Tab actions: select ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const handleSelectTab = useCallback((id: string) => {
    if (id === activeTabIdRef.current) return

    const currentId = activeTabIdRef.current
    if (currentId) {
      const rt = captureRuntimeTabState(currentId)
      if (rt) runtimeTabs.current.set(currentId, rt)
    }

    store.getState().setActiveTab(id)
    const target = runtimeTabs.current.get(id)
    if (target) activateRuntimeTab(id, target)

    const s = store.getState()
    persistWorkspaceInBackground({
      key: 'current',
      activeTabId: id,
      openTabIds: [...s.openTabIds],
      nextUntitledNumber: s.nextUntitledNumber,
      migrations: { legacyLocalStorageMigrationCompleted: true },
    })

    // Persist selection/scroll for the tab we're leaving.
    // If content is dirty, the save loop handles everything (including metadata).
    // If content is clean, do a metadata-only write.
    if (currentId && canSave(currentId)) {
      if (isDirty(currentId)) {
        startSaveLoop(currentId)
      } else {
        const metaPatch = captureDocument(currentId)
        if (metaPatch) {
          void enqueueDocumentWrite(currentId, metaPatch).catch(() => {})
        }
      }
    }
  }, [])

  // ---- Persistence recovery (shared between quota and memory-only) ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const handleRetryPersistence = useCallback(async () => {
    try {
      await resumeWorkspacePersistence()
      invalidateTextPadNormalization()
      const state = store.getState()
      if (state.persistenceStatus === 'memory-only') {
        state.clearStickyPersistenceError('memory-only')
      } else if (state.persistenceStatus === 'quota-error') {
        state.clearStickyPersistenceError('quota-error')
      }
      for (const id of store.getState().openTabIds) {
        if (isDirty(id) && canSave(id)) startSaveLoop(id)
      }
    } catch {
      // Documents remain available for export when recovery fails.
    }
  }, [])

  // ---- Tab actions: create ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const handleNewTab = useCallback(() => {
    const s = store.getState()
    const nextNum = s.nextUntitledNumber
    const title = `pad${nextNum}`
    const id = crypto.randomUUID()
    const createdAt = Date.now()
    const state = createEditorState({
      doc: '',
      lineWrapping: editorPrefsRef.current.lineWrapping,
      showWhitespace: editorPrefsRef.current.showWhitespace,
    })
    lastUpdatedAtById.current.set(id, createdAt)
    runtimeTabs.current.set(id, { editorState: state, scrollTop: 0, title, createdAt })
    activeTabIdRef.current = id
    store.getState().addTab(id, title, nextNum + 1)

    if (viewRef.current) {
      viewRef.current.setState(state)
      viewRef.current.focus()
    }

    void persistWorkspace(
      {
        key: 'current',
        activeTabId: id,
        openTabIds: [...store.getState().openTabIds],
        nextUntitledNumber: nextNum + 1,
        migrations: { legacyLocalStorageMigrationCompleted: true },
      },
      [{
        id, title, content: '', selection: null, scrollTop: 0,
        contentRevision: 0, createdAt, updatedAt: createdAt,
      }],
      [id],
    ).catch(() => {})
  }, [])

  // ---- Tab actions: close ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const handleCloseTab = useCallback((id: string) => {
    const s = store.getState()
    if (!s.openTabIds.includes(id)) return

    const isLastTab = s.openTabIds.length === 1
    const rt = captureRuntimeTabState(id)
    const patch = captureDocument(id)
    const index = s.openTabIds.indexOf(id)
    const currentRev = getLoggerRevision(id)
    const savedRev = getSavedRevision(id)
    const title = s.tabsById[id]?.title ?? id
    const debounceTimer = debounceTimers.current.get(id)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimers.current.delete(id)
    }

    const closedDocRecord: DocumentRecord | null = patch
      ? {
          id, title, content: patch.content, selection: patch.selection,
          scrollTop: patch.scrollTop, contentRevision: currentRev,
          createdAt: rt?.createdAt ?? Date.now(), updatedAt: patch.updatedAt,
        }
      : null

    let newId: string | null = null
    let newState: RuntimeTabState | null = null
    let nextUntitledNumber = s.nextUntitledNumber
    if (isLastTab) {
      newId = crypto.randomUUID()
      const createdAt = Date.now()
      const newTitle = 'pad1'
      const editorState = createEditorState({
        doc: '',
        lineWrapping: editorPrefsRef.current.lineWrapping,
        showWhitespace: editorPrefsRef.current.showWhitespace,
      })
      newState = { editorState, scrollTop: 0, title: newTitle, createdAt }
      lastUpdatedAtById.current.set(newId, createdAt)
      runtimeTabs.current.set(newId, newState)
      activeTabIdRef.current = newId
      store.getState().addTab(newId, newTitle, 2)
      nextUntitledNumber = 2
    }

    const result = store.getState().closeTab(id)
    if (!result) return
    if (rt) {
      undoEntries.current.set(id, { id, index, runtimeState: rt, currentRevision: currentRev, savedRevision: savedRev })
    }
    bumpSessionGeneration(id)
    runtimeTabs.current.delete(id)

    if (isLastTab && newId && newState) {
      activateRuntimeTab(newId, newState)
    } else if (s.activeTabId === id) {
      const newActiveId = store.getState().activeTabId
      const target = newActiveId ? runtimeTabs.current.get(newActiveId) : undefined
      if (newActiveId && target) activateRuntimeTab(newActiveId, target)
    }

    const timeout = setTimeout(() => {
      undoEntries.current.delete(id)
      undoTimeouts.current.delete(id)
      setUndoList((previous) => previous.filter((entry) => entry.id !== id))
    }, 5000)
    undoTimeouts.current.set(id, timeout)
    setUndoList((previous) => [...previous, { id, title }])

    const replacement: DocumentRecord[] = newId && newState
      ? [{
          id: newId, title: newState.title, content: '', selection: null,
          scrollTop: 0, contentRevision: 0, createdAt: newState.createdAt,
          updatedAt: newState.createdAt,
        }]
      : []
    void persistWorkspace(
      {
        key: 'current', activeTabId: store.getState().activeTabId,
        openTabIds: [...store.getState().openTabIds], nextUntitledNumber,
        migrations: { legacyLocalStorageMigrationCompleted: true },
      },
      [...(closedDocRecord ? [closedDocRecord] : []), ...replacement],
      newId ? [newId] : [],
    ).then(() => {
      reconcileClosedDocumentCommit(id, currentRev, undoEntries.current)
    }).catch(() => {})
  }, [])

  // ---- Undo close ----
  // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read fresh state via refs/store.getState()
  const handleUndoClose = useCallback((id: string) => {
    const entry = undoEntries.current.get(id)
    if (!entry) return
    bumpSessionGeneration(id)
    const timeout = undoTimeouts.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      undoTimeouts.current.delete(id)
    }
    activeTabIdRef.current = id
    store.getState().undoCloseTab(id, entry.index, entry.runtimeState.title, entry.currentRevision, entry.savedRevision)
    runtimeTabs.current.set(id, entry.runtimeState)
    undoEntries.current.delete(id)
    setUndoList((previous) => previous.filter((item) => item.id !== id))
    activateRuntimeTab(id, entry.runtimeState)
    const s = store.getState()
    persistWorkspaceInBackground({
      key: 'current', activeTabId: id, openTabIds: [...s.openTabIds],
      nextUntitledNumber: s.nextUntitledNumber,
      migrations: { legacyLocalStorageMigrationCompleted: true },
    })
  }, [])

  // ---- Lifecycle: visibility change ----
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'hidden') return
      const currentId = activeTabIdRef.current
      if (currentId) {
        const runtime = captureRuntimeTabState(currentId)
        if (runtime) runtimeTabs.current.set(currentId, runtime)
      }
      for (const id of store.getState().openTabIds) {
        const patch = captureDocument(id)
        if (patch) void enqueueDocumentWrite(id, patch).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // ---- Lifecycle: unmount cleanup ----
  useEffect(() => () => {
    disposed.current = true
    for (const timer of debounceTimers.current.values()) clearTimeout(timer)
    debounceTimers.current.clear()
    for (const timer of undoTimeouts.current.values()) clearTimeout(timer)
    undoTimeouts.current.clear()
    undoEntries.current.clear()
    const currentId = activeTabIdRef.current
    if (currentId) {
      const runtime = captureRuntimeTabState(currentId)
      if (runtime) runtimeTabs.current.set(currentId, runtime)
    }
    for (const id of store.getState().openTabIds) {
      const patch = captureDocument(id)
      if (patch) void enqueueDocumentWrite(id, patch).catch(() => {})
    }
    clearRecoverySnapshotFn()
  }, [])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.isContentEditable && !target.closest('.cm-editor'))) return
      if (!rootRef.current?.contains(target)) return
      if (event.altKey && event.shiftKey && event.code === 'KeyN') {
        event.preventDefault()
        handleNewTab()
      } else if (event.altKey && event.shiftKey && event.code === 'KeyW') {
        event.preventDefault()
        const id = store.getState().activeTabId
        if (id) handleCloseTab(id)
      } else if (event.altKey && event.shiftKey && (event.code === 'ArrowRight' || event.code === 'ArrowLeft')) {
        event.preventDefault()
        const state = store.getState()
        const index = state.openTabIds.indexOf(state.activeTabId ?? '')
        const offset = event.code === 'ArrowRight' ? 1 : -1
        const id = state.openTabIds[(index + offset + state.openTabIds.length) % state.openTabIds.length]
        if (id) handleSelectTab(id)
      } else if (event.altKey && event.shiftKey && event.code >= 'Digit1' && event.code <= 'Digit9') {
        event.preventDefault()
        const id = store.getState().openTabIds[Number(event.code.slice(-1)) - 1]
        if (id) handleSelectTab(id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewTab, handleCloseTab, handleSelectTab])

  const handleCopy = () => {
    void copyToClipboard(viewRef.current?.state.doc.toString() ?? '')
  }

  const replaceWholeDoc = (next: string, userEvent: string) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      userEvent,
    })
  }

  const handleQuickOp = (op: 'removeEmptyLines' | 'removeDuplicateLines' | 'sortLines' | 'trimLines' | 'shuffleLines' | 'toLowerCase' | 'toUpperCase' | 'sentenceCase' | 'titleCase' | 'htmlEscape' | 'htmlUnescape' | 'urlEncode' | 'urlDecode' | 'formatJson' | 'minifyJson') => {
    const current = viewRef.current?.state.doc.toString() ?? ''
    const userEvent = `input.textPad.${op}`
    switch (op) {
      case 'removeEmptyLines':
        replaceWholeDoc(removeEmptyLines(current), userEvent)
        break
      case 'removeDuplicateLines':
        replaceWholeDoc(removeDuplicateLines(current), userEvent)
        break
      case 'sortLines':
        replaceWholeDoc(sortLines(current), userEvent)
        break
      case 'trimLines':
        replaceWholeDoc(trimLines(current), userEvent)
        break
      case 'shuffleLines':
        replaceWholeDoc(shuffleLines(current), userEvent)
        break
      case 'toLowerCase':
        replaceWholeDoc(toLowerCase(current), userEvent)
        break
      case 'toUpperCase':
        replaceWholeDoc(toUpperCase(current), userEvent)
        break
      case 'sentenceCase':
        replaceWholeDoc(toSentenceCase(current), userEvent)
        break
      case 'titleCase':
        replaceWholeDoc(toTitleCase(current), userEvent)
        break
      case 'htmlEscape':
        replaceWholeDoc(htmlEscape(current), userEvent)
        break
      case 'htmlUnescape':
        replaceWholeDoc(htmlUnescape(current), userEvent)
        break
      case 'urlEncode':
        replaceWholeDoc(urlEncode(current), userEvent)
        break
      case 'urlDecode':
        replaceWholeDoc(urlDecode(current), userEvent)
        break
      case 'formatJson':
        try {
          replaceWholeDoc(formatJson(current), userEvent)
          setFormatError(null)
        } catch (e) {
          setFormatError((e as Error).message)
        }
        break
      case 'minifyJson':
        try {
          replaceWholeDoc(minifyJson(current), userEvent)
          setFormatError(null)
        } catch (e) {
          setFormatError((e as Error).message)
        }
        break
    }
  }

  const handleAddPrefixSuffix = () => {
    const current = viewRef.current?.state.doc.toString() ?? ''
    if (!prefix && !suffix) return
    replaceWholeDoc(addPrefixSuffix(current, { prefix, suffix }), 'input.textPad.addPrefixSuffix')
  }

  const handleImportSourceInput = () => {
    if (pendingSourceInput === null) return
    replaceWholeDoc(pendingSourceInput, 'input.textPad.importSourceInput')
    setPendingSourceInput(null)
  }

  const handleClear = () => {
    const view = viewRef.current
    if (!view) return
    if (window.confirm(t('textPad.confirmClear'))) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        userEvent: 'input.textPad.clear',
      })
    }
  }

  const handleGoToLineClose = useCallback(() => {
    setGoToLineOpen(false)
    setGoToLineError('')
  }, [])

  const handleGoToLineSubmit = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const num = Number(goToLineValue)
    const total = view.state.doc.lines
    if (!Number.isFinite(num) || num % 1 !== 0 || num < 1 || num > total) {
      setGoToLineError(
        !Number.isFinite(num) || num % 1 !== 0 || num < 1
          ? t('textPad.goToLine.errorInvalid')
          : t('textPad.goToLine.errorOutOfRange'),
      )
      return
    }
    const line = view.state.doc.line(num)
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    setGoToLineOpen(false)
    view.focus()
  }, [goToLineValue, t])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    const view = viewRef.current
    if (view) {
      view.dispatch({ effects: cmSetSearchQuery.of(new SearchQuery({ search: '' })) })
      view.focus()
    }
  }, [])

  const handleFindNext = useCallback(() => {
    const view = viewRef.current
    if (view) cmFindNext(view)
  }, [])

  const handleFindPrev = useCallback(() => {
    const view = viewRef.current
    if (view) cmFindPrevious(view)
  }, [])

  const handleReplaceNext = useCallback(() => {
    const view = viewRef.current
    if (view) cmReplaceNext(view)
  }, [])

  const handleReplaceAll = useCallback(() => {
    const view = viewRef.current
    if (view) cmReplaceAll(view)
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const view = viewRef.current
    if (!view) {
      e.target.value = ''
      return
    }
    if ((view.state.doc.toString() ?? '').length > 0) {
      if (!window.confirm(t('textPad.confirmImportReplace'))) {
        e.target.value = ''
        return
      }
    }
    const text = await file.text()
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      userEvent: 'input.textPad.importTxt',
    })
    e.target.value = ''
  }

  return (
    <div ref={rootRef} className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-2" data-testid="text-pad-view">
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setActiveToolId(null)}
            className={buttonIdle}
          >
            {t('textPad.toolbar.backToTools')}
          </button>
          <span className="text-base leading-none text-accent">✎</span>
          <h2 className="text-sm font-semibold text-text">{t('textPad.title')}</h2>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {pendingSourceInput !== null && (
            <button onClick={handleImportSourceInput} className={buttonActive}>
              {t('textPad.importFromInput.action')}
            </button>
          )}
          <button
            onClick={() => setOperationsOpen((open) => !open)}
            className={operationsOpen ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.operations')} {operationsOpen ? '▴' : '▾'}
          </button>
          <button onClick={() => {
            setGoToLineTotal(viewRef.current?.state.doc.lines ?? 0)
            setSearchOpen(false)
            setGoToLineOpen(true)
            requestAnimationFrame(() => goToLineInputRef.current?.focus())
          }} className={buttonIdle}>
            {t('textPad.goToLine.title')}
          </button>
          <button onClick={() => {
            setGoToLineOpen(false)
            setSearchOpen(true)
            requestAnimationFrame(() => searchInputRef.current?.focus())
          }} className={buttonIdle}>
            {t('textPad.search.title')}
          </button>
          <button
            onClick={handleCopy}
            className={buttonIdle}
          >
            {t('textPad.toolbar.copy')}
          </button>
          <button
            onClick={handleUploadClick}
            className={buttonIdle}
          >
            {t('textPad.toolbar.uploadTxt')}
          </button>
          <button
            onClick={() => downloadTextFile(viewRef.current?.state.doc.toString() ?? '')}
            className={buttonIdle}
          >
            {t('textPad.toolbar.downloadTxt')}
          </button>
          <button
            onClick={() => setEditorPrefs({ lineWrapping: !editorPrefs.lineWrapping })}
            className={editorPrefs.lineWrapping ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.wrap')}
          </button>
          <button
            onClick={() => setEditorPrefs({ showWhitespace: !editorPrefs.showWhitespace })}
            className={editorPrefs.showWhitespace ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.whitespace')}
          </button>
          <button
            onClick={handleClear}
            className={buttonDanger}
          >
            {t('textPad.toolbar.clear')}
          </button>
        </div>
      </header>

      {undoList.length > 0 && (
        <aside
          ref={undoToastsRef}
          data-testid="text-pad-undo-toasts"
          aria-live="polite"
          className="fixed inset-y-4 right-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2">
            {undoOverflowOpen && (
              <div
                ref={undoOverflowDialogRef}
                id={undoOverflowId}
                role="dialog"
                aria-label={t('textPad.undo.moreClosedTabs')}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg"
              >
                {hiddenUndoItems.map(({ id, title }) => (
                  <div key={id} className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs" data-testid={`undo-${id}`}>
                    <span className="flex-1 text-text">{t('textPad.undo.closeTab', { title })}</span>
                    <button onClick={() => handleUndoClose(id)} className="min-h-9 rounded bg-accent/20 px-3 text-xs font-mono text-accent hover:bg-accent/30">
                      {t('textPad.undo.restore')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hiddenUndoItems.length > 0 && (
              <div>
                <button
                  type="button"
                  ref={undoOverflowButtonRef}
                  aria-controls={undoOverflowOpen ? undoOverflowId : undefined}
                  aria-haspopup="dialog"
                  aria-expanded={undoOverflowOpen}
                  onClick={() => setUndoOverflowOpen((open) => !open)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-mono text-muted hover:border-accent/40 hover:text-accent"
                >
                  {t('textPad.undo.more', { count: hiddenUndoItems.length })}
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {visibleUndoItems.map(({ id, title }) => (
                <div key={id} className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs" data-testid={`undo-${id}`}>
                  <span className="flex-1 text-text">{t('textPad.undo.closeTab', { title })}</span>
                  <button onClick={() => handleUndoClose(id)} className="min-h-9 rounded bg-accent/20 px-3 text-xs font-mono text-accent hover:bg-accent/30">
                    {t('textPad.undo.restore')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {(persistenceStatus === 'memory-only' || persistenceStatus === 'quota-error') && (
        <div
          role="alert"
          data-testid={persistenceStatus === 'quota-error' ? 'quota-banner' : 'memory-only-banner'}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <span className="flex-1">{persistenceStatus === 'quota-error' ? t('textPad.quota.title') : t('textPad.memoryOnly')}</span>
          <button onClick={() => {
            const title = activeTabId ? tabsById[activeTabId]?.title ?? 'pad' : 'pad'
            downloadTextFile(viewRef.current?.state.doc.toString() ?? '', `${title}.txt`)
          }} className={buttonIdle}>{t('textPad.quota.exportCurrent')}</button>
          <button onClick={async () => {
            const documents = new Map<string, { title: string; content: string }>()
            try {
              for (const doc of await getAllDocuments()) documents.set(doc.id, { title: doc.title, content: doc.content })
            } catch {
              // IndexedDB may be unavailable while persistence is memory-only.
            }
            for (const id of store.getState().openTabIds) {
              const patch = captureDocument(id)
              if (patch) documents.set(id, { title: store.getState().tabsById[id]?.title ?? id, content: patch.content })
            }
            for (const [id, entry] of undoEntries.current) documents.set(id, { title: entry.runtimeState.title, content: entry.runtimeState.editorState.doc.toString() })
            downloadJsonBackup([...documents.values()])
          }} className={buttonIdle}>{t('textPad.quota.exportAll')}</button>
          {persistenceStatus === 'memory-only' ? (
            <button onClick={() => { void handleRetryPersistence() }} className={buttonIdle}>{t('textPad.persistence.retry')}</button>
          ) : (
            <button onClick={async () => {
              const { deleteDocuments } = await import('../../db/textPadRepository')
              const closedIds = (await getAllDocuments()).map((doc) => doc.id).filter((id) => !store.getState().openTabIds.includes(id) && !undoEntries.current.has(id))
              if (closedIds.length === 0) {
                alert(t('textPad.quota.noClosed'))
                return
              }
              if (!window.confirm(t('textPad.quota.deleteConfirm', { count: String(closedIds.length) }))) return
              await deleteDocuments(closedIds)
              await handleRetryPersistence()
            }} className={buttonIdle}>{t('textPad.quota.deleteClosed')}</button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileChange}
        className="hidden"
      />

      {operationsOpen && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.lines')}</span>
            <button onClick={() => handleQuickOp('removeEmptyLines')} className={buttonIdle}>
              {t('textPad.ops.removeEmptyLines')}
            </button>
            <button onClick={() => handleQuickOp('removeDuplicateLines')} className={buttonIdle}>
              {t('textPad.ops.removeDuplicateLines')}
            </button>
            <button onClick={() => handleQuickOp('sortLines')} className={buttonIdle}>
              {t('textPad.ops.sortLines')}
            </button>
            <button onClick={() => handleQuickOp('trimLines')} className={buttonIdle}>
              {t('textPad.ops.trimLines')}
            </button>
            <button onClick={() => handleQuickOp('shuffleLines')} className={buttonIdle}>
              {t('textPad.ops.shuffleLines')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.case')}</span>
            <button onClick={() => handleQuickOp('toLowerCase')} className={buttonIdle}>
              {t('textPad.ops.toLowerCase')}
            </button>
            <button onClick={() => handleQuickOp('toUpperCase')} className={buttonIdle}>
              {t('textPad.ops.toUpperCase')}
            </button>
            <button onClick={() => handleQuickOp('sentenceCase')} className={buttonIdle}>
              {t('textPad.ops.sentenceCase')}
            </button>
            <button onClick={() => handleQuickOp('titleCase')} className={buttonIdle}>
              {t('textPad.ops.titleCase')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.prefix')}</span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder={t('textPad.ops.prefixPlaceholder')}
              className={inputClass}
            />
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder={t('textPad.ops.suffixPlaceholder')}
              className={inputClass}
            />
            <button
              onClick={handleAddPrefixSuffix}
              disabled={!prefix && !suffix}
              className={`${buttonIdle} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t('textPad.ops.addPrefixSuffix')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.encode')}</span>
            <button onClick={() => handleQuickOp('htmlEscape')} className={buttonIdle}>
              {t('textPad.ops.htmlEscape')}
            </button>
            <button onClick={() => handleQuickOp('htmlUnescape')} className={buttonIdle}>
              {t('textPad.ops.htmlUnescape')}
            </button>
            <button onClick={() => handleQuickOp('urlEncode')} className={buttonIdle}>
              {t('textPad.ops.urlEncode')}
            </button>
            <button onClick={() => handleQuickOp('urlDecode')} className={buttonIdle}>
              {t('textPad.ops.urlDecode')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.format')}</span>
            <button onClick={() => handleQuickOp('formatJson')} className={buttonIdle}>
              {t('textPad.ops.formatJson')}
            </button>
            <button onClick={() => handleQuickOp('minifyJson')} className={buttonIdle}>
              {t('textPad.ops.minifyJson')}
            </button>
          </div>
        </div>
      )}

      {formatError && (
        <div
          role="alert"
          data-testid="text-pad-format-error"
          className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/40 rounded-lg text-xs text-red-200"
        >
          <span className="text-red-300 font-mono">{t('textPad.ops.formatErrorLabel')}</span>
          <span className="flex-1 font-mono break-all">{formatError}</span>
          <button
            onClick={() => setFormatError(null)}
            className="px-2 py-0.5 bg-red-500/20 rounded text-red-100 hover:bg-red-500/30 transition-colors text-[10px] font-mono"
          >
            {t('textPad.ops.formatErrorDismiss')}
          </button>
        </div>
      )}


      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
          onClick={handleSearchClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-80 flex-col gap-3 rounded-xl border border-border bg-surface-dim p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text">{t('textPad.search.title')}</span>
              <button
                onClick={handleSearchClose}
                title={t('textPad.search.close')}
                aria-label={t('textPad.search.close')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-dim text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) handleFindPrev()
                      else handleFindNext()
                    }
                    if (e.key === 'Escape') handleSearchClose()
                  }}
                  placeholder={t('textPad.search.findPlaceholder')}
                  className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm font-mono text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
                />
                <button
                  onClick={() => setCaseSensitive((v) => !v)}
                  className={caseSensitive ? buttonActive : buttonIdle}
                  title={t('textPad.search.caseSensitive')}
                >
                  Aa
                </button>
              </div>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReplaceNext()
                  if (e.key === 'Escape') handleSearchClose()
                }}
                placeholder={t('textPad.search.replacePlaceholder')}
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm font-mono text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleFindPrev} className={buttonIdle}>{t('textPad.search.prev')}</button>
              <button onClick={handleFindNext} className={buttonActive}>{t('textPad.search.next')}</button>
              <div className="w-3" />
              <button onClick={handleReplaceNext} className={buttonIdle}>{t('textPad.search.replace')}</button>
              <button onClick={handleReplaceAll} className={buttonIdle}>{t('textPad.search.replaceAll')}</button>
            </div>
          </div>
        </div>
      )}

      {goToLineOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
          onClick={handleGoToLineClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface-dim p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text">{t('textPad.goToLine.title')}</span>
              <button
                onClick={handleGoToLineClose}
                title={t('textPad.goToLine.close')}
                aria-label={t('textPad.goToLine.close')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-dim text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={goToLineInputRef}
                type="text"
                inputMode="numeric"
                value={goToLineValue}
                onChange={(e) => {
                  setGoToLineValue(e.target.value)
                  setGoToLineError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleGoToLineSubmit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleGoToLineClose()
                  }
                }}
                placeholder={t('textPad.goToLine.placeholder')}
                className="h-9 w-44 rounded-lg border border-border bg-surface px-3 text-sm font-mono text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
              />
              <span className="text-xs text-muted">
                {t('textPad.goToLine.of')} {goToLineTotal}
              </span>
            </div>
            {goToLineError && (
              <span className="text-xs text-red-400">{goToLineError}</span>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleGoToLineSubmit}
                className={buttonActive}
              >
                {t('textPad.goToLine.go')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-[360px] flex-col">
        <TextPadTabBar
          onNewTab={handleNewTab}
          onCloseTab={handleCloseTab}
          onSelectTab={handleSelectTab}
        />
        <section
          ref={hostRef}
          data-testid="text-pad-editor-host"
          className="text-pad-editor-host flex-1 min-h-0 overflow-hidden rounded-b-lg border border-border border-t-0 bg-[#09090b]"
        />
      </div>

      <footer className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[10px] text-muted font-mono">
        <span>{t('textPad.stats.chars')}: {stats.chars}</span>
        <span>{t('textPad.stats.lines')}: {stats.lines}</span>
        {stats.detailedStatsDisabled ? (
          <span className="text-muted/70">{t('textPad.stats.detailedDisabled')}</span>
        ) : (
          <>
            {stats.words !== null && <span>{t('textPad.stats.words')}: {stats.words}</span>}
            {stats.paragraphs !== null && (
              <span>{t('textPad.stats.paragraphs')}: {stats.paragraphs}</span>
            )}
          </>
        )}
      </footer>
    </div>
  )
}
