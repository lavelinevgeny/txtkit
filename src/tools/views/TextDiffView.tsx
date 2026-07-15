import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'
import { diffRows, diffStats, type DiffRow, type DiffSeg } from '../../utils/text-diff-ops'

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`

// Row-level background tints per diff op (kept within the app palette).
const rowBg: Record<DiffRow['op'], string> = {
  equal: '',
  add: 'bg-success/10',
  remove: 'bg-red-400/10',
  replace: 'bg-accent/10',
}

// Emphasis for the changed cell of a row (whole-line highlight).
const cellBg: Record<DiffRow['op'], string> = {
  equal: '',
  add: 'bg-success/15',
  remove: 'bg-red-400/15',
  replace: 'bg-accent/15',
}

function Segments({ segs, op }: { segs: DiffSeg[]; op: DiffRow['op'] }) {
  const mark =
    op === 'add' ? 'bg-success/40' : op === 'remove' ? 'bg-red-400/40' : 'bg-accent/40'
  return (
    <>
      {segs.map((seg, i) =>
        seg.changed ? (
          <span key={i} className={`${mark} rounded-sm`}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

function Pane({
  cell,
  lineNo,
  op,
  side,
}: {
  cell: DiffSeg[] | null
  lineNo: number | null
  op: DiffRow['op']
  side: 'left' | 'right'
}) {
  const emphasise = cell !== null && op !== 'equal'
  return (
    <div className={`flex min-w-0 ${side === 'left' ? 'border-r border-border' : ''}`}>
      <span className="w-10 flex-none select-none px-1.5 text-right text-muted-dim">
        {lineNo ?? ''}
      </span>
      <span
        className={`min-w-0 flex-1 whitespace-pre-wrap break-words px-2 ${
          emphasise ? cellBg[op] : cell === null ? 'bg-surface-dim/40' : ''
        }`}
      >
        {cell !== null ? <Segments segs={cell} op={op} /> : ' '}
      </span>
    </div>
  )
}

export function TextDiffView() {
  const { t } = useTranslation()
  const sourceInput = useStore((s) => s.input)
  const setActiveToolId = useStore((s) => s.setActiveToolId)

  const [left, setLeft] = useState(sourceInput)
  const [right, setRight] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [wordLevel, setWordLevel] = useState(true)

  const rows = useMemo(
    () => diffRows(left, right, { ignoreCase, ignoreWhitespace, wordLevel }),
    [left, right, ignoreCase, ignoreWhitespace, wordLevel],
  )
  const stats = useMemo(() => diffStats(rows), [rows])

  const numbered = useMemo(() => {
    let l = 0
    let r = 0
    return rows.map((row) => ({
      row,
      leftNo: row.left !== null ? ++l : null,
      rightNo: row.right !== null ? ++r : null,
    }))
  }, [rows])

  const swap = () => {
    setLeft(right)
    setRight(left)
  }

  return (
    <div className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-2">
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => setActiveToolId(null)} className={buttonIdle}>
            {t('textDiff.toolbar.backToTools')}
          </button>
          <span className="text-base leading-none text-accent">⇄</span>
          <h2 className="text-sm font-semibold text-text">{t('textDiff.title')}</h2>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <button onClick={swap} className={buttonIdle}>
            {t('textDiff.toolbar.swap')}
          </button>
          <button
            onClick={() => setIgnoreCase((v) => !v)}
            className={ignoreCase ? buttonActive : buttonIdle}
          >
            {t('textDiff.toolbar.ignoreCase')}
          </button>
          <button
            onClick={() => setIgnoreWhitespace((v) => !v)}
            className={ignoreWhitespace ? buttonActive : buttonIdle}
          >
            {t('textDiff.toolbar.ignoreWhitespace')}
          </button>
          <button
            onClick={() => setWordLevel((v) => !v)}
            className={wordLevel ? buttonActive : buttonIdle}
          >
            {t('textDiff.toolbar.wordLevel')}
          </button>
          <button
            onClick={() => {
              setLeft('')
              setRight('')
            }}
            className={buttonDanger}
          >
            {t('textDiff.toolbar.clear')}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <textarea
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder={t('textDiff.input.leftPlaceholder')}
          spellCheck={false}
          className="h-40 resize-y rounded-lg border border-border bg-[#09090b] p-3 font-mono text-xs text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
        />
        <textarea
          value={right}
          onChange={(e) => setRight(e.target.value)}
          placeholder={t('textDiff.input.rightPlaceholder')}
          spellCheck={false}
          className="h-40 resize-y rounded-lg border border-border bg-[#09090b] p-3 font-mono text-xs text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[10px] font-mono text-muted">
        <span className="text-text">
          {t('textDiff.stats.differences', { n: stats.blocks })}
        </span>
        <span className="text-success">+{stats.added}</span>
        <span className="text-red-300">−{stats.removed}</span>
        <span className="text-accent">~{stats.changed}</span>
        <button
          onClick={() => void copyToClipboard(right)}
          className="ml-auto text-muted transition-colors hover:text-accent"
        >
          {t('textDiff.stats.copyRight')}
        </button>
      </div>

      <section
        data-testid="text-diff-view"
        className="flex-1 min-h-[240px] overflow-auto rounded-lg border border-border bg-[#09090b] font-mono text-xs leading-relaxed"
      >
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 py-8 text-center text-muted">
            {t('textDiff.empty')}
          </div>
        ) : (
          numbered.map(({ row, leftNo, rightNo }, i) => (
            <div key={i} className={`grid grid-cols-2 ${rowBg[row.op]}`}>
              <Pane cell={row.left} lineNo={leftNo} op={row.op} side="left" />
              <Pane cell={row.right} lineNo={rightNo} op={row.op} side="right" />
            </div>
          ))
        )}
      </section>
    </div>
  )
}
