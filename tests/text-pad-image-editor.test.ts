import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorSelection, StateEffect } from '@codemirror/state'
import { copyLineDown, deleteCharBackward, moveLineDown, moveLineUp, redo, transposeChars, undo, undoDepth } from '@codemirror/commands'
import { findNext, findPrevious, replaceAll, SearchQuery, setSearchQuery } from '@codemirror/search'
import { resizePadImage } from '../src/tools/text-pad/padImageState'
import { createEditorState } from '../src/tools/text-pad/editorStateFactory'
import type { EditorStateParams } from '../src/tools/text-pad/editorStateFactory'
import {
  allowPadImageReplacement, clearPadImageCache, loadPadImageFiles,
  padImageBindings, padImageFiles, padPlainText, padSearchMatch, recoverPadImageFile,
} from '../src/tools/text-pad/padImageEditor'

// jsdom has no text layout. CodeMirror requests DOM range geometry on its animation frame.
Object.defineProperties(Range.prototype, {
  getClientRects: { configurable: true, value: () => [] },
  getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
})

const anchor = '\ufffc'
const viewList: EditorView[] = []
const notify = vi.fn()
function editor(options: Partial<EditorStateParams> = {}) {
  const state = createEditorState({ doc: '', imageServices: { t: key => key, notify }, ...options })
  const view = new EditorView({ state, parent: document.body })
  viewList.push(view)
  return view
}
afterEach(() => {
  for (const view of viewList.splice(0)) view.destroy()
  vi.restoreAllMocks()
  notify.mockClear()
})

function paste(view: EditorView, files: File[], texts: Record<string, string> = {}, items: object[] = []) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files, items, getData: (key: string) => texts[key] ?? '' } })
  view.contentDOM.dispatchEvent(event)
}
function file(byte = 42, type = 'image/png') { return new File([new Uint8Array([byte])], 'image', { type }) }
async function settled() { await new Promise(resolve => setTimeout(resolve, 0)) }
const source = { bytes: new Uint8Array([19]), mimeType: 'image/png' }
function withImage(doc = 'a' + anchor + 'b', offset = 1) {
  return editor({ doc, images: [{ offset, imageId: 'old' }], imageFiles: { old: source } })
}
function select(view: EditorView, from: number, to = from) {
  view.dispatch({ selection: EditorSelection.single(from, to) })
}
function delayed() {
  const image = file()
  let finish!: (buffer: ArrayBuffer) => void
  const reading = new Promise<ArrayBuffer>(resolve => { finish = resolve })
  Object.defineProperty(image, 'arrayBuffer', { value: () => reading })
  return { image, finish: () => finish(new Uint8Array([42]).buffer) }
}

describe('Pad clipboard', () => {
  it.each([' ', 'mixed'])('gives nonempty plain text %j precedence over files and HTML', text => {
    const v = editor()
    paste(v, [file(), file(3, 'image/tiff')], { 'text/plain': text, 'text/html': '<img>' })
    expect(v.state.doc.toString()).toBe(text)
    expect(padImageBindings(v.state)).toEqual([])
  })
  it('rejects bare HTML and PDF, passes URI text to CodeMirror', () => {
    const v = editor({ doc: 'abc' })
    select(v, 1, 2)
    const sel = v.state.selection
    paste(v, [], { 'text/html': '<img>' })
    paste(v, [file(3, 'application/pdf')])
    expect(v.state.selection).toBe(sel)
    expect(undoDepth(v.state)).toBe(0)
    paste(v, [], { 'text/uri-list': 'https://example.com/' })
    expect(v.state.doc.toString()).toBe('ahttps://example.com/c')
  })
  it('inserts duplicate files once each, in order at the primary selection', async () => {
    const v = editor({ doc: '😀before / after' })
    v.dispatch({ selection: EditorSelection.create([EditorSelection.range(2, 8), EditorSelection.range(9, 10)], 1) })
    const img = file()
    paste(v, [img, img, file(20, 'image/webp')], {}, [{ kind: 'file', type: 'image/tiff', getAsFile: () => null }])
    await settled()
    const bindings = padImageBindings(v.state)
    expect(bindings.map(b => b.offset)).toEqual([9, 10, 11])
    expect(new Set(bindings.map(b => b.imageId)).size).toBe(3)
    expect(v.state.doc.toString()).toBe('😀before ' + anchor.repeat(3) + ' after')
    expect(v.state.selection.ranges.map(r => r.head)).toEqual([12])
    const files = padImageFiles(v.state)
    expect(bindings.map(b => files[b.imageId].bytes[0])).toEqual([42, 42, 20])
    v.dispatch({ effects: clearPadImageCache.of(null) })
    expect(undo(v)).toBe(true)
    expect(v.state.doc.toString()).toBe('😀before / after')
    expect(v.state.selection.ranges).toHaveLength(2)
    expect(redo(v)).toBe(true)
    expect(padImageFiles(v.state)).toEqual(files)
  })
  it('uses file items as fallback and rejects inaccessible, empty, unsupported or unreadable images atomically', async () => {
    const v = editor({ doc: 'abc' })
    select(v, 0, 2)
    const item = (image: File | null) => ({ type: 'image/png', kind: 'file', getAsFile: () => image })
    const broken = file()
    Object.defineProperty(broken, 'arrayBuffer', { value: () => Promise.reject(new Error()) })
    paste(v, [], {}, [item(file()), item(null)])
    paste(v, [file(), new File([], 'empty', { type: 'image/png' })])
    paste(v, [file(), file(2, 'image/tiff')])
    paste(v, [file(), broken])
    await settled()
    expect(v.state.doc.toString()).toBe('abc')
    expect(v.state.selection.main.to).toBe(2)
    expect(undoDepth(v.state)).toBe(0)
    expect(notify.mock.calls.flat()).toEqual(['readError', 'empty', 'unsupported', 'readError'].map(k => 'textPad.image.' + k))
    paste(v, [], {}, [item(file())])
    await settled()
    expect(padPlainText(v.state, '[image]')).toBe('[image]c')
  })
  it('checks both byte limits before reading and subtracts replaced files', async () => {
    const mib = 1024 * 1024
    const bytes = new Uint8Array(10 * mib)
    const v = editor({
      doc: anchor.repeat(5), images: Array.from({ length: 5 }, (_, i) => ({ offset: i, imageId: String(i) })),
      imageFiles: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i, { bytes, mimeType: 'image/png' }])),
    })
    paste(v, [file()])
    expect(notify).toHaveBeenLastCalledWith('textPad.image.documentLimit')
    const oversized = file()
    Object.defineProperty(oversized, 'size', { value: bytes.length + 1 })
    paste(v, [oversized])
    expect(notify).toHaveBeenLastCalledWith('textPad.image.fileLimit')
    expect(undoDepth(v.state)).toBe(0)
    select(v, 2, 3)
    const exact = file()
    Object.defineProperties(exact, { size: { value: bytes.length }, arrayBuffer: { value: async () => bytes.buffer } })
    paste(v, [exact])
    await settled()
    expect(padImageBindings(v.state)).toHaveLength(5)
    expect(undoDepth(v.state)).toBe(1)
  })
  it.each(['selection', 'document', 'session', 'paste'])('cancels a pending read on %s changes even after restoration', async kind => {
    const v = editor({ doc: 'abc' })
    const { image, finish } = delayed()
    paste(v, [image])
    if (kind === 'selection') { select(v, 1); select(v, 0) }
    if (kind === 'document') { v.dispatch({ changes: { from: 2, insert: 'a' } }); undo(v) }
    if (kind === 'session') {
      const initial = v.state
      v.setState(createEditorState({ doc: 'b' }))
      v.setState(initial)
    }
    if (kind === 'paste') paste(v, [], { 'text/html': '<img>' })
    finish()
    await settled()
    expect(v.state.doc.toString()).toBe('abc')
    expect(notify).toHaveBeenCalledWith('textPad.image.stale')
  })
  it('allows a no-op service transaction and cancels an identical-text undo that restores a different image', async () => {
    const v = withImage()
    select(v, 1, 2)
    const first = delayed()
    paste(v, [first.image])
    v.dispatch({ effects: StateEffect.define<boolean>().of(true) })
    first.finish()
    await settled()
    expect(padImageBindings(v.state)[0].imageId).not.toBe('old')
    select(v, 1, 2)
    const second = delayed()
    paste(v, [second.image])
    undo(v)
    expect(padImageBindings(v.state)[0].imageId).toBe('old')
    expect(padImageFiles(v.state).old).toEqual(source)
    second.finish()
    await settled()
    expect(padImageBindings(v.state)[0].imageId).toBe('old')
  })
})

describe('Pad image editing', () => {
  it('undoes a single image resize, maps it through edits, and restores it after deletion', () => {
    const first = { imageId: 'a', offset: 0 }
    const second = { imageId: 'b', offset: 2 }
    const v = editor({ doc: anchor + ' ' + anchor, images: [first, second], imageFiles: { a: source, b: source } })
    v.dispatch({ effects: resizePadImage.of({ imageId: 'b', scale: 125 }) })
    expect(padImageBindings(v.state)).toEqual([first, { ...second, scale: 125 }])
    expect(undo(v)).toBe(true)
    expect(padImageBindings(v.state)).toEqual([first, second])
    expect(redo(v)).toBe(true)
    v.dispatch({ changes: { from: 0, insert: 'ab' } })
    select(v, 5)
    deleteCharBackward(v)
    expect(undo(v)).toBe(true)
    expect(padImageBindings(v.state)).toEqual([{ ...first, offset: 2 }, { ...second, offset: 4, scale: 125 }])
    expect(padImageFiles(v.state).b).toBe(source)
  })

  it.each([
    [moveLineUp, 'x\n' + anchor, 2, 2],
    [moveLineUp, anchor + '\nx', 0, 2],
    [moveLineDown, anchor + '\nx', 0, 0],
    [moveLineDown, 'x\n' + anchor, 2, 0],
    [copyLineDown, 'x\n' + anchor, 2, 2],
    [transposeChars, 'x' + anchor, 1, 1],
    [transposeChars, anchor + 'x', 0, 1],
  ] as const)('blocks affected source/neighbor for command %s in %s', (cmd, doc, offset, caret) => {
    const v = withImage(doc, offset)
    select(v, caret)
    cmd(v)
    expect(v.state.doc.toString()).toBe(doc)
    expect(undoDepth(v.state)).toBe(0)
  })
  it('permits neighbouring text commands and rejects unknown destructive commands', () => {
    const v = withImage(anchor + '\n' + anchor + 'x', 0)
    select(v, 3)
    copyLineDown(v)
    expect(v.state.doc.lines).toBe(3)
    expect(padImageBindings(v.state)).toEqual([{ offset: 0, imageId: 'old' }])
    v.dispatch({ changes: { from: 0, to: 1 } })
    v.dispatch({ changes: { from: 0, to: 1 }, userEvent: 'delete.backward' })
    expect(padPlainText(v.state, 'img')).toBe('img\n' + anchor + 'x\n' + anchor + 'x')
  })
  it('backspace and a confirmed full replacement recover bytes through history', () => {
    const v = withImage()
    select(v, 2)
    deleteCharBackward(v)
    expect(v.state.doc.toString()).toBe('ab')
    expect(padImageFiles(v.state)).toEqual({})
    undo(v)
    expect(padImageFiles(v.state)).toEqual({ old: source })
    v.dispatch({ changes: { from: 0, to: 3, insert: anchor }, annotations: allowPadImageReplacement.of(true) })
    expect(padImageBindings(v.state)).toEqual([])
    undo(v)
    expect(padPlainText(v.state, 'img')).toBe('aimgb')
  })
  it('blocks removing an unhydrated image until its bytes can be retained by undo', () => {
    const v = editor({ doc: anchor, images: [{ offset: 0, imageId: 'old' }] })
    select(v, 1)
    deleteCharBackward(v)
    expect(v.state.doc.length).toBe(1)
    v.dispatch({ effects: loadPadImageFiles.of({ old: source }) })
    deleteCharBackward(v)
    expect(v.state.doc.length).toBe(0)
    undo(v)
    expect(padImageFiles(v.state).old).toBe(source)
  })
  it('filters navigation, replacement and highlight for literal U+FFFCs', () => {
    const v = withImage(anchor.repeat(3), 1)
    v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: anchor, replace: 'xx', test: padSearchMatch })) })
    select(v, 0, 1)
    findNext(v)
    expect(v.state.selection.main.from).toBe(2)
    findPrevious(v)
    expect(v.state.selection.main.from).toBe(0)
    expect(v.contentDOM.querySelectorAll('.cm-searchMatch')).toHaveLength(2)
    select(v, 1, 2)
    expect(v.contentDOM.querySelectorAll('.cm-selectionMatch')).toHaveLength(0)
    replaceAll(v)
    expect(padPlainText(v.state, 'img')).toBe('xximgxx')
  })
})

function clipboardEvent(view: EditorView, type: string) {
  const data = { clearData: vi.fn(), setData: vi.fn(), effectAllowed: 'all' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, type.startsWith('drag') || type === 'drop' ? 'dataTransfer' : 'clipboardData', { value: data })
  view.contentDOM.dispatchEvent(event)
  return { event, data }
}

it('copies a label while preserving ordinary anchors, cuts with one edit and keeps bytes for undo', async () => {
  const v = withImage(anchor + anchor + 'b\nnext', 1)
  v.focus()
  select(v, 0, 2)
  const copy = clipboardEvent(v, 'copy')
  expect(copy.data.setData).toHaveBeenCalledWith('text/plain', anchor + 'textPad.image.label')
  select(v, 2)
  const cut = clipboardEvent(v, 'cut')
  expect(cut.data.setData).toHaveBeenCalledWith('text/plain', anchor + 'textPad.image.labelb')
  expect(v.state.doc.toString()).toBe('next')
  expect(undoDepth(v.state)).toBe(1)
  await settled()
  expect(notify).toHaveBeenCalledWith('textPad.image.cut')
  undo(v)
  expect(padImageFiles(v.state).old).toEqual(source)
})
it('publishes only labeled text for external drag and blocks an internal drop', () => {
  const v = withImage()
  select(v, 0, 2)
  const drag = clipboardEvent(v, 'dragstart')
  expect(drag.event.defaultPrevented).toBe(false)
  expect(drag.data.effectAllowed).toBe('copy')
  expect(drag.data.setData).toHaveBeenCalledWith('text/plain', 'atextPad.image.label')
  expect(clipboardEvent(v, 'drop').event.defaultPrevented).toBe(true)
  expect(padPlainText(v.state, 'i')).toBe('aib')
  expect(undoDepth(v.state)).toBe(0)
})

it('revokes the preview URL on tab change and preserves bytes on decode failure', () => {
  const create = vi.fn(() => 'blob:image')
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = create
    static revokeObjectURL = revoke
  })
  try {
    const v = editor({
      doc: anchor, images: [{ offset: 0, imageId: 'a' }], imageFiles: { a: source }, showWhitespace: true,
    })
    const img = v.contentDOM.querySelector<HTMLImageElement>('.cm-pad-image img')!
    expect(img.alt).toBe('textPad.image.alt')
    expect(img.draggable).toBe(false)
    img.dispatchEvent(new Event('error'))
    expect(v.contentDOM.textContent).toContain('textPad.image.previewError')
    expect(padImageFiles(v.state).a).toBe(source)
    v.setState(createEditorState({ doc: '' }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:image')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('keeps UTF-16 positions through composition and autocorrection and rejects removal outside any action range', () => {
  const v = withImage('😀' + anchor + 'a' + anchor, 2)
  v.dispatch({ changes: { from: 0, insert: anchor }, userEvent: 'input.type.compose' })
  v.dispatch({ changes: { from: 4, to: 5, insert: 'corrected' }, userEvent: 'input.type' })
  expect(padPlainText(v.state, 'img')).toBe(anchor + '😀imgcorrected' + anchor)
  select(v, 4, 7)
  const original = v.state
  v.dispatch({ changes: [{ from: 3, to: 4 }, { from: 4, to: 7 }], userEvent: 'input.type' })
  expect(v.state.doc).toBe(original.doc)
  select(v, 3, 4)
  v.dispatch({ changes: { from: 3, to: 4 }, userEvent: 'input.unknown' })
  expect(v.state.doc).toBe(original.doc)
  v.dispatch(v.state.replaceSelection(anchor), { userEvent: 'input.type.compose.start' })
  expect(padImageBindings(v.state)).toEqual([])
  undo(v)
  expect(padPlainText(v.state, 'img')).toBe(anchor + '😀imgcorrected' + anchor)
})

it('highlights single characters, skips a literal anchor match across an image and keeps other text commands available', () => {
  const v = withImage('xxx\n' + anchor + '\n' + anchor, 4)
  select(v, 0, 1)
  expect(v.contentDOM.querySelectorAll('.cm-selectionMatch')).toHaveLength(2)
  select(v, 6, 7)
  expect(v.contentDOM.querySelectorAll('.cm-selectionMatch')).toHaveLength(0)
  copyLineDown(v)
  expect(v.state.doc.lines).toBe(4)
})

function press(view: EditorView, key: string, shiftKey = false) {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
}

it.each(['\u0301', '\ufe0f', '\u200d🙂'])('steps across the bound image separately from %j in either direction', mark => {
  const v = withImage(anchor + mark + 'z', 0)
  press(v, 'ArrowRight')
  expect(v.state.selection.main.head).toBe(1)
  press(v, 'ArrowRight', true)
  expect(v.state.selection.main).toMatchObject({ anchor: 1, head: 1 + mark.length })
  press(v, 'ArrowLeft', true)
  expect(v.state.selection.main.head).toBe(1)
  press(v, 'ArrowLeft', true)
  expect(v.state.selection.main).toMatchObject({ anchor: 1, head: 0 })
  select(v, 0)
  press(v, 'Delete')
  expect(v.state.doc.toString()).toBe(mark + 'z')
  expect(padImageBindings(v.state)).toHaveLength(0)
  undo(v)
  select(v, 1)
  press(v, 'Backspace')
  expect(v.state.doc.toString()).toBe(mark + 'z')
  undo(v)
  select(v, 1 + mark.length)
  press(v, 'Backspace')
  expect(padImageBindings(v.state)).toEqual([{ imageId: 'old', offset: 0 }])
  expect(v.state.doc.toString()).toBe(anchor + 'z')
})
it('edits multi-cursor text and a bound image in one step and preserves normal Unicode clusters', () => {
  const v = withImage(anchor + '\u0301z\n' + anchor + '\u0301x', 0)
  v.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(4)], 1) })
  press(v, 'ArrowRight', true)
  expect(v.state.selection.ranges.map(r => [r.anchor, r.head])).toEqual([[0, 1], [4, 6]])
  v.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(4)], 1) })
  press(v, 'Delete')
  expect(v.state.doc.toString()).toBe('\u0301z\nx')
  undo(v)
  expect(padImageBindings(v.state)[0].offset).toBe(0)
})
it('finds a valid selection highlight overlapping an image-crossing candidate', () => {
  const v = withImage(anchor.repeat(3) + '\n' + anchor.repeat(2), 0)
  select(v, 4, 6)
  const matches = v.contentDOM.querySelectorAll('.cm-selectionMatch')
  expect(matches).toHaveLength(1)
  expect(matches[0].textContent).toBe(anchor.repeat(2))
})

it('recovers history-owned bytes after eviction, edits and repeated database hydration', async () => {
  const view = editor()
  paste(view, [file(12), file(24)])
  await settled()
  const [first, second] = padImageBindings(view.state)
  view.dispatch({ effects: clearPadImageCache.of([first.imageId]) })
  expect(Object.keys(padImageFiles(view.state))).toEqual([second.imageId])
  expect(recoverPadImageFile(view.state, first.imageId)?.bytes).toEqual(new Uint8Array([12]))
  view.dispatch({ changes: { from: 0, insert: '😀' } })
  expect(padImageBindings(view.state)[0].offset).toBe(2)
  const original = recoverPadImageFile(view.state, first.imageId)
  const cloned = { bytes: new Uint8Array([12]), mimeType: 'image/png' }
  view.dispatch({ effects: loadPadImageFiles.of({ [first.imageId]: cloned }) })
  expect(padImageFiles(view.state)[first.imageId]).toBe(original)
  view.dispatch({ effects: clearPadImageCache.of(null) })
  expect(padImageFiles(view.state)).toEqual({})
  expect(recoverPadImageFile(view.state, first.imageId)).toBe(original)
  expect(recoverPadImageFile(view.state, second.imageId)?.bytes).toEqual(new Uint8Array([24]))
  undo(view)
  undo(view)
  expect(recoverPadImageFile(view.state, first.imageId)).toBeUndefined()
  redo(view)
  expect(padImageFiles(view.state)[first.imageId]).toBe(original)
})
