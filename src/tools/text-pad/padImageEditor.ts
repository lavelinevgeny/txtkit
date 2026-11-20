import { Compartment, Prec } from '@codemirror/state'
import type { Range } from '@codemirror/state'
import { getSearchQuery, SearchCursor } from '@codemirror/search'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { imageControls, imageControlsTheme } from './padImageControls'
import { autoImageWidth, imageBinding } from './padImageSize'
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
  readonly binding: PadImageBinding
  readonly alt: string
  readonly fallback: string
  readonly resizeLabel: string

  constructor(file: PadImageFile | undefined, binding: PadImageBinding, alt: string, fallback: string, resizeLabel: string) {
    super()
    this.file = file
    this.binding = binding
    this.alt = alt
    this.fallback = fallback
    this.resizeLabel = resizeLabel
  }
  private sameSource(other: Preview) {
    return this.binding.imageId === other.binding.imageId && this.file === other.file &&
      this.alt === other.alt && this.fallback === other.fallback && this.resizeLabel === other.resizeLabel
  }
  eq(other: Preview) {
    return this.sameSource(other) && this.binding.scale === other.binding.scale
  }
  updateDOM(dom: HTMLElement, _view: EditorView, previous: Preview) {
    if (!this.sameSource(previous)) return false
    dom.style.setProperty('--pad-image-factor', String((this.binding.scale ?? 100) / 100))
    return true
  }
  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-pad-image'
    if (!this.file || !URL.createObjectURL) {
      span.textContent = this.alt
      return span
    }
    span.style.setProperty('--pad-image-factor', String((this.binding.scale ?? 100) / 100))
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'cm-pad-image-trigger'
    trigger.dataset.imageId = this.binding.imageId
    trigger.title = this.resizeLabel
    trigger.setAttribute('aria-label', this.resizeLabel)
    trigger.setAttribute('aria-expanded', 'false')
    const hint = document.createElement('span')
    hint.className = 'cm-pad-image-hint'
    hint.setAttribute('aria-hidden', 'true')
    const img = document.createElement('img')
    img.alt = this.alt
    img.draggable = false
    img.onload = () => {
      const base = autoImageWidth(img)
      if (base) {
        img.style.setProperty('--pad-image-base', base + 'px')
        img.dataset.loaded = ''
      }
      view.requestMeasure()
      view.plugin(imageControls)?.measure()
    }
    const showError = () => {
      span.textContent = this.fallback
      view.requestMeasure()
      view.plugin(imageControls)?.measure()
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
    trigger.append(img, hint)
    span.append(trigger)
    return span
  }
  destroy(dom: HTMLElement) {
    disposePreviews.get(dom)?.()
    disposePreviews.delete(dom)
  }
}

const previews = EditorView.decorations.compute([imageField, padImageServices], state => {
  const { bindings, files } = state.field(imageField)
  return Decoration.set(bindings.map(binding => Decoration.replace({
    widget: new Preview(Object.hasOwn(files, binding.imageId) ? files[binding.imageId] : undefined, binding,
      imageText(state, 'alt'), imageText(state, 'previewError'), imageText(state, 'resize')),
  }).range(binding.offset, binding.offset + 1)))
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
    imageField.init(() => ({ bindings: images.map(imageBinding), files: {}, evicted: {} })),
    imageServicesCompartment.of(services ? padImageServices.of(services) : []),
    imageGuard, imageHistory, isolateImageEdits, imageControlsTheme, imageControls,
    Prec.highest([previews, imageCharacterKeys, clipboardEvents, clipboardSession]), labeledCopy, matchHighlights,
  ]
}
