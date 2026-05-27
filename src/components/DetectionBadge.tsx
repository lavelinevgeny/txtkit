import { useStore } from '../store/useStore'
import { detectInputTypes } from '../tools/detect'

export function DetectionBadge() {
  const input = useStore(s => s.input)
  const locale = useStore(s => s.locale)

  if (!input.trim()) return null

  const detections = detectInputTypes(input)
  if (detections.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="w-1.5 h-1.5 rounded-full bg-success" />
      <span className="text-[10px] text-success">{detections[0].label}</span>
      {detections.length > 1 && (
        <span className="text-[9px] text-muted-dim">+{detections.length - 1}</span>
      )}
    </div>
  )
}
