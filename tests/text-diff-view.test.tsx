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
    expect(screen.getByLabelText('Original…')).toHaveStyle({ width: '35%' })
  })

  it('changes and persists the shared input height with the horizontal handle', () => {
    renderTextDiff()
    const inputs = screen.getByTestId('text-diff-inputs')
    Object.defineProperty(inputs, 'getBoundingClientRect', {
      value: () => ({ top: 100, width: 1000, height: 160, bottom: 260 }),
    })

    fireEvent.pointerDown(screen.getByTestId('text-diff-horizontal-resizer'), { clientY: 260 })
    fireEvent.pointerMove(window, { clientY: 320 })
    fireEvent.pointerUp(window)

    expect(inputs).toHaveStyle({ height: '220px' })
    expect(localStorage.getItem('txtkit.textDiff.topHeight')).toBe('220')
  })

  it('changes and persists the column ratio with the vertical handle', () => {
    renderTextDiff()
    const inputs = screen.getByTestId('text-diff-inputs')
    Object.defineProperty(inputs, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 0, width: 1000, height: 160, right: 1100, bottom: 160 }),
    })

    fireEvent.pointerDown(screen.getByTestId('text-diff-vertical-resizer'), { clientX: 600 })
    fireEvent.pointerMove(window, { clientX: 700 })
    fireEvent.pointerUp(window)

    expect(screen.getByLabelText('Original…')).toHaveStyle({ width: '60%' })
    expect(localStorage.getItem('txtkit.textDiff.leftWidthRatio')).toBe('0.6')
  })
})
