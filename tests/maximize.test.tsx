import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { useStore } from '../src/store/useStore'

function renderApp() {
  return render(<App />)
}

const brand = () => screen.queryByRole('heading', { level: 1 })
const carouselAllButton = () => screen.queryByRole('button', { name: /^⊞\s*All$/ })

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ input: '', activeToolId: null, catalogOpen: false, locale: 'en', maximized: false })
})

describe('maximize tool frame', () => {
  it('maximizes auto mode from the button next to the logo, keeping the catalog reachable', () => {
    renderApp()
    expect(screen.queryByTestId('tool-header')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))

    const header = screen.getByTestId('tool-header')
    expect(within(header).getByRole('heading', { name: 'Auto-detect' })).toBeInTheDocument()
    expect(within(header).queryByRole('button', { name: '← back to tools' })).toBeNull()
    expect(screen.getByTestId('transform-workspace')).toBeInTheDocument()
    expect(brand()).toBeNull()
    expect(carouselAllButton()).toBeNull()

    fireEvent.click(within(header).getByRole('button', { name: /Tools$/ }))
    expect(useStore.getState().catalogOpen).toBe(true)
  })

  it('maximizes a transform tool into a two-pane workspace and persists the preference', () => {
    useStore.setState({ activeToolId: 'json' })
    renderApp()

    const header = screen.getByTestId('tool-header')
    expect(within(header).getByRole('heading', { name: 'JSON Tools' })).toBeInTheDocument()
    expect(screen.queryByTestId('transform-workspace')).toBeNull()

    fireEvent.click(within(header).getByRole('button', { name: 'Maximize' }))

    expect(useStore.getState().maximized).toBe(true)
    expect(localStorage.getItem('txtkit-maximized')).toBe('1')
    expect(screen.getByTestId('transform-workspace')).toBeInTheDocument()
    expect(brand()).toBeNull()
    expect(carouselAllButton()).toBeNull()
    expect(screen.getByRole('button', { name: 'Restore' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(useStore.getState().maximized).toBe(false)
    expect(localStorage.getItem('txtkit-maximized')).toBe('0')
    expect(brand()).not.toBeNull()
    expect(carouselAllButton()).not.toBeNull()
  })

  it('maximizes custom views through the shared header', () => {
    useStore.setState({ activeToolId: 'text-diff' })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))

    expect(screen.getByRole('heading', { name: 'Text Diff' })).toBeInTheDocument()
    expect(brand()).toBeNull()
    expect(carouselAllButton()).toBeNull()
  })

  it('returns to tools from the shared header back button', () => {
    useStore.setState({ activeToolId: 'text-diff', maximized: true })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: '← back to tools' }))

    expect(useStore.getState().activeToolId).toBeNull()
    // Остаёмся развёрнутыми — уже в авто-режиме.
    expect(screen.getByRole('heading', { name: 'Auto-detect' })).toBeInTheDocument()
    expect(brand()).toBeNull()
  })

  it('toggles with Alt+Shift+F', () => {
    useStore.setState({ activeToolId: 'json' })
    renderApp()

    fireEvent.keyDown(window, { code: 'KeyF', key: 'F', altKey: true, shiftKey: true })
    expect(useStore.getState().maximized).toBe(true)

    fireEvent.keyDown(window, { code: 'KeyF', key: 'F', altKey: true, shiftKey: true })
    expect(useStore.getState().maximized).toBe(false)
  })

  it('restores on Escape, but not while typing in a field', () => {
    useStore.setState({ activeToolId: 'json', maximized: true })
    renderApp()

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(useStore.getState().maximized).toBe(true)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useStore.getState().maximized).toBe(false)
  })

  it('toggles auto mode with Alt+Shift+F too', () => {
    renderApp()

    fireEvent.keyDown(window, { code: 'KeyF', key: 'F', altKey: true, shiftKey: true })
    expect(useStore.getState().maximized).toBe(true)
    expect(screen.getByTestId('transform-workspace')).toBeInTheDocument()
  })
})

describe('result viewer', () => {
  it('opens an expanded result full screen; Escape closes the viewer without restoring the tool', () => {
    useStore.setState({ activeToolId: 'json', maximized: true, input: '{"a": 1}' })
    renderApp()

    fireEvent.click(screen.getByText('Minify').closest('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }))

    const dialog = screen.getByRole('dialog', { name: 'Minify' })
    expect(within(dialog).getByTestId('result-viewer-text')).toHaveTextContent('{"a":1}')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Wrap' }))
    expect(within(dialog).getByRole('button', { name: 'Wrap' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useStore.getState().maximized).toBe(true)
  })

  it('stretches a tree to the full viewer height instead of its 320px tile box', () => {
    useStore.setState({ activeToolId: 'json', maximized: true, input: '{"a": {"b": [1, 2]}}' })
    renderApp()

    fireEvent.click(screen.getByText('JSON tree').closest('button')!)
    expect(screen.getByTestId('transform-workspace').querySelector('.max-h-80')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }))

    const dialog = screen.getByRole('dialog', { name: 'JSON tree' })
    expect(within(dialog).getByText(/"a":/)).toBeInTheDocument()
    expect(dialog.querySelector('[class*="max-h-"]')).toBeNull()
  })

  it('is available for results in the normal (non-maximized) layout too', () => {
    useStore.setState({ input: '{"a": 1}' })
    renderApp()

    fireEvent.click(screen.getByText('Minify').closest('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }))

    expect(screen.getByRole('dialog', { name: 'Minify' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('transform workspace splitter', () => {
  function renderWorkspace() {
    useStore.setState({ activeToolId: 'json', maximized: true })
    renderApp()
    return screen.getByRole('separator', { name: /Pane width/ })
  }

  it('resizes the input pane from the keyboard and persists the width', () => {
    const splitter = renderWorkspace()
    expect(splitter).toHaveAttribute('aria-valuenow', '40')

    fireEvent.keyDown(splitter, { key: 'ArrowRight' })
    fireEvent.keyDown(splitter, { key: 'ArrowRight' })

    expect(splitter).toHaveAttribute('aria-valuenow', '44')
    expect(screen.getByTestId('transform-panes').style.getPropertyValue('--left-pane')).toBe('44%')
    expect(localStorage.getItem('txtkit.transformWorkspace.leftWidthRatio')).toBe('0.44')

    fireEvent.keyDown(splitter, { key: 'End' })
    expect(splitter).toHaveAttribute('aria-valuenow', '75')
    fireEvent.keyDown(splitter, { key: 'ArrowRight' })
    expect(splitter).toHaveAttribute('aria-valuenow', '75')
  })

  it('resizes by dragging and resets on double-click', () => {
    const splitter = renderWorkspace()
    const panes = screen.getByTestId('transform-panes')
    panes.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 }) as DOMRect

    fireEvent.pointerDown(splitter, { button: 0, clientX: 400, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 550 })
    fireEvent.pointerUp(window)

    expect(splitter).toHaveAttribute('aria-valuenow', '55')
    expect(localStorage.getItem('txtkit.transformWorkspace.leftWidthRatio')).toBe('0.55')

    fireEvent.doubleClick(splitter)
    expect(splitter).toHaveAttribute('aria-valuenow', '40')
  })

  it('restores a saved width and clamps out-of-range values', () => {
    localStorage.setItem('txtkit.transformWorkspace.leftWidthRatio', '0.95')
    expect(renderWorkspace()).toHaveAttribute('aria-valuenow', '75')
  })
})

describe('smart input clear button', () => {
  function setup() {
    useStore.setState({ activeToolId: 'json', maximized: true })
    renderApp()
    const textarea = screen.getByRole('textbox')
    // В jsdom нет стилей Tailwind и раскладки — задаём геометрию поля явно:
    // однострочная высота = 1 + 12 + 20 + 12 + 1 = 46px.
    Object.assign(textarea.style, { border: '1px solid', padding: '12px', lineHeight: '20px' })
    fireEvent.change(textarea, { target: { value: 'hello' } })
    const wrapper = screen.getByRole('button', { name: 'Clear' }).parentElement!
    Object.defineProperty(wrapper, 'offsetHeight', { configurable: true, value: 24 })
    return { textarea, wrapper }
  }

  it('centers the button in a single-line field: equal top, bottom and right insets', () => {
    const { textarea, wrapper } = setup()

    fireEvent.change(textarea, { target: { value: 'hello!' } })

    expect(wrapper.style.top).toBe('11px') // (46 - 24) / 2 → снизу тоже 11px
    expect(wrapper.style.right).toBe('11px')
  })

  it('shifts the button past the textarea scrollbar', () => {
    const { textarea, wrapper } = setup()
    Object.defineProperty(textarea, 'offsetWidth', { configurable: true, value: 402 })
    Object.defineProperty(textarea, 'clientWidth', { configurable: true, value: 390 })

    fireEvent.change(textarea, { target: { value: 'hello!' } })

    expect(wrapper.style.top).toBe('11px')
    expect(wrapper.style.right).toBe('21px') // 11 + (402 - 390 - 2px borders)
  })
})
