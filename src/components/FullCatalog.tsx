import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getToolsByCategory, getToolById } from '../tools/registry'
import { CatalogCard } from './CatalogCard'
import type { Category } from '../types/tool'

const CATEGORY_LABELS: Record<string, string> = {
  transform: 'Трансформации',
  analysis: 'Анализ',
  encoding: 'Кодирование',
  json: 'JSON',
  dev: 'Dev Tools',
}

const CATEGORY_ORDER = ['transform', 'analysis', 'encoding', 'json']

export function FullCatalog() {
  const catalogOpen = useStore(s => s.catalogOpen)
  const setCatalogOpen = useStore(s => s.setCatalogOpen)
  const setActiveToolId = useStore(s => s.setActiveToolId)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogOpen(false)
    }
    if (catalogOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catalogOpen, setCatalogOpen])

  if (!catalogOpen) return null

  const groups = getToolsByCategory()

  const handleToolClick = (toolId: string) => {
    const tool = getToolById(toolId)
    if (tool) {
      setActiveToolId(toolId)
      setCatalogOpen(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#09090b] z-40 flex flex-col animate-fade-in">
      <div className="px-6 py-4 flex justify-between items-center border-b border-border">
        <div className="font-mono font-bold text-base text-accent">
          txt<span className="text-muted">kit</span>
          <span className="text-xs text-muted font-normal ml-2">все инструменты</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
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
        {CATEGORY_ORDER.map(cat => {
          const catTools = groups[cat as Category] || []
          if (catTools.length === 0) return null
          const filtered = catTools.filter((t: { name: string; description: string }) =>
            !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
          )
          if (filtered.length === 0) return null
          return (
            <div key={cat} className="mb-6">
              <div className="text-[9px] uppercase text-muted-dim tracking-widest font-semibold mb-2.5">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid grid-cols-4 gap-2 catalog-grid">
                {filtered.map((tool) => (
                  <CatalogCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-6 py-2.5 border-t border-border text-center">
        <span className="text-[9px] text-muted-dim">
          Нажмите <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-[9px]">Esc</kbd> чтобы вернуться
        </span>
      </div>
    </div>
  )
}
