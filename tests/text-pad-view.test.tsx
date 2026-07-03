import { EditorView } from '@codemirror/view'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TextPadView } from '../src/tools/views/TextPadView'
import { I18nProvider } from '../src/i18n/context'
import { useStore } from '../src/store/useStore'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function openGoToLineDialog(container: HTMLElement) {
  const editor = container.querySelector('.cm-editor')
  expect(editor).toBeInstanceOf(HTMLElement)
  fireEvent.keyDown(editor as HTMLElement, { key: 'g', ctrlKey: true, altKey: true })
  return editor as HTMLElement
}

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver
})

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    input: '',
    activeToolId: null,
    catalogOpen: false,
    locale: 'en',
    editorDoc: '',
    editorPrefs: { lineWrapping: false, showWhitespace: false },
    editorAutosaveWarning: null,
  })
})

describe('TextPadView', () => {
  it('renders the editor container with CodeMirror mounted', () => {
    const { container } = render(
      <I18nProvider>
        <TextPadView />
      </I18nProvider>,
    )
    expect(container.querySelector('[data-testid="text-pad-view"]')).not.toBeNull()
    expect(container.querySelector('.cm-editor')).not.toBeNull()
  })

  it('collapses secondary operations behind a toggle', () => {
    render(
      <I18nProvider>
        <TextPadView />
      </I18nProvider>,
    )

    expect(screen.queryByText('Remove empty lines')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))

    expect(screen.getByText('Remove empty lines')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))

    expect(screen.queryByText('Remove empty lines')).toBeNull()
  })

  it('moves the editor selection to the requested line', () => {
    useStore.setState({ editorDoc: 'one\ntwo\nthree\nfour' })
    const { container } = render(
      <I18nProvider>
        <TextPadView />
      </I18nProvider>,
    )

    const editor = openGoToLineDialog(container)
    fireEvent.change(screen.getByPlaceholderText('Line number'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    const view = EditorView.findFromDOM(editor)
    expect(view).not.toBeNull()
    expect(view?.state.selection.main.head).toBe(view?.state.doc.line(3).from)
    expect(screen.queryByText('Go to line')).toBeNull()
  })

  it('shows an error for a line outside the document', () => {
    useStore.setState({ editorDoc: 'one\ntwo' })
    const { container } = render(
      <I18nProvider>
        <TextPadView />
      </I18nProvider>,
    )

    openGoToLineDialog(container)
    fireEvent.change(screen.getByPlaceholderText('Line number'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(screen.getByText('Line out of range')).toBeInTheDocument()
    expect(screen.getByText('Go to line')).toBeInTheDocument()
  })
})
