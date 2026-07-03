import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'

export function TextPadView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editorDoc = useStore((s) => s.editorDoc)
  const setEditorDoc = useStore((s) => s.setEditorDoc)
  const editorDocRef = useRef(editorDoc)
  const setActiveToolId = useStore((s) => s.setActiveToolId)
  const { t } = useTranslation()

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

  const handleCopy = () => {
    void copyToClipboard(viewRef.current?.state.doc.toString() ?? '')
  }

  const handleClear = () => {
    const view = viewRef.current
    if (!view) return
    if (window.confirm(t('textPad.confirmClear'))) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        userEvent: 'input.textPad.clear',
      })
    }
  }

  return (
    <div className="w-full max-w-6xl flex-1 flex flex-col min-h-0 gap-2">
      <header className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
        <span className="text-base leading-none text-accent">✎</span>
        <h2 className="text-sm font-medium text-text">{t('textPad.title')}</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setActiveToolId(null)}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.backToTools')}
          </button>
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.copy')}
          </button>
          <button
            onClick={handleClear}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.clear')}
          </button>
        </div>
      </header>

      <p className="text-xs text-muted/70 px-1">{t('textPad.hint.empty')}</p>

      <section
        ref={hostRef}
        data-testid="text-pad-view"
        className="flex-1 min-h-0 h-full overflow-hidden border border-border rounded-lg"
      />

      <p className="text-xs text-muted/70 px-1">{t('textPad.hint.undo')}</p>
    </div>
  )
}
