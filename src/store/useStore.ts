import { create } from 'zustand'

export type Locale = 'ru' | 'en'

export interface EditorPrefs {
  lineWrapping: boolean
  showWhitespace: boolean
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getInitialLocale(): Locale {
  const saved = localStorage.getItem('txtkit-locale')
  if (saved === 'ru' || saved === 'en') return saved
  return navigator.language.startsWith('ru') ? 'ru' : 'en'
}

function getInitialPrefs(): EditorPrefs {
  const defaults: EditorPrefs = { lineWrapping: false, showWhitespace: false }
  if (!canUseLocalStorage()) return defaults
  const raw = localStorage.getItem('txtkit-editor-prefs')
  if (raw === null) return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaults
    const obj = parsed as Record<string, unknown>
    return {
      lineWrapping: typeof obj.lineWrapping === 'boolean' ? obj.lineWrapping : defaults.lineWrapping,
      showWhitespace:
        typeof obj.showWhitespace === 'boolean' ? obj.showWhitespace : defaults.showWhitespace,
    }
  } catch {
    return defaults
  }
}

const MAXIMIZED_KEY = 'txtkit-maximized'

function getInitialMaximized(): boolean {
  if (!canUseLocalStorage()) return false
  try {
    return localStorage.getItem(MAXIMIZED_KEY) === '1'
  } catch {
    return false
  }
}

function persistMaximized(value: boolean): void {
  if (!canUseLocalStorage()) return
  try {
    localStorage.setItem(MAXIMIZED_KEY, value ? '1' : '0')
  } catch {
    return
  }
}

function persistEditorPrefs(prefs: EditorPrefs): void {
  if (!canUseLocalStorage()) return
  try {
    localStorage.setItem('txtkit-editor-prefs', JSON.stringify(prefs))
  } catch {
    return
  }
}

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean
  locale: Locale
  editorPrefs: EditorPrefs
  /** Инструмент развёрнут на всё окно: без логотипа и нижней карусели. */
  maximized: boolean

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  setLocale: (locale: Locale) => void
  setEditorPrefs: (p: Partial<EditorPrefs>) => void
  setMaximized: (maximized: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  locale: getInitialLocale(),
  editorPrefs: getInitialPrefs(),
  maximized: getInitialMaximized(),

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
  setLocale: (locale) => {
    localStorage.setItem('txtkit-locale', locale)
    set({ locale })
  },
  setEditorPrefs: (p) => {
    set((state) => {
      const next: EditorPrefs = { ...state.editorPrefs, ...p }
      persistEditorPrefs(next)
      return { editorPrefs: next }
    })
  },
  setMaximized: (maximized) => {
    persistMaximized(maximized)
    set({ maximized })
  },
}))
