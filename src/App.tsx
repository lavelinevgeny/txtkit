import { Component, type ReactNode } from 'react'
import { I18nProvider, useTranslation } from './i18n/context'
import { useStore } from './store/useStore'
import { SmartInput } from './components/SmartInput'
import { DetectionBadge } from './components/DetectionBadge'
import { ResultTiles } from './components/ResultTiles'
import { BottomCarousel } from './components/BottomCarousel'
import { FullCatalog } from './components/FullCatalog'

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

  return (
    <ErrorBoundary t={t}>
      <div className="min-h-screen bg-[#09090b] flex flex-col">
        <div className="flex-1 flex flex-col items-center pt-16 pb-4 px-4 overflow-y-auto">
          <div className="mb-5 flex items-center gap-2">
            <h1 className="font-mono text-2xl font-bold">
              <span className="text-accent">txt</span>
              <span className="text-muted">kit</span>
            </h1>
            <LocaleToggle />
          </div>

          <SmartInput />
          <DetectionBadge />
          <ResultTiles />
        </div>

        <BottomCarousel />
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
