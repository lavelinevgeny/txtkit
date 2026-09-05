import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  wheelFactor,
  zoomAtPoint,
  ZOOM_MAX,
  ZOOM_MIN,
  type ZoomState,
} from '../src/tools/views/mermaidZoom'

const at = (state: ZoomState, point: { x: number; y: number }) => ({
  x: (point.x - state.pan.x) / state.zoom,
  y: (point.y - state.pan.y) / state.zoom,
})

describe('clampZoom', () => {
  it('clamps below the minimum', () => {
    expect(clampZoom(0.05)).toBe(ZOOM_MIN)
  })

  it('clamps above the maximum', () => {
    expect(clampZoom(10)).toBe(ZOOM_MAX)
  })

  it('passes values inside the range through', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0.25)).toBe(0.25)
    expect(clampZoom(2.75)).toBe(2.75)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor fixed', () => {
    const state: ZoomState = { zoom: 1.5, pan: { x: -40, y: 25 } }
    const cursor = { x: 120, y: 80 }
    const before = at(state, cursor)

    const next = zoomAtPoint(state, 1.25, cursor)
    const after = at(next, cursor)

    expect(next.zoom).toBeCloseTo(1.875, 10)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('keeps the content point fixed when zooming out too', () => {
    const state: ZoomState = { zoom: 2, pan: { x: 15, y: -60 } }
    const cursor = { x: 33, y: 210 }
    const before = at(state, cursor)

    const next = zoomAtPoint(state, 0.5, cursor)
    const after = at(next, cursor)

    expect(next.zoom).toBeCloseTo(1, 10)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('clamps the zoom and pans from the clamped value', () => {
    const state: ZoomState = { zoom: ZOOM_MAX, pan: { x: 10, y: 20 } }
    const cursor = { x: 100, y: 50 }

    const next = zoomAtPoint(state, 2, cursor)

    expect(next.zoom).toBe(ZOOM_MAX)
    expect(next.pan).toEqual(state.pan)
  })

  it('clamps at the minimum and pans from the clamped value', () => {
    const state: ZoomState = { zoom: 0.5, pan: { x: 10, y: 20 } }
    const cursor = { x: 100, y: 50 }
    const before = at(state, cursor)

    const next = zoomAtPoint(state, 0.1, cursor)
    const after = at(next, cursor)

    expect(next.zoom).toBe(ZOOM_MIN)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('leaves the state unchanged for factor 1', () => {
    const state: ZoomState = { zoom: 1.5, pan: { x: -40, y: 25 } }

    const next = zoomAtPoint(state, 1, { x: 120, y: 80 })

    expect(next.zoom).toBeCloseTo(state.zoom, 10)
    expect(next.pan.x).toBeCloseTo(state.pan.x, 10)
    expect(next.pan.y).toBeCloseTo(state.pan.y, 10)
  })
})

describe('wheelFactor', () => {
  it('zooms in on negative deltaY', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1)
  })

  it('zooms out on positive deltaY', () => {
    expect(wheelFactor(100)).toBeLessThan(1)
  })

  it('is neutral for deltaY 0', () => {
    expect(wheelFactor(0)).toBe(1)
  })

  it('clamps extreme deltaY values', () => {
    expect(wheelFactor(-10000)).toBeCloseTo(1.5, 10)
    expect(wheelFactor(10000)).toBeCloseTo(1 / 1.5, 10)
  })
})
