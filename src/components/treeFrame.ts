/**
 * Размер контейнера дерева (JSON / YAML / 1C):
 * - compact — плитка в обычной колонке, своя прокрутка до 320px;
 * - wide    — плитка в развёрнутом режиме, своя прокрутка до 60% высоты окна;
 * - fill    — полноэкранный просмотр: без рамки и ограничения, прокручивает родитель.
 */
export type TreeSize = 'compact' | 'wide' | 'fill'

export interface TreeViewProps {
  data: unknown
  size?: TreeSize
}

const BOXED = 'font-mono text-xs bg-zinc-900/50 rounded-lg p-3 overflow-y-auto scrollbar-thin border border-zinc-800'

export function treeFrameClass(size: TreeSize = 'compact'): string {
  if (size === 'fill') return 'font-mono text-xs'
  return `${BOXED} ${size === 'wide' ? 'max-h-[60dvh]' : 'max-h-80'}`
}
