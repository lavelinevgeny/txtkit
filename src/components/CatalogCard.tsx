import type { ToolDescriptor } from '../types/tool'
import { useTranslation } from '../i18n/context'

interface Props {
  tool: ToolDescriptor
  disabled?: boolean
  onClick: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  transform: 'rgba(232,160,48,0.1)',
  analysis: 'rgba(52,211,153,0.1)',
  encoding: 'rgba(96,165,250,0.1)',
  json: 'rgba(192,132,252,0.1)',
  dev: 'rgba(113,113,122,0.1)',
}

const CATEGORY_TEXT: Record<string, string> = {
  transform: 'text-accent',
  analysis: 'text-success',
  encoding: 'text-info',
  json: 'text-purple-400',
  dev: 'text-muted',
}

export function CatalogCard({ tool, disabled, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-surface border border-border rounded-xl p-3.5 text-left transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-border-dim'
          : 'hover:border-accent/50 cursor-pointer'
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm mb-2"
        style={{ background: CATEGORY_COLORS[tool.category] }}
      >
        <span className={CATEGORY_TEXT[tool.category]}>{tool.icon}</span>
      </div>
      <div className={`font-semibold text-xs mb-1 ${disabled ? 'text-muted-dim' : 'text-text'}`}>
        {tool.name}
      </div>
      <div className="text-[9px] text-muted leading-relaxed">
        {disabled ? t('catalogCard.soon') : tool.description}
      </div>
    </button>
  )
}
