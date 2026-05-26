import { Component, type ReactNode } from 'react'
import { useStore } from './store/useStore'
import { SmartInput } from './components/SmartInput'
import { DetectionBadge } from './components/DetectionBadge'
import { ResultTiles } from './components/ResultTiles'
import { ExpandedSection } from './components/ExpandedSection'
import { BottomCarousel } from './components/BottomCarousel'
import { FullCatalog } from './components/FullCatalog'
import { Toast } from './components/Toast'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
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
              Попробовать снова
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#09090b] flex flex-col">
        <div className="flex-1 flex flex-col items-center pt-16 pb-4 px-4 overflow-y-auto">
          <div className="mb-5">
            <h1 className="font-mono text-2xl font-bold">
              <span className="text-accent">txt</span>
              <span className="text-muted">kit</span>
            </h1>
          </div>

          <SmartInput />
          <DetectionBadge />
          <ResultTiles />
          <ExpandedSection />
        </div>

        <BottomCarousel />
        <FullCatalog />
        <Toast />
      </div>
    </ErrorBoundary>
  )
}

export default App
