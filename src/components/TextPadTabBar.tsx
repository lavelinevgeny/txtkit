import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '../i18n/context'
import { useTextPadStore } from '../tools/text-pad/useTextPadStore'
import { normalizeVisibleTabIds, promoteOverflowTab } from './textPadTabOverflow'

interface TextPadTabBarProps {
  onNewTab: () => void
  onCloseTab: (id: string) => void
  onSelectTab: (id: string) => void
}

function haveSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function TextPadTabBar({
  onNewTab,
  onCloseTab,
  onSelectTab,
}: TextPadTabBarProps) {
  const openTabIds = useTextPadStore((state) => state.openTabIds)
  const tabsById = useTextPadStore((state) => state.tabsById)
  const activeTabId = useTextPadStore((state) => state.activeTabId)
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)
  const moreTabsButtonRef = useRef<HTMLButtonElement>(null)
  const overflowPopupRef = useRef<HTMLDivElement>(null)
  const overflowPopupId = useId()
  const [capacity, setCapacity] = useState(1)
  const [visibleTabIds, setVisibleTabIds] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  // Normalize during render too, so an externally selected hidden tab is never
  // briefly rendered outside the visible portion while the effect catches up.
  const displayedVisibleTabIds = normalizeVisibleTabIds(
    openTabIds,
    visibleTabIds,
    capacity,
    activeTabId,
  )

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return undefined

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setCapacity(Math.max(1, Math.floor((entry.contentRect.width - 96) / 112)))
    })
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // The visible list is derived display state; preserve its identity when unchanged.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleTabIds((ids) => haveSameIds(ids, displayedVisibleTabIds) ? ids : displayedVisibleTabIds)
  }, [displayedVisibleTabIds])

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        moreTabsButtonRef.current?.focus()
      }
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        moreTabsButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    overflowPopupRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [menuOpen])

  const hiddenTabIds = openTabIds.filter((id) => !displayedVisibleTabIds.includes(id))

  const selectOverflowTab = (id: string) => {
    setVisibleTabIds((ids) => promoteOverflowTab(ids, id))
    onSelectTab(id)
    setMenuOpen(false)
  }

  const closeOverflowTab = (id: string) => {
    onCloseTab(id)
    setMenuOpen(false)
  }

  return (
    <div
      ref={barRef}
      className="relative flex min-w-0 items-center rounded-t-lg border border-border border-b-0 bg-surface"
      data-testid="text-pad-tab-bar"
    >
      <div className="flex min-w-0 flex-1">
        {displayedVisibleTabIds.map((id) => {
          const tab = tabsById[id]
          const isActive = id === activeTabId

          return (
            <div key={id} className="flex w-28 shrink-0 border-r border-border last:border-r-0">
              <button
                data-tab-id={id}
                data-active={isActive ? 'true' : undefined}
                onClick={() => onSelectTab(id)}
                className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${isActive ? 'border-b-2 border-accent text-foreground' : 'text-muted hover:bg-surface-hover'}`}
                title={tab?.title ?? ''}
              >
                <span className="block truncate">{tab?.title ?? id}</span>
              </button>
              <button
                className="shrink-0 px-2 text-muted hover:text-foreground"
                data-testid={`close-tab-${id}`}
                onClick={() => onCloseTab(id)}
                title={t('textPad.tabs.closeTab')}
                aria-label={t('textPad.tabs.closeTab')}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      {hiddenTabIds.length > 0 && (
        <div className="relative shrink-0">
          <button
            ref={moreTabsButtonRef}
            className="px-3 py-2 text-muted hover:text-foreground"
            onClick={() => setMenuOpen((open) => !open)}
            aria-controls={overflowPopupId}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label={t('textPad.tabs.moreTabs')}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              ref={overflowPopupRef}
              id={overflowPopupId}
              role="dialog"
              aria-label={t('textPad.tabs.moreTabs')}
              className="absolute right-0 z-10 mt-1 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
            >
              {hiddenTabIds.map((id) => {
                const title = tabsById[id]?.title ?? id
                return (
                  <div key={id} className="flex items-center">
                    <button
                      className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
                      onClick={() => selectOverflowTab(id)}
                    >
                      {title}
                    </button>
                    <button
                      className="shrink-0 rounded px-2 py-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
                      onClick={() => closeOverflowTab(id)}
                      aria-label={t('textPad.tabs.closeTabFromMenu', { title })}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <button
        className="shrink-0 px-3 py-2 text-muted hover:text-foreground"
        onClick={onNewTab}
        title={t('textPad.tabs.newTab')}
        aria-label={t('textPad.tabs.newTab')}
      >
        +
      </button>
    </div>
  )
}
