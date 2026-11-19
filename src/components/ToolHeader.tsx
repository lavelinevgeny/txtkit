import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { useTranslation } from '../i18n/context'
import { buttonIdle, iconButtonActive, iconButtonIdle } from './toolButtonStyles'
import {
  MAXIMIZE_SHORTCUT,
  isBrowserFullscreenSupported,
  toggleBrowserFullscreen,
  toggleMaximized,
  useIsBrowserFullscreen,
} from './maximize'

const ICON_PATHS = {
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  restore: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  fullscreen: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
  exitFullscreen: 'M20 10h-6V4M14 10l6-6M4 14h6v6M10 14l-6 6',
} as const

export function FrameIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

const subtleIconButton =
  'inline-flex items-center justify-center rounded-md p-1 text-muted transition-colors hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30'

/** subtle — без рамки, для строки с логотипом рядом с переключателем языка. */
export function MaximizeButton({ subtle = false }: { subtle?: boolean }) {
  const { t } = useTranslation()
  const maximized = useStore((s) => s.maximized)
  const label = maximized ? t('toolFrame.restore') : t('toolFrame.maximize')
  return (
    <button
      type="button"
      onClick={toggleMaximized}
      aria-label={label}
      aria-pressed={maximized}
      aria-keyshortcuts={MAXIMIZE_SHORTCUT}
      title={`${label} (${MAXIMIZE_SHORTCUT})`}
      className={subtle ? subtleIconButton : maximized ? iconButtonActive : iconButtonIdle}
    >
      <FrameIcon name={maximized ? 'restore' : 'maximize'} />
    </button>
  )
}

function FrameControls() {
  const { t } = useTranslation()
  const maximized = useStore((s) => s.maximized)
  const browserFullscreen = useIsBrowserFullscreen()
  const fullscreenLabel = browserFullscreen ? t('toolFrame.exitFullscreen') : t('toolFrame.fullscreen')

  return (
    <div className="flex items-center gap-1.5 border-l border-border pl-1.5">
      {maximized && isBrowserFullscreenSupported() && (
        <button
          type="button"
          onClick={toggleBrowserFullscreen}
          aria-label={fullscreenLabel}
          aria-pressed={browserFullscreen}
          title={fullscreenLabel}
          className={browserFullscreen ? iconButtonActive : iconButtonIdle}
        >
          <FrameIcon name={browserFullscreen ? 'exitFullscreen' : 'fullscreen'} />
        </button>
      )}
      <MaximizeButton />
    </div>
  )
}

interface ToolHeaderProps {
  icon: string
  title: string
  /** Кнопка «← к инструментам»; в авто-режиме возвращаться некуда. */
  showBack?: boolean
  /** Кнопки конкретного инструмента; рамочные кнопки всегда добавляются справа. */
  children?: ReactNode
}

export function ToolHeader({ icon, title, showBack = true, children }: ToolHeaderProps) {
  const { t } = useTranslation()
  const setActiveToolId = useStore((s) => s.setActiveToolId)

  return (
    <header
      data-testid="tool-header"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 [view-transition-name:tool-header]"
    >
      <div className="flex min-w-0 items-center gap-2">
        {showBack && (
          <button type="button" onClick={() => setActiveToolId(null)} className={buttonIdle}>
            {t('toolFrame.backToTools')}
          </button>
        )}
        <span className="font-mono text-base leading-none text-accent">{icon}</span>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {children}
        <FrameControls />
      </div>
    </header>
  )
}
