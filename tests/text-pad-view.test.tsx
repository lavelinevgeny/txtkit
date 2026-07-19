import { StrictMode } from 'react'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  private static instances: MockResizeObserver[] = []
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  static trigger(width: number) {
    for (const observer of MockResizeObserver.instances) {
      observer.callback(
        [{ contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      )
    }
  }

  observe() {}
  unobserve() {}
  disconnect() {
    MockResizeObserver.instances = MockResizeObserver.instances.filter(
      (observer) => observer !== this,
    )
  }
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

function getClickHandler(element: HTMLElement): () => void {
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'))
  if (!propsKey) throw new Error('React click handler not found')
  const props = (element as unknown as Record<string, { onClick?: () => void }>)[propsKey]
  if (!props?.onClick) throw new Error('React click handler not found')
  return props.onClick
}

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver
})

afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await resetTextPadRepositoryForTests()
  for (const db of await indexedDB.databases()) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(db.name!)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }
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

  it('places responsive tabs immediately above the editor and promotes overflow tabs', async () => {
    const user = userEvent.setup()
    renderTextPad()
    await waitForEditor()

    act(() => {
      useTextPadStore.setState({
        activeTabId: 'pad1',
        openTabIds: ['pad1', 'pad2', 'pad3', 'pad4'],
        tabsById: {
          pad1: { title: 'pad1' },
          pad2: { title: 'pad2' },
          pad3: { title: 'pad3' },
          pad4: { title: 'pad4' },
        },
      })
      MockResizeObserver.trigger(320)
    })

    const tabBar = screen.getByTestId('text-pad-tab-bar')
    expect(tabBar.nextElementSibling).toHaveAttribute('data-testid', 'text-pad-editor-host')

    const moreTabsButton = screen.getByRole('button', { name: 'More tabs' })
    fireEvent.click(moreTabsButton)
    const overflowPopup = screen.getByRole('dialog', { name: 'More tabs' })
    expect(overflowPopup).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pad3' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close pad3' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'pad4' }))

    expect(screen.getByRole('button', { name: 'pad4' })).toBeInTheDocument()
    fireEvent.click(moreTabsButton)
    expect(screen.getByRole('button', { name: 'pad2' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'More tabs' })).toBeNull()
    expect(moreTabsButton).toHaveFocus()
    expect(screen.getByRole('button', { name: 'New tab' })).toBeInTheDocument()
  })

  it('closes a hidden tab from the overflow popup and dismisses it on outside pointer down', async () => {
    renderTextPad()
    await waitForEditor()

    act(() => {
      useTextPadStore.setState({
        activeTabId: 'pad1',
        openTabIds: ['pad1', 'pad2', 'pad3', 'pad4'],
        tabsById: {
          pad1: { title: 'pad1' },
          pad2: { title: 'pad2' },
          pad3: { title: 'pad3' },
          pad4: { title: 'pad4' },
        },
      })
      MockResizeObserver.trigger(320)
    })

    fireEvent.click(screen.getByRole('button', { name: 'More tabs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close pad3' }))

    expect(useTextPadStore.getState().openTabIds).not.toContain('pad3')
    expect(screen.queryByRole('dialog', { name: 'More tabs' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'More tabs' }))
    expect(screen.getByRole('dialog', { name: 'More tabs' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'More tabs' })).toBeNull()
  })

  it('renders an externally selected hidden tab immediately as visible', async () => {
    renderTextPad()
    await waitForEditor()

    act(() => {
      useTextPadStore.setState({
        activeTabId: 'pad4',
        openTabIds: ['pad1', 'pad2', 'pad3', 'pad4'],
        tabsById: {
          pad1: { title: 'pad1' },
          pad2: { title: 'pad2' },
          pad3: { title: 'pad3' },
          pad4: { title: 'pad4' },
        },
      })
      MockResizeObserver.trigger(320)
    })

    expect(screen.getByRole('button', { name: 'pad4' })).toHaveAttribute('data-active', 'true')
  })

  it('keeps one persisted replacement after repeated close of the last tab', async () => {
    renderTextPad()
    await waitForEditor()
    const closedId = useTextPadStore.getState().activeTabId
    expect(closedId).not.toBeNull()
    const closeButton = screen.getByTestId(`close-tab-${closedId}`)
    const close = getClickHandler(closeButton)

    act(() => {
      close()
      close()
    })

    await waitFor(() => {
      const state = useTextPadStore.getState()
      expect(state.openTabIds).toHaveLength(1)
      expect(state.openTabIds[0]).not.toBe(closedId)
      expect(state.tabsById[state.openTabIds[0]!]?.title).toBe('pad1')
      expect(state.nextUntitledNumber).toBe(2)
    })

    await waitFor(async () => {
      const state = useTextPadStore.getState()
      const replacementId = state.openTabIds[0]!
      const workspace = await getWorkspace()
      expect(state.openTabIds).toEqual([replacementId])
      expect(workspace).toMatchObject({
        activeTabId: replacementId,
        openTabIds: [replacementId],
        nextUntitledNumber: 2,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    await waitFor(() => {
      const state = useTextPadStore.getState()
      expect(state.tabsById[state.activeTabId!]?.title).toBe('pad2')
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

  it('shows close undo notices in a fixed three-item toast stack', async () => {
    renderTextPad()
    await waitForEditor()

    const initialId = useTextPadStore.getState().activeTabId!
    act(() => {
      useTextPadStore.setState({
        activeTabId: initialId,
        openTabIds: [initialId],
        tabsById: { [initialId]: useTextPadStore.getState().tabsById[initialId]! },
        nextUntitledNumber: 2,
      })
    })
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    }
    act(() => {
      MockResizeObserver.trigger(2000)
    })
    const ids = [...useTextPadStore.getState().openTabIds]
    const closeTabs = ids.map((id) => getClickHandler(screen.getByTestId(`close-tab-${id}`)))
    act(() => {
      for (const closeTab of closeTabs) closeTab()
    })

    await waitFor(async () => {
      expect((await getWorkspace())?.openTabIds).toHaveLength(1)
    })

    const host = screen.getByTestId('text-pad-undo-toasts')
    expect(host).toHaveClass('fixed', 'bottom-4', 'right-4')
    expect(screen.queryByTestId(`undo-${initialId}`)).toBeNull()
    expect(host.querySelectorAll('[data-testid^="undo-"]')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'More: 1' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('makes older close undo actions keyboard-accessible in a viewport-bound overflow', async () => {
    await resetTextPadRepositoryForTests()
    for (const db of await indexedDB.databases()) {
      if (db.name) {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
    }
    resetTextPadBootstrapForTests()
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
    renderTextPad()
    await waitForEditor()

    const initialId = useTextPadStore.getState().activeTabId!
    act(() => {
      useTextPadStore.setState({
        activeTabId: initialId,
        openTabIds: [initialId],
        tabsById: { [initialId]: useTextPadStore.getState().tabsById[initialId]! },
        nextUntitledNumber: 2,
      })
    })
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    }
    act(() => {
      MockResizeObserver.trigger(2000)
    })
    const closeTabs = useTextPadStore.getState().openTabIds.map((id) =>
      getClickHandler(screen.getByTestId(`close-tab-${id}`)),
    )
    act(() => {
      for (const closeTab of closeTabs) closeTab()
    })

    await waitFor(async () => {
      expect((await getWorkspace())?.openTabIds).toHaveLength(1)
    })

    const overflowButton = screen.getByRole('button', { name: /^More:/ })
    fireEvent.click(overflowButton)
    const overflow = screen.getByRole('dialog', { name: 'More closed tabs' })
    expect(overflow).toHaveClass('max-h-[calc(100dvh-11.75rem)]', 'overflow-y-auto')
    expect(overflowButton).toHaveAttribute('aria-controls', overflow.id)
    expect(overflowButton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(within(within(overflow).getByTestId(`undo-${initialId}`)).getByRole('button', { name: 'Undo' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'More closed tabs' })).toBeNull()
    expect(overflowButton).toHaveFocus()

    fireEvent.click(overflowButton)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'More closed tabs' })).toBeNull()
    expect(overflowButton).toHaveFocus()

    fireEvent.click(overflowButton)
    const reopenedOverflow = screen.getByRole('dialog', { name: 'More closed tabs' })
    fireEvent.click(within(within(reopenedOverflow).getByTestId(`undo-${initialId}`)).getByRole('button', { name: 'Undo' }))

    expect(useTextPadStore.getState().openTabIds).toContain(initialId)
    expect(screen.queryByRole('dialog', { name: 'More closed tabs' })).toBeNull()

    await waitFor(async () => {
      expect((await getWorkspace())?.openTabIds).toContain(initialId)
    })
  })
})
