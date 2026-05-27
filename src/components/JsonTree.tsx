import { useState } from 'react'
import { copyToClipboard } from '../utils/clipboard'
import { useTranslation } from '../i18n/context'

interface JsonTreeNodeProps {
  keyName?: string
  value: unknown
  depth: number
  isLast: boolean
}

function JsonTreeNode({ keyName, value, depth, isLast }: JsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)

  if (value === null) {
    return (
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: depth * 20 }}>
        {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
        <span className="text-zinc-500 text-xs font-mono">null</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
        <span className="text-purple-400 text-xs font-mono">{String(value)}</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={String(value)} />
      </div>
    )
  }

  if (typeof value === 'number') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
        <span className="text-blue-400 text-xs font-mono">{value}</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={String(value)} />
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
        <span className="text-emerald-400 text-xs font-mono">&quot;{value}&quot;</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={value} />
      </div>
    )
  }

  if (Array.isArray(value)) {
    const items = value
    return (
      <div style={{ paddingLeft: depth * 20 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 py-0.5 hover:bg-zinc-800/50 rounded px-1 w-full text-left"
        >
          <span className="text-zinc-500 text-xs w-3">{expanded ? '▼' : '►'}</span>
          {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
          <span className="text-amber-400 text-xs font-mono">Array[{items.length}]</span>
        </button>
        {expanded && (
          <div>
            {items.map((item, i) => (
              <JsonTreeNode
                key={i}
                value={item}
                depth={depth + 1}
                isLast={i === items.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div style={{ paddingLeft: depth * 20 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 py-0.5 hover:bg-zinc-800/50 rounded px-1 w-full text-left"
        >
          <span className="text-zinc-500 text-xs w-3">{expanded ? '▼' : '►'}</span>
          {keyName !== undefined && <span className="text-text text-xs font-mono">&quot;{keyName}&quot;: </span>}
          <span className="text-amber-400 text-xs font-mono">{`{${entries.length}}`}</span>
        </button>
        {expanded && (
          <div>
            {entries.map(([k, v], i) => (
              <JsonTreeNode
                key={k}
                keyName={k}
                value={v}
                depth={depth + 1}
                isLast={i === entries.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`ml-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 rounded ${
        copied ? 'text-emerald-400 opacity-100' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {copied ? '✓' : t('jsonTree.copy')}
    </button>
  )
}

interface JsonTreeProps {
  data: unknown
}

export function JsonTree({ data }: JsonTreeProps) {
  return (
    <div className="font-mono text-xs bg-zinc-900/50 rounded-lg p-3 max-h-80 overflow-y-auto scrollbar-thin border border-zinc-800">
      <JsonTreeNode value={data} depth={0} isLast={true} />
    </div>
  )
}
