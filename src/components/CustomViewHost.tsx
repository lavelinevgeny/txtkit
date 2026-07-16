import { Suspense, lazy, type ComponentType } from 'react'
import { TextPadView } from '../tools/views/TextPadView'
import { TextDiffView } from '../tools/views/TextDiffView'

const MermaidView = lazy(() => import('../tools/views/MermaidView'))

const VIEWS: Record<string, ComponentType> = {
  'text-pad': TextPadView,
  'text-diff': TextDiffView,
  mermaid: MermaidView,
}

function ViewFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-muted font-mono text-xs">
      Loading...
    </div>
  )
}

export function CustomViewHost({ toolId }: { toolId: string }) {
  const View = VIEWS[toolId]
  return View ? (
    <Suspense fallback={<ViewFallback />}>
      <View />
    </Suspense>
  ) : null
}
