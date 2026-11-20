import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { deleteCharBackward, redo, undo } from '@codemirror/commands'
import { I18nProvider } from '../src/i18n/context'
import { useStore } from '../src/store/useStore'
import * as repo from '../src/db/textPadRepository'
import { TextPadView, resetTextPadBootstrapForTests } from '../src/tools/views/TextPadView'
import { useTextPadStore } from '../src/tools/text-pad/useTextPadStore'
import { resetWorkspaceQueueForTests } from '../src/tools/text-pad/useWorkspaceQueue'
import { resetDocumentWriteQueueForTests } from '../src/tools/text-pad/useDocumentWriteQueue'
import { padImageBindings, padImageFiles } from '../src/tools/text-pad/padImageEditor'

beforeEach(() => {
  // jsdom provides DOM selections without layout rectangles.
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
  localStorage.clear()
  useStore.setState({ locale: 'en', input: '' })
  useTextPadStore.setState(useTextPadStore.getInitialState())
  resetDocumentWriteQueueForTests()
  resetWorkspaceQueueForTests()
  resetTextPadBootstrapForTests()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(async () => {
  cleanup()
  await new Promise(resolve => setTimeout(resolve, 15))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await repo.resetTextPadRepositoryForTests()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('txtkit-text-pad')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
})

async function openPad() {
  const component = render(<I18nProvider><TextPadView /></I18nProvider>)
  await waitFor(() => expect(component.container.querySelector('.cm-editor')).toBeTruthy())
  const editor = EditorView.findFromDOM(component.container.querySelector('.cm-editor')!)!
  return { ...component, editor }
}

async function insertImage(editor: EditorView) {
  const file = new File([Uint8Array.of(1, 2, 253)], 'shot.png', { type: 'image/png' })
  fireEvent.paste(editor.contentDOM, { clipboardData: { files: [file], getData: () => '' } })
  await waitFor(() => expect(padImageBindings(editor.state)).toHaveLength(1))
  return padImageBindings(editor.state)[0].imageId
}

it('restores the original bytes through Undo after a saved deletion and tab switches', async () => {
  const { editor, unmount } = await openPad()
  const id = useTextPadStore.getState().activeTabId!
  const imageId = await insertImage(editor)
  await waitFor(async () => expect(Array.from((await repo.readPadImage(id, imageId))?.bytes ?? [])).toEqual([1, 2, 253]))
  fireEvent.click(screen.getByRole('button', { name: /Operations/ }))
  expect(screen.getByRole('button', { name: 'Sort lines' })).toBeDisabled()
  act(() => { deleteCharBackward(editor) })
  expect(screen.getByRole('button', { name: 'Sort lines' })).toBeEnabled()
  await waitFor(async () => expect(await repo.readPadImage(id, imageId)).toBeUndefined())
  fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
  fireEvent.keyDown(editor.contentDOM, { key: '1', code: 'Digit1', altKey: true, shiftKey: true })
  await waitFor(() => expect(useTextPadStore.getState().activeTabId).toBe(id))
  act(() => { undo(editor) })
  expect(padImageFiles(editor.state)[imageId]?.bytes).toEqual(Uint8Array.of(1, 2, 253))
  await waitFor(async () => expect(Array.from((await repo.readPadImage(id, imageId))?.bytes ?? [])).toEqual([1, 2, 253]))
  unmount()
  const restored = await openPad()
  await waitFor(() => expect(Array.from(padImageFiles(restored.editor.state)[imageId]?.bytes ?? [])).toEqual([1, 2, 253]))
})

it('exports and retries a failed closed note with its memory-only image', async () => {
  const { editor } = await openPad()
  const id = useTextPadStore.getState().activeTabId!
  const imageId = await insertImage(editor)
  vi.spyOn(repo, 'commitWorkspace').mockRejectedValueOnce(new Error('interrupted'))
  fireEvent.click(screen.getByTestId(`close-tab-${id}`))
  const warning = await screen.findByTestId('memory-only-banner')
  const downloads: Blob[] = []
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL(blob: Blob) { downloads.push(blob); return 'blob:backup' }
    static revokeObjectURL() {}
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  fireEvent.click(within(warning).getByRole('button', { name: 'Download all documents' }))
  await waitFor(() => expect(downloads).toHaveLength(1))
  const archive = JSON.parse(await downloads[0].text())
  expect(archive).toContainEqual(expect.objectContaining({
    version: 2, images: [{ offset: 0, mimeType: 'image/png', dataBase64: 'AQL9' }],
  }))
  fireEvent.click(within(warning).getByRole('button', { name: 'Retry saving' }))
  await waitFor(async () => expect(Array.from((await repo.readPadImage(id, imageId))?.bytes ?? [])).toEqual([1, 2, 253]))
  expect((await repo.getWorkspace())?.openTabIds).not.toContain(id)
})

it('reports cancellation when leaving Pad during a pending paste', async () => {
  const { editor, unmount } = await openPad()
  let complete!: (value: ArrayBuffer) => void
  const image = new File([Uint8Array.of(1)], 'shot.png', { type: 'image/png' })
  Object.defineProperty(image, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { complete = resolve }) })
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
  fireEvent.paste(editor.contentDOM, { clipboardData: { files: [image], getData: () => '' } })
  unmount()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('Image paste canceled'))
  complete(Uint8Array.of(1).buffer)
  const next = await openPad()
  expect(padImageBindings(next.editor.state)).toHaveLength(0)
})

it('keeps local bytes on deactivation if another editor already removed the saved file', async () => {
  const first = await openPad()
  const id = useTextPadStore.getState().activeTabId!
  const imageId = await insertImage(first.editor)
  await waitFor(async () => expect(await repo.readPadImage(id, imageId)).toBeDefined())
  first.unmount()
  const { editor } = await openPad()
  await waitFor(() => expect(padImageFiles(editor.state)[imageId]).toBeDefined())
  const [saved] = await repo.getAllDocuments()
  await repo.updateDocument(id, { ...saved, content: '', images: [], contentRevision: saved.contentRevision + 1 })
  expect(await repo.readPadImage(id, imageId)).toBeUndefined()
  const keys = vi.spyOn(repo, 'getStoredPadImageIds')
  fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
  await waitFor(() => expect(keys).toHaveBeenCalledWith(id))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  fireEvent.keyDown(editor.contentDOM, { key: '1', code: 'Digit1', altKey: true, shiftKey: true })
  expect(Array.from(padImageFiles(editor.state)[imageId].bytes)).toEqual([1, 2, 253])
  act(() => editor.dispatch({ changes: { from: editor.state.doc.length, insert: '!' } }))
  await waitFor(async () => expect(Array.from((await repo.readPadImage(id, imageId))?.bytes ?? [])).toEqual([1, 2, 253]))
})

it('diagnoses a file removed before an inactive note with no history has loaded its bytes', async () => {
  const id = 'inactive'
  const saved = {
    id, title: 'Saved image', content: '\uFFFC', selection: null,
    createdAt: 1, updatedAt: 2, contentRevision: 1, scrollTop: 0,
    images: [{ offset: 0, imageId: 'photo' }],
    imageFiles: { photo: { mimeType: 'image/png', bytes: Uint8Array.of(1, 2, 253) } },
  }
  await repo.commitWorkspace({
    workspace: {
      key: 'current', activeTabId: 'active', openTabIds: [id, 'active'], nextUntitledNumber: 3,
      migrations: { legacyLocalStorageMigrationCompleted: true },
    },
    putDocuments: [saved, { ...saved, id: 'active', images: [], imageFiles: {}, content: '' }],
  })
  const restored = await openPad()
  await repo.updateDocument(id, { ...saved, content: 'external change', images: [], contentRevision: saved.contentRevision + 1 })
  fireEvent.keyDown(restored.editor.contentDOM, { key: '1', code: 'Digit1', altKey: true, shiftKey: true })
  await screen.findByText(/Some images could not be linked/)
  expect(padImageBindings(restored.editor.state)).toHaveLength(0)
  expect((await repo.getAllDocuments()).find(doc => doc.id === id)?.content).toBe('external change')
})

it('recovers a subsequently deleted file from insertion history after evicting the inactive cache', async () => {
  const { editor } = await openPad()
  const id = useTextPadStore.getState().activeTabId!
  const imageId = await insertImage(editor)
  await waitFor(async () => expect(await repo.readPadImage(id, imageId)).toBeDefined())
  const keys = vi.spyOn(repo, 'getStoredPadImageIds')
  fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
  await waitFor(() => expect(keys).toHaveBeenCalledWith(id))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  const saved = (await repo.getAllDocuments()).find(doc => doc.id === id)!
  await repo.updateDocument(id, { ...saved, images: [], content: '', contentRevision: saved.contentRevision + 1 })
  fireEvent.keyDown(editor.contentDOM, { key: '1', code: 'Digit1', altKey: true, shiftKey: true })
  await waitFor(() => expect(padImageFiles(editor.state)[imageId]).toBeDefined())
  act(() => { undo(editor); redo(editor) })
  expect(padImageBindings(editor.state)).toEqual([{ offset: 0, imageId }])
  expect(Array.from(padImageFiles(editor.state)[imageId].bytes)).toEqual([1, 2, 253])
  await waitFor(async () => expect(await repo.readPadImage(id, imageId)).toBeDefined())
})

it('updates an existing image description when the UI language changes', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:test' }
    static revokeObjectURL() {}
  })
  const { editor } = await openPad()
  await insertImage(editor)
  expect(screen.getByRole('img', { name: 'Image from clipboard' })).toBeInTheDocument()
  act(() => useStore.getState().setLocale('ru'))
  expect(screen.getByRole('img', { name: 'Изображение из буфера' })).toBeInTheDocument()
})

it('autosaves a resize without typing and restores it when the note reopens', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:test' }
    static revokeObjectURL() {}
  })
  const { editor, unmount } = await openPad()
  const id = useTextPadStore.getState().activeTabId!
  const imageId = await insertImage(editor)
  await waitFor(async () => expect(await repo.readPadImage(id, imageId)).toBeDefined())
  const before = await repo.getDocumentVersion(id)
  fireEvent.click(screen.getByRole('button', { name: 'Image size' }))
  fireEvent.click(screen.getByRole('button', { name: 'Decrease image size' }))
  await waitFor(async () => {
    const [saved] = await repo.getAllDocuments()
    expect(saved.images).toEqual([{ imageId, offset: 0, scale: 75 }])
    expect(saved.contentRevision).toBe(before!.contentRevision + 1)
    expect(saved.updatedAt).toBeGreaterThan(before!.updatedAt)
  })
  unmount()
  const reopened = await openPad()
  await waitFor(() => expect(padImageFiles(reopened.editor.state)[imageId]).toBeDefined())
  fireEvent.click(screen.getByRole('button', { name: 'Image size' }))
  expect(screen.getByRole('button', { name: /75%, Reset/ })).toBeVisible()
})
