import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'

export function TextPadView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editorDoc = useStore((s) => s.editorDoc)
  const setEditorDoc = useStore((s) => s.setEditorDoc)
  const editorDocRef = useRef(editorDoc)

  useEffect(() => {
    editorDocRef.current = editorDoc
  })

  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: editorDocRef.current,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        history(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setEditorDoc(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [setEditorDoc])

  return (
    <section
      ref={hostRef}
      data-testid="text-pad-view"
      className="w-full max-w-6xl flex-1 h-full overflow-hidden"
    />
  )
}
