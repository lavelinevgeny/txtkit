export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25

const WHEEL_SENSITIVITY = 0.0015
const WHEEL_FACTOR_MAX = 1.5

export type ZoomState = { zoom: number; pan: { x: number; y: number } }

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/**
 * factor > 1 приближает, < 1 отдаляет. cursor — координаты указателя
 * относительно вьюпорта. Точка контента под курсором остаётся неподвижной
 * (transform-origin: 0 0).
 */
export function zoomAtPoint(
  state: ZoomState,
  factor: number,
  cursor: { x: number; y: number },
): ZoomState {
  const nextZoom = clampZoom(state.zoom * factor)
  const contentX = (cursor.x - state.pan.x) / state.zoom
  const contentY = (cursor.y - state.pan.y) / state.zoom

  return {
    zoom: nextZoom,
    pan: {
      x: cursor.x - contentX * nextZoom,
      y: cursor.y - contentY * nextZoom,
    },
  }
}

/**
 * Плавный фактор из wheel-события: трекпад (много мелких deltaY) не даёт
 * рывков, колесо мыши (deltaY ≈ ±100) даёт привычные ~1.16×. Клампы по краям
 * защищают от аномально больших deltaY (deltaMode, инерция).
 */
export function wheelFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY)) return 1
  const factor = Math.exp(-deltaY * WHEEL_SENSITIVITY)
  return Math.min(WHEEL_FACTOR_MAX, Math.max(1 / WHEEL_FACTOR_MAX, factor))
}
