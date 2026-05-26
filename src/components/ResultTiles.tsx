import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { ResultTile } from './ResultTile'

export function ResultTiles() {
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)

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

  const detections = useMemo(() => detectInputTypes(input), [input])

  const filteredResults = activeToolId
    ? allResults.filter(r => r.toolId === activeToolId)
    : allResults

  if (!input.trim() || filteredResults.length === 0) return null

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      <div className="grid grid-cols-2 gap-1.5">
        {filteredResults.map((r, i) => (
          <ResultTile
            key={`${r.toolId}-${r.result.label}`}
            result={r.result}
            accent={i < 4 && !activeToolId}
          />
        ))}
      </div>
    </div>
  )
}
