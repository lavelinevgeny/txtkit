import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n/context'

const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`

export default function MermaidView() {
  const { t } = useTranslation()
  const input = useStore((s) => s.input)
  const setActiveToolId = useStore((s) => s.setActiveToolId)

  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const renderIdRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const trimmed = input.trim()
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
  }, [input])

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

  const handleCopySvg = useCallback(() => {
    if (!svg) return
    navigator.clipboard.writeText(svg).catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = svg
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }, [svg])

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
          {svg && (
            <>
              <button
                onClick={() => setZoomed((z) => !z)}
                className={zoomed ? buttonActive : buttonIdle}
              >
                {t('mermaid.toolbar.zoom')}
              </button>
              <button onClick={handleCopySvg} className={buttonIdle}>
                {t('mermaid.toolbar.copySvg')}
              </button>
            </>
          )}
        </div>
      </header>

      <div
        ref={containerRef}
        className={`flex-1 min-h-[300px] overflow-auto rounded-lg border border-border bg-[#09090b] p-4 ${
          zoomed ? 'flex items-start justify-center' : ''
        }`}
      >
        {loading && !svg && (
          <div className="flex h-full w-full items-center justify-center text-muted font-mono text-xs">
            {t('mermaid.rendering')}
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="text-red-400 font-mono text-xs">{t('mermaid.error')}</span>
            <span className="text-muted font-mono text-xs">
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
          <div className="flex h-full w-full items-center justify-center text-muted font-mono text-xs">
            {t('mermaid.empty')}
          </div>
        )}

        {svg && (
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className={zoomed ? 'mermaid-svg [&>svg]:max-w-none' : 'mermaid-svg'}
          />
        )}
      </div>
    </div>
  )
}
