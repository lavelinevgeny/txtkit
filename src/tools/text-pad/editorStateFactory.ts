import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { highlightSelectionMatches, search } from '@codemirror/search'
import { drawSelection, EditorView, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import type { SerializedSelection } from './types'

const wrappingCompartment = new Compartment()
const whitespaceCompartment = new Compartment()

const textPadTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: '#09090b',
      color: '#e4e4e7',
      fontSize: '13px',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.65',
      overflow: 'auto',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '14px 0',
      caretColor: '#e8a030',
    },
    '.cm-line': { padding: '0 18px 0 12px' },
    '.cm-gutters': {
      backgroundColor: '#18181b',
      color: '#71717a',
      borderRight: '1px solid #27272a',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 12px',
      minWidth: '38px',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(232, 160, 48, 0.07)' },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(232, 160, 48, 0.12)',
      color: '#e4e4e7',
    },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#e8a030' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(232, 160, 48, 0.28)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(96, 165, 250, 0.28)',
      outline: '1px solid rgba(96, 165, 250, 0.45)',
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'rgba(232, 160, 48, 0.38)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(232, 160, 48, 0.18)',
    },
    '.cm-selectionMatch-main': {
      backgroundColor: 'rgba(232, 160, 48, 0.32)',
    },
    '.cm-searchMatch .cm-selectionMatch': {
      backgroundColor: 'transparent',
    },
  },
  { dark: true },
)

export { wrappingCompartment, whitespaceCompartment }

export interface EditorStateParams {
  doc: string
  selection?: SerializedSelection | null
  lineWrapping?: boolean
  showWhitespace?: boolean
}

function normalizeSelection(
  sel: SerializedSelection | null | undefined,
  docLength: number,
): EditorSelection | undefined {
  if (!sel || !sel.ranges || sel.ranges.length === 0) return undefined

  const ranges = sel.ranges.map((range) => {
    const anchor = Math.max(0, Math.min(docLength, Number.isFinite(range.anchor) ? range.anchor : 0))
    const head = Math.max(0, Math.min(docLength, Number.isFinite(range.head) ? range.head : 0))
    return EditorSelection.range(anchor, head)
  })
  let main = Number.isFinite(sel.main) ? sel.main : 0
  if (main < 0 || main >= ranges.length) main = 0

  return EditorSelection.create(ranges, main)
}

export function createEditorState(params: EditorStateParams): EditorState {
  const {
    doc,
    selection,
    lineWrapping = false,
    showWhitespace = false,
  } = params
  const extensions = [
    textPadTheme,
    lineNumbers(),
    whitespaceCompartment.of(showWhitespace ? highlightSpecialChars() : []),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    history(),
    highlightSelectionMatches(),
    search(),
    wrappingCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
    ]),
  ]

  const normalized = normalizeSelection(selection, doc.length)
  if (normalized) {
    return EditorState.create({ doc, extensions, selection: normalized })
  }

  return EditorState.create({ doc, extensions })
}
