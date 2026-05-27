import { useState } from 'react'
import type { TransformResult } from '../types/tool'
import { copyToClipboard } from '../utils/clipboard'
import { useTranslation } from '../i18n/context'

interface Props {
  result: TransformResult
  accent?: boolean
  isExpanded?: boolean
  onToggle?: () => void
}

export function ResultTile({ result, accent, isExpanded, onToggle }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(result.value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-all w-full"
      >
        <div className="text-[9px] text-muted">{result.label}</div>
        <div className={`font-mono text-xs truncate ${accent ? 'text-accent' : 'text-text'}`}>
          {result.value}
        </div>
      </button>
    )
  }

  return (
    <div
      className="bg-surface border border-accent rounded-lg px-3 py-2 col-span-2 transition-all"
    >
      <div className="text-[9px] text-accent font-medium mb-1">{result.label}</div>
      <div className="font-mono text-xs text-text break-all max-h-32 overflow-y-auto scrollbar-thin">
        {result.value}
      </div>
      {result.value && (
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCopy}
            disabled={copied}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              copied
                ? 'bg-emerald-400/20 text-emerald-400'
                : 'bg-accent text-zinc-900 hover:bg-accent/90'
            }`}
          >
            {copied ? t('resultTile.copied') : t('resultTile.copy')}
          </button>
        </div>
      )}
    </div>
  )
}
