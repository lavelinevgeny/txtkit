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

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  setLocale: (locale: Locale) => void
  setEditorPrefs: (p: Partial<EditorPrefs>) => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  locale: getInitialLocale(),
  editorPrefs: getInitialPrefs(),

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
}))
