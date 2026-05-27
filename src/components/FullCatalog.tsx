import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools, getToolById } from '../tools/registry'
import { useTranslation } from '../i18n/context'

const TOOL_ORDER = ['case', 'transforms', 'stats', 'encode', 'json', '1c-blocks']

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

export function FullCatalog() {
  const catalogOpen = useStore(s => s.catalogOpen)
  const setCatalogOpen = useStore(s => s.setCatalogOpen)
  const setActiveToolId = useStore(s => s.setActiveToolId)
  const [search, setSearch] = useState('')
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogOpen(false)
    }
    if (catalogOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catalogOpen, setCatalogOpen])

  if (!catalogOpen) return null

  const tools = getAllTools()
  const ordered = TOOL_ORDER.map(id => tools.find(t => t.id === id)!).filter(Boolean)

  const handleToolClick = (toolId: string) => {
    const tool = getToolById(toolId)
    if (tool) {
      setActiveToolId(toolId)
      setCatalogOpen(false)
    }
  }

  const matchesSearch = (tool: typeof tools[0]) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      (tool.features || []).some(f => f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))
    )
  }

  const handleFeatureToggle = (featureKey: string) => {
    setExpandedFeature(prev => prev === featureKey ? null : featureKey)
  }

  return (
    <div className="fixed inset-0 bg-[#09090b] z-40 flex flex-col animate-fade-in">
      <div className="px-6 py-4 flex justify-between items-center border-b border-border">
        <div className="font-mono font-bold text-base text-accent">
          txt<span className="text-muted">kit</span>
          <span className="text-xs text-muted font-normal ml-2">{t('catalog.subtitle')}</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setExpandedFeature(null) }}
            placeholder={t('catalog.search')}
            className="bg-zinc-800 rounded-md px-3 py-1.5 text-xs text-text outline-none border border-transparent focus:border-border placeholder:text-muted/50 w-48"
          />
          <button
            onClick={() => setCatalogOpen(false)}
            className="w-7 h-7 bg-zinc-800 rounded-md flex items-center justify-center text-muted hover:text-text transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {ordered.filter(matchesSearch).map(tool => (
          <div key={tool.id} className="mb-5">
            <button
              onClick={() => handleToolClick(tool.id)}
              className="w-full flex items-center gap-3 bg-surface border border-border rounded-xl p-3.5 hover:border-accent/50 transition-colors cursor-pointer mb-2.5 group"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0"
                style={{ background: CATEGORY_COLORS[tool.category] }}
              >
                <span className={CATEGORY_TEXT[tool.category]}>{tool.icon}</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-xs text-text group-hover:text-accent transition-colors">
                  {tool.name}
                </div>
                <div className="text-[9px] text-muted">{tool.description}</div>
              </div>
            </button>
            <div className="flex flex-wrap gap-1.5 pl-1">
              {(tool.features || [])
                .filter(f => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase()))
                .map(feature => {
                  const featureKey = `${tool.id}-${feature.label}`
                  const isExpanded = expandedFeature === featureKey
                  return (
                    <div key={feature.label} className={isExpanded ? 'w-full' : ''}>
                      {isExpanded ? (
                        <div
                          className="bg-surface border border-accent/50 rounded-lg p-3 transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-accent font-semibold">{feature.label}</span>
                            <button
                              onClick={() => handleFeatureToggle(featureKey)}
                              className="text-muted hover:text-text text-xs transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="text-[10px] text-text-dim leading-relaxed mb-2">
                            {feature.description}
                          </div>
                          <div className="bg-zinc-900 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-muted">
                            {feature.example}
                          </div>
                          <button
                            onClick={() => handleToolClick(tool.id)}
                            className="mt-2 text-[9px] text-accent hover:underline"
                          >
                            {t('catalog.openTool', { name: tool.name })} →
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFeatureToggle(featureKey)}
                          className="bg-zinc-800/60 border border-border-dim rounded-md px-2.5 py-1.5 text-[10px] text-muted hover:text-text hover:border-border transition-colors cursor-pointer"
                        >
                          {feature.label}
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-2.5 border-t border-border text-center">
        <span className="text-[9px] text-muted-dim">
          Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-[9px]">Esc</kbd> to close
        </span>
      </div>
    </div>
  )
}
