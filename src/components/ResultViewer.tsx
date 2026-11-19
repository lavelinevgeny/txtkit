import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from '../i18n/context'
import { copyToClipboard } from '../utils/clipboard'
import { buttonActive, buttonIdle, iconButtonIdle } from './toolButtonStyles'
import type { TreeViewProps } from './treeFrame'

export interface ResultViewerItem {
  label: string
  value: string
  /** Если задан — вместо текста показывается интерактивное дерево. */
  Tree?: ComponentType<TreeViewProps>
  treeData?: unknown
}

interface Props {
  item: ResultViewerItem
  onClose: () => void
}

/** Полноэкранный просмотр одного результата: текст или дерево, копирование, перенос строк. */
export function ResultViewer({ item, onClose }: Props) {
  const { t } = useTranslation()
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()

    // На document, а не window: срабатывает раньше глобального Esc «свернуть»,
    // а preventDefault говорит ему, что клавиша уже обработана.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  const handleCopy = async () => {
    if (await copyToClipboard(item.value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const { Tree } = item

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
      className="fixed inset-0 z-50 flex bg-[#09090b]/80 p-2 backdrop-blur-sm sm:p-4 motion-safe:animate-viewer-backdrop"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl motion-safe:animate-viewer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h2 className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-accent">{item.label}</h2>
          {!Tree && (
            <button type="button" onClick={() => setWrap((v) => !v)} aria-pressed={wrap} className={wrap ? buttonActive : buttonIdle}>
              {t('resultViewer.wrap')}
            </button>
          )}
          {item.value && (
            <button type="button" onClick={() => void handleCopy()} disabled={copied} className={copied ? buttonActive : buttonIdle}>
              {copied ? t('resultTile.copied') : t('resultTile.copy')}
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('resultViewer.close')}
            title={`${t('resultViewer.close')} (Esc)`}
            className={iconButtonIdle}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#09090b] p-4 scrollbar-thin">
          {Tree ? (
            <Tree data={item.treeData} size="fill" />
          ) : (
            <pre
              data-testid="result-viewer-text"
              className={`font-mono text-xs leading-relaxed text-text ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
            >
              {item.value}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
