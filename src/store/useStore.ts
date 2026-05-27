import { create } from 'zustand'

export type Locale = 'ru' | 'en'

function getInitialLocale(): Locale {
  const saved = localStorage.getItem('txtkit-locale')
  if (saved === 'ru' || saved === 'en') return saved
  return navigator.language.startsWith('ru') ? 'ru' : 'en'
}

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean
  activeJsonSubTool: string | null
  locale: Locale

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  setActiveJsonSubTool: (sub: string | null) => void
  setLocale: (locale: Locale) => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  activeJsonSubTool: null,
  locale: getInitialLocale(),

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id, activeJsonSubTool: null }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
  setActiveJsonSubTool: (sub) => set({ activeJsonSubTool: sub }),
  setLocale: (locale) => {
    localStorage.setItem('txtkit-locale', locale)
    set({ locale })
  },
}))
