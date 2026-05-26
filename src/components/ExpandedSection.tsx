import { useStore } from '../store/useStore'
import { getToolById } from '../tools/registry'
import { ResultTile } from './ResultTile'

const CATEGORY_COLORS: Record<string, string> = {
  transform: 'rgba(232,160,48,0.1)',
  analysis: 'rgba(52,211,153,0.1)',
  encoding: 'rgba(96,165,250,0.1)',
  json: 'rgba(192,132,252,0.1)',
}

const CATEGORY_TEXT: Record<string, string> = {
  transform: 'text-accent',
  analysis: 'text-success',
  encoding: 'text-info',
  json: 'text-purple-400',
}

const CATEGORY_BORDER: Record<string, string> = {
  transform: 'border-accent/30',
  analysis: 'border-success/30',
  encoding: 'border-info/30',
  json: 'border-purple-400/30',
}

export function ExpandedSection() {
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const setActiveToolId = useStore(s => s.setActiveToolId)

  if (!activeToolId || !input.trim()) return null

  const tool = getToolById(activeToolId)
  if (!tool) return null

  const results = tool.transform(input)

  return (
    <div className={`w-full max-w-lg mx-auto mt-3 bg-surface-dim border ${CATEGORY_BORDER[tool.category] || 'border-border'} rounded-xl overflow-hidden`}>
      <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs ${CATEGORY_TEXT[tool.category] || 'text-accent'}`}
            style={{ background: CATEGORY_COLORS[tool.category] || 'rgba(232,160,48,0.1)' }}
          >
            {tool.icon}
          </div>
          <span className="font-semibold text-xs text-text">{tool.name}</span>
        </div>
        <button onClick={() => setActiveToolId(null)} className="text-muted-dim hover:text-text text-xs">✕</button>
      </div>
      <div className="p-4">
        {tool.category === 'analysis' ? (
          <div className="grid grid-cols-4 gap-3 mb-3">
            {results.slice(0, 4).map(r => (
              <div key={r.label} className="text-center">
                <div className="font-mono text-xl font-bold text-success">{r.value}</div>
                <div className="text-[8px] text-muted mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          {results.map(r => (
            <ResultTile key={r.label} result={r} />
          ))}
        </div>
      </div>
    </div>
  )
}
