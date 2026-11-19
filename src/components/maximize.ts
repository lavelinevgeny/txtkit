import { useEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { useStore } from '../store/useStore'

export const MAXIMIZE_SHORTCUT = 'Alt+Shift+F'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Применяет изменение раскладки через View Transitions API, чтобы шапка
 * инструмента плавно «переехала», а логотип и карусель ушли с анимацией.
 * Без поддержки API (или при reduced motion) изменение применяется сразу.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    update()
    return
  }
  document.startViewTransition(() => flushSync(update))
}

export function setMaximizedAnimated(next: boolean): void {
  const { maximized, setMaximized } = useStore.getState()
  if (maximized === next) return
  if (!next && document.fullscreenElement) exitBrowserFullscreen()
  withViewTransition(() => setMaximized(next))
}

export function toggleMaximized(): void {
  setMaximizedAnimated(!useStore.getState().maximized)
}

// --- Browser Fullscreen API ---------------------------------------------------

export function isBrowserFullscreenSupported(): boolean {
  return document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function'
}

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

export function useIsBrowserFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement != null, () => false)
}

function exitBrowserFullscreen(): void {
  document.exitFullscreen().catch(() => undefined)
}

export function toggleBrowserFullscreen(): void {
  if (document.fullscreenElement) {
    exitBrowserFullscreen()
    return
  }
  document.documentElement.requestFullscreen().catch(() => undefined)
}

// --- Keyboard -----------------------------------------------------------------

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null
}

/**
 * Alt+Shift+F — развернуть/свернуть рабочую область (в духе Alt+Shift-хоткеев Text Pad).
 * Esc — свернуть, если клавишу не обработал кто-то раньше (поиск, меню, просмотрщик)
 * и фокус не в поле ввода/редакторе.
 */
export function useMaximizeShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyF') {
        event.preventDefault()
        toggleMaximized()
        return
      }
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        useStore.getState().maximized &&
        !useStore.getState().catalogOpen &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        setMaximizedAnimated(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
