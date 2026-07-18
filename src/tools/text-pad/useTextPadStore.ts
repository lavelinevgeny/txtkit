import { create } from 'zustand'
import type { PersistenceStatus } from './types'

export interface TextPadState {
  activeTabId: string | null
  openTabIds: string[]
  tabsById: Record<string, { title: string }>
  nextUntitledNumber: number

  persistenceStatus: PersistenceStatus

  currentRevisionById: Record<string, number>
  savedRevisionById: Record<string, number>
  saveErrorById: Record<string, boolean>
  workspaceSaveError: boolean
}

interface TextPadActions {
  setActiveTab: (id: string | null) => void
  addTab: (id: string, title: string, nextNum: number) => void
  closeTab: (id: string) => { removedId: string; removedIndex: number } | null
  undoCloseTab: (
    id: string,
    index: number,
    title: string,
    currentRevision: number,
    savedRevision: number,
  ) => void
  bumpRevision: (id: string) => void
  markSaved: (id: string, revision: number) => void
  setSaveError: (id: string, hasError: boolean) => void
  setWorkspaceSaveError: (hasError: boolean) => void
  setPersistenceStatus: (s: PersistenceStatus) => void
  clearStickyPersistenceError: (
    expectedStatus: 'quota-error' | 'memory-only',
  ) => void
  checkSaveErrorRecovery: () => void
}

export const useTextPadStore = create<TextPadState & TextPadActions>(
  (set, get) => ({
    activeTabId: null,
    openTabIds: [],
    tabsById: {},
    nextUntitledNumber: 1,

    persistenceStatus: 'initializing',

    currentRevisionById: {},
    savedRevisionById: {},
    saveErrorById: {},
    workspaceSaveError: false,

    setActiveTab: (id) => set({ activeTabId: id }),

    addTab: (id, title, nextNum) =>
      set((s) => ({
        openTabIds: [...s.openTabIds, id],
        tabsById: { ...s.tabsById, [id]: { title } },
        activeTabId: id,
        nextUntitledNumber: nextNum,
        currentRevisionById: { ...s.currentRevisionById, [id]: 0 },
        savedRevisionById: { ...s.savedRevisionById, [id]: 0 },
        saveErrorById: { ...s.saveErrorById, [id]: false },
      })),

    closeTab: (id) => {
      const s = get()
      const idx = s.openTabIds.indexOf(id)
      if (idx === -1) return null

      const newIds = [...s.openTabIds]
      newIds.splice(idx, 1)

      const nextActive =
        s.activeTabId === id
          ? (newIds[Math.min(idx, newIds.length - 1)] ?? null)
          : s.activeTabId

      const newTabs = { ...s.tabsById }
      delete newTabs[id]

      const newCurrent = { ...s.currentRevisionById }
      delete newCurrent[id]

      const newSaved = { ...s.savedRevisionById }
      delete newSaved[id]

      const newErrors = { ...s.saveErrorById }
      delete newErrors[id]

      set({
        openTabIds: newIds,
        activeTabId: nextActive,
        tabsById: newTabs,
        currentRevisionById: newCurrent,
        savedRevisionById: newSaved,
        saveErrorById: newErrors,
      })

      return { removedId: id, removedIndex: idx }
    },

    undoCloseTab: (id, index, title, currentRevision, savedRevision) =>
      set((s) => {
        const newIds = [...s.openTabIds]
        newIds.splice(index, 0, id)

        return {
          openTabIds: newIds,
          activeTabId: id,
          tabsById: { ...s.tabsById, [id]: { title } },
          currentRevisionById: {
            ...s.currentRevisionById,
            [id]: currentRevision,
          },
          savedRevisionById: {
            ...s.savedRevisionById,
            [id]: savedRevision,
          },
          saveErrorById: { ...s.saveErrorById, [id]: false },
        }
      }),

    bumpRevision: (id) =>
      set((s) => ({
        currentRevisionById: {
          ...s.currentRevisionById,
          [id]: (s.currentRevisionById[id] ?? 0) + 1,
        },
      })),

    markSaved: (id, revision) =>
      set((s) => ({
        savedRevisionById: {
          ...s.savedRevisionById,
          [id]: Math.max(s.savedRevisionById[id] ?? 0, revision),
        },
      })),

    setSaveError: (id, hasError) =>
      set((s) => ({
        saveErrorById: { ...s.saveErrorById, [id]: hasError },
      })),

    setWorkspaceSaveError: (hasError) =>
      set({ workspaceSaveError: hasError }),

    setPersistenceStatus: (status) =>
      set({ persistenceStatus: status }),

    clearStickyPersistenceError: (expectedStatus) =>
      set((s) => {
        if (s.persistenceStatus !== expectedStatus) return {}
        return { persistenceStatus: 'ready' }
      }),

    checkSaveErrorRecovery: () =>
      set((s) => {
        if (s.persistenceStatus !== 'save-error') return {}
        const anyDocError = Object.values(s.saveErrorById).some(Boolean)
        if (anyDocError || s.workspaceSaveError) return {}
        return { persistenceStatus: 'ready' }
      }),
  }),
)
