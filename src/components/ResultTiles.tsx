import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { scoreTool, scoreTransform, matchesScope, getEffectiveInput } from '../tools/score'
import { ResultTile } from './ResultTile'
import { JsonTree } from './JsonTree'
import { useTranslation } from '../i18n/context'

const INITIAL_LIMIT = 8

export function ResultTiles() {
  const { t } = useTranslation()
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const locale = useStore(s => s.locale)

  const { allResults, truncationInfo } = useMemo(() => {
    if (!input.trim()) return { allResults: [], truncationInfo: null }

    const detections = detectInputTypes(input)
    const tools = getAllTools()
    const isManual = !!activeToolId

    const scoredTools = tools
      .map((tool, index) => {
        let score = scoreTool(tool, detections)
        if (!matchesScope(tool.scope, input)) score -= 1
        return { tool, score, index }
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)

    let truncationInfo: { originalLength: number; limit: number } | null = null
    const results: Array<{ toolId: string; toolName: string; result: { label: string; value: string } }> = []

    for (const { tool } of scoredTools) {
      if (isManual && activeToolId !== tool.id) continue

      const { input: effectiveInput, truncated, originalLength, limit } = getEffectiveInput(input, tool.scope, isManual)
      if (truncated && !truncationInfo) {
        truncationInfo = { originalLength, limit }
      }

      const toolResults = tool.transform(effectiveInput)

      const scoredResults = toolResults
        .map((r, idx) => {
          const s = scoreTransform(tool, r.label, detections)
          return { result: r, score: s, index: idx }
        })
        .sort((a, b) => b.score - a.score || a.index - b.index)

      for (const { result } of scoredResults) {
        results.push({ toolId: tool.id, toolName: tool.name, result })
      }
    }

    return { allResults: results, truncationInfo }
  }, [input, locale, activeToolId])

  const filteredResults = allResults

  const searchedResults = search
    ? filteredResults.filter(r => r.result.label.toLowerCase().includes(search.toLowerCase()))
    : filteredResults

  let parsedJson: unknown = null
  if (!activeToolId || activeToolId === 'json') {
    try { parsedJson = JSON.parse(input.trim()) } catch { /* ignore */ }
  }

  const treeLabel = 'Tree'
  const treeMatchesSearch = search
    ? treeLabel.toLowerCase().includes(search.toLowerCase())
    : true
  const showTreeTile = parsedJson !== null && treeMatchesSearch

  if (!input.trim() || (searchedResults.length === 0 && !showTreeTile && !search)) return null

  const visibleResults = expanded || activeToolId || search
    ? searchedResults
    : searchedResults.slice(0, INITIAL_LIMIT)

  const hasMore = !activeToolId && !expanded && !search && searchedResults.length > INITIAL_LIMIT

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const treeTileId = 'json-tree'
  const isTreeExpanded = expandedId === treeTileId

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      {(searchedResults.length > 0 || search || showTreeTile) && (
        <div className="mb-1.5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('resultTiles.filter')}
            className="w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-text outline-none border border-transparent focus:border-border placeholder:text-muted/50"
          />
          {searchedResults.length === 0 && !showTreeTile && (
            <p className="text-xs text-muted text-center py-3">{t('resultTiles.noResults')}</p>
          )}
        </div>
      )}
      {truncationInfo && activeToolId && (() => {
        const tool = getAllTools().find(t => t.id === activeToolId)
        return (
          <div className="mb-1.5 px-3 py-1.5 text-xs text-amber-400 bg-amber-400/10 rounded-lg border border-amber-400/20">
            {t('warnings.inputTruncated', {
              limit: String(truncationInfo.limit),
              total: String(truncationInfo.originalLength),
              toolName: tool?.name ?? '',
            })}
          </div>
        )
      })()}
      <div className="grid grid-cols-2 gap-1.5">
        {showTreeTile && (
          isTreeExpanded ? (
            <div className="bg-surface border border-accent rounded-lg px-3 py-2 col-span-2">
              <button
                onClick={() => handleToggle(treeTileId)}
                className="text-[9px] text-accent font-medium mb-1 hover:text-accent/80"
              >
                Tree
              </button>
              <JsonTree data={parsedJson} />
            </div>
          ) : (
            <button
              onClick={() => handleToggle(treeTileId)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-all"
            >
              <div className="text-[9px] text-muted">Tree</div>
              <div className="font-mono text-xs truncate text-text">{t('tree.description')}</div>
            </button>
          )
        )}
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
