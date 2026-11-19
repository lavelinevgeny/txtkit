import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { clampRatio, type SplitBounds } from './useSplitRatio'

const KEYBOARD_STEP = 0.02

interface Props {
  /** Контейнер, относительно ширины которого считается доля. */
  containerRef: RefObject<HTMLElement | null>
  ratio: number
  bounds: SplitBounds
  label: string
  onChange: (ratio: number, commit: boolean) => void
  className?: string
}

/**
 * Вертикальный разделитель панелей: перетаскивание мышью/пальцем, стрелки и Home/End
 * с клавиатуры, двойной клик — вернуть ширину по умолчанию.
 */
export function PaneSplitter({ containerRef, ratio, bounds, label, onChange, className = '' }: Props) {
  const [dragging, setDragging] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || event.button !== 0) return
    const width = container.getBoundingClientRect().width
    if (width <= 0) return

    cleanupRef.current?.()
    event.preventDefault()
    const target = event.currentTarget
    const pointerId = event.pointerId
    target.setPointerCapture?.(pointerId)
    const startX = event.clientX
    const startRatio = ratio
    let latest = ratio
    setDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const move = (moveEvent: globalThis.PointerEvent) => {
      latest = clampRatio(startRatio + (moveEvent.clientX - startX) / width, bounds)
      onChange(latest, false)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      setDragging(false)
      onChange(latest, true)
      if (cleanupRef.current === stop) cleanupRef.current = null
    }

    cleanupRef.current = stop
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === 'ArrowLeft' ? ratio - KEYBOARD_STEP
        : event.key === 'ArrowRight' ? ratio + KEYBOARD_STEP
          : event.key === 'Home' ? bounds.min
            : event.key === 'End' ? bounds.max
              : null
    if (next === null) return
    event.preventDefault()
    onChange(next, true)
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      title={label}
      aria-orientation="vertical"
      aria-valuemin={Math.round(bounds.min * 100)}
      aria-valuemax={Math.round(bounds.max * 100)}
      aria-valuenow={Math.round(ratio * 100)}
      data-dragging={dragging || undefined}
      onPointerDown={startDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onChange(bounds.fallback, true)}
      className={`group relative w-2 cursor-col-resize touch-none select-none items-center justify-center focus:outline-none ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent/25 group-data-[dragging]:bg-accent/40"
      />
      <span
        aria-hidden="true"
        className="relative h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-accent/70 group-focus-visible:bg-accent group-data-[dragging]:bg-accent"
      />
    </div>
  )
}
