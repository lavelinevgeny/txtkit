import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'
import { diffRows, diffStats, type DiffRow, type DiffSeg } from '../../utils/text-diff-ops'

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`

const TOP_HEIGHT_KEY = 'txtkit.textDiff.topHeight'
const LEFT_WIDTH_RATIO_KEY = 'txtkit.textDiff.leftWidthRatio'
const MIN_INPUT_HEIGHT = 120
const MIN_RESULT_HEIGHT = 240
const MIN_INPUT_WIDTH = 240
const DIVIDER_WIDTH = 8

function readLayoutNumber(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  const parsed = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function topHeightBounds(layoutHeight: number) {
  const max = Math.max(0, layoutHeight - MIN_RESULT_HEIGHT)
  return [Math.min(MIN_INPUT_HEIGHT, max), max] as const
}

function leftWidthRatioBounds(layoutWidth: number) {
  const min = MIN_INPUT_WIDTH / layoutWidth
  const max = 1 - (MIN_INPUT_WIDTH + DIVIDER_WIDTH) / layoutWidth
  return min <= max ? ([min, max] as const) : ([0.5, 0.5] as const)
}

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

// Solid marker colour for the mini-map ticks.
const minimapTick: Record<DiffRow['op'], string> = {
  equal: '',
  add: 'bg-success/70',
  remove: 'bg-red-400/70',
  replace: 'bg-accent/70',
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
        {cell !== null ? <Segments segs={cell} op={op} /> : ' '}
      </span>
    </div>
  )
}

interface Viewport {
  top: number
  height: number
  scrollHeight: number
}

/**
 * Location pane: a compact vertical map of the whole comparison. Each changed
 * row is a coloured tick placed at its relative position; the highlighted box
 * tracks the visible viewport, and clicking anywhere scrolls the diff there.
 */
function Minimap({
  ops,
  viewport,
  onSeek,
  label,
}: {
  ops: DiffRow['op'][]
  viewport: Viewport
  onSeek: (fraction: number) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const total = ops.length || 1

  const seekTo = useCallback(
    (clientY: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const fraction = (clientY - rect.top) / rect.height
      onSeek(Math.min(1, Math.max(0, fraction)))
    },
    [onSeek],
  )

  const boxTop = viewport.scrollHeight > 0 ? (viewport.top / viewport.scrollHeight) * 100 : 0
  const boxHeight = viewport.scrollHeight > 0 ? (viewport.height / viewport.scrollHeight) * 100 : 100

  return (
    <div
      ref={ref}
      role="scrollbar"
      aria-label={label}
      aria-controls="text-diff-view"
      aria-valuenow={Math.round(boxTop)}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault()
        seekTo(e.clientY)
      }}
      className="relative w-3 flex-none cursor-pointer overflow-hidden rounded border border-border bg-surface-dim"
    >
      {ops.map((op, i) =>
        op === 'equal' ? null : (
          <div
            key={i}
            className={`absolute inset-x-0 ${minimapTick[op]}`}
            style={{ top: `${(i / total) * 100}%`, height: `${Math.max(100 / total, 0.5)}%` }}
          />
        ),
      )}
      <div
        className="pointer-events-none absolute inset-x-0 rounded-sm border border-accent/60 bg-accent/10"
        style={{ top: `${boxTop}%`, height: `${Math.max(boxHeight, 3)}%` }}
      />
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
  const [syncScroll, setSyncScroll] = useState(true)
  const layoutRef = useRef<HTMLDivElement>(null)
  const [topHeight, setTopHeight] = useState(() => readLayoutNumber(TOP_HEIGHT_KEY, 160))
  const [leftWidthRatio, setLeftWidthRatio] = useState(() =>
    readLayoutNumber(LEFT_WIDTH_RATIO_KEY, 0.5),
  )
  const topHeightRef = useRef(topHeight)
  const leftWidthRatioRef = useRef(leftWidthRatio)

  useEffect(() => {
    topHeightRef.current = topHeight
  }, [topHeight])

  useEffect(() => {
    leftWidthRatioRef.current = leftWidthRatio
  }, [leftWidthRatio])

  const normalizeLayout = useCallback(() => {
    const layout = layoutRef.current
    if (!layout) return

    const rect = layout.getBoundingClientRect()
    if (rect.height > 0) {
      const [min, max] = topHeightBounds(rect.height)
      const height = clamp(topHeightRef.current, min, max)
      if (height !== topHeightRef.current) {
        topHeightRef.current = height
        setTopHeight(height)
        localStorage.setItem(TOP_HEIGHT_KEY, String(height))
      }
    }
    if (rect.width > 0) {
      const [min, max] = leftWidthRatioBounds(rect.width)
      const ratio = clamp(leftWidthRatioRef.current, min, max)
      if (ratio !== leftWidthRatioRef.current) {
        leftWidthRatioRef.current = ratio
        setLeftWidthRatio(ratio)
        localStorage.setItem(LEFT_WIDTH_RATIO_KEY, String(ratio))
      }
    }
  }, [])

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

  const ops = useMemo(() => rows.map((r) => r.op), [rows])

  // --- Synchronised scrolling of the two input panes ---------------------
  const leftInputRef = useRef<HTMLTextAreaElement>(null)
  const rightInputRef = useRef<HTMLTextAreaElement>(null)
  const suppressSync = useRef(false)

  const handleInputScroll = useCallback(
    (source: 'left' | 'right') => {
      if (!syncScroll) return
      if (suppressSync.current) {
        suppressSync.current = false
        return
      }
      const from = source === 'left' ? leftInputRef.current : rightInputRef.current
      const to = source === 'left' ? rightInputRef.current : leftInputRef.current
      if (!from || !to) return
      const fromMax = from.scrollHeight - from.clientHeight
      const toMax = to.scrollHeight - to.clientHeight
      const ratio = fromMax > 0 ? from.scrollTop / fromMax : 0
      const next = ratio * toMax
      if (Math.abs(to.scrollTop - next) < 1) return
      suppressSync.current = true
      to.scrollTop = next
    },
    [syncScroll],
  )

  // --- Location pane / viewport tracking for the diff result -------------
  const diffRef = useRef<HTMLElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ top: 0, height: 1, scrollHeight: 1 })

  const measure = useCallback(() => {
    const el = diffRef.current
    if (!el) return
    setViewport({ top: el.scrollTop, height: el.clientHeight, scrollHeight: el.scrollHeight })
  }, [])

  useEffect(() => {
    measure()
  }, [measure, numbered])

  useLayoutEffect(() => {
    const handleResize = () => {
      normalizeLayout()
      measure()
    }

    handleResize()
    const layout = layoutRef.current
    window.addEventListener('resize', handleResize)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && layout) {
      observer = new ResizeObserver(handleResize)
      observer.observe(layout)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [measure, normalizeLayout])

  useEffect(() => {
    measure()
  }, [measure, topHeight])

  const seek = useCallback((fraction: number) => {
    const el = diffRef.current
    if (!el) return
    const target = fraction * el.scrollHeight - el.clientHeight / 2
    el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, Math.max(0, target))
  }, [])

  const swap = () => {
    setLeft(right)
    setRight(left)
  }

  const startHorizontalResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const layout = layoutRef.current
    if (!layout) return

    const startY = event.clientY
    const startHeight = topHeightRef.current
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'

    const move = (moveEvent: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const [min, max] = topHeightBounds(rect.height)
      const height = clamp(startHeight + moveEvent.clientY - startY, min, max)
      topHeightRef.current = height
      setTopHeight(height)
    }

    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      localStorage.setItem(TOP_HEIGHT_KEY, String(topHeightRef.current))
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [])

  const startVerticalResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const layout = layoutRef.current
    if (!layout) return

    const startX = event.clientX
    const startRatio = leftWidthRatioRef.current
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const move = (moveEvent: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const [minRatio, maxRatio] = leftWidthRatioBounds(rect.width)
      const ratio = clamp(
        startRatio + (moveEvent.clientX - startX) / rect.width,
        minRatio,
        maxRatio,
      )
      leftWidthRatioRef.current = ratio
      setLeftWidthRatio(ratio)
    }

    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      localStorage.setItem(LEFT_WIDTH_RATIO_KEY, String(leftWidthRatioRef.current))
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [])

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
            onClick={() => setSyncScroll((v) => !v)}
            className={syncScroll ? buttonActive : buttonIdle}
          >
            {t('textDiff.toolbar.syncScroll')}
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

      <div ref={layoutRef} data-testid="text-diff-layout" className="flex flex-1 min-h-0 flex-col">
        <div data-testid="text-diff-inputs" className="flex min-h-0" style={{ height: `${topHeight}px` }}>
          <textarea
            ref={leftInputRef}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            onScroll={() => handleInputScroll('left')}
            placeholder={t('textDiff.input.leftPlaceholder')}
            spellCheck={false}
            style={{ width: `${leftWidthRatio * 100}%` }}
            className="h-full min-h-0 flex-none resize-none rounded-lg border border-border bg-[#09090b] p-3 font-mono text-xs text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
          />
          <div
            data-testid="text-diff-vertical-resizer"
            onPointerDown={startVerticalResize}
            className="w-2 flex-none cursor-col-resize touch-none"
          />
          <textarea
            ref={rightInputRef}
            value={right}
            onChange={(e) => setRight(e.target.value)}
            onScroll={() => handleInputScroll('right')}
            placeholder={t('textDiff.input.rightPlaceholder')}
            spellCheck={false}
            className="h-full min-h-0 min-w-0 flex-1 resize-none rounded-lg border border-border bg-[#09090b] p-3 font-mono text-xs text-text outline-none placeholder:text-muted/50 focus:border-accent/50"
          />
        </div>

        <div
          data-testid="text-diff-horizontal-resizer"
          onPointerDown={startHorizontalResize}
          className="h-2 flex-none cursor-row-resize touch-none"
        />

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

        <div className="flex flex-1 min-h-[240px] gap-1.5">
          <section
            ref={diffRef}
            id="text-diff-view"
            data-testid="text-diff-view"
            onScroll={measure}
            className="min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-[#09090b] font-mono text-xs leading-relaxed"
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

          {rows.length > 0 && (
            <Minimap
              ops={ops}
              viewport={viewport}
              onSeek={seek}
              label={t('textDiff.minimap.label')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
