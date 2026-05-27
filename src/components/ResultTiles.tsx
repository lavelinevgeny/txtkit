import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { ResultTile } from './ResultTile'
import { useTranslation } from '../i18n/context'

const INITIAL_LIMIT = 8

export function ResultTiles() {
  const { t } = useTranslation()
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const allResults = useMemo(() => {
    if (!input.trim()) return []
    const tools = getAllTools()
    const results: Array<{ toolId: string; toolName: string; result: { label: string; value: string } }> = []
    for (const tool of tools) {
      const toolResults = tool.transform(input)
      for (const r of toolResults) {
        results.push({ toolId: tool.id, toolName: tool.name, result: r })
      }
    }
    return results
  }, [input])

  useMemo(() => detectInputTypes(input), [input])

  useEffect(() => {
    setExpandedId(null)
  }, [input])

  const filteredResults = activeToolId
    ? allResults.filter(r => r.toolId === activeToolId)
    : allResults

  if (!input.trim() || filteredResults.length === 0) return null

  const visibleResults = expanded || activeToolId
    ? filteredResults
    : filteredResults.slice(0, INITIAL_LIMIT)

  const hasMore = !activeToolId && !expanded && filteredResults.length > INITIAL_LIMIT

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      <div className="grid grid-cols-2 gap-1.5">
        {visibleResults.map((r, i) => {
          const tileId = `${r.toolId}-${r.result.label}`
          return (
            <ResultTile
              key={tileId}
              result={r.result}
              accent={i < 4 && !activeToolId}
              isExpanded={expandedId === tileId}
              onToggle={() => handleToggle(tileId)}
            />
          )
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-2 py-2 text-xs text-muted hover:text-accent transition-colors"
        >
          {t('resultTiles.showAll', { count: filteredResults.length })}
        </button>
      )}
      {expanded && !activeToolId && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full mt-2 py-2 text-xs text-muted hover:text-accent transition-colors"
        >
          {t('resultTiles.collapse')}
        </button>
      )}
    </div>
  )
}
