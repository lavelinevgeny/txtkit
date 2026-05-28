import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { scoreTool, scoreTransform, matchesScope } from '../tools/score'
import { ResultTile } from './ResultTile'
import { JsonTree } from './JsonTree'
import { useTranslation } from '../i18n/context'

const INITIAL_LIMIT = 8
const GROUP_ORDER = ['case', 'transforms', 'stats', 'encode', 'json', '1c-blocks']
const GROUP_META: Record<string, { icon: string; label: string }> = {
  case: { icon: 'Aa', label: 'Case' },
  transforms: { icon: '↻', label: 'Transform' },
  stats: { icon: '#', label: 'Stats' },
  encode: { icon: '⇄', label: 'Encode' },
  json: { icon: '{ }', label: 'JSON' },
  '1c-blocks': { icon: '{,}', label: '1C' },
}

export function ResultTiles() {
  const { t } = useTranslation()
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const locale = useStore(s => s.locale)

  const allResults = useMemo(() => {
    if (!input.trim()) return []

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

    const results: Array<{
      toolId: string
      toolName: string
      result: { label: string; value: string }
      truncationWarning?: string
    }> = []

    for (const { tool } of scoredTools) {
      if (isManual && activeToolId !== tool.id) continue

      const truncationWarning = tool.scope?.truncate && input.length > tool.scope.truncate.maxLength
        ? t('warnings.inputTruncated', {
            limit: String(tool.scope.truncate.maxLength),
            total: String(input.length),
            toolName: tool.name,
          })
        : undefined

      const toolResults = tool.transform(input)

      const scoredResults = toolResults
        .map((r, idx) => {
          const s = scoreTransform(tool, r.label, detections)
          return { result: r, score: s, index: idx }
        })
        .sort((a, b) => b.score - a.score || a.index - b.index)

      for (const { result } of scoredResults) {
        results.push({ toolId: tool.id, toolName: tool.name, result, truncationWarning })
      }
    }

    return results
  }, [input, locale, activeToolId, t])

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

  const visibleResults = expanded || activeToolId || search
    ? searchedResults
    : searchedResults.slice(0, INITIAL_LIMIT)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleResults>()
    for (const r of visibleResults) {
      if (!map.has(r.toolId)) map.set(r.toolId, [])
      map.get(r.toolId)!.push(r)
    }
    const ordered: Array<{ toolId: string; results: typeof visibleResults }> = []
    for (const id of GROUP_ORDER) {
      const results = map.get(id)
      if (results) ordered.push({ toolId: id, results })
    }
    for (const [id, results] of map) {
      if (!GROUP_ORDER.includes(id)) ordered.push({ toolId: id, results })
    }
    return ordered
  }, [visibleResults])

  if (!input.trim() || (searchedResults.length === 0 && !showTreeTile && !search)) return null

  const hasMore = !activeToolId && !expanded && !search && searchedResults.length > INITIAL_LIMIT

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const treeTileId = 'json-tree'
  const isTreeExpanded = expandedId === treeTileId

  let globalIndex = 0

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
      <div className="flex flex-col gap-3">
        {showTreeTile && (
          <div className="grid grid-cols-2 gap-1.5">
            {isTreeExpanded ? (
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
            )}
          </div>
        )}
        {grouped.map((group, gi) => {
          const startIdx = globalIndex
          globalIndex += group.results.length
          return (
            <div key={group.toolId}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="font-mono text-[10px] text-accent">{GROUP_META[group.toolId]?.icon}</span>
                <span className="text-[10px] text-muted font-medium">{GROUP_META[group.toolId]?.label ?? group.toolId}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {group.results.map((r, ri) => {
                  const tileId = `${r.toolId}-${r.result.label}`
                  return (
                    <ResultTile
                      key={tileId}
                      result={r.result}
                      accent={startIdx + ri < 4 && !activeToolId}
                      isExpanded={expandedId === tileId}
                      onToggle={() => handleToggle(tileId)}
                      truncationWarning={r.truncationWarning}
                    />
                  )
                })}
              </div>
            </div>
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
