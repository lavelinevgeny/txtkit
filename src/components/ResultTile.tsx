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
      title={`${result.value}\n\nНажмите чтобы скопировать`}
      className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-colors w-full"
    >
      <div className="text-[9px] text-muted">{result.label}</div>
      <div className={`font-mono text-xs truncate ${accent ? 'text-accent' : 'text-text'}`}>
        {result.value}
      </div>
    </button>
  )
}
