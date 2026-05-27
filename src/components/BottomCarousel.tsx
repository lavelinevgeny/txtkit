import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'

const CAROUSEL_ORDER = ['case', 'transforms', 'stats', 'encode', 'json', '1c-blocks']

const TOOL_META: Record<string, { icon: string; label: string }> = {
  case: { icon: 'Aa', label: 'Case' },
  transforms: { icon: '↻', label: 'Transform' },
  stats: { icon: '#', label: 'Stats' },
  encode: { icon: '⇄', label: 'Encode' },
  json: { icon: '{ }', label: 'JSON' },
  '1c-blocks': { icon: '{,}', label: '1C' },
}

export function BottomCarousel() {
  const activeToolId = useStore(s => s.activeToolId)
  const setActiveToolId = useStore(s => s.setActiveToolId)
  const setCatalogOpen = useStore(s => s.setCatalogOpen)

  const allTools = getAllTools()
  const tools = CAROUSEL_ORDER.map(id => allTools.find(t => t.id === id)!).filter(Boolean)

  return (
    <div className="w-full bg-surface border-t border-border px-4 py-2.5">
      <div className="flex gap-1.5 items-center max-w-xl mx-auto overflow-x-auto">
        <button
          onClick={() => setCatalogOpen(true)}
          className="flex-shrink-0 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center min-w-[56px] hover:bg-accent/20 transition-colors"
        >
          <div className="font-mono font-bold text-accent text-sm">⊞</div>
          <div className="text-[7px] text-accent font-medium">All</div>
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {tools.map(tool => {
          const meta = TOOL_META[tool.id]
          const isActive = activeToolId === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => setActiveToolId(isActive ? null : tool.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-center min-w-[56px] transition-colors ${
                isActive
                  ? 'bg-accent/10 border border-accent/30'
                  : 'bg-zinc-800 border border-transparent hover:bg-zinc-700'
              }`}
            >
              <div className="font-mono font-bold text-sm text-accent">
                {meta.icon}
              </div>
              <div className={`text-[7px] ${isActive ? 'text-accent' : 'text-muted'}`}>
                {meta.label}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
