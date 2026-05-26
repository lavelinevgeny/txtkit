import type { TransformResult } from '../types/tool'
import { copyToClipboard } from '../utils/clipboard'
import { useStore } from '../store/useStore'

interface Props {
  result: TransformResult
  accent?: boolean
}

export function ResultTile({ result, accent }: Props) {
  const showToast = useStore(s => s.showToast)

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.value)
    if (ok) showToast('Скопировано!')
  }

  return (
    <button
      onClick={handleCopy}
      className="bg-surface border border-border rounded-lg px-3 py-2 flex justify-between items-center text-left hover:border-accent/30 transition-colors w-full group"
    >
      <div className="min-w-0 flex-1 mr-2">
        <div className="text-[9px] text-muted">{result.label}</div>
        <div className={`font-mono text-xs truncate ${accent ? 'text-accent' : 'text-text'}`}>
          {result.value}
        </div>
      </div>
      <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-[10px] text-muted group-hover:text-text transition-colors flex-shrink-0">
        📋
      </div>
    </button>
  )
}
