import {
  Annotation, EditorState, Facet, MapMode, StateEffect, StateField, Transaction,
} from '@codemirror/state'
import type { ChangeDesc } from '@codemirror/state'
import { invertedEffects, isolateHistory } from '@codemirror/commands'
import { imageBinding, validImageScale } from './padImageSize'
import { t } from '../../i18n/translate'
import type { PadImageBinding, PadImageFile } from './types'

type Files = Record<string, PadImageFile>
interface Images {
  bindings: readonly PadImageBinding[]
  files: Files
  // History and queued writes can own the same file after active cache eviction.
  evicted: Record<string, WeakRef<PadImageFile>>
}
interface Attached extends PadImageBinding {
  file: PadImageFile
}

export const padImageServices = Facet.define<{ t: typeof t; notify: (message: string) => void }>()
export const allowPadImageReplacement = Annotation.define<boolean>()
export const resizePadImage = StateEffect.define<{ imageId: string; scale: number }>()
export const loadPadImageFiles = StateEffect.define<Files>()
export const missingPadImageFiles = StateEffect.define<ReadonlySet<string>>()
export const clearPadImageCache = StateEffect.define<readonly string[] | null>()

function mapBinding<T extends PadImageBinding>(binding: T, changes: ChangeDesc): T | undefined {
  const offset = changes.mapPos(binding.offset, 1, MapMode.TrackAfter)
  if (offset === null) return undefined
  return offset === binding.offset ? binding : { ...binding, offset }
}

export const attachImages = StateEffect.define<Attached[]>({
  map: (images, changes) => images.flatMap(image => mapBinding(image, changes) ?? []),
})
// Undoing an insertion can happen before an evicted tab has hydrated. Carry
// the files with the inverse so redo can recover this exact insertion.
const detachedFiles = StateEffect.define<Files>()

function filesFor<T>(bindings: readonly PadImageBinding[], files: Record<string, T>): Record<string, T> {
  return Object.fromEntries(bindings
    .filter(({ imageId }) => Object.hasOwn(files, imageId))
    .map(({ imageId }) => [imageId, files[imageId]]))
}

export const imageField = StateField.define<Images>({
  create: () => ({ bindings: [], files: {}, evicted: {} }),
  update(value, tr) {
    let { bindings, files, evicted } = value
    if (!tr.changes.empty && bindings.length) {
      const mapped = bindings.flatMap(binding => mapBinding(binding, tr.changes) ?? [])
      if (mapped.length !== bindings.length) {
        files = filesFor(mapped, files)
        evicted = filesFor(mapped, evicted)
      }
      if (mapped.length !== bindings.length || mapped.some((b, i) => b !== bindings[i])) bindings = mapped
    }
    for (const effect of tr.effects) {
      if (effect.is(attachImages)) {
        bindings = [...bindings, ...effect.value.map(imageBinding)].sort((a, b) => a.offset - b.offset)
        files = { ...files, ...Object.fromEntries(effect.value.map(i => [i.imageId, i.file])) }
        evicted = { ...evicted }
        for (const { imageId } of effect.value) delete evicted[imageId]
      } else if (effect.is(resizePadImage) && validImageScale(effect.value.scale)) {
        const { imageId, scale } = effect.value
        const index = bindings.findIndex(binding => binding.imageId === imageId)
        if (index >= 0 && (bindings[index].scale ?? 100) !== scale) {
          bindings = bindings.map((binding, i) => i === index ? imageBinding({ ...binding, scale }) : binding)
        }
      } else if (effect.is(loadPadImageFiles)) {
        files = filesFor(bindings, { ...files, ...effect.value })
        evicted = { ...evicted }
        for (const imageId of Object.keys(effect.value)) {
          if (!Object.hasOwn(evicted, imageId)) continue
          // IDs are immutable. Keep the history-owned instance when a fresh
          // database read returns a clone, so it is still reachable on the next eviction.
          files[imageId] = evicted[imageId].deref() ?? files[imageId]
          delete evicted[imageId]
        }
      } else if (effect.is(missingPadImageFiles)) {
        bindings = bindings.filter(binding => !effect.value.has(binding.imageId) || Object.hasOwn(files, binding.imageId))
        evicted = filesFor(bindings, evicted)
      } else if (effect.is(clearPadImageCache)) {
        const ids = (effect.value ?? Object.keys(files)).filter(id => Object.hasOwn(files, id))
        evicted = { ...evicted, ...Object.fromEntries(ids.map(id => [id, new WeakRef(files[id])])) }
        files = { ...files }
        for (const id of ids) delete files[id]
      }
    }
    return bindings === value.bindings && files === value.files && evicted === value.evicted
      ? value : { bindings, files, evicted }
  },
})

export function padImageBindings(state: EditorState) { return state.field(imageField).bindings }
export function padImageFiles(state: EditorState) { return state.field(imageField).files }

export function recoverPadImageFile(state: EditorState, imageId: string): PadImageFile | undefined {
  const { files, evicted } = state.field(imageField)
  if (Object.hasOwn(files, imageId)) return files[imageId]
  return Object.hasOwn(evicted, imageId) ? evicted[imageId].deref() : undefined
}

export function padSearchMatch(_match: string, state: EditorState, from: number, to: number) {
  const bindings = padImageBindings(state)
  let low = 0
  let high = bindings.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (bindings[mid].offset < from) low = mid + 1
    else high = mid
  }
  return low === bindings.length || bindings[low].offset >= to
}

export function labeledRange(state: EditorState, from: number, to: number, label: string) {
  const parts: string[] = []
  for (const { offset } of padImageBindings(state)) {
    if (offset < from) continue
    if (offset >= to) break
    parts.push(state.sliceDoc(from, offset), label)
    from = offset + 1
  }
  parts.push(state.sliceDoc(from, to))
  return parts.join('')
}

export function padPlainText(state: EditorState, label: string) {
  return labeledRange(state, 0, state.doc.length, label)
}

export function imageText(state: EditorState, key: string) {
  return (state.facet(padImageServices)[0]?.t ?? t)('textPad.image.' + key)
}

export function notifyImage(state: EditorState, key: string) {
  state.facet(padImageServices)[0]?.notify('textPad.image.' + key)
}

function removedBindings(tr: Transaction) {
  return padImageBindings(tr.startState).filter(b => tr.changes.mapPos(b.offset, 1, MapMode.TrackAfter) === null)
}

// Keep a replacement that removes an attachment reversible on its own, even
// when CodeMirror would join it to adjacent typing or IME transactions.
export const isolateImageEdits = EditorState.transactionExtender.of(tr =>
  tr.docChanged && !tr.annotation(isolateHistory) && removedBindings(tr).length
    ? { annotations: isolateHistory.of('full') } : null)

export const imageHistory = invertedEffects.of(tr => {
  if (!tr.docChanged && !tr.effects.some(e => e.is(resizePadImage))) return []
  let files = padImageFiles(tr.startState)
  const effects: StateEffect<unknown>[] = []
  for (const e of tr.effects) {
    if (e.is(resizePadImage) && validImageScale(e.value.scale)) {
      const binding = padImageBindings(tr.startState).find(b => b.imageId === e.value.imageId)
      if (binding && (binding.scale ?? 100) !== e.value.scale) {
        effects.push(resizePadImage.of({ imageId: binding.imageId, scale: binding.scale ?? 100 }))
      }
    }
    if (e.is(detachedFiles)) files = { ...files, ...e.value }
    if (e.is(attachImages)) effects.push(detachedFiles.of(Object.fromEntries(e.value.map(i => [i.imageId, i.file]))))
  }
  const restore = removedBindings(tr).map(b => ({ ...b, file: files[b.imageId] }))
  if (restore.length) effects.push(attachImages.of(restore))
  return effects
})

export function copyRanges(state: EditorState) {
  const ranges = state.selection.ranges.filter(r => !r.empty)
  if (ranges.length) return ranges.map(({ from, to }) => ({ from, to, cutTo: to }))
  const lines = new Set(state.selection.ranges.map(r => state.doc.lineAt(r.head).number))
  return Array.from(lines, n => {
    const { from, to } = state.doc.line(n)
    return { from, to, cutTo: Math.min(to + 1, state.doc.length) }
  })
}

function blocked(tr: Transaction, reason: string) {
  queueMicrotask(() => notifyImage(tr.startState, reason))
  return []
}

const selectionActions = new Set([
  'input', 'input.type', 'input.type.compose', 'input.type.compose.start',
  'input.paste', 'input.complete', 'input.drop', 'input.replace', 'input.replace.all',
  'delete', 'delete.selection', 'delete.backward', 'delete.forward',
])

function actionRanges(tr: Transaction) {
  const state = tr.startState
  if (tr.annotation(Transaction.userEvent) === 'delete.cut') {
    return copyRanges(state).map(r => ({ from: r.from, to: r.cutTo }))
  }
  if (tr.annotation(Transaction.userEvent) === 'delete.line') return selectedLineRanges(state)
  const event = tr.annotation(Transaction.userEvent)
  const replacesSelection = event !== undefined && selectionActions.has(event)
  return state.selection.ranges.map(range => {
    if (!range.empty && replacesSelection) return range
    if (range.empty && event === 'delete.backward') return { from: range.from - 1, to: range.to }
    if (range.empty && event === 'delete.forward') return { from: range.from, to: range.to + 1 }
    return { from: 0, to: 0 }
  })
}

function selectedLineRanges(state: EditorState) {
  return state.selection.ranges.map(({ from, to }) => {
    const end = to > from && state.doc.lineAt(to).from === to ? to - 1 : to
    return { from: state.doc.lineAt(from).from, to: state.doc.lineAt(end).to }
  })
}

export const imageGuard = EditorState.transactionFilter.of(tr => {
  const state = tr.startState
  if (!tr.docChanged || !padImageBindings(state).length) return tr
  const removed = removedBindings(tr)
  if (tr.isUserEvent('input.copyline') || tr.isUserEvent('move.line')) {
    // CM may express a line move by deleting only the neighbouring line,
    // or a duplicate by inserting text without touching its source at all.
    if (removed.length || selectedLineRanges(state).some(r => !padSearchMatch('', state, r.from, r.to))) return blocked(tr, 'blocked')
  }
  if (!removed.length) return tr
  if (removed.some(b => !Object.hasOwn(padImageFiles(state), b.imageId))) return blocked(tr, 'loading')
  if (tr.annotation(allowPadImageReplacement)) {
    let whole = false
    tr.changes.iterChangedRanges((from, to) => { whole ||= from === 0 && to === state.doc.length })
    if (whole) return tr
  }
  const ranges = actionRanges(tr)
  if (removed.some(b => !ranges.some(r => r.from <= b.offset && b.offset < r.to))) return blocked(tr, 'blocked')
  if (tr.annotation(Transaction.userEvent) === 'delete.cut') queueMicrotask(() => notifyImage(state, 'cut'))
  return tr
})
