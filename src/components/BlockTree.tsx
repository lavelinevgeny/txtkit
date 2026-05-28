import { useState } from 'react'
import { copyToClipboard } from '../utils/clipboard'
import { useTranslation } from '../i18n/context'
import type { BlockChild, BlockNode } from '../tools/1c-blocks-utils'

function childPreview(child: BlockChild): string {
  if (child.type === 'number') return child.value
  if (child.type === 'string') return `"${child.value.length > 15 ? child.value.slice(0, 15) + '...' : child.value}"`
  if (child.type === 'identifier') return child.value
  return `{${child.children.length}}`
}

function blockPreview(children: BlockChild[]): string {
  const preview = children.slice(0, 3).map(childPreview)
  if (children.length > 3) preview.push('...')
  return preview.join(', ')
}

interface BlockTreeNodeProps {
  node: BlockChild
  index: number
  depth: number
  isLast: boolean
}

function BlockTreeNode({ node, index, depth, isLast }: BlockTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)

  if (node.type === 'number') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        <span className="text-zinc-600 text-xs font-mono w-4 text-right">{index}</span>
        <span className="text-blue-400 text-xs font-mono">{node.value}</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={node.value} />
      </div>
    )
  }

  if (node.type === 'string') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        <span className="text-zinc-600 text-xs font-mono w-4 text-right">{index}</span>
        <span className="text-emerald-400 text-xs font-mono">&quot;{node.value}&quot;</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={node.value} />
      </div>
    )
  }

  if (node.type === 'identifier') {
    return (
      <div className="flex items-center gap-1.5 py-0.5 group" style={{ paddingLeft: depth * 20 }}>
        <span className="text-zinc-600 text-xs font-mono w-4 text-right">{index}</span>
        <span className="text-amber-400 text-xs font-mono">{node.value}</span>
        {!isLast && <span className="text-zinc-600 text-xs">,</span>}
        <CopyButton text={node.value} />
      </div>
    )
  }

  const children = (node as BlockNode).children
  const preview = blockPreview(children)

  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-0.5 hover:bg-zinc-800/50 rounded px-1 w-full text-left"
      >
        <span className="text-zinc-500 text-xs w-3">{expanded ? '▼' : '►'}</span>
        <span className="text-zinc-600 text-xs font-mono">[{index}]</span>
        <span className="text-amber-400 text-xs font-mono">Block</span>
        <span className="text-zinc-500 text-xs font-mono">({children.length}: {preview})</span>
      </button>
      {expanded && (
        <div>
          {children.map((child, i) => (
            <BlockTreeNode
              key={i}
              node={child}
              index={i}
              depth={depth + 1}
              isLast={i === children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
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

interface BlockTreeProps {
  data: unknown
}

export function BlockTree({ data }: BlockTreeProps) {
  const nodes = data as BlockChild[]
  if (!Array.isArray(nodes)) return null

  return (
    <div className="font-mono text-xs bg-zinc-900/50 rounded-lg p-3 max-h-80 overflow-y-auto scrollbar-thin border border-zinc-800">
      {nodes.map((node, i) => (
        <BlockTreeNode
          key={i}
          node={node}
          index={i}
          depth={0}
          isLast={i === nodes.length - 1}
        />
      ))}
    </div>
  )
}
