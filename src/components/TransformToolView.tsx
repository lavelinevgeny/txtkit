import { useRef, type CSSProperties } from 'react'
import type { ToolDescriptor } from '../types/tool'
import { useStore } from '../store/useStore'
import { useTranslation } from '../i18n/context'
import { DetectionBadge } from './DetectionBadge'
import { ResultTiles } from './ResultTiles'
import { SmartInput } from './SmartInput'
import { ToolHeader } from './ToolHeader'
import { buttonIdle } from './toolButtonStyles'
import { PaneSplitter } from './PaneSplitter'
import { useSplitRatio, type SplitBounds } from './useSplitRatio'

const SPLIT_STORAGE_KEY = 'txtkit.transformWorkspace.leftWidthRatio'
const SPLIT_BOUNDS: SplitBounds = { min: 0.2, max: 0.75, fallback: 0.4 }

interface Props {
  /** null — авто-режим: результаты всех подходящих инструментов. */
  tool: ToolDescriptor | null
  maximized: boolean
}

/**
 * Ввод + плитки результатов: выбранный инструмент или авто-режим.
 * Обычный режим — узкая колонка (у выбранного инструмента — с шапкой).
 * Развёрнутый — рабочее пространство: ввод слева на всю высоту, результаты справа.
 */
export function TransformToolView({ tool, maximized }: Props) {
  const { t } = useTranslation()
  const setCatalogOpen = useStore((s) => s.setCatalogOpen)
  const hasInput = useStore((s) => s.input.trim().length > 0)
  const panesRef = useRef<HTMLDivElement>(null)
  const [leftRatio, setLeftRatio] = useSplitRatio(SPLIT_STORAGE_KEY, SPLIT_BOUNDS)

  if (!maximized) {
    return (
      <>
        {tool && (
          <div className="w-full max-w-xl mx-auto mb-3">
            <ToolHeader icon={tool.icon} title={tool.name} />
          </div>
        )}
        <SmartInput />
        <DetectionBadge />
        <ResultTiles />
      </>
    )
  }

  return (
    <div data-testid="transform-workspace" className="flex w-full flex-1 min-h-0 flex-col gap-2">
      {tool ? (
        <ToolHeader icon={tool.icon} title={tool.name} />
      ) : (
        <ToolHeader icon="✦" title={t('toolFrame.autoTitle')} showBack={false}>
          {/* Карусель в развёрнутом режиме скрыта — каталог остаётся доступен отсюда. */}
          <button type="button" onClick={() => setCatalogOpen(true)} className={buttonIdle}>
            ⊞ {t('toolFrame.allTools')}
          </button>
        </ToolHeader>
      )}
      {/* На lg+ — три колонки: ввод | разделитель | результаты; ниже — панели друг под другом. */}
      <div
        ref={panesRef}
        data-testid="transform-panes"
        style={{ '--left-pane': `${leftRatio * 100}%` } as CSSProperties}
        className="grid flex-1 min-h-0 grid-cols-1 gap-2 overflow-y-auto lg:grid-cols-[minmax(0,var(--left-pane))_auto_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden"
      >
        <section className="h-[40dvh] min-h-[160px] lg:h-auto lg:min-h-0">
          <SmartInput fill />
        </section>
        <PaneSplitter
          containerRef={panesRef}
          ratio={leftRatio}
          bounds={SPLIT_BOUNDS}
          label={t('toolFrame.resizePanes')}
          onChange={setLeftRatio}
          className="hidden lg:flex"
        />
        <section className="flex min-h-0 flex-col lg:overflow-y-auto scrollbar-thin lg:pr-1">
          {hasInput ? (
            <>
              <DetectionBadge />
              <div className="mt-2">
                <ResultTiles wide />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
              {t('toolFrame.resultsEmpty')}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
