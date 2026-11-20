import { Compartment, Prec } from '@codemirror/state'
import type { Range } from '@codemirror/state'
import { getSearchQuery, SearchCursor } from '@codemirror/search'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { imageCharacterKeys } from './padImageCharacters'
import { encodeBytes } from './padImageEncoding'
import { clipboardEvents, clipboardSession, labeledCopy } from './padImageClipboard'
import { imageField, imageGuard, imageHistory, imageText, isolateImageEdits, padImageServices, padSearchMatch } from './padImageState'
import type { PadImageBinding, PadImageFile } from './types'

export { cancelPadImagePaste } from './padImageClipboard'
export {
  allowPadImageReplacement, clearPadImageCache, loadPadImageFiles, missingPadImageFiles, padImageBindings,
  padImageFiles, padImageServices, padPlainText, padSearchMatch, recoverPadImageFile,
} from './padImageState'

export const imageServicesCompartment = new Compartment()

const disposePreviews = new WeakMap<HTMLElement, () => void>()
class Preview extends WidgetType {
  readonly file?: PadImageFile
  readonly alt: string
  readonly fallback: string
  constructor(file: PadImageFile | undefined, alt: string, fallback: string) {
    super()
    this.file = file
    this.alt = alt
    this.fallback = fallback
  }
  eq(other: Preview) {
    return this.file === other.file && this.alt === other.alt && this.fallback === other.fallback
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-pad-image'
    if (!this.file || !URL.createObjectURL) {
      span.textContent = this.alt
      return span
    }
    const img = document.createElement('img')
    img.alt = this.alt
    img.draggable = false
    img.onload = () => EditorView.findFromDOM(span)?.requestMeasure()
    const showError = () => {
      span.textContent = this.fallback
      EditorView.findFromDOM(span)?.requestMeasure()
    }
    const bytes = this.file.bytes
    const source = bytes.buffer instanceof ArrayBuffer
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : Uint8Array.from(bytes)
    const blob = new Blob([source], { type: this.file.mimeType })
    const url = URL.createObjectURL(blob)
    img.onerror = () => {
      if (navigator.onLine) return showError()
      // Offline WebKit can reject both blob: URLs and FileReader. Build the
      // single retry from the bytes already in memory, with aligned chunks.
      img.onerror = showError
      img.src = 'data:' + blob.type + ';base64,' + encodeBytes(bytes)
    }
    disposePreviews.set(span, () => {
      img.onload = img.onerror = null
      img.removeAttribute('src')
      URL.revokeObjectURL(url)
    })
    img.src = url
    span.append(img)
    return span
  }
  destroy(dom: HTMLElement) {
    disposePreviews.get(dom)?.()
    disposePreviews.delete(dom)
  }
}

const previews = EditorView.decorations.compute([imageField, padImageServices], state => {
  const { bindings, files } = state.field(imageField)
  return Decoration.set(bindings.map(({ offset, imageId }) => Decoration.replace({
    widget: new Preview(Object.hasOwn(files, imageId) ? files[imageId] : undefined, imageText(state, 'alt'), imageText(state, 'previewError')),
  }).range(offset, offset + 1)))
})

const imageTheme = EditorView.baseTheme({
  '.cm-pad-image img': {
    maxHeight: '480px', maxWidth: 'var(--pad-image-width, 100%)',
    width: 'auto', height: 'auto', verticalAlign: 'middle',
  },
})
const measureImages = ViewPlugin.fromClass(class {
  readonly observer?: ResizeObserver
  constructor(view: EditorView) {
    const gutter = view.scrollDOM.querySelector<HTMLElement>('.cm-gutters')
    const measure = () => view.requestMeasure({
      key: this,
      read: () => {
        const line = view.contentDOM.querySelector('.cm-line')
        const style = line && getComputedStyle(line)
        const padding = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 30
        return Math.max(1, view.scrollDOM.clientWidth - (gutter?.offsetWidth ?? 0) - (padding || 0))
      },
      write: width => view.dom.style.setProperty('--pad-image-width', width + 'px'),
    })
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(measure)
      this.observer.observe(view.scrollDOM)
      if (gutter) this.observer.observe(gutter)
    }
    measure()
  }
  destroy() { this.observer?.disconnect() }
})

const selectionMark = Decoration.mark({ class: 'cm-selectionMatch' })
const searchMark = Decoration.mark({ class: 'cm-searchMatch' })
const currentMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

function matches(view: EditorView) {
  const { state } = view
  const marks: Range<Decoration>[] = []
  const sel = state.selection.main
  // Keep CodeMirror's default selection highlight scope and maximum count.
  if (state.selection.ranges.length === 1 && !sel.empty && sel.to - sel.from <= 200 && padSearchMatch('', state, sel.from, sel.to)) {
    const query = state.sliceDoc(sel.from, sel.to)
    for (const range of view.visibleRanges) {
      const cursor = new SearchCursor(state.doc, query, range.from, range.to, undefined,
        (from, to) => padSearchMatch('', state, from, to))
      for (const { from, to } of cursor) {
        if (to <= sel.from || from >= sel.to) marks.push(selectionMark.range(from, to))
        if (marks.length > 100) break
      }
      if (marks.length > 100) { marks.length = 0; break }
    }
  }
  const search = getSearchQuery(state)
  if (search.valid) {
    for (const range of view.visibleRanges) {
      const cursor = search.getCursor(state, range.from, range.to)
      for (let result = cursor.next(); !result.done; result = cursor.next()) {
        const { from, to } = result.value
        if (from === to || !padSearchMatch('', state, from, to)) continue
        const selected = state.selection.ranges.some(r => r.from === from && r.to === to)
        marks.push((selected ? currentMark : searchMark).range(from, to))
      }
    }
  }
  return Decoration.set(marks, true)
}

const matchHighlights = ViewPlugin.fromClass(class {
  decorations
  constructor(view: EditorView) { this.decorations = matches(view) }
  update(u: ViewUpdate) {
    if (u.docChanged || u.selectionSet || u.viewportChanged || getSearchQuery(u.state) !== getSearchQuery(u.startState))
      this.decorations = matches(u.view)
  }
}, { decorations: p => p.decorations })

export function padImageExtensions(images: readonly PadImageBinding[],
  services?: { t: (key: string) => string; notify: (message: string) => void }) {
  return [
    imageField.init(() => ({ bindings: images, files: {}, evicted: {} })),
    imageServicesCompartment.of(services ? padImageServices.of(services) : []),
    imageGuard, imageHistory, isolateImageEdits, imageTheme, measureImages,
    Prec.highest([previews, imageCharacterKeys, clipboardEvents, clipboardSession]), labeledCopy, matchHighlights,
  ]
}
