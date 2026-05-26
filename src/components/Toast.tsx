import { useStore } from '../store/useStore'

export function Toast() {
  const toast = useStore(s => s.toast)

  if (!toast) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-accent text-zinc-900 font-semibold text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in z-50">
      {toast}
    </div>
  )
}
