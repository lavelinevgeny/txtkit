import type { ComponentType } from 'react'
import { TextPadView } from '../tools/views/TextPadView'
import { TextDiffView } from '../tools/views/TextDiffView'

const VIEWS: Record<string, ComponentType> = {
  'text-pad': TextPadView,
  'text-diff': TextDiffView,
}

export function CustomViewHost({ toolId }: { toolId: string }) {
  const View = VIEWS[toolId]
  return View ? <View /> : null
}
