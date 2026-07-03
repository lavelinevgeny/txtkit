import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'
import {
  removeEmptyLines,
  removeDuplicateLines,
  sortLines,
  trimLines,
  shuffleLines,
  addPrefixSuffix,
} from '../../utils/text-ops'
import { toLowerCase, toUpperCase, toSentenceCase, toTitleCase } from '../../utils/text-case-ops'
import { htmlEscape, htmlUnescape, urlEncode, urlDecode } from '../../utils/text-encode-ops'
import { getTextPadStats } from './textPadStats'
import { downloadTextFile } from './textPadFile'

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
    '.cm-line': {
      padding: '0 18px 0 12px',
    },
    '.cm-gutters': {
      backgroundColor: '#18181b',
      color: '#71717a',
      borderRight: '1px solid #27272a',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 12px',
      minWidth: '38px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(232, 160, 48, 0.07)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(232, 160, 48, 0.12)',
      color: '#e4e4e7',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#e8a030',
    },
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
  },
  { dark: true },
)

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`
const inputClass =
  'h-8 w-28 rounded-lg border border-border-dim bg-surface-dim px-2 text-xs font-mono text-text outline-none placeholder:text-muted/50 focus:border-accent/50'

export function TextPadView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceInput = useStore((s) => s.input)
  const sourceInputRef = useRef(sourceInput)
  const editorDoc = useStore((s) => s.editorDoc)
  const setEditorDoc = useStore((s) => s.setEditorDoc)
  const editorDocRef = useRef(editorDoc)
  const editorPrefs = useStore((s) => s.editorPrefs)
  const setEditorPrefs = useStore((s) => s.setEditorPrefs)
  const setActiveToolId = useStore((s) => s.setActiveToolId)
  const editorAutosaveWarning = useStore((s) => s.editorAutosaveWarning)
  const clearEditorAutosaveWarning = useStore((s) => s.clearEditorAutosaveWarning)
  const { t } = useTranslation()
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [operationsOpen, setOperationsOpen] = useState(false)
  const [pendingSourceInput, setPendingSourceInput] = useState<string | null>(() =>
    sourceInput.length > 0 && editorDoc.length > 0 && sourceInput !== editorDoc ? sourceInput : null,
  )

  const stats = useMemo(() => getTextPadStats(editorDoc), [editorDoc])

  useEffect(() => {
    editorDocRef.current = editorDoc
  })

  useEffect(() => {
    if (sourceInput.length === 0 || sourceInput === editorDocRef.current) {
      setPendingSourceInput(null)
      return
    }
    setPendingSourceInput(sourceInput)
  }, [sourceInput])

  useEffect(() => {
    if (!hostRef.current) return

    const initialSourceInput = sourceInputRef.current
    if (editorDocRef.current.length === 0 && initialSourceInput.length > 0) {
      editorDocRef.current = initialSourceInput
      setEditorDoc(initialSourceInput)
      setPendingSourceInput(null)
    }

    const state = EditorState.create({
      doc: editorDocRef.current,
      extensions: [
        textPadTheme,
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

  const replaceWholeDoc = (next: string, userEvent: string) => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      userEvent,
    })
  }

  const handleQuickOp = (op: 'removeEmptyLines' | 'removeDuplicateLines' | 'sortLines' | 'trimLines' | 'shuffleLines' | 'toLowerCase' | 'toUpperCase' | 'sentenceCase' | 'titleCase' | 'htmlEscape' | 'htmlUnescape' | 'urlEncode' | 'urlDecode') => {
    const current = viewRef.current?.state.doc.toString() ?? ''
    const userEvent = `input.textPad.${op}`
    switch (op) {
      case 'removeEmptyLines':
        replaceWholeDoc(removeEmptyLines(current), userEvent)
        break
      case 'removeDuplicateLines':
        replaceWholeDoc(removeDuplicateLines(current), userEvent)
        break
      case 'sortLines':
        replaceWholeDoc(sortLines(current), userEvent)
        break
      case 'trimLines':
        replaceWholeDoc(trimLines(current), userEvent)
        break
      case 'shuffleLines':
        replaceWholeDoc(shuffleLines(current), userEvent)
        break
      case 'toLowerCase':
        replaceWholeDoc(toLowerCase(current), userEvent)
        break
      case 'toUpperCase':
        replaceWholeDoc(toUpperCase(current), userEvent)
        break
      case 'sentenceCase':
        replaceWholeDoc(toSentenceCase(current), userEvent)
        break
      case 'titleCase':
        replaceWholeDoc(toTitleCase(current), userEvent)
        break
      case 'htmlEscape':
        replaceWholeDoc(htmlEscape(current), userEvent)
        break
      case 'htmlUnescape':
        replaceWholeDoc(htmlUnescape(current), userEvent)
        break
      case 'urlEncode':
        replaceWholeDoc(urlEncode(current), userEvent)
        break
      case 'urlDecode':
        replaceWholeDoc(urlDecode(current), userEvent)
        break
    }
  }

  const handleAddPrefixSuffix = () => {
    const current = viewRef.current?.state.doc.toString() ?? ''
    if (!prefix && !suffix) return
    replaceWholeDoc(addPrefixSuffix(current, { prefix, suffix }), 'input.textPad.addPrefixSuffix')
  }

  const handleImportSourceInput = () => {
    if (pendingSourceInput === null) return
    replaceWholeDoc(pendingSourceInput, 'input.textPad.importSourceInput')
    setPendingSourceInput(null)
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
    <div className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-2">
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setActiveToolId(null)}
            className={buttonIdle}
          >
            {t('textPad.toolbar.backToTools')}
          </button>
          <span className="text-base leading-none text-accent">✎</span>
          <h2 className="text-sm font-semibold text-text">{t('textPad.title')}</h2>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {pendingSourceInput !== null && (
            <button onClick={handleImportSourceInput} className={buttonActive}>
              {t('textPad.importFromInput.action')}
            </button>
          )}
          <button
            onClick={() => setOperationsOpen((open) => !open)}
            className={operationsOpen ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.operations')}
          </button>
          <button
            onClick={handleCopy}
            className={buttonIdle}
          >
            {t('textPad.toolbar.copy')}
          </button>
          <button
            onClick={handleUploadClick}
            className={buttonIdle}
          >
            {t('textPad.toolbar.uploadTxt')}
          </button>
          <button
            onClick={() => downloadTextFile(viewRef.current?.state.doc.toString() ?? '')}
            className={buttonIdle}
          >
            {t('textPad.toolbar.downloadTxt')}
          </button>
          <button
            onClick={() => setEditorPrefs({ lineWrapping: !editorPrefs.lineWrapping })}
            className={editorPrefs.lineWrapping ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.wrap')}
          </button>
          <button
            onClick={() => setEditorPrefs({ showWhitespace: !editorPrefs.showWhitespace })}
            className={editorPrefs.showWhitespace ? buttonActive : buttonIdle}
          >
            {t('textPad.toolbar.whitespace')}
          </button>
          <button
            onClick={handleClear}
            className={buttonDanger}
          >
            {t('textPad.toolbar.clear')}
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

      {operationsOpen && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.lines')}</span>
            <button onClick={() => handleQuickOp('removeEmptyLines')} className={buttonIdle}>
              {t('textPad.ops.removeEmptyLines')}
            </button>
            <button onClick={() => handleQuickOp('removeDuplicateLines')} className={buttonIdle}>
              {t('textPad.ops.removeDuplicateLines')}
            </button>
            <button onClick={() => handleQuickOp('sortLines')} className={buttonIdle}>
              {t('textPad.ops.sortLines')}
            </button>
            <button onClick={() => handleQuickOp('trimLines')} className={buttonIdle}>
              {t('textPad.ops.trimLines')}
            </button>
            <button onClick={() => handleQuickOp('shuffleLines')} className={buttonIdle}>
              {t('textPad.ops.shuffleLines')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.case')}</span>
            <button onClick={() => handleQuickOp('toLowerCase')} className={buttonIdle}>
              {t('textPad.ops.toLowerCase')}
            </button>
            <button onClick={() => handleQuickOp('toUpperCase')} className={buttonIdle}>
              {t('textPad.ops.toUpperCase')}
            </button>
            <button onClick={() => handleQuickOp('sentenceCase')} className={buttonIdle}>
              {t('textPad.ops.sentenceCase')}
            </button>
            <button onClick={() => handleQuickOp('titleCase')} className={buttonIdle}>
              {t('textPad.ops.titleCase')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.prefix')}</span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder={t('textPad.ops.prefixPlaceholder')}
              className={inputClass}
            />
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder={t('textPad.ops.suffixPlaceholder')}
              className={inputClass}
            />
            <button
              onClick={handleAddPrefixSuffix}
              disabled={!prefix && !suffix}
              className={`${buttonIdle} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t('textPad.ops.addPrefixSuffix')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase text-muted-dim">{t('textPad.group.encode')}</span>
            <button onClick={() => handleQuickOp('htmlEscape')} className={buttonIdle}>
              {t('textPad.ops.htmlEscape')}
            </button>
            <button onClick={() => handleQuickOp('htmlUnescape')} className={buttonIdle}>
              {t('textPad.ops.htmlUnescape')}
            </button>
            <button onClick={() => handleQuickOp('urlEncode')} className={buttonIdle}>
              {t('textPad.ops.urlEncode')}
            </button>
            <button onClick={() => handleQuickOp('urlDecode')} className={buttonIdle}>
              {t('textPad.ops.urlDecode')}
            </button>
          </div>
        </div>
      )}

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
        className="text-pad-editor-host flex-1 min-h-[360px] overflow-hidden rounded-lg border border-border bg-[#09090b]"
      />

      <footer className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[10px] text-muted font-mono">
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
    </div>
  )
}
