import { StrictMode } from 'react'
import { EditorView } from '@codemirror/view'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { I18nProvider } from '../src/i18n/context'
import { useStore } from '../src/store/useStore'
import { useTextPadStore } from '../src/tools/text-pad/useTextPadStore'
import {
  getAllDocuments,
  getWorkspace,
  resetTextPadRepositoryForTests,
  updateDocument,
} from '../src/db/textPadRepository'
import { resetDocumentWriteQueueForTests } from '../src/tools/text-pad/useDocumentWriteQueue'
import { resetWorkspaceQueueForTests } from '../src/tools/text-pad/useWorkspaceQueue'
import {
  resetTextPadBootstrapForTests,
  TextPadView,
} from '../src/tools/views/TextPadView'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderTextPad() {
  return render(
    <I18nProvider>
      <TextPadView />
    </I18nProvider>,
  )
}

async function waitForEditor() {
  await waitFor(() => {
    expect(
      screen.getByTestId('text-pad-editor-host').querySelector('.cm-editor'),
    ).not.toBeNull()
  })
}

function openGoToLineDialog(container: HTMLElement) {
  const editor = container.querySelector('.cm-editor')
  expect(editor).toBeInstanceOf(HTMLElement)
  fireEvent.click(screen.getByRole('button', { name: 'Go to line' }))
  return editor as HTMLElement
}

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver
})

beforeEach(async () => {
  localStorage.clear()
  await resetTextPadRepositoryForTests()
  resetWorkspaceQueueForTests()
  resetDocumentWriteQueueForTests()
  resetTextPadBootstrapForTests()
  for (const db of await indexedDB.databases()) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(db.name!)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }
  useStore.setState({
    input: '',
    activeToolId: null,
    catalogOpen: false,
    locale: 'en',
    editorPrefs: { lineWrapping: false, showWhitespace: false },
  })
  useTextPadStore.setState({
    activeTabId: null,
    openTabIds: [],
    tabsById: {},
    nextUntitledNumber: 1,
    persistenceStatus: 'initializing',
    currentRevisionById: {},
    savedRevisionById: {},
    saveErrorById: {},
    workspaceSaveError: false,
  })
})

describe('TextPadView', () => {
  it('renders tab bar with editor after init', async () => {
    renderTextPad()
    expect(screen.getByTestId('text-pad-tab-bar')).toBeInTheDocument()
    await waitForEditor()
    expect(useTextPadStore.getState().openTabIds.length).toBeGreaterThan(0)
  })

  it('resets the replacement tab to pad1 after closing the last tab', async () => {
    renderTextPad()
    await waitForEditor()
    const closedId = useTextPadStore.getState().activeTabId
    expect(closedId).not.toBeNull()

    fireEvent.click(screen.getByTestId(`close-tab-${closedId}`))

    await waitFor(() => {
      const state = useTextPadStore.getState()
      expect(state.openTabIds).toHaveLength(1)
      expect(state.openTabIds[0]).not.toBe(closedId)
      expect(state.tabsById[state.openTabIds[0]!]?.title).toBe('pad1')
      expect(state.nextUntitledNumber).toBe(2)
    })
  })

  it('creates exactly one initial document in StrictMode', async () => {
    render(
      <StrictMode>
        <I18nProvider>
          <TextPadView />
        </I18nProvider>
      </StrictMode>,
    )
    await waitForEditor()
    const documents = await getAllDocuments()
    const workspace = await getWorkspace()
    expect(documents).toHaveLength(1)
    expect(workspace?.openTabIds).toHaveLength(1)
    expect(workspace?.activeTabId).toBe(documents[0]?.id)
  })

  it('migrates legacy text exactly once in StrictMode', async () => {
    localStorage.setItem('txtkit-editor-doc', 'legacy text')
    render(
      <StrictMode>
        <I18nProvider>
          <TextPadView />
        </I18nProvider>
      </StrictMode>,
    )
    await waitForEditor()
    const documents = await getAllDocuments()
    expect(documents).toHaveLength(1)
    expect(documents[0]?.content).toBe('legacy text')
    expect(localStorage.getItem('txtkit-editor-doc')).toBeNull()
  })

  it('reads fresh persisted content after remount', async () => {
    const first = renderTextPad()
    await waitForEditor()
    const id = useTextPadStore.getState().activeTabId
    expect(id).not.toBeNull()
    await updateDocument(id!, {
      content: 'changed after first mount',
      selection: null,
      scrollTop: 0,
      contentRevision: 1,
      updatedAt: Date.now(),
    })
    first.unmount()
    renderTextPad()
    await waitForEditor()
    expect(
      screen.getByTestId('text-pad-editor-host').querySelector('.cm-content')?.textContent,
    ).toBe('changed after first mount')
    expect(useTextPadStore.getState().currentRevisionById[id!]).toBe(1)
    expect(useTextPadStore.getState().savedRevisionById[id!]).toBe(1)
  })

  it('collapses secondary operations behind a toggle', async () => {
    renderTextPad()
    await waitForEditor()
    expect(screen.queryByText('Remove empty lines')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Operations/ }))
    expect(screen.getByText('Remove empty lines')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Operations/ }))
    expect(screen.queryByText('Remove empty lines')).toBeNull()
  })

  it('moves the editor selection to the requested line', async () => {
    localStorage.setItem('txtkit-editor-doc', 'one\ntwo\nthree\nfour')
    const { container } = renderTextPad()
    await waitForEditor()
    const editor = openGoToLineDialog(container)
    fireEvent.change(screen.getByPlaceholderText('Line number'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    const view = EditorView.findFromDOM(editor)
    expect(view?.state.selection.main.head).toBe(view?.state.doc.line(3).from)
    expect(screen.queryByPlaceholderText('Line number')).toBeNull()
  })

  it('shows an error for a line outside the document', async () => {
    localStorage.setItem('txtkit-editor-doc', 'one\ntwo')
    const { container } = renderTextPad()
    await waitForEditor()
    openGoToLineDialog(container)
    fireEvent.change(screen.getByPlaceholderText('Line number'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.getByText('Line out of range')).toBeInTheDocument()
  })
})
