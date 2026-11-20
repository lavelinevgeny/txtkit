import { countColumn, EditorSelection, findClusterBreak } from '@codemirror/state'
import type { EditorState, SelectionRange } from '@codemirror/state'
import { getIndentUnit } from '@codemirror/language'
import { Direction, keymap } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'
import { padImageBindings } from './padImageState'

// Never cross both a bound object and adjacent text in a single character
// step. Unbound U+FFFCs retain CodeMirror's normal grapheme behaviour.
function limitStep(state: EditorState, start: number, end: number) {
  if (Math.abs(end - start) <= 1) return end
  const bindings = padImageBindings(state)
  if (end > start) {
    const image = bindings.find(b => b.offset >= start)
    if (image && image.offset < end) return image.offset === start ? start + 1 : image.offset
  } else {
    const image = bindings.findLast(b => b.offset < start)
    if (image && image.offset >= end) return image.offset + 1 === start ? start - 1 : image.offset + 1
  }
  return end
}

function move(right: boolean, extend = false) {
  return (view: EditorView) => {
    const { state } = view
    if (!padImageBindings(state).length) return false
    const forward = (view.textDirectionAt(state.selection.main.head) === Direction.LTR) === right
    let adjusted = false
    const ranges = state.selection.ranges.map(initial => {
      let range = initial
      if (!extend && !range.empty) return EditorSelection.cursor(forward ? range.to : range.from)
      if (extend && range.undirectional && (range.head >= range.anchor) !== forward) {
        range = EditorSelection.range(range.head, range.anchor)
      }
      const next = view.moveByChar(range, forward)
      let head = limitStep(state, range.head, next.head)
      if (head !== next.head) {
        // A visual step can also jump over a whole bidirectional run. Only
        // shorten it when the underlying positions form one logical cluster.
        const line = state.doc.lineAt(range.head)
        const logical = line.from + findClusterBreak(line.text, range.head - line.from, next.head > range.head)
        if (logical !== next.head) head = next.head
      }
      adjusted ||= head !== next.head
      return extend
        ? EditorSelection.range(range.anchor, head, next.goalColumn, next.bidiLevel ?? undefined, next.assoc)
        : EditorSelection.cursor(head, next.assoc, next.bidiLevel ?? undefined)
    })
    if (!adjusted) return false
    view.dispatch({ selection: EditorSelection.create(ranges, state.selection.mainIndex), userEvent: 'select', scrollIntoView: true })
    return true
  }
}

// Match the native Backspace indentation rule for unaffected cursors taking
// part in the same edit as a cursor at an image boundary.
function deleteTarget(state: EditorState, pos: number, forward: boolean) {
  const line = state.doc.lineAt(pos), local = pos - line.from
  if (local === (forward ? line.length : 0)) {
    return Math.max(0, Math.min(state.doc.length, pos + (forward ? 1 : -1)))
  }
  if (!forward && local < 200) {
    const indent = line.text.slice(0, local)
    if (/^[ \t]+$/.test(indent)) {
      if (indent.endsWith('\t')) return pos - 1
      const unit = getIndentUnit(state)
      const width = countColumn(indent, state.tabSize) % unit || unit
      const trailingSpaces = indent.length - indent.lastIndexOf('\t') - 1
      return pos - Math.min(width, trailingSpaces)
    }
  }
  let next = findClusterBreak(line.text, local, forward, forward)
  if (!forward && /[\ufe00-\ufe0f]/u.test(line.text.slice(next, local))) {
    next = findClusterBreak(line.text, next, false, false)
  }
  return line.from + next
}

function erase(forward: boolean) {
  return (view: EditorView) => {
    const { state } = view
    if (state.readOnly || !padImageBindings(state).length) return false
    const targets = new Map<SelectionRange, number>()
    let adjusted = false
    for (const range of state.selection.ranges) {
      if (!range.empty) continue
      const end = deleteTarget(state, range.head, forward)
      const target = limitStep(state, range.head, end)
      targets.set(range, target)
      adjusted ||= end !== target
    }
    if (!adjusted) return false
    const changes = state.changeByRange(range => {
      const target = targets.get(range) ?? range.head
      const from = Math.min(range.from, target), to = Math.max(range.to, target)
      return { changes: { from, to }, range: EditorSelection.cursor(from) }
    })
    view.dispatch(changes, { userEvent: forward ? 'delete.forward' : 'delete.backward', scrollIntoView: true })
    return true
  }
}

const left = move(false), right = move(true)
const selectLeft = move(false, true), selectRight = move(true, true)
const backspace = erase(false), del = erase(true)
export const imageCharacterKeys = keymap.of([
  { key: 'ArrowLeft', run: left, shift: selectLeft },
  { key: 'ArrowRight', run: right, shift: selectRight },
  { key: 'Backspace', run: backspace, shift: backspace },
  { key: 'Delete', run: del },
  { mac: 'Ctrl-b', run: left, shift: selectLeft },
  { mac: 'Ctrl-f', run: right, shift: selectRight },
  { mac: 'Ctrl-h', run: backspace },
  { mac: 'Ctrl-d', run: del },
])
