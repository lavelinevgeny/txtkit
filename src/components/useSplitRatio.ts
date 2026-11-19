import { useCallback, useState } from 'react'

export interface SplitBounds {
  min: number
  max: number
  fallback: number
}

export function clampRatio(value: number, { min, max }: SplitBounds): number {
  // Округляем до 0.01% — без хвостов вида 0.44000000000000006 в стилях и localStorage.
  return Math.round(Math.min(max, Math.max(min, value)) * 10000) / 10000
}

function readRatio(storageKey: string, bounds: SplitBounds): number {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw === null || raw.trim() === '' ? Number.NaN : Number(raw)
    return Number.isFinite(parsed) ? clampRatio(parsed, bounds) : bounds.fallback
  } catch {
    return bounds.fallback
  }
}

/**
 * Доля ширины левой панели (0..1) с сохранением в localStorage.
 * `setRatio(value, commit)` — commit=false во время перетаскивания (без записи в storage).
 */
export function useSplitRatio(storageKey: string, bounds: SplitBounds) {
  const [ratio, setRatioState] = useState(() => readRatio(storageKey, bounds))

  const setRatio = useCallback(
    (value: number, commit: boolean) => {
      const next = clampRatio(value, bounds)
      setRatioState(next)
      if (!commit) return
      try {
        localStorage.setItem(storageKey, String(next))
      } catch {
        // Хранилище недоступно — ширина просто не переживёт перезагрузку.
      }
    },
    [storageKey, bounds],
  )

  return [ratio, setRatio] as const
}
