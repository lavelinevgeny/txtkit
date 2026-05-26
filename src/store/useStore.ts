import { create } from 'zustand'

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean
  toast: string | null

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  showToast: (message: string) => void
  clearToast: () => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  toast: null,

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
  showToast: (message) => {
    set({ toast: message })
    setTimeout(() => set({ toast: null }), 2000)
  },
  clearToast: () => set({ toast: null }),
}))
