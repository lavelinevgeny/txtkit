import { EditorSelection } from '@codemirror/state'
import { isolateHistory } from '@codemirror/commands'
import { EditorView, ViewPlugin } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import {
  attachImages, copyRanges, imageText, labeledRange, notifyImage,
  padImageBindings, padImageFiles, padSearchMatch,
} from './padImageState'

const fileLimit = 10 * 1024 * 1024
const documentLimit = 5 * fileLimit
const accepted = new Set(['image/png', 'image/jpeg', 'image/webp'])
const pending = new WeakMap<EditorView, object>()

export function cancelPadImagePaste(view: EditorView, notifyOnExit?: (message: string) => void) {
  if (!pending.delete(view)) return
  if (notifyOnExit) notifyOnExit(imageText(view.state, 'stale'))
  else notifyImage(view.state, 'stale')
}

function readBytes(file: File): Promise<ArrayBuffer> {
  if (file.arrayBuffer) return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.onabort = () => reject(new Error('aborted'))
    reader.readAsArrayBuffer(file)
  })
}

function paste(event: ClipboardEvent, view: EditorView) {
  cancelPadImagePaste(view)
  const data = event.clipboardData
  if (!data || data.getData('text/plain')) return false
  const files: File[] = []
  let error = ''
  function collect(type: string, file: File | null) {
    if (!type.startsWith('image/')) return
    if (!accepted.has(type) || (file && file.type !== type)) error ||= 'unsupported'
    else if (!file) error ||= 'readError'
    else if (!file.size) error ||= 'empty'
    else if (file.size > fileLimit) error ||= 'fileLimit'
    else files.push(file)
  }
  try {
    if (data.files?.length) {
      for (const file of Array.from(data.files)) collect(file.type, file)
    } else {
      for (const item of Array.from(data.items ?? [])) {
        if (item.kind === 'file' && item.type.startsWith('image/')) collect(item.type, item.getAsFile())
      }
    }
  } catch { error ||= 'readError' }
  const { state } = view
  if (error) { notifyImage(state, error); return true }
  if (!files.length) return !data.getData('text/uri-list')
  if (state.readOnly) return true
  const { from, to } = state.selection.main
  const existing = padImageFiles(state)
  let total = files.reduce((sum, f) => sum + f.size, 0)
  for (const binding of padImageBindings(state)) {
    if (!Object.hasOwn(existing, binding.imageId)) { notifyImage(state, 'loading'); return true }
    if (binding.offset < from || binding.offset >= to) total += existing[binding.imageId].bytes.byteLength
  }
  if (total > documentLimit) { notifyImage(state, 'documentLimit'); return true }

  const token = {}
  pending.set(view, token)
  void Promise.all(files.map(async (file, i) => {
    const bytes = new Uint8Array(await readBytes(file))
    if (!bytes.length || bytes.length !== file.size) throw new Error('Incomplete file read')
    return { offset: from + i, imageId: crypto.randomUUID(), file: { mimeType: file.type, bytes } }
  })).then(images => {
    if (pending.get(view) !== token) return
    pending.delete(view)
    view.dispatch({
      changes: { from, to, insert: '\ufffc'.repeat(images.length) },
      selection: EditorSelection.cursor(from + images.length),
      effects: attachImages.of(images),
      annotations: isolateHistory.of('full'),
      userEvent: 'input.paste',
      scrollIntoView: true,
    })
  }).catch(() => {
    if (pending.get(view) === token) {
      pending.delete(view)
      notifyImage(view.state, 'readError')
    }
  })
  return true
}

export const clipboardEvents = EditorView.domEventHandlers({ paste })

export const labeledCopy = EditorView.clipboardOutputFilter.of((text, state) => {
  if (!padImageBindings(state).length) return text
  const ranges = copyRanges(state)
  if (ranges.every(r => padSearchMatch('', state, r.from, r.to))) return text
  const label = imageText(state, 'label')
  return ranges.map(r => labeledRange(state, r.from, r.to, label)).join(state.lineBreak)
})

export const clipboardSession = ViewPlugin.fromClass(class {
  private dragging = false
  readonly view: EditorView
  constructor(view: EditorView) {
    this.view = view
    // Capture before the built-in dragstart handler, without preventDefault
    // (which would cancel even a drag to an external application).
    this.view.dom.addEventListener('dragstart', this.startDrag, true)
    this.view.dom.addEventListener('dragend', this.endDrag, true)
  }
  startDrag = (event: DragEvent) => {
    const { state } = this.view
    const range = state.selection.main
    if (!(event.target instanceof Node) || !this.view.contentDOM.contains(event.target)) return
    if (!event.dataTransfer || padSearchMatch('', state, range.from, range.to)) return
    this.dragging = true
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/plain', labeledRange(state, range.from, range.to, imageText(state, 'label')))
    event.dataTransfer.effectAllowed = 'copy'
    event.stopPropagation()
  }
  endDrag = () => { this.dragging = false }
  update(update: ViewUpdate) {
    if (!pending.has(this.view)) return
    for (const tr of update.transactions) {
      if (!tr.startState.selection.eq(tr.newSelection, true) ||
          !tr.startState.doc.eq(tr.newDoc) ||
          padImageBindings(tr.startState) !== padImageBindings(tr.state)) {
        cancelPadImagePaste(this.view)
        break
      }
    }
  }
  destroy() {
    cancelPadImagePaste(this.view)
    this.view.dom.removeEventListener('dragstart', this.startDrag, true)
    this.view.dom.removeEventListener('dragend', this.endDrag, true)
  }
  drop() {
    if (!this.dragging) return false
    this.dragging = false
    notifyImage(this.view.state, 'blocked')
    return true
  }
}, { eventHandlers: { drop() { return this.drop() } } })
