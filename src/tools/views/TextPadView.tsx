import { useEffect, useMemo, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'
import { getTextPadStats } from './textPadStats'
import { downloadTextFile } from './textPadFile'

const wrappingCompartment = new Compartment()
const whitespaceCompartment = new Compartment()

export function TextPadView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorDoc = useStore((s) => s.editorDoc)
  const setEditorDoc = useStore((s) => s.setEditorDoc)
  const editorDocRef = useRef(editorDoc)
  const editorPrefs = useStore((s) => s.editorPrefs)
  const setEditorPrefs = useStore((s) => s.setEditorPrefs)
  const setActiveToolId = useStore((s) => s.setActiveToolId)
  const editorAutosaveWarning = useStore((s) => s.editorAutosaveWarning)
  const clearEditorAutosaveWarning = useStore((s) => s.clearEditorAutosaveWarning)
  const { t } = useTranslation()

  const stats = useMemo(() => getTextPadStats(editorDoc), [editorDoc])

  useEffect(() => {
    editorDocRef.current = editorDoc
  })

  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: editorDocRef.current,
      extensions: [
        lineNumbers(),
        whitespaceCompartment.of(editorPrefs.showWhitespace ? highlightSpecialChars() : []),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        history(),
        highlightSelectionMatches(),
        wrappingCompartment.of(editorPrefs.lineWrapping ? EditorView.lineWrapping : []),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEditorDoc])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wrappingCompartment.reconfigure(editorPrefs.lineWrapping ? EditorView.lineWrapping : []),
    })
  }, [editorPrefs.lineWrapping])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: whitespaceCompartment.reconfigure(editorPrefs.showWhitespace ? highlightSpecialChars() : []),
    })
  }, [editorPrefs.showWhitespace])

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

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const view = viewRef.current
    if (!view) {
      e.target.value = ''
      return
    }
    if ((view.state.doc.toString() ?? '').length > 0) {
      if (!window.confirm(t('textPad.confirmImportReplace'))) {
        e.target.value = ''
        return
      }
    }
    const text = await file.text()
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      userEvent: 'input.textPad.importTxt',
    })
    e.target.value = ''
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
            onClick={() => downloadTextFile(viewRef.current?.state.doc.toString() ?? '')}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.downloadTxt')}
          </button>
          <button
            onClick={handleUploadClick}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.uploadTxt')}
          </button>
          <button
            onClick={handleClear}
            className="px-2 py-1 bg-zinc-800 rounded-lg text-muted hover:text-accent transition-colors text-xs font-mono"
          >
            {t('textPad.toolbar.clear')}
          </button>
          <button
            onClick={() => setEditorPrefs({ lineWrapping: !editorPrefs.lineWrapping })}
            className={
              'px-2 py-1 rounded-lg transition-colors text-xs font-mono ' +
              (editorPrefs.lineWrapping
                ? 'bg-accent text-surface'
                : 'bg-zinc-800 text-muted hover:text-accent')
            }
          >
            {t('textPad.toolbar.wrap')}
          </button>
          <button
            onClick={() => setEditorPrefs({ showWhitespace: !editorPrefs.showWhitespace })}
            className={
              'px-2 py-1 rounded-lg transition-colors text-xs font-mono ' +
              (editorPrefs.showWhitespace
                ? 'bg-accent text-surface'
                : 'bg-zinc-800 text-muted hover:text-accent')
            }
          >
            {t('textPad.toolbar.whitespace')}
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-xs text-muted/70 px-1">{t('textPad.hint.empty')}</p>

      {editorAutosaveWarning && (
        <div
          role="alert"
          data-testid="text-pad-autosave-warning"
          className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/40 rounded-lg text-xs text-amber-200"
        >
          <span className="flex-1">
            {editorAutosaveWarning === 'autosave-too-large'
              ? t('textPad.autosave.tooLarge')
              : t('textPad.autosave.quotaExceeded')}
          </span>
          <button
            onClick={clearEditorAutosaveWarning}
            className="px-2 py-0.5 bg-amber-500/20 rounded text-amber-100 hover:bg-amber-500/30 transition-colors text-[10px] font-mono"
          >
            {t('textPad.autosave.dismiss')}
          </button>
        </div>
      )}

      <section
        ref={hostRef}
        data-testid="text-pad-view"
        className="flex-1 min-h-0 h-full overflow-hidden border border-border rounded-lg"
      />

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-[10px] text-muted font-mono">
        <span>{t('textPad.stats.chars')}: {stats.chars}</span>
        <span>{t('textPad.stats.lines')}: {stats.lines}</span>
        {stats.detailedStatsDisabled ? (
          <span className="text-muted/70">{t('textPad.stats.detailedDisabled')}</span>
        ) : (
          <>
            {stats.words !== null && <span>{t('textPad.stats.words')}: {stats.words}</span>}
            {stats.paragraphs !== null && (
              <span>{t('textPad.stats.paragraphs')}: {stats.paragraphs}</span>
            )}
          </>
        )}
      </footer>

      <p className="text-xs text-muted/70 px-1">{t('textPad.hint.undo')}</p>
    </div>
  )
}
