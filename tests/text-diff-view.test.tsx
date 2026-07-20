import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n/context'
import { useStore } from '../src/store/useStore'
import { TextDiffView } from '../src/tools/views/TextDiffView'

function renderTextDiff() {
  return render(
    <I18nProvider>
      <TextDiffView />
    </I18nProvider>,
  )
}

function mockLayoutRect(width = 1000, height = 600) {
  const layout = screen.getByTestId('text-diff-layout')
  Object.defineProperty(layout, 'getBoundingClientRect', {
    value: () => ({
      left: 100,
      top: 100,
      width,
      height,
      right: 100 + width,
      bottom: 100 + height,
    }),
  })
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ input: '', activeToolId: 'text-diff', locale: 'en' })
})

describe('TextDiffView layout', () => {
  it('restores valid persisted pane dimensions', () => {
    localStorage.setItem('txtkit.textDiff.topHeight', '180')
    localStorage.setItem('txtkit.textDiff.leftWidthRatio', '0.35')

    renderTextDiff()

    expect(screen.getByTestId('text-diff-inputs')).toHaveStyle({ height: '180px' })
    expect(screen.getByPlaceholderText('Original…')).toHaveStyle({ width: '35%' })
  })

  it('changes and persists the shared input height with the horizontal handle', () => {
    renderTextDiff()
    mockLayoutRect()
    const inputs = screen.getByTestId('text-diff-inputs')

    fireEvent.pointerDown(screen.getByTestId('text-diff-horizontal-resizer'), { clientY: 260 })
    fireEvent.pointerMove(window, { clientY: 320 })
    fireEvent.pointerUp(window)

    expect(inputs).toHaveStyle({ height: '220px' })
    expect(localStorage.getItem('txtkit.textDiff.topHeight')).toBe('220')
  })

  it('changes and persists the column ratio with the vertical handle', () => {
    renderTextDiff()
    mockLayoutRect()

    fireEvent.pointerDown(screen.getByTestId('text-diff-vertical-resizer'), { clientX: 600 })
    fireEvent.pointerMove(window, { clientX: 700 })
    fireEvent.pointerUp(window)

    expect(screen.getByPlaceholderText('Original…')).toHaveStyle({ width: '60%' })
    expect(localStorage.getItem('txtkit.textDiff.leftWidthRatio')).toBe('0.6')
  })

  it('clamps the input area to its 120px minimum height', () => {
    renderTextDiff()
    mockLayoutRect()

    fireEvent.pointerDown(screen.getByTestId('text-diff-horizontal-resizer'), { clientY: 260 })
    fireEvent.pointerMove(window, { clientY: -240 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('text-diff-inputs')).toHaveStyle({ height: '120px' })
    expect(localStorage.getItem('txtkit.textDiff.topHeight')).toBe('120')
  })

  it('keeps 240px available for the result pane', () => {
    renderTextDiff()
    mockLayoutRect(1000, 500)

    fireEvent.pointerDown(screen.getByTestId('text-diff-horizontal-resizer'), { clientY: 260 })
    fireEvent.pointerMove(window, { clientY: 760 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('text-diff-inputs')).toHaveStyle({ height: '260px' })
    expect(localStorage.getItem('txtkit.textDiff.topHeight')).toBe('260')
  })

  it('keeps both top panes at least 240px wide', () => {
    renderTextDiff()
    mockLayoutRect(1000)

    const verticalResizer = screen.getByTestId('text-diff-vertical-resizer')
    fireEvent.pointerDown(verticalResizer, { clientX: 600 })
    fireEvent.pointerMove(window, { clientX: -100 })
    fireEvent.pointerUp(window)

    expect(screen.getByPlaceholderText('Original…')).toHaveStyle({ width: '24%' })
    expect(localStorage.getItem('txtkit.textDiff.leftWidthRatio')).toBe('0.24')

    fireEvent.pointerDown(verticalResizer, { clientX: 600 })
    fireEvent.pointerMove(window, { clientX: 1300 })
    fireEvent.pointerUp(window)

    expect(screen.getByPlaceholderText('Original…')).toHaveStyle({ width: '76%' })
    expect(localStorage.getItem('txtkit.textDiff.leftWidthRatio')).toBe('0.76')
  })
})
