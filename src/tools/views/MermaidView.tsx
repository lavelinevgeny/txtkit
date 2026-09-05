import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'
import { clampZoom, wheelFactor, zoomAtPoint, ZOOM_STEP, type ZoomState } from './mermaidZoom'
import {
  copyPngToClipboard,
  downloadBlob,
  downloadSvgFile,
  svgToPngBlob,
} from './mermaidExport'

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`
const buttonDisabled = 'disabled:opacity-40 disabled:hover:border-border-dim disabled:hover:text-muted'

const STATUS_TIMEOUT_MS = 2000
const INITIAL_VIEW: ZoomState = { zoom: 1, pan: { x: 0, y: 0 } }

type Status = { kind: 'ok' | 'error'; key: string }

const SAMPLE = 'graph TD\n  A[Начало] --> B{Условие}\n  B -->|да| C[Действие]\n  B -->|нет| D[Конец]'

export default function MermaidView() {
  const { t } = useTranslation()
  const sourceInput = useStore((s) => s.input)
  const setActiveToolId = useStore((s) => s.setActiveToolId)

  const [code, setCode] = useState(sourceInput)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  // Один объект: zoomAtPoint пересчитывает zoom и pan совместно.
  const [view, setView] = useState<ZoomState>(INITIAL_VIEW)

  const renderIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Нативный wheel-слушатель навешивается один раз и иначе захватил бы
  // устаревшее состояние в замыкании.
  const viewRef = useRef(view)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panCleanupRef = useRef<(() => void) | null>(null)

  const applyView = useCallback((next: ZoomState) => {
    viewRef.current = next
    setView(next)
  }, [])

  const showStatus = useCallback((kind: Status['kind'], key: string) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    setStatus({ kind, key })
    statusTimerRef.current = setTimeout(() => {
      statusTimerRef.current = null
      setStatus(null)
    }, STATUS_TIMEOUT_MS)
  }, [])

  // Статус сбрасывается по таймауту либо раньше — при следующем изменении
  // кода, то есть в начале нового дебаунс-цикла рендеринга.
  const changeCode = useCallback((next: string) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setStatus(null)
    setCode(next)
  }, [])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
      panCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const trimmed = code.trim()
      if (!trimmed) {
        setSvg(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const id = ++renderIdRef.current

      try {
        // htmlLabels: false — обязательное условие работоспособного PNG-экспорта:
        // <foreignObject> не растеризуется на canvas в WebKit и расходится в Chrome.
        mermaid.initialize({ startOnLoad: false, theme: 'dark', htmlLabels: false })

        const { svg: rendered } = await mermaid.render(`mermaid-${id}`, trimmed)

        if (id !== renderIdRef.current) return

        setSvg(rendered)
        setError(null)
      } catch (e) {
        if (id !== renderIdRef.current) return

        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setSvg(null)
      } finally {
        if (id === renderIdRef.current) {
          setLoading(false)
        }
      }
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code])

  // Boolean, а не сам svg: слушатель пересоздаётся только на появление или
  // исчезновение диаграммы, а не на каждый ре-рендер её разметки.
  const hasSvg = svg !== null

  useEffect(() => {
    const viewport = viewportRef.current
    // Колесо зумит только при отрендеренной диаграмме — иначе масштаб уезжал бы
    // с 100% на пустой панели, и она открывалась бы в неожиданном зуме.
    if (!viewport || !hasSvg) return

    const onWheel = (event: WheelEvent) => {
      // Непассивный слушатель — иначе preventDefault() игнорируется.
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      applyView(
        zoomAtPoint(viewRef.current, wheelFactor(event.deltaY), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }),
      )
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [applyView, hasSvg])

  const startPan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!svg) return
      if (event.pointerType === 'mouse' && event.button !== 0) return

      panCleanupRef.current?.()
      event.preventDefault()

      const startX = event.clientX
      const startY = event.clientY
      const startPanOffset = viewRef.current.pan
      const target = event.currentTarget
      const pointerId = event.pointerId
      if (typeof pointerId === 'number' && target.setPointerCapture) {
        target.setPointerCapture(pointerId)
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'

      const move = (moveEvent: PointerEvent) => {
        applyView({
          ...viewRef.current,
          pan: {
            x: startPanOffset.x + moveEvent.clientX - startX,
            y: startPanOffset.y + moveEvent.clientY - startY,
          },
        })
      }

      const stop = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        window.removeEventListener('blur', stop)
        if (typeof pointerId === 'number' && target.hasPointerCapture?.(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        if (panCleanupRef.current === stop) panCleanupRef.current = null
      }

      panCleanupRef.current = stop
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
      window.addEventListener('blur', stop)
    },
    [applyView, svg],
  )

  const zoomBy = useCallback(
    (delta: number) => {
      applyView({ ...viewRef.current, zoom: clampZoom(viewRef.current.zoom + delta) })
    },
    [applyView],
  )

  const resetView = useCallback(() => applyView(INITIAL_VIEW), [applyView])

  const copyPng = useCallback(async () => {
    if (!svg) return
    const ok = await copyPngToClipboard(svg)
    showStatus(ok ? 'ok' : 'error', ok ? 'mermaid.status.pngCopied' : 'mermaid.status.pngCopyFailed')
  }, [showStatus, svg])

  const downloadPng = useCallback(async () => {
    if (!svg) return
    try {
      downloadBlob(await svgToPngBlob(svg), 'diagram.png')
    } catch {
      showStatus('error', 'mermaid.status.exportFailed')
    }
  }, [showStatus, svg])

  const downloadSvg = useCallback(() => {
    if (!svg) return
    try {
      downloadSvgFile(svg)
    } catch {
      showStatus('error', 'mermaid.status.exportFailed')
    }
  }, [showStatus, svg])

  const errorLine = useCallback(() => {
    if (!error) return null
    const match = error.match(/line (\d+), column (\d+)/i)
    if (match) {
      return parseInt(match[1], 10)
    }

    const lineMatch = error.match(/line (\d+)/i)
    if (lineMatch) {
      return parseInt(lineMatch[1], 10)
    }

    return null
  }, [error])

  const errorMessage = useCallback(() => {
    if (!error) return null
    const lineMatch = error.match(/^(.*?)(?: line \d+|$)/i)
    if (lineMatch) {
      return lineMatch[1].trim()
    }
    return error
  }, [error])

  const lineCount = code === '' ? 0 : code.split('\n').length

  return (
    <div className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-2">
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => setActiveToolId(null)} className={buttonIdle}>
            {t('mermaid.toolbar.backToTools')}
          </button>
          <span className="text-base leading-none text-accent">▶</span>
          <h2 className="text-sm font-semibold text-text">{t('mermaid.title')}</h2>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <button onClick={() => changeCode(SAMPLE)} className={buttonIdle}>
            {t('mermaid.toolbar.sample')}
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={!svg}
              aria-label={t('mermaid.toolbar.zoomOutAria')}
              className={`${buttonIdle} ${buttonDisabled}`}
            >
              {t('mermaid.toolbar.zoomOut')}
            </button>
            {/* role="img": aria-label на голом span (role=generic) скринридеры
                игнорируют. Значение входит в имя — без aria-live оно не
                зачитывается спонтанно, но доступно по запросу. */}
            <span
              data-testid="mermaid-zoom-level"
              role="img"
              aria-label={`${t('mermaid.toolbar.zoomLevel')}: ${Math.round(view.zoom * 100)}%`}
              className={`min-w-[3.25rem] text-center font-mono text-xs text-muted ${svg ? '' : 'opacity-40'}`}
            >
              {Math.round(view.zoom * 100)}%
            </span>
            <button
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={!svg}
              aria-label={t('mermaid.toolbar.zoomInAria')}
              className={`${buttonIdle} ${buttonDisabled}`}
            >
              {t('mermaid.toolbar.zoomIn')}
            </button>
            <button
              onClick={resetView}
              disabled={!svg}
              aria-label={t('mermaid.toolbar.zoomResetAria')}
              className={`${buttonIdle} ${buttonDisabled}`}
            >
              {t('mermaid.toolbar.zoomReset')}
            </button>
          </div>

          <button
            onClick={() => void copyPng()}
            disabled={!svg}
            className={`${buttonIdle} ${buttonDisabled}`}
          >
            {t('mermaid.toolbar.copyPng')}
          </button>
          <button
            onClick={() => void downloadPng()}
            disabled={!svg}
            aria-label={t('mermaid.toolbar.downloadPngAria')}
            className={`${buttonIdle} ${buttonDisabled}`}
          >
            {t('mermaid.toolbar.downloadPng')}
          </button>
          <button
            onClick={downloadSvg}
            disabled={!svg}
            aria-label={t('mermaid.toolbar.downloadSvgAria')}
            className={`${buttonIdle} ${buttonDisabled}`}
          >
            {t('mermaid.toolbar.downloadSvg')}
          </button>
          <button
            onClick={() => void copyToClipboard(svg ?? '')}
            disabled={!svg}
            className={`${buttonIdle} ${buttonDisabled}`}
          >
            {t('mermaid.toolbar.copySvg')}
          </button>
          <button onClick={() => changeCode('')} className={buttonDanger}>
            {t('mermaid.toolbar.clear')}
          </button>
        </div>
      </header>

      <div className="grid flex-1 min-h-[320px] grid-cols-1 gap-2 md:grid-cols-2">
        <section className="flex min-h-[240px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-[#09090b]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] font-mono text-muted">
            <span className="text-text">{t('mermaid.pane.code')}</span>
            <span className="ml-auto">{t('mermaid.stats.lines', { n: lineCount })}</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => changeCode(e.target.value)}
            placeholder={t('mermaid.input.placeholder')}
            spellCheck={false}
            data-testid="mermaid-code"
            className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-text outline-none placeholder:text-muted/50"
          />
        </section>

        <section className="flex min-h-[240px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-[#09090b]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] font-mono text-muted">
            <span className="text-text">{t('mermaid.pane.preview')}</span>
            <span className="ml-auto flex items-center gap-2">
              {status && (
                <span
                  data-testid="mermaid-status"
                  className={status.kind === 'ok' ? 'text-success' : 'text-red-300'}
                >
                  {t(status.key)}
                </span>
              )}
              {loading && <span>{t('mermaid.rendering')}</span>}
              {!loading && error && <span className="text-red-300">{t('mermaid.error')}</span>}
            </span>
          </div>

          <div
            ref={viewportRef}
            data-testid="mermaid-preview"
            onPointerDown={startPan}
            style={{ touchAction: 'none' }}
            className={`relative min-h-0 flex-1 overflow-hidden p-4 ${svg && !error ? 'cursor-grab' : ''}`}
          >
            {loading && !svg && (
              <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
                {t('mermaid.rendering')}
              </div>
            )}

            {!loading && error && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="font-mono text-xs text-red-400">{t('mermaid.error')}</span>
                <span className="font-mono text-xs text-muted">
                  {errorMessage()}
                  {errorLine() && (
                    <span>
                      {' — '}
                      {t('mermaid.errorLine', { n: errorLine()! })}
                    </span>
                  )}
                </span>
              </div>
            )}

            {!loading && !error && !svg && (
              <div className="flex h-full w-full items-center justify-center px-4 text-center font-mono text-xs text-muted">
                {t('mermaid.empty')}
              </div>
            )}

            {svg && !error && (
              <div
                dangerouslySetInnerHTML={{ __html: svg }}
                style={{
                  transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
                  transformOrigin: '0 0',
                }}
                className="mermaid-svg"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
