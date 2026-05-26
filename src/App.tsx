import { useStore } from './store/useStore'
import { SmartInput } from './components/SmartInput'
import { DetectionBadge } from './components/DetectionBadge'
import { ResultTiles } from './components/ResultTiles'
import { ExpandedSection } from './components/ExpandedSection'
import { BottomCarousel } from './components/BottomCarousel'
import { FullCatalog } from './components/FullCatalog'
import { Toast } from './components/Toast'

function App() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <div className="flex-1 flex flex-col items-center pt-16 pb-4 px-4">
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
  )
}

export default App
