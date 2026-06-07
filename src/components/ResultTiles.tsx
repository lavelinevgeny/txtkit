import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import type { TransformResult } from '../types/tool'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { scoreTool, scoreTransform, matchesScope } from '../tools/score'
import { ResultTile } from './ResultTile'
import { JsonTree } from './JsonTree'
import { BlockTree } from './BlockTree'
import { useTranslation } from '../i18n/context'

const TREE_RENDERERS: Record<string, ComponentType<{ data: unknown }>> = {
  'json': JsonTree,
  'yaml': JsonTree,
  '1c-log-blocks': BlockTree,
}

const INITIAL_LIMIT = 8
const GROUP_ORDER = ['case', 'transforms', 'stats', 'encode', 'json', 'yaml', '1c-blocks', 'list-converter']
const GROUP_META: Record<string, { icon: string; label: string }> = {
  'list-converter': { icon: '≡', label: 'List' },
  case: { icon: 'Aa', label: 'Case' },
  transforms: { icon: '↻', label: 'Transform' },
  stats: { icon: '#', label: 'Stats' },
  encode: { icon: '⇄', label: 'Encode' },
  json: { icon: '{ }', label: 'JSON' },
  yaml: { icon: 'Y:', label: 'YAML' },
  '1c-blocks': { icon: '{,}', label: '1C' },
}

interface GroupedResult {
  toolId: string
  toolName: string
  result: TransformResult
  truncationWarning?: string
}

export function ResultTiles() {
  const { t, locale } = useTranslation()
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

    const results: GroupedResult[] = []

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, activeToolId, t, locale])

  const filteredResults = allResults

  const treeResults = useMemo(() => {
    return filteredResults.filter(r =>
      r.result.isTree && r.result.treeKey && TREE_RENDERERS[r.result.treeKey]
    )
  }, [filteredResults])

  const nonTreeResults = useMemo(() => {
    return filteredResults.filter(r => !r.result.isTree)
  }, [filteredResults])

  const q = search.toLowerCase()

  const toolIdMatches = search
    ? new Set(
        Object.entries(GROUP_META)
          .filter(([, meta]) => meta.label.toLowerCase().includes(q))
          .map(([id]) => id)
      )
    : null

  const searchedResults = search
    ? nonTreeResults.filter(r =>
        r.result.label.toLowerCase().includes(q) || toolIdMatches!.has(r.toolId)
      )
    : nonTreeResults

  const searchedTreeResults = search
    ? treeResults.filter(r =>
        r.result.label.toLowerCase().includes(q) || toolIdMatches!.has(r.toolId)
      )
    : treeResults

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

  const hasAnyTree = searchedTreeResults.length > 0

  if (!input.trim() || (searchedResults.length === 0 && !hasAnyTree && !search)) return null

  const hasMore = !activeToolId && !expanded && !search && searchedResults.length > INITIAL_LIMIT

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  let globalIndex = 0

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      {(searchedResults.length > 0 || search || hasAnyTree) && (
        <div className="mb-1.5">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('resultTiles.filter')}
              className="w-full bg-zinc-800 rounded-lg px-3 py-1.5 pr-7 text-xs text-text outline-none border border-transparent focus:border-border placeholder:text-muted/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-zinc-700 rounded flex items-center justify-center text-muted hover:text-text transition-colors text-[10px]"
              >
                ✕
              </button>
            )}
          </div>
          {searchedResults.length === 0 && !hasAnyTree && (
            <p className="text-xs text-muted text-center py-3">{t('resultTiles.noResults')}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {hasAnyTree && (
          <div className="grid grid-cols-2 gap-1.5">
            {searchedTreeResults.map((tr) => {
              const treeTileId = `tree-${tr.result.treeKey}`
              const isTreeExpanded = expandedId === treeTileId
              const TreeComponent = TREE_RENDERERS[tr.result.treeKey!]

              if (isTreeExpanded) {
                return (
                  <div
                    key={treeTileId}
                    onClick={() => {
                      if (window.getSelection()?.toString()) return
                      handleToggle(treeTileId)
                    }}
                    className="bg-surface border border-accent rounded-lg px-3 py-2 col-span-2"
                  >
                    <div className="text-[9px] text-accent font-medium mb-1">{tr.result.label}</div>
                    <div onClick={e => e.stopPropagation()}>
                      <TreeComponent data={tr.result.treeData} />
                    </div>
                  </div>
                )
              }

              return (
                <button
                  key={treeTileId}
                  onClick={() => handleToggle(treeTileId)}
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-all"
                >
                  <div className="text-[9px] text-muted">{tr.result.label}</div>
                  <div className="font-mono text-xs truncate text-text">{t('tree.description')}</div>
                </button>
              )
            })}
          </div>
        )}
        {grouped.map((group) => {
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
