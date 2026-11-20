import { StrictMode } from 'react'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'
import * as repository from '../src/db/textPadRepository'
import { pendingDocuments, pendingOpenSession, pendingWorkspace } from '../src/tools/text-pad/pendingPadWrites'
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
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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
    expect(moreTabsButton).not.toHaveAttribute('aria-controls')
    fireEvent.click(moreTabsButton)
    const overflowPopup = screen.getByRole('dialog', { name: 'More tabs' })
    expect(overflowPopup).toBeInTheDocument()
    expect(moreTabsButton).toHaveAttribute('aria-controls', overflowPopup.id)
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

  it('keeps the new-tab button next to the last tab and opens a tab on empty-space double-click', async () => {
    renderTextPad()
    await waitForEditor()
    const activeId = useTextPadStore.getState().activeTabId!

    const newTabButton = screen.getByRole('button', { name: 'New tab' })
    const lastTab = screen.getByTestId(`close-tab-${activeId}`).parentElement!
    expect(lastTab.nextElementSibling).toBe(newTabButton)

    fireEvent.doubleClick(screen.getByTestId('text-pad-tab-bar-empty'))
    await waitFor(() => {
      const state = useTextPadStore.getState()
      expect(state.openTabIds).toHaveLength(2)
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
    expect(host).toHaveClass('pointer-events-none', 'fixed', 'inset-y-4', 'right-4', 'flex', 'flex-col')
    expect(host.querySelector('.pointer-events-auto')).toBeInTheDocument()
    expect(screen.queryByTestId(`undo-${initialId}`)).toBeNull()
    expect(host.querySelectorAll('[data-testid^="undo-"]')).toHaveLength(3)
    const overflowButton = screen.getByRole('button', { name: 'More: 1' })
    expect(overflowButton).toHaveAttribute('aria-expanded', 'false')
    expect(overflowButton).not.toHaveAttribute('aria-controls')
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
    expect(overflow.parentElement).toHaveClass('min-h-0', 'flex-1', 'flex', 'flex-col', 'justify-end')
    expect(overflow).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
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

function liveEditor() {
  return EditorView.findFromDOM(screen.getByTestId('text-pad-editor-host').querySelector('.cm-editor')!)!
}

function interceptArchiveDownload() {
  const downloads: Blob[] = []
  const createObjectURL = vi.fn((blob: Blob) => { downloads.push(blob); return 'blob:backup' })
  const original = URL
  vi.stubGlobal('URL', class extends original {
    static createObjectURL = createObjectURL
    static revokeObjectURL = vi.fn()
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return async () => {
    await waitFor(() => expect(downloads).toHaveLength(1))
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(downloads[0])
    })
    return JSON.parse(text) as Array<{ version: number; title: string; content: string }>
  }
}

describe('Text Pad recovery and backups', () => {
  it.each(['switch back', 'undo close', 'edit', 'unmount'])('cancels delayed TXT import after %s', async (action) => {
    const rendered = renderTextPad()
    await waitForEditor()
    const undoId = useTextPadStore.getState().activeTabId!
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    let finish!: (text: string) => void
    const text = new Promise<string>(resolve => { finish = resolve })
    const input = rendered.container.querySelector('input[type=file]')!
    fireEvent.change(input, { target: { files: [{ text: () => text }] } })
    if (action === 'switch back') {
      act(() => MockResizeObserver.trigger(2000))
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
      fireEvent.click(screen.getByRole('button', { name: 'pad1' }))
    } else if (action === 'undo close') {
      fireEvent.click(screen.getByTestId(`close-tab-${undoId}`))
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    } else if (action === 'unmount') {
      rendered.unmount()
    } else {
      act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'new edit' } }))
    }
    await act(async () => { finish('late import'); await text })
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Select the file again'))
    if (action === 'unmount') {
      renderTextPad()
      await waitForEditor()
    }
    expect(liveEditor().state.doc.toString()).toBe(action === 'edit' ? 'new edit' : '')
  })

  it('preserves the failed last-close snapshot after its Undo timeout and a remount', async () => {
    const rendered = renderTextPad()
    await waitForEditor()
    const closed = useTextPadStore.getState().activeTabId!
    const ws = (await getWorkspace())!
    const old = (await getAllDocuments())[0]
    await repository.commitWorkspace({ workspace: ws, putDocuments: [{ ...old, id: 'other', title: 'old closed' }] })
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'unsaved revision' } }))
    const fail = vi.spyOn(repository, 'commitWorkspace').mockRejectedValueOnce(new Error('close failed'))
    vi.useFakeTimers()
    fireEvent.click(screen.getByTestId(`close-tab-${closed}`))
    await act(async () => { await vi.advanceTimersByTimeAsync(5001) })
    vi.useRealTimers()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    fail.mockRestore()
    const replacement = useTextPadStore.getState().activeTabId!
    expect(replacement).not.toBe(closed)
    rendered.unmount()
    renderTextPad()
    await waitForEditor()
    expect(useTextPadStore.getState().openTabIds).toEqual([replacement])
    const banner = screen.getByTestId('memory-only-banner')
    const readArchive = interceptArchiveDownload()
    fireEvent.click(within(banner).getByRole('button', { name: 'Download all documents' }))
    expect(await readArchive()).toEqual(expect.arrayContaining([
      expect.objectContaining({ version: 1, content: 'unsaved revision' }),
      expect.objectContaining({ version: 1, title: 'old closed' }),
    ]))
    expect(pendingDocuments().get(closed)?.content).toBe('unsaved revision')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(banner).getByRole('button', { name: 'Delete closed' }))
    await waitFor(() => expect(useTextPadStore.getState().persistenceStatus).toBe('ready'))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 closed'))
    const saved = await getAllDocuments()
    expect(saved.find(doc => doc.id === closed)?.content).toBe('unsaved revision')
    expect(saved.some(doc => doc.id === 'other')).toBe(false)
    expect((await getWorkspace())?.openTabIds).toEqual([replacement])
    expect(pendingDocuments().size).toBe(0)
  })

  it('offers retry and explicitly partial export if enumeration fails', async () => {
    renderTextPad()
    await waitForEditor()
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'available' } }))
    vi.spyOn(repository, 'getAllDocuments').mockRejectedValue(new Error('unavailable'))
    const readArchive = interceptArchiveDownload()
    fireEvent.click(screen.getByRole('button', { name: 'Download all documents' }))
    await screen.findByText(/backup may be missing closed notes/)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retry export' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download available data' }))
    expect(await readArchive()).toEqual([expect.objectContaining({ content: 'available' })])
    expect(screen.getByText(/Downloaded a partial backup/)).toBeInTheDocument()
  })

  it('keeps the snapshot when a superseded write has no newer persisted version', async () => {
    renderTextPad()
    await waitForEditor()
    vi.spyOn(repository, 'updateDocument').mockResolvedValue('superseded')
    const id = useTextPadStore.getState().activeTabId!
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'keep this' } }))
    const banner = await screen.findByTestId('save-error-banner')
    expect(pendingDocuments().get(id)?.content).toBe('keep this')
    expect((await getAllDocuments())[0].content).toBe('')
    fireEvent.click(within(banner).getByRole('button', { name: 'Retry saving' }))
    await waitFor(() => expect(screen.queryByTestId('save-error-banner')).toBeNull())
    expect((await getAllDocuments())[0].content).toBe('keep this')
  })

  it('explains a newer database without altering its contents', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('txtkit-text-pad', 42)
      req.onupgradeneeded = () => req.result.createObjectStore('future').put('sentinel', 'note')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    try {
      renderTextPad()
      await screen.findByText(/saved by a newer version/)
      expect(screen.queryByTestId('text-pad-editor-host')).toBeNull()
      expect(await new Promise(resolve => {
        const req = db.transaction('future').objectStore('future').get('note')
        req.onsuccess = () => resolve(req.result)
      })).toBe('sentinel')
    } finally {
      db.close()
    }
  })
})

describe('Text Pad cleanup and version ordering', () => {
  it('protects saved documents with a live Undo during quota cleanup', async () => {
    renderTextPad()
    await waitForEditor()
    const closed = useTextPadStore.getState().activeTabId!
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'restore me' } }))
    fireEvent.click(screen.getByTestId(`close-tab-${closed}`))
    await waitFor(async () => {
      expect((await getAllDocuments()).find(doc => doc.id === closed)?.content).toBe('restore me')
    })
    const original = (await getAllDocuments()).find(doc => doc.id === closed)!
    await repository.commitWorkspace({
      workspace: (await getWorkspace())!, putDocuments: [{ ...original, id: 'expired', title: 'expired' }],
    })
    vi.spyOn(repository, 'updateDocument').mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'))
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'new' } }))
    const banner = await screen.findByTestId('quota-banner')
    expect(within(banner).getByRole('button', { name: 'Retry saving' })).toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Download all documents' })).toBeInTheDocument()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(banner).getByRole('button', { name: 'Delete closed' }))
    await waitFor(() => expect(screen.queryByTestId('quota-banner')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(liveEditor().state.doc.toString()).toBe('restore me')
    expect((await getAllDocuments()).map(doc => doc.id)).toContain(closed)
    expect((await getAllDocuments()).map(doc => doc.id)).not.toContain('expired')
  })

  it.each([
    ['higher persisted revision', 1, 0, 'on disk'],
    ['higher persisted timestamp', 0, 50000, 'on disk'],
    ['same version', 0, 0, 'memory'],
  ] as const)('selects the backup copy for %s', async (_, revision, increment, expected) => {
    localStorage.setItem('txtkit-editor-doc', 'memory')
    renderTextPad()
    await waitForEditor()
    const doc = (await getAllDocuments())[0]
    await updateDocument(doc.id, { ...doc, content: 'on disk', contentRevision: revision, updatedAt: doc.updatedAt + increment })
    const readArchive = interceptArchiveDownload()
    fireEvent.click(screen.getByRole('button', { name: 'Download all documents' }))
    expect(await readArchive()).toEqual([expect.objectContaining({ version: 1, content: expected })])
  })
})


describe('Text Pad remount without database read access', () => {
  it.each(['UnknownError', 'VersionError'])('retains open notes and their order after a document write fails and reads reject with %s', async (errorName) => {
    const rendered = renderTextPad()
    await waitForEditor()
    const first = useTextPadStore.getState().activeTabId!
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'already saved' } }))
    await waitFor(async () => expect((await getAllDocuments())[0].content).toBe('already saved'))
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const second = useTextPadStore.getState().activeTabId!
    await waitFor(async () => expect((await getWorkspace())?.openTabIds).toEqual([first, second]))
    const update = repository.updateDocument
    const failWrites = vi.spyOn(repository, 'updateDocument').mockImplementation((id, doc) =>
      id === second ? Promise.reject(new Error('write failed')) : update(id, doc))
    act(() => liveEditor().dispatch({ changes: { from: 0, insert: 'pending edit' } }))
    await screen.findByTestId('save-error-banner')
    expect(pendingWorkspace()).toBeUndefined()
    rendered.unmount()
    await waitFor(() => expect(pendingDocuments().has(first)).toBe(false))
    expect(pendingOpenSession()?.workspace.openTabIds).toEqual([first, second])
    const failReads = vi.spyOn(repository, 'getWorkspace').mockRejectedValue(new DOMException('', errorName))
    renderTextPad()
    await waitForEditor()
    expect(useTextPadStore.getState().openTabIds).toEqual([first, second])
    expect(useTextPadStore.getState().activeTabId).toBe(second)
    expect(liveEditor().state.doc.toString()).toBe('pending edit')
    if (errorName === 'VersionError') expect(screen.getByText(/saved by a newer version/)).toBeInTheDocument()
    const banner = screen.getByTestId('memory-only-banner')
    failReads.mockRestore()
    failWrites.mockRestore()
    fireEvent.click(within(banner).getByRole('button', { name: 'Retry saving' }))
    await waitFor(() => expect(useTextPadStore.getState().persistenceStatus).toBe('ready'))
    expect(pendingOpenSession()).toBeUndefined()
    expect((await getAllDocuments()).map(doc => doc.content).sort()).toEqual(['already saved', 'pending edit'])
  })
})
