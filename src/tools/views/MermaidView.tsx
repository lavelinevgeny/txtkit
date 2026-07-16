import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'
import { copyToClipboard } from '../../utils/clipboard'

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`

const SAMPLE = 'graph TD\n  A[Начало] --> B{Условие}\n  B -->|да| C[Действие]\n  B -->|нет| D[Конец]'

export default function MermaidView() {
  const { t } = useTranslation()
  const sourceInput = useStore((s) => s.input)
  const setActiveToolId = useStore((s) => s.setActiveToolId)

  const [code, setCode] = useState(sourceInput)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const renderIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        mermaid.initialize({ startOnLoad: false, theme: 'dark' })

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
          <button onClick={() => setCode(SAMPLE)} className={buttonIdle}>
            {t('mermaid.toolbar.sample')}
          </button>
          <button
            onClick={() => setZoomed((z) => !z)}
            disabled={!svg}
            className={`${zoomed ? buttonActive : buttonIdle} disabled:opacity-40 disabled:hover:border-border-dim disabled:hover:text-muted`}
          >
            {t('mermaid.toolbar.zoom')}
          </button>
          <button
            onClick={() => void copyToClipboard(svg ?? '')}
            disabled={!svg}
            className={`${buttonIdle} disabled:opacity-40 disabled:hover:border-border-dim disabled:hover:text-muted`}
          >
            {t('mermaid.toolbar.copySvg')}
          </button>
          <button onClick={() => setCode('')} className={buttonDanger}>
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
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('mermaid.input.placeholder')}
            spellCheck={false}
            data-testid="mermaid-code"
            className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-text outline-none placeholder:text-muted/50"
          />
        </section>

        <section className="flex min-h-[240px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-[#09090b]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] font-mono text-muted">
            <span className="text-text">{t('mermaid.pane.preview')}</span>
            {loading && <span className="ml-auto">{t('mermaid.rendering')}</span>}
            {!loading && error && <span className="ml-auto text-red-300">{t('mermaid.error')}</span>}
          </div>

          <div
            data-testid="mermaid-preview"
            className={`min-h-0 flex-1 overflow-auto p-4 ${zoomed ? 'flex items-start justify-center' : ''}`}
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
                className={zoomed ? 'mermaid-svg [&>svg]:max-w-none' : 'mermaid-svg'}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
