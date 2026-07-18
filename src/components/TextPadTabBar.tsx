import { useTranslation } from '../i18n/context'
import { useTextPadStore } from '../tools/text-pad/useTextPadStore'

interface TextPadTabBarProps {
  onNewTab: () => void
  onCloseTab: (id: string) => void
  onSelectTab: (id: string) => void
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

  return (
    <div className="tabBar" data-testid="text-pad-tab-bar">
      <div
        className="tabScroller"
        style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}
      >
        {openTabIds.map((id) => {
          const tab = tabsById[id]
          const isActive = id === activeTabId

          return (
            <div key={id} className="tabItem">
              <button
                data-tab-id={id}
                data-active={isActive ? 'true' : undefined}
                onClick={() => onSelectTab(id)}
                className={`tabButton ${isActive ? 'tabActive' : 'tabIdle'}`}
                title={tab?.title ?? ''}
              >
                <span className="tabLabel">{tab?.title ?? id}</span>
              </button>
              <button
                className="tabClose"
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
      <button
        className="newTabButton"
        onClick={onNewTab}
        title={t('textPad.tabs.newTab')}
        aria-label={t('textPad.tabs.newTab')}
      >
        +
      </button>
    </div>
  )
}
