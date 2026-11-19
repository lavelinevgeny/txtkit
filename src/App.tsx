import { Component, type ReactNode } from 'react'
import { I18nProvider, useTranslation } from './i18n/context'
import { useStore } from './store/useStore'
import { BottomCarousel } from './components/BottomCarousel'
import { CustomViewHost } from './components/CustomViewHost'
import { FullCatalog } from './components/FullCatalog'
import { TransformToolView } from './components/TransformToolView'
import { MaximizeButton } from './components/ToolHeader'
import { useMaximizeShortcuts } from './components/maximize'
import { getToolById } from './tools/registry'

function LocaleToggle() {
  const locale = useStore(s => s.locale)
  const setLocale = useStore(s => s.setLocale)
  return (
    <button
      onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
      className="font-mono text-[10px] text-muted hover:text-accent transition-colors"
    >
      {locale === 'ru' ? 'EN' : 'RU'}
    </button>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode; t: (key: string) => string }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' }

  static getDerivedStateFromError(e: Error) {
    return { hasError: true, error: e.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-red-400 text-sm font-mono mb-2">Error: {this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="text-xs text-muted hover:text-accent"
            >
              {this.props.t('errorBoundary.retry')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const { t } = useTranslation()
  const activeToolId = useStore(s => s.activeToolId)
  const activeTool = activeToolId ? getToolById(activeToolId) : null
  const isMaximized = useStore(s => s.maximized)
  const isCustomView = activeTool?.view === 'custom'
  useMaximizeShortcuts()

  const contentClassName = isMaximized
    ? 'flex-1 flex flex-col items-center p-2 sm:p-3 overflow-y-auto min-h-0'
    : isCustomView
      ? 'flex-1 flex flex-col items-center pt-5 pb-3 px-3 lg:px-6 overflow-y-auto min-h-0'
      : 'flex-1 flex flex-col items-center pt-16 pb-4 px-4 overflow-y-auto min-h-0'

  return (
    <ErrorBoundary t={t}>
      <div className="h-dvh bg-[#09090b] flex flex-col overflow-hidden">
        <div className={contentClassName}>
          {!isMaximized && (
            <div className={`${isCustomView ? 'mb-3' : 'mb-5'} flex items-center gap-2 [view-transition-name:app-brand]`}>
              <h1 className="font-mono text-2xl font-bold">
                <span className="text-accent">txt</span>
                <span className="text-muted">kit</span>
              </h1>
              <LocaleToggle />
              {!activeTool && <MaximizeButton subtle />}
            </div>
          )}

          {isCustomView && activeToolId ? (
            <CustomViewHost toolId={activeToolId} />
          ) : (
            <TransformToolView tool={activeTool ?? null} maximized={isMaximized} />
          )}
        </div>

        {!isMaximized && <BottomCarousel />}
        <FullCatalog />
      </div>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  )
}

export default App
