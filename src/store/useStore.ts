import { create } from 'zustand'

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean
  activeJsonSubTool: string | null

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  setActiveJsonSubTool: (sub: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  activeJsonSubTool: null,

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id, activeJsonSubTool: null }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
  setActiveJsonSubTool: (sub) => set({ activeJsonSubTool: sub }),
}))
