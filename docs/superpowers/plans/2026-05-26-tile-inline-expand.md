# Inline Expand для ResultTile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить мгновенное копирование по клику на inline-раскрытие плитки с предпросмотром полного значения и явной кнопкой «Скопировать».

**Architecture:** ResultTiles управляет состоянием `expandedId` (какая плитка раскрыта). ResultTile получает `isExpanded` + `onToggle` и рендерит либо обычный, либо раскрытый вид. Toast и toast-механизм в store удаляются.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Zustand, Vitest

---

### Task 1: Удалить Toast и toast-механизм из store

**Files:**
- Delete: `src/components/Toast.tsx`
- Modify: `src/store/useStore.ts:1-30`
- Modify: `src/App.tsx:9,58`

- [ ] **Step 1: Удалить Toast.tsx**

```bash
rm src/components/Toast.tsx
```

- [ ] **Step 2: Почистить useStore.ts — убрать toast, showToast, clearToast**

Итоговый файл `src/store/useStore.ts`:

```typescript
import { create } from 'zustand'

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
}))
```

- [ ] **Step 3: Убрать Toast из App.tsx**

Удалить строку импорта `import { Toast } from './components/Toast'` и `<Toast />` из рендера.

Итоговый `src/App.tsx`:

```tsx
import { Component, type ReactNode } from 'react'
import { useStore } from './store/useStore'
import { SmartInput } from './components/SmartInput'
import { DetectionBadge } from './components/DetectionBadge'
import { ResultTiles } from './components/ResultTiles'
import { ExpandedSection } from './components/ExpandedSection'
import { BottomCarousel } from './components/BottomCarousel'
import { FullCatalog } from './components/FullCatalog'

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
      </div>
    </ErrorBoundary>
  )
}

export default App
```

- [ ] **Step 4: Проверить сборку**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Запустить существующие тесты**

Run: `npx vitest run`
Expected: все тесты проходят (тесты инструментов не затронуты)

- [ ] **Step 6: Коммит**

```bash
git add -A && git commit -m "refactor: remove Toast component and toast state from store"
```

---

### Task 2: Переработать ResultTiles — управление состоянием раскрытия

**Files:**
- Modify: `src/components/ResultTiles.tsx:1-70`

- [ ] **Step 1: Переписать ResultTiles с expandedId**

ResultTiles хранит `expandedId: string | null` — ключ вида `toolId-label`. Передаёт в ResultTile props `isExpanded` и `onToggle`. При изменении `input` — сбрасывает `expandedId` в `null`.

Итоговый `src/components/ResultTiles.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { ResultTile } from './ResultTile'

const INITIAL_LIMIT = 8

export function ResultTiles() {
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const [expanded, setExpanded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const allResults = useMemo(() => {
    if (!input.trim()) return []
    const tools = getAllTools()
    const results: Array<{ toolId: string; toolName: string; result: { label: string; value: string } }> = []
    for (const tool of tools) {
      const toolResults = tool.transform(input)
      for (const r of toolResults) {
        results.push({ toolId: tool.id, toolName: tool.name, result: r })
      }
    }
    return results
  }, [input])

  useMemo(() => detectInputTypes(input), [input])

  useEffect(() => {
    setExpandedId(null)
  }, [input])

  const filteredResults = activeToolId
    ? allResults.filter(r => r.toolId === activeToolId)
    : allResults

  if (!input.trim() || filteredResults.length === 0) return null

  const visibleResults = expanded || activeToolId
    ? filteredResults
    : filteredResults.slice(0, INITIAL_LIMIT)

  const hasMore = !activeToolId && !expanded && filteredResults.length > INITIAL_LIMIT

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      <div className="grid grid-cols-2 gap-1.5">
        {visibleResults.map((r, i) => {
          const tileId = `${r.toolId}-${r.result.label}`
          return (
            <ResultTile
              key={tileId}
              result={r.result}
              accent={i < 4 && !activeToolId}
              isExpanded={expandedId === tileId}
              onToggle={() => handleToggle(tileId)}
            />
          )
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-2 py-2 text-xs text-muted hover:text-accent transition-colors"
        >
          Показать все ({filteredResults.length})
        </button>
      )}
      {expanded && !activeToolId && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full mt-2 py-2 text-xs text-muted hover:text-accent transition-colors"
        >
          Свернуть
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Проверить TypeScript**

Run: `npx tsc --noEmit`
Expected: может быть ошибки в ResultTile (пока старый интерфейс props) — это ок, исправим в Task 3

- [ ] **Step 3: Коммит**

```bash
git add -A && git commit -m "refactor: ResultTiles manages expandedId state for inline expand"
```

---

### Task 3: Переработать ResultTile — раскрытие и кнопка копирования

**Files:**
- Modify: `src/components/ResultTile.tsx:1-30`

- [ ] **Step 1: Переписать ResultTile с двумя состояниями (обычное / раскрытое)**

Итоговый `src/components/ResultTile.tsx`:

```tsx
import { useState } from 'react'
import type { TransformResult } from '../types/tool'
import { copyToClipboard } from '../utils/clipboard'

interface Props {
  result: TransformResult
  accent?: boolean
  isExpanded: boolean
  onToggle: () => void
}

export function ResultTile({ result, accent, isExpanded, onToggle }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(result.value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-colors w-full"
      >
        <div className="text-[9px] text-muted">{result.label}</div>
        <div className={`font-mono text-xs truncate ${accent ? 'text-accent' : 'text-text'}`}>
          {result.value}
        </div>
      </button>
    )
  }

  return (
    <div
      className="bg-surface border border-accent rounded-lg px-3 py-2 col-span-2 transition-colors"
    >
      <div className="text-[9px] text-accent font-medium mb-1">{result.label}</div>
      <div className="font-mono text-xs text-text break-all max-h-32 overflow-y-auto scrollbar-thin">
        {result.value}
      </div>
      {result.value && (
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCopy}
            disabled={copied}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              copied
                ? 'bg-emerald-400/20 text-emerald-400'
                : 'bg-accent text-zinc-900 hover:bg-accent/90'
            }`}
          >
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Добавить кастомный scrollbar в index.css**

Проверить есть ли в `src/index.css` класс `.scrollbar-thin`. Если нет — добавить в конец файла после Tailwind директив:

```css
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 2px;
}
```

- [ ] **Step 3: Проверить TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Запустить все тесты**

Run: `npx vitest run`
Expected: все тесты проходят

- [ ] **Step 5: Ручная проверка в браузере**

Run: `npm run dev`

Проверить:
1. Клик по плитке → раскрывается на всю ширину, показывает полное значение
2. Повторный клик → сворачивается обратно
3. Клик по другой плитке → текущая сворачивается, новая раскрывается
4. Кнопка «Скопировать» → копирует в буфер, меняется на «✓ Скопировано» на 1.5с
5. Изменение текста в поле → раскрытая плитка сворачивается
6. Длинные значения (Base64) → прокрутка в раскрытой плитке
7. Пустое значение → кнопка «Скопировать» не показывается

- [ ] **Step 6: Коммит**

```bash
git add -A && git commit -m "feat: inline expand for result tiles with explicit copy button"
```

---

### Task 4: Полировка — анимация раскрытия и финальная проверка

**Files:**
- Modify: `src/components/ResultTile.tsx` (добавить transition)

- [ ] **Step 1: Добавить плавную анимацию при раскрытии**

Обновить раскрытое состояние ResultTile — добавить `transition-all` и анимацию появления. Обычная плитка уже имеет `transition-colors`.

В `ResultTile.tsx` обновить обычное состояние — добавить `transition-all`:

```tsx
<button
  onClick={onToggle}
  className="bg-surface border border-border rounded-lg px-3 py-2 text-left hover:border-accent/30 transition-all w-full"
>
```

Раскрытое состояние — добавить `transition-all`:

```tsx
<div
  className="bg-surface border border-accent rounded-lg px-3 py-2 col-span-2 transition-all"
>
```

- [ ] **Step 2: Проверить TypeScript и тесты**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, все тесты проходят

- [ ] **Step 3: Финальная ручная проверка**

Run: `npm run dev`

Проверить все сценарии из Task 3 + плавность анимации.

- [ ] **Step 4: Коммит**

```bash
git add -A && git commit -m "style: smooth transitions for tile expand/collapse"
```
