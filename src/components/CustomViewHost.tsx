import type { ComponentType } from 'react'
import { TextPadView } from '../tools/views/TextPadView'

const VIEWS: Record<string, ComponentType> = {
  'text-pad': TextPadView,
}

export function CustomViewHost({ toolId }: { toolId: string }) {
  const View = VIEWS[toolId]
  return View ? <View /> : null
}
