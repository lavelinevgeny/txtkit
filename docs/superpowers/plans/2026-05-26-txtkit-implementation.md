# txtkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build txtkit — a smart text processing web tool with an intelligent input field that auto-detects text type and shows contextual action tiles.

**Architecture:** React SPA with Tool Registry pattern. Each tool is a self-contained module implementing a `ToolDescriptor` interface. A Zustand store manages global state (input text, active tool, catalog visibility). Detection logic runs on every input change and identifies text patterns with confidence scores. UI is a single centered layout with smart input, result tiles, bottom carousel, and fullscreen catalog overlay.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS 4, Zustand, Vitest + @testing-library/react

---

## File Structure

```
txtkit/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── docs/
│   └── design.md
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                          — Tailwind directives + custom properties + fonts
│   ├── types/
│   │   └── tool.ts                        — ToolDescriptor, TransformResult, DetectionResult, Category
│   ├── store/
│   │   └── useStore.ts                    — Zustand store
│   ├── tools/
│   │   ├── registry.ts                    — getAllTools(), getToolsByCategory(), detectTypes()
│   │   ├── detect.ts                      — detectInputType() — returns DetectionResult[]
│   │   ├── case.ts                        — Case converter (17 formats)
│   │   ├── stats.ts                       — Text statistics (8 metrics)
│   │   ├── transforms.ts                  — Text transforms (10 operations)
│   │   └── encode.ts                      — Encoders (4 encode/decode pairs)
│   ├── components/
│   │   ├── SmartInput.tsx                 — Auto-expanding textarea
│   │   ├── DetectionBadge.tsx             — Detection result pill
│   │   ├── ResultTiles.tsx                — Grid of result tiles
│   │   ├── ResultTile.tsx                 — Single result tile
│   │   ├── ExpandedSection.tsx            — Expanded tool panel
│   │   ├── BottomCarousel.tsx             — Bottom bar with tool icons
│   │   ├── FullCatalog.tsx                — Fullscreen catalog overlay
│   │   ├── CatalogCard.tsx                — Single catalog card
│   │   └── Toast.tsx                      — Copy notification
│   └── utils/
│       └── clipboard.ts                   — copyToClipboard()
└── tests/
    ├── detect.test.ts
    ├── case.test.ts
    ├── stats.test.ts
    ├── transforms.test.ts
    ├── encode.test.ts
    └── registry.test.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.ts`, `postcss.config.js`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Initialize Vite project**

```bash
cd /home/evgeny/projects/txtkit
npm create vite@latest . -- --template react-ts
```

If prompted about existing files, choose to overwrite/ignore.

- [ ] **Step 2: Install dependencies**

```bash
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Vite with Tailwind and Vitest**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Configure TypeScript for Vitest**

In `tsconfig.app.json`, add to `compilerOptions`:

```json
"types": ["vitest/globals"]
```

- [ ] **Step 6: Replace src/index.css with Tailwind + custom properties**

```css
@import "tailwindcss";

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

@theme {
  --color-surface: #18181b;
  --color-surface-dim: #111113;
  --color-border: #27272a;
  --color-border-dim: #1f1f22;
  --color-muted: #71717a;
  --color-muted-dim: #52525b;
  --color-text: #e4e4e7;
  --color-text-dim: #a1a1aa;
  --color-accent: #e8a030;
  --color-success: #34d399;
  --color-info: #60a5fa;
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Space Grotesk', sans-serif;
}

body {
  font-family: var(--font-sans);
  background-color: #09090b;
  color: var(--color-text);
}

::selection {
  background-color: rgba(232, 160, 48, 0.3);
}
```

- [ ] **Step 7: Create minimal App.tsx**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <h1 className="font-mono text-2xl font-bold">
        <span className="text-accent">txt</span>
        <span className="text-muted">kit</span>
      </h1>
    </div>
  )
}

export default App
```

- [ ] **Step 8: Update src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Add scripts to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 10: Verify everything works**

```bash
npm run dev
npm run test
```

Expected: dev server starts, no errors in console. Test runs with no tests found (or passes).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold project with Vite, React, TS, Tailwind, Vitest"
```

---

### Task 2: Types

**Files:**
- Create: `src/types/tool.ts`

- [ ] **Step 1: Write the types file**

Create `src/types/tool.ts`:

```typescript
export type Category = 'transform' | 'analysis' | 'encoding' | 'dev'

export interface TransformResult {
  label: string
  value: string
}

export interface DetectionResult {
  type: string
  label: string
  confidence: number
}

export interface ToolDescriptor {
  id: string
  name: string
  icon: string
  category: Category
  description: string
  detect?: (input: string) => DetectionResult | null
  transform: (input: string) => TransformResult[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/tool.ts
git commit -m "feat: add core type definitions"
```

---

### Task 3: Detection Logic

**Files:**
- Create: `src/tools/detect.ts`, `tests/detect.test.ts`

- [ ] **Step 1: Write failing tests for detection**

Create `tests/detect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectInputTypes } from '../src/tools/detect'

describe('detectInputTypes', () => {
  it('detects Base64', () => {
    const results = detectInputTypes('SGVsbG8gV29ybGQ=')
    const b64 = results.find(r => r.type === 'base64')
    expect(b64).toBeDefined()
    expect(b64!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('detects URL-encoded text', () => {
    const results = detectInputTypes('hello%20world%21')
    const url = results.find(r => r.type === 'url-encoded')
    expect(url).toBeDefined()
  })

  it('detects HTML entities', () => {
    const results = detectInputTypes('&lt;div&gt;hello&lt;/div&gt;')
    const html = results.find(r => r.type === 'html-entities')
    expect(html).toBeDefined()
  })

  it('detects JSON object', () => {
    const results = detectInputTypes('{"name":"John","age":30}')
    const json = results.find(r => r.type === 'json')
    expect(json).toBeDefined()
  })

  it('detects JSON array', () => {
    const results = detectInputTypes('[1,2,3]')
    const json = results.find(r => r.type === 'json')
    expect(json).toBeDefined()
  })

  it('detects camelCase', () => {
    const results = detectInputTypes('helloWorldExample')
    const camel = results.find(r => r.type === 'camelCase')
    expect(camel).toBeDefined()
  })

  it('detects PascalCase', () => {
    const results = detectInputTypes('HelloWorldExample')
    const pascal = results.find(r => r.type === 'PascalCase')
    expect(pascal).toBeDefined()
  })

  it('detects snake_case', () => {
    const results = detectInputTypes('hello_world_example')
    const snake = results.find(r => r.type === 'snake_case')
    expect(snake).toBeDefined()
  })

  it('detects kebab-case', () => {
    const results = detectInputTypes('hello-world-example')
    const kebab = results.find(r => r.type === 'kebab-case')
    expect(kebab).toBeDefined()
  })

  it('detects multi-word space-separated', () => {
    const results = detectInputTypes('hello world example')
    const multi = results.find(r => r.type === 'multi-word')
    expect(multi).toBeDefined()
  })

  it('detects single word as fallback', () => {
    const results = detectInputTypes('hello')
    const single = results.find(r => r.type === 'single-word')
    expect(single).toBeDefined()
  })

  it('returns results sorted by confidence descending', () => {
    const results = detectInputTypes('SGVsbG8gV29ybGQ=')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence)
    }
  })

  it('returns multi-detection for ambiguous input', () => {
    const results = detectInputTypes('hello_world example')
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('returns empty array for empty input', () => {
    const results = detectInputTypes('')
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/detect.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement detection logic**

Create `src/tools/detect.ts`:

```typescript
import type { DetectionResult } from '../types/tool'

const detectors: Array<{
  type: string
  label: string
  detect: (input: string) => DetectionResult | null
}> = [
  {
    type: 'base64',
    label: 'Base64',
    detect: (input) => {
      const re = /^[A-Za-z0-9+/]+=*$/
      if (!re.test(input)) return null
      if (input.length < 4) return null
      try {
        const decoded = atob(input)
        const reEncoded = btoa(decoded)
        if (reEncoded !== input.replace(/=+$/, '') && btoa(decoded) !== input) {
          return null
        }
        return { type: 'base64', label: 'Base64', confidence: 0.9 }
      } catch {
        return null
      }
    },
  },
  {
    type: 'url-encoded',
    label: 'URL-encoded',
    detect: (input) => {
      const re = /%[0-9A-Fa-f]{2}/
      if (!re.test(input)) return null
      const count = (input.match(/%[0-9A-Fa-f]{2}/g) || []).length
      const confidence = Math.min(0.5 + count * 0.1, 0.95)
      return { type: 'url-encoded', label: 'URL-encoded', confidence }
    },
  },
  {
    type: 'html-entities',
    label: 'HTML entities',
    detect: (input) => {
      const re = /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/
      if (!re.test(input)) return null
      const count = (input.match(/&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g) || []).length
      const confidence = Math.min(0.6 + count * 0.1, 0.95)
      return { type: 'html-entities', label: 'HTML entities', confidence }
    },
  },
  {
    type: 'json',
    label: 'JSON',
    detect: (input) => {
      const trimmed = input.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed)
          return { type: 'json', label: 'JSON', confidence: 0.95 }
        } catch {
          return null
        }
      }
      return null
    },
  },
  {
    type: 'camelCase',
    label: 'camelCase',
    detect: (input) => {
      if (/[a-z][A-Z]/.test(input) && !input.includes(' ') && !input.includes('_') && !input.includes('-')) {
        return { type: 'camelCase', label: 'camelCase', confidence: 0.8 }
      }
      return null
    },
  },
  {
    type: 'PascalCase',
    label: 'PascalCase',
    detect: (input) => {
      if (/^[A-Z][a-zA-Z]*$/.test(input) && /[a-z][A-Z]/.test(input) && !input.includes(' ') && !input.includes('_') && !input.includes('-')) {
        return { type: 'PascalCase', label: 'PascalCase', confidence: 0.8 }
      }
      return null
    },
  },
  {
    type: 'snake_case',
    label: 'snake_case',
    detect: (input) => {
      if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(input)) {
        return { type: 'snake_case', label: 'snake_case', confidence: 0.85 }
      }
      return null
    },
  },
  {
    type: 'kebab-case',
    label: 'kebab-case',
    detect: (input) => {
      if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(input)) {
        return { type: 'kebab-case', label: 'kebab-case', confidence: 0.85 }
      }
      return null
    },
  },
  {
    type: 'multi-word',
    label: (input: string) => {
      const words = input.split(/\s+/).filter(Boolean)
      return `${words.length} ${words.length === 1 ? 'слово' : words.length < 5 ? 'слова' : 'слов'}, разделённых пробелами`
    },
    detect: (input) => {
      const words = input.split(/\s+/).filter(Boolean)
      if (words.length >= 2) {
        const label = `${words.length} ${words.length === 1 ? 'слово' : words.length < 5 ? 'слова' : 'слов'}, разделённых пробелами`
        return { type: 'multi-word', label, confidence: 0.5 }
      }
      return null
    },
  } as any,
  {
    type: 'single-word',
    label: 'Single word',
    detect: (input) => {
      if (input.trim().length > 0 && !/\s/.test(input.trim())) {
        return { type: 'single-word', label: 'Одиночное слово', confidence: 0.2 }
      }
      return null
    },
  },
]

export function detectInputTypes(input: string): DetectionResult[] {
  if (!input.trim()) return []

  const results: DetectionResult[] = []
  for (const detector of detectors) {
    const result = detector.detect(input.trim())
    if (result) {
      results.push(result)
    }
  }

  results.sort((a, b) => b.confidence - a.confidence)
  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/detect.test.ts
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/detect.ts tests/detect.test.ts
git commit -m "feat: add text type detection with tests"
```

---

### Task 4: Case Converter Tool

**Files:**
- Create: `src/tools/case.ts`, `tests/case.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/case.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { caseTool } from '../src/tools/case'

describe('caseTool', () => {
  it('has correct id and category', () => {
    expect(caseTool.id).toBe('case')
    expect(caseTool.category).toBe('transform')
  })

  it('converts multi-word to all 17 formats', () => {
    const results = caseTool.transform('hello world example')
    expect(results.length).toBe(17)
  })

  it('converts to camelCase', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'camelCase')
    expect(r!.value).toBe('helloWorldExample')
  })

  it('converts to PascalCase', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'PascalCase')
    expect(r!.value).toBe('HelloWorldExample')
  })

  it('converts to snake_case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'snake_case')
    expect(r!.value).toBe('hello_world_example')
  })

  it('converts to kebab-case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'kebab-case')
    expect(r!.value).toBe('hello-world-example')
  })

  it('converts to SCREAMING_SNAKE_CASE', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'SCREAMING_SNAKE_CASE')
    expect(r!.value).toBe('HELLO_WORLD_EXAMPLE')
  })

  it('converts to Title Case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Title Case')
    expect(r!.value).toBe('Hello World Example')
  })

  it('converts to Sentence case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Sentence case')
    expect(r!.value).toBe('Hello world example')
  })

  it('converts to dot.case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'dot.case')
    expect(r!.value).toBe('hello.world.example')
  })

  it('converts to path/case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'path/case')
    expect(r!.value).toBe('hello/world/example')
  })

  it('converts to Train-Case', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'Train-Case')
    expect(r!.value).toBe('Hello-World-Example')
  })

  it('converts to UPPER', () => {
    const results = caseTool.transform('hello world example')
    const r = results.find(r => r.label === 'UPPER')
    expect(r!.value).toBe('HELLO WORLD EXAMPLE')
  })

  it('converts to lower', () => {
    const results = caseTool.transform('HELLO WORLD EXAMPLE')
    const r = results.find(r => r.label === 'lower')
    expect(r!.value).toBe('hello world example')
  })

  it('converts to Alternating', () => {
    const results = caseTool.transform('hello')
    const r = results.find(r => r.label === 'Alternating')
    expect(r!.value).toBe('hElLo')
  })

  it('converts to Inverse', () => {
    const results = caseTool.transform('Hello World')
    const r = results.find(r => r.label === 'Inverse')
    expect(r!.value).toBe('hELLO wORLD')
  })

  it('handles camelCase input', () => {
    const results = caseTool.transform('helloWorldExample')
    const r = results.find(r => r.label === 'snake_case')
    expect(r!.value).toBe('hello_world_example')
  })

  it('handles snake_case input', () => {
    const results = caseTool.transform('hello_world_example')
    const r = results.find(r => r.label === 'camelCase')
    expect(r!.value).toBe('helloWorldExample')
  })

  it('handles single word', () => {
    const results = caseTool.transform('hello')
    expect(results.length).toBe(17)
    const upper = results.find(r => r.label === 'UPPER')
    expect(upper!.value).toBe('HELLO')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/case.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement case converter**

Create `src/tools/case.ts`:

```typescript
import type { ToolDescriptor } from '../types/tool'

function splitWords(input: string): string[] {
  if (input.includes(' ')) return input.split(/\s+/).filter(Boolean)
  if (input.includes('_')) return input.split('_').filter(Boolean)
  if (input.includes('-')) return input.split('-').filter(Boolean)
  if (input.includes('.')) return input.split('.').filter(Boolean)
  if (input.includes('/')) return input.split('/').filter(Boolean)
  const camelSplit = input.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return camelSplit.split(/\s+/).filter(Boolean)
}

const toWords = (input: string) => splitWords(input).map(w => w.toLowerCase())

const formats: Array<{ label: string; convert: (words: string[], original: string) => string }> = [
  {
    label: 'camelCase',
    convert: (words) => words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
  },
  {
    label: 'PascalCase',
    convert: (words) => words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
  },
  {
    label: 'snake_case',
    convert: (words) => words.join('_'),
  },
  {
    label: 'kebab-case',
    convert: (words) => words.join('-'),
  },
  {
    label: 'SCREAMING_SNAKE_CASE',
    convert: (words) => words.map(w => w.toUpperCase()).join('_'),
  },
  {
    label: 'lower',
    convert: (words) => words.join(' '),
  },
  {
    label: 'Title Case',
    convert: (words) => words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  },
  {
    label: 'Sentence case',
    convert: (words) => {
      const all = words.join(' ')
      return all.charAt(0).toUpperCase() + all.slice(1)
    },
  },
  {
    label: 'dot.case',
    convert: (words) => words.join('.'),
  },
  {
    label: 'path/case',
    convert: (words) => words.join('/'),
  },
  {
    label: 'Train-Case',
    convert: (words) => words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-'),
  },
  {
    label: 'UPPER',
    convert: (words) => words.map(w => w.toUpperCase()).join(' '),
  },
  {
    label: 'Alternating',
    convert: (words, original) => {
      const flat = words.join(' ')
      let upper = false
      return flat.split('').map(c => {
        if (c === ' ') return c
        const result = upper ? c.toUpperCase() : c.toLowerCase()
        upper = !upper
        return result
      }).join('')
    },
  },
  {
    label: 'Inverse',
    convert: (words) => words.join(' ').split('').map(c => {
      if (c === c.toUpperCase()) return c.toLowerCase()
      return c.toUpperCase()
    }).join(''),
  },
  {
    label: 'CONSTANT_CASE',
    convert: (words) => words.map(w => w.toUpperCase()).join('_'),
  },
  {
    label: 'lower_case',
    convert: (words) => words.join('_'),
  },
  {
    label: 'UPPER_CASE',
    convert: (words) => words.map(w => w.toUpperCase()).join(' '),
  },
]

export const caseTool: ToolDescriptor = {
  id: 'case',
  name: 'Case Converter',
  icon: 'Aa',
  category: 'transform',
  description: '17 форматов конверсии регистра',
  transform: (input: string) => {
    if (!input.trim()) return []
    const words = toWords(input)
    return formats.map(f => ({
      label: f.label,
      value: f.convert(words, input),
    }))
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/case.test.ts
```

Expected: all 18 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/case.ts tests/case.test.ts
git commit -m "feat: add case converter tool with 17 formats"
```

---

### Task 5: Text Stats Tool

**Files:**
- Create: `src/tools/stats.ts`, `tests/stats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { statsTool } from '../src/tools/stats'

describe('statsTool', () => {
  it('has correct id and category', () => {
    expect(statsTool.id).toBe('stats')
    expect(statsTool.category).toBe('analysis')
  })

  it('counts characters', () => {
    const results = statsTool.transform('hello')
    const r = results.find(r => r.label === 'Characters')
    expect(r!.value).toBe('5')
  })

  it('counts characters with spaces', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'Characters')
    expect(r!.value).toBe('11')
  })

  it('counts words', () => {
    const results = statsTool.transform('hello world example')
    const r = results.find(r => r.label === 'Words')
    expect(r!.value).toBe('3')
  })

  it('counts characters without spaces', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'No spaces')
    expect(r!.value).toBe('10')
  })

  it('counts lines', () => {
    const results = statsTool.transform('hello\nworld\nfoo')
    const r = results.find(r => r.label === 'Lines')
    expect(r!.value).toBe('3')
  })

  it('counts sentences', () => {
    const results = statsTool.transform('Hello. World! How are you?')
    const r = results.find(r => r.label === 'Sentences')
    expect(r!.value).toBe('3')
  })

  it('counts unique words', () => {
    const results = statsTool.transform('hello hello world')
    const r = results.find(r => r.label === 'Unique words')
    expect(r!.value).toBe('2')
  })

  it('counts bytes', () => {
    const results = statsTool.transform('hello')
    const r = results.find(r => r.label === 'Bytes (UTF-8)')
    expect(r!.value).toBe('5 B')
  })

  it('counts bytes with multibyte chars', () => {
    const results = statsTool.transform('привет')
    const r = results.find(r => r.label === 'Bytes (UTF-8)')
    expect(r!.value).toBe('12 B')
  })

  it('estimates reading time', () => {
    const words = 'word '.repeat(250).trim()
    const results = statsTool.transform(words)
    const r = results.find(r => r.label === 'Reading time')
    expect(r!.value).toBe('~1 min')
  })

  it('estimates short reading time', () => {
    const results = statsTool.transform('hello world')
    const r = results.find(r => r.label === 'Reading time')
    expect(r!.value).toBe('~0 sec')
  })

  it('returns 8 metrics', () => {
    const results = statsTool.transform('hello')
    expect(results.length).toBe(8)
  })

  it('handles empty input', () => {
    const results = statsTool.transform('')
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/stats.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement stats tool**

Create `src/tools/stats.ts`:

```typescript
import type { ToolDescriptor } from '../types/tool'

export const statsTool: ToolDescriptor = {
  id: 'stats',
  name: 'Text Stats',
  icon: '#',
  category: 'analysis',
  description: 'Символы, слова, строки, предложения, время чтения, байты',
  transform: (input: string) => {
    if (!input.trim()) return []

    const chars = input.length
    const words = input.split(/\s+/).filter(Boolean)
    const wordCount = words.length
    const noSpaces = input.replace(/\s/g, '').length
    const lines = input.split('\n').length
    const sentences = (input.match(/[.!?]+(\s|$)/g) || []).length || (input.trim() ? 1 : 0)
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size
    const bytes = new TextEncoder().encode(input).length
    const readingTimeSec = Math.ceil((wordCount / 250) * 60)
    const readingTime = wordCount === 0 ? '0 sec'
      : readingTimeSec >= 60 ? `~${Math.ceil(readingTimeSec / 60)} min`
      : `~${readingTimeSec} sec`

    return [
      { label: 'Characters', value: String(chars) },
      { label: 'Words', value: String(wordCount) },
      { label: 'No spaces', value: String(noSpaces) },
      { label: 'Lines', value: String(lines) },
      { label: 'Sentences', value: String(sentences) },
      { label: 'Unique words', value: String(uniqueWords) },
      { label: 'Bytes (UTF-8)', value: `${bytes} B` },
      { label: 'Reading time', value: readingTime },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/stats.test.ts
```

Expected: all 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/stats.ts tests/stats.test.ts
git commit -m "feat: add text stats tool with 8 metrics"
```

---

### Task 6: Text Transforms Tool

**Files:**
- Create: `src/tools/transforms.ts`, `tests/transforms.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transforms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { transformsTool } from '../src/tools/transforms'

describe('transformsTool', () => {
  it('has correct id and category', () => {
    expect(transformsTool.id).toBe('transforms')
    expect(transformsTool.category).toBe('transform')
  })

  it('reverses text', () => {
    const results = transformsTool.transform('hello')
    const r = results.find(r => r.label === 'Reverse')
    expect(r!.value).toBe('olleh')
  })

  it('trims whitespace', () => {
    const results = transformsTool.transform('  hello  world  ')
    const r = results.find(r => r.label === 'Trim')
    expect(r!.value).toBe('hello  world')
  })

  it('capitalizes first letter', () => {
    const results = transformsTool.transform('hello world')
    const r = results.find(r => r.label === 'Capitalize')
    expect(r!.value).toBe('Hello World')
  })

  it('uncapitalizes', () => {
    const results = transformsTool.transform('HELLO WORLD')
    const r = results.find(r => r.label === 'Uncapitalize')
    expect(r!.value).toBe('hello world')
  })

  it('slugifies', () => {
    const results = transformsTool.transform('Hello World! Example #1')
    const r = results.find(r => r.label === 'Slugify')
    expect(r!.value).toBe('hello-world-example-1')
  })

  it('removes duplicate lines', () => {
    const results = transformsTool.transform('hello\nworld\nhello\nfoo')
    const r = results.find(r => r.label === 'Remove duplicates')
    expect(r!.value).toBe('hello\nworld\nfoo')
  })

  it('sorts lines', () => {
    const results = transformsTool.transform('cherry\napple\nbanana')
    const r = results.find(r => r.label === 'Sort lines')
    expect(r!.value).toBe('apple\nbanana\ncherry')
  })

  it('converts to leet speak', () => {
    const results = transformsTool.transform('hello')
    const r = results.find(r => r.label === 'Leet speak')
    expect(r!.value).toBe('h3ll0')
  })

  it('converts to morse code', () => {
    const results = transformsTool.transform('SOS')
    const r = results.find(r => r.label === 'Morse code')
    expect(r!.value).toBe('... --- ...')
  })

  it('converts to binary', () => {
    const results = transformsTool.transform('A')
    const r = results.find(r => r.label === 'Binary')
    expect(r!.value).toBe('01000001')
  })

  it('returns 10 transforms', () => {
    const results = transformsTool.transform('hello')
    expect(results.length).toBe(10)
  })

  it('handles empty input', () => {
    expect(transformsTool.transform('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/transforms.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement transforms tool**

Create `src/tools/transforms.ts`:

```typescript
import type { ToolDescriptor } from '../types/tool'

const MORSE_MAP: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
}

const LEET_MAP: Record<string, string> = {
  'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7', 'l': '1',
}

export const transformsTool: ToolDescriptor = {
  id: 'transforms',
  name: 'Text Transforms',
  icon: '↻',
  category: 'transform',
  description: 'Reverse, trim, capitalize, leet speak, morse, binary...',
  transform: (input: string) => {
    if (!input.trim()) return []

    return [
      {
        label: 'Reverse',
        value: input.split('').reverse().join(''),
      },
      {
        label: 'Trim',
        value: input.trim().replace(/\n{3,}/g, '\n\n'),
      },
      {
        label: 'Capitalize',
        value: input.replace(/\b\w/g, c => c.toUpperCase()),
      },
      {
        label: 'Uncapitalize',
        value: input.toLowerCase(),
      },
      {
        label: 'Slugify',
        value: input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      },
      {
        label: 'Remove duplicates',
        value: [...new Set(input.split('\n'))].join('\n'),
      },
      {
        label: 'Sort lines',
        value: input.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'),
      },
      {
        label: 'Leet speak',
        value: input.split('').map(c => LEET_MAP[c.toLowerCase()] || c).join(''),
      },
      {
        label: 'Morse code',
        value: input.toUpperCase().split('').map(c => {
          if (c === ' ') return '/'
          return MORSE_MAP[c] || c
        }).join(' '),
      },
      {
        label: 'Binary',
        value: input.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '),
      },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/transforms.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/transforms.ts tests/transforms.test.ts
git commit -m "feat: add text transforms tool with 10 operations"
```

---

### Task 7: Encoders Tool

**Files:**
- Create: `src/tools/encode.ts`, `tests/encode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/encode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { encodeTool } from '../src/tools/encode'

describe('encodeTool', () => {
  it('has correct id and category', () => {
    expect(encodeTool.id).toBe('encode')
    expect(encodeTool.category).toBe('encoding')
  })

  it('encodes to Base64', () => {
    const results = encodeTool.transform('hello')
    const r = results.find(r => r.label === 'Base64 encode')
    expect(r!.value).toBe('aGVsbG8=')
  })

  it('decodes from Base64', () => {
    const results = encodeTool.transform('aGVsbG8=')
    const r = results.find(r => r.label === 'Base64 decode')
    expect(r!.value).toBe('hello')
  })

  it('URL-encodes', () => {
    const results = encodeTool.transform('hello world')
    const r = results.find(r => r.label === 'URL encode')
    expect(r!.value).toBe('hello%20world')
  })

  it('URL-decodes', () => {
    const results = encodeTool.transform('hello%20world')
    const r = results.find(r => r.label === 'URL decode')
    expect(r!.value).toBe('hello world')
  })

  it('HTML-escapes', () => {
    const results = encodeTool.transform('<div>hello</div>')
    const r = results.find(r => r.label === 'HTML escape')
    expect(r!.value).toBe('&lt;div&gt;hello&lt;/div&gt;')
  })

  it('HTML-unescapes', () => {
    const results = encodeTool.transform('&lt;div&gt;hello&lt;/div&gt;')
    const r = results.find(r => r.label === 'HTML unescape')
    expect(r!.value).toBe('<div>hello</div>')
  })

  it('JSON-escapes', () => {
    const results = encodeTool.transform('hello "world"')
    const r = results.find(r => r.label === 'JSON escape')
    expect(r!.value).toBe('"hello \\"world\\""')
  })

  it('JSON-unescapes', () => {
    const results = encodeTool.transform('"hello \\"world\\""')
    const r = results.find(r => r.label === 'JSON unescape')
    expect(r!.value).toBe('hello "world"')
  })

  it('returns 8 encode/decode results', () => {
    const results = encodeTool.transform('hello')
    expect(results.length).toBe(8)
  })

  it('handles empty input', () => {
    expect(encodeTool.transform('')).toEqual([])
  })

  it('Base64 decode returns error for invalid input', () => {
    const results = encodeTool.transform('not-valid-base64!!!')
    const r = results.find(r => r.label === 'Base64 decode')
    expect(r!.value).toContain('Error')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/encode.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement encoders tool**

Create `src/tools/encode.ts`:

```typescript
import type { ToolDescriptor } from '../types/tool'

export const encodeTool: ToolDescriptor = {
  id: 'encode',
  name: 'Encoders',
  icon: '{ }',
  category: 'encoding',
  description: 'Base64, URL encode/decode, HTML escape, JSON escape',
  transform: (input: string) => {
    if (!input.trim()) return []

    let base64Decode = ''
    try {
      base64Decode = atob(input.trim())
    } catch {
      base64Decode = 'Error: invalid Base64'
    }

    let jsonUnescape = ''
    try {
      jsonUnescape = JSON.parse(input)
    } catch {
      jsonUnescape = 'Error: invalid JSON string'
    }

    return [
      { label: 'Base64 encode', value: btoa(input) },
      { label: 'Base64 decode', value: base64Decode },
      { label: 'URL encode', value: encodeURIComponent(input) },
      { label: 'URL decode', value: (() => { try { return decodeURIComponent(input) } catch { return 'Error: invalid URL encoding' } })() },
      { label: 'HTML escape', value: input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') },
      { label: 'HTML unescape', value: input.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') },
      { label: 'JSON escape', value: JSON.stringify(input) },
      { label: 'JSON unescape', value: jsonUnescape },
    ]
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/encode.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/encode.ts tests/encode.test.ts
git commit -m "feat: add encoders tool with 8 encode/decode operations"
```

---

### Task 8: Tool Registry

**Files:**
- Create: `src/tools/registry.ts`, `tests/registry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getAllTools, getToolsByCategory } from '../src/tools/registry'
import type { Category } from '../src/types/tool'

describe('tool registry', () => {
  it('returns all 4 tools', () => {
    const tools = getAllTools()
    expect(tools.length).toBe(4)
  })

  it('each tool has unique id', () => {
    const tools = getAllTools()
    const ids = tools.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups tools by category', () => {
    const groups = getToolsByCategory()
    expect(Object.keys(groups).sort()).toEqual(['analysis', 'encoding', 'transform'].sort())
  })

  it('transform category has 2 tools', () => {
    const groups = getToolsByCategory()
    expect(groups['transform'].length).toBe(2)
  })

  it('analysis category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['analysis'].length).toBe(1)
  })

  it('encoding category has 1 tool', () => {
    const groups = getToolsByCategory()
    expect(groups['encoding'].length).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/registry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement registry**

Create `src/tools/registry.ts`:

```typescript
import type { ToolDescriptor, Category } from '../types/tool'
import { caseTool } from './case'
import { statsTool } from './stats'
import { transformsTool } from './transforms'
import { encodeTool } from './encode'

const tools: ToolDescriptor[] = [caseTool, transformsTool, statsTool, encodeTool]

export function getAllTools(): ToolDescriptor[] {
  return tools
}

export function getToolsByCategory(): Record<Category, ToolDescriptor[]> {
  const groups: Record<string, ToolDescriptor[]> = {}
  for (const tool of tools) {
    if (!groups[tool.category]) groups[tool.category] = []
    groups[tool.category].push(tool)
  }
  return groups as Record<Category, ToolDescriptor[]>
}

export function getToolById(id: string): ToolDescriptor | undefined {
  return tools.find(t => t.id === id)
}
```

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

Expected: all tests across all files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/registry.ts tests/registry.test.ts
git commit -m "feat: add tool registry"
```

---

### Task 9: Zustand Store

**Files:**
- Create: `src/store/useStore.ts`

- [ ] **Step 1: Implement store**

Create `src/store/useStore.ts`:

```typescript
import { create } from 'zustand'

interface AppState {
  input: string
  activeToolId: string | null
  catalogOpen: boolean
  toast: string | null

  setInput: (input: string) => void
  setActiveToolId: (id: string | null) => void
  setCatalogOpen: (open: boolean) => void
  showToast: (message: string) => void
  clearToast: () => void
}

export const useStore = create<AppState>((set) => ({
  input: '',
  activeToolId: null,
  catalogOpen: false,
  toast: null,

  setInput: (input) => set({ input }),
  setActiveToolId: (id) => set({ activeToolId: id }),
  setCatalogOpen: (open) => set({ catalogOpen: open }),
  showToast: (message) => {
    set({ toast: message })
    setTimeout(() => set({ toast: null }), 2000)
  },
  clearToast: () => set({ toast: null }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: add Zustand store"
```

---

### Task 10: Clipboard Utility

**Files:**
- Create: `src/utils/clipboard.ts`

- [ ] **Step 1: Implement clipboard utility**

Create `src/utils/clipboard.ts`:

```typescript
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/clipboard.ts
git commit -m "feat: add clipboard utility"
```

---

### Task 11: UI Components — SmartInput + DetectionBadge + Toast

**Files:**
- Create: `src/components/SmartInput.tsx`, `src/components/DetectionBadge.tsx`, `src/components/Toast.tsx`

- [ ] **Step 1: Create SmartInput component**

Create `src/components/SmartInput.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

const MAX_INPUT_LENGTH = 5000

export function SmartInput() {
  const input = useStore(s => s.input)
  const setInput = useStore(s => s.setInput)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 240) + 'px'
    }
  }, [input])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_INPUT_LENGTH) {
      setInput(value)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.length > MAX_INPUT_LENGTH) {
      e.preventDefault()
      setInput(pasted.slice(0, MAX_INPUT_LENGTH))
    }
  }

  const showWarning = input.length > MAX_INPUT_LENGTH * 0.9

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder="Вставьте или введите текст..."
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text resize-none outline-none focus:border-accent/50 transition-colors placeholder:text-muted/40"
          rows={1}
        />
        {input && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              onClick={() => setInput('')}
              className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-muted hover:text-text transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {showWarning && input && (
        <p className="text-xs text-amber-500 mt-1">
          Текст обрезан до {MAX_INPUT_LENGTH} символов
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create DetectionBadge component**

Create `src/components/DetectionBadge.tsx`:

```tsx
import { useStore } from '../store/useStore'
import { detectInputTypes } from '../tools/detect'

export function DetectionBadge() {
  const input = useStore(s => s.input)

  if (!input.trim()) return null

  const detections = detectInputTypes(input)
  if (detections.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="w-1.5 h-1.5 rounded-full bg-success" />
      <span className="text-[10px] text-success">{detections[0].label}</span>
      {detections.length > 1 && (
        <span className="text-[9px] text-muted-dim">+{detections.length - 1}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create Toast component**

Create `src/components/Toast.tsx`:

```tsx
import { useStore } from '../store/useStore'

export function Toast() {
  const toast = useStore(s => s.toast)

  if (!toast) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-accent text-zinc-900 font-semibold text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in z-50">
      {toast}
    </div>
  )
}
```

- [ ] **Step 4: Add fade-in animation to index.css**

Append to `src/index.css`:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SmartInput.tsx src/components/DetectionBadge.tsx src/components/Toast.tsx src/index.css
git commit -m "feat: add SmartInput, DetectionBadge, Toast components"
```

---

### Task 12: UI Components — ResultTile + ResultTiles

**Files:**
- Create: `src/components/ResultTile.tsx`, `src/components/ResultTiles.tsx`

- [ ] **Step 1: Create ResultTile component**

Create `src/components/ResultTile.tsx`:

```tsx
import type { TransformResult } from '../types/tool'
import { copyToClipboard } from '../utils/clipboard'
import { useStore } from '../store/useStore'

interface Props {
  result: TransformResult
  accent?: boolean
}

export function ResultTile({ result, accent }: Props) {
  const showToast = useStore(s => s.showToast)

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.value)
    if (ok) showToast('Скопировано!')
  }

  return (
    <button
      onClick={handleCopy}
      className="bg-surface border border-border rounded-lg px-3 py-2 flex justify-between items-center text-left hover:border-accent/30 transition-colors w-full group"
    >
      <div className="min-w-0 flex-1 mr-2">
        <div className="text-[9px] text-muted">{result.label}</div>
        <div className={`font-mono text-xs truncate ${accent ? 'text-accent' : 'text-text'}`}>
          {result.value}
        </div>
      </div>
      <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-[10px] text-muted group-hover:text-text transition-colors flex-shrink-0">
        📋
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Create ResultTiles component**

Create `src/components/ResultTiles.tsx`:

```tsx
import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'
import { detectInputTypes } from '../tools/detect'
import { ResultTile } from './ResultTile'

export function ResultTiles() {
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)

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

  const detections = useMemo(() => detectInputTypes(input), [input])
  const detectedTypes = new Set(detections.map(d => d.type))

  const filteredResults = activeToolId
    ? allResults.filter(r => r.toolId === activeToolId)
    : allResults

  if (!input.trim() || filteredResults.length === 0) return null

  return (
    <div className="w-full max-w-xl mx-auto mt-3">
      <div className="grid grid-cols-2 gap-1.5">
        {filteredResults.map((r, i) => (
          <ResultTile
            key={`${r.toolId}-${r.result.label}`}
            result={r.result}
            accent={i < 4 && !activeToolId}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultTile.tsx src/components/ResultTiles.tsx
git commit -m "feat: add ResultTile and ResultTiles components"
```

---

### Task 13: UI Components — ExpandedSection + BottomCarousel + FullCatalog

**Files:**
- Create: `src/components/ExpandedSection.tsx`, `src/components/BottomCarousel.tsx`, `src/components/CatalogCard.tsx`, `src/components/FullCatalog.tsx`

- [ ] **Step 1: Create ExpandedSection component**

Create `src/components/ExpandedSection.tsx`:

```tsx
import { useStore } from '../store/useStore'
import { getToolById } from '../tools/registry'
import { ResultTile } from './ResultTile'

const CATEGORY_COLORS: Record<string, string> = {
  transform: 'rgba(232,160,48,0.1)',
  analysis: 'rgba(52,211,153,0.1)',
  encoding: 'rgba(96,165,250,0.1)',
}

const CATEGORY_TEXT: Record<string, string> = {
  transform: 'text-accent',
  analysis: 'text-success',
  encoding: 'text-info',
}

const CATEGORY_BORDER: Record<string, string> = {
  transform: 'border-accent/30',
  analysis: 'border-success/30',
  encoding: 'border-info/30',
}

export function ExpandedSection() {
  const input = useStore(s => s.input)
  const activeToolId = useStore(s => s.activeToolId)
  const setActiveToolId = useStore(s => s.setActiveToolId)

  if (!activeToolId || !input.trim()) return null

  const tool = getToolById(activeToolId)
  if (!tool) return null

  const results = tool.transform(input)

  return (
    <div className={`w-full max-w-lg mx-auto mt-3 bg-surface-dim border ${CATEGORY_BORDER[tool.category]} rounded-xl overflow-hidden`}>
      <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs ${CATEGORY_TEXT[tool.category]}`}
               style={{ background: CATEGORY_COLORS[tool.category] }}>
            {tool.icon}
          </div>
          <span className="font-semibold text-xs text-text">{tool.name}</span>
        </div>
        <button onClick={() => setActiveToolId(null)} className="text-muted-dim hover:text-text text-xs">✕</button>
      </div>
      <div className="p-4">
        {tool.category === 'analysis' ? (
          <div className="grid grid-cols-4 gap-3 mb-3">
            {results.slice(0, 4).map(r => (
              <div key={r.label} className="text-center">
                <div className="font-mono text-xl font-bold text-success">{r.value}</div>
                <div className="text-[8px] text-muted mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div className={`grid gap-1.5 ${tool.category === 'analysis' ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {results.map(r => (
            <ResultTile key={r.label} result={r} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create BottomCarousel component**

Create `src/components/BottomCarousel.tsx`:

```tsx
import { useStore } from '../store/useStore'
import { getAllTools } from '../tools/registry'

const CAROUSEL_ORDER = ['case', 'transforms', 'stats', 'encode']

const TOOL_META: Record<string, { icon: string; label: string }> = {
  case: { icon: 'Aa', label: 'Case' },
  transforms: { icon: '↻', label: 'Transform' },
  stats: { icon: '#', label: 'Stats' },
  encode: { icon: '{ }', label: 'Encode' },
}

export function BottomCarousel() {
  const activeToolId = useStore(s => s.activeToolId)
  const setActiveToolId = useStore(s => s.setActiveToolId)
  const setCatalogOpen = useStore(s => s.setCatalogOpen)

  const allTools = getAllTools()
  const tools = CAROUSEL_ORDER.map(id => allTools.find(t => t.id === id)!).filter(Boolean)

  return (
    <div className="w-full bg-surface border-t border-border px-4 py-2.5">
      <div className="flex gap-1.5 items-center max-w-xl mx-auto">
        <button
          onClick={() => setCatalogOpen(true)}
          className="flex-shrink-0 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center min-w-[56px] hover:bg-accent/20 transition-colors"
        >
          <div className="font-mono font-bold text-accent text-sm">⊞</div>
          <div className="text-[7px] text-accent font-medium">Все</div>
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {tools.map(tool => {
          const meta = TOOL_META[tool.id]
          const isActive = activeToolId === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => setActiveToolId(isActive ? null : tool.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-center min-w-[56px] transition-colors ${
                isActive
                  ? 'bg-accent/10 border border-accent/30'
                  : 'bg-zinc-800 border border-transparent hover:bg-zinc-700'
              }`}
            >
              <div className={`font-mono font-bold text-sm ${isActive ? 'text-accent' : 'text-accent'}`}>
                {meta.icon}
              </div>
              <div className={`text-[7px] ${isActive ? 'text-accent' : 'text-muted'}`}>
                {meta.label}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create CatalogCard component**

Create `src/components/CatalogCard.tsx`:

```tsx
import type { ToolDescriptor } from '../types/tool'

interface Props {
  tool: ToolDescriptor
  disabled?: boolean
  onClick: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  transform: 'rgba(232,160,48,0.1)',
  analysis: 'rgba(52,211,153,0.1)',
  encoding: 'rgba(96,165,250,0.1)',
  dev: 'rgba(113,113,122,0.1)',
}

const CATEGORY_TEXT: Record<string, string> = {
  transform: 'text-accent',
  analysis: 'text-success',
  encoding: 'text-info',
  dev: 'text-muted',
}

export function CatalogCard({ tool, disabled, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-surface border border-border rounded-xl p-3.5 text-left transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-border-dim'
          : 'hover:border-accent/50 cursor-pointer'
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm mb-2"
        style={{ background: CATEGORY_COLORS[tool.category] }}
      >
        <span className={CATEGORY_TEXT[tool.category]}>{tool.icon}</span>
      </div>
      <div className={`font-semibold text-xs mb-1 ${disabled ? 'text-muted-dim' : 'text-text'}`}>
        {tool.name}
      </div>
      <div className="text-[9px] text-muted leading-relaxed">
        {disabled ? 'Скоро' : tool.description}
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Create FullCatalog component**

Create `src/components/FullCatalog.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getToolsByCategory, getToolById } from '../tools/registry'
import { CatalogCard } from './CatalogCard'

const CATEGORY_LABELS: Record<string, string> = {
  transform: 'Трансформации',
  analysis: 'Анализ',
  encoding: 'Кодирование',
  dev: 'Dev Tools',
}

const CATEGORY_ORDER = ['transform', 'analysis', 'encoding']

export function FullCatalog() {
  const catalogOpen = useStore(s => s.catalogOpen)
  const setCatalogOpen = useStore(s => s.setCatalogOpen)
  const setActiveToolId = useStore(s => s.setActiveToolId)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogOpen(false)
    }
    if (catalogOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [catalogOpen, setCatalogOpen])

  if (!catalogOpen) return null

  const groups = getToolsByCategory()

  const handleToolClick = (toolId: string) => {
    const tool = getToolById(toolId)
    if (tool) {
      setActiveToolId(toolId)
      setCatalogOpen(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#09090b] z-40 flex flex-col animate-fade-in">
      <div className="px-6 py-4 flex justify-between items-center border-b border-border">
        <div className="font-mono font-bold text-base text-accent">
          txt<span className="text-muted">kit</span>
          <span className="text-xs text-muted font-normal ml-2">все инструменты</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="bg-zinc-800 rounded-md px-3 py-1.5 text-xs text-text outline-none border border-transparent focus:border-border placeholder:text-muted/50 w-48"
          />
          <button
            onClick={() => setCatalogOpen(false)}
            className="w-7 h-7 bg-zinc-800 rounded-md flex items-center justify-center text-muted hover:text-text transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {CATEGORY_ORDER.map(cat => {
          const catTools = groups[cat] || []
          if (catTools.length === 0) return null
          const filtered = catTools.filter(t =>
            !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
          )
          if (filtered.length === 0) return null
          return (
            <div key={cat} className="mb-6">
              <div className="text-[9px] uppercase text-muted-dim tracking-widest font-semibold mb-2.5">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {filtered.map(tool => (
                  <CatalogCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-6 py-2.5 border-t border-border text-center">
        <span className="text-[9px] text-muted-dim">
          Нажмите <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-[9px]">Esc</kbd> чтобы вернуться
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpandedSection.tsx src/components/BottomCarousel.tsx src/components/CatalogCard.tsx src/components/FullCatalog.tsx
git commit -m "feat: add ExpandedSection, BottomCarousel, CatalogCard, FullCatalog"
```

---

### Task 14: App Layout — Wire Everything Together

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx with full layout**

```tsx
import { useStore } from './store/useStore'
import { SmartInput } from './components/SmartInput'
import { DetectionBadge } from './components/DetectionBadge'
import { ResultTiles } from './components/ResultTiles'
import { ExpandedSection } from './components/ExpandedSection'
import { BottomCarousel } from './components/BottomCarousel'
import { FullCatalog } from './components/FullCatalog'
import { Toast } from './components/Toast'

function App() {
  const input = useStore(s => s.input)

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
```

- [ ] **Step 2: Run dev server and verify visually**

```bash
npm run dev
```

Open browser, test:
- Type text → should see detection badge + result tiles
- Click carousel tools → expanded section appears
- Click «Все» → fullscreen catalog
- Click result tile → toast "Скопировано!"
- Press Esc → catalog closes
- Clear input → all results disappear

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire all components in App layout"
```

---

### Task 15: Mobile Responsive Adjustments

**Files:**
- Modify: `src/index.css`, `src/components/FullCatalog.tsx`, `src/components/BottomCarousel.tsx`

- [ ] **Step 1: Add responsive utilities to index.css**

Append to `src/index.css`:

```css
@media (max-width: 640px) {
  .catalog-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
```

- [ ] **Step 2: Add overflow-x-auto to BottomCarousel inner flex**

In `src/components/BottomCarousel.tsx`, add `overflow-x-auto` to the inner flex div:

Change:
```tsx
<div className="flex gap-1.5 items-center max-w-xl mx-auto">
```
To:
```tsx
<div className="flex gap-1.5 items-center max-w-xl mx-auto overflow-x-auto">
```

- [ ] **Step 3: Add catalog-grid class to FullCatalog grid**

In `src/components/FullCatalog.tsx`, change:
```tsx
<div className="grid grid-cols-4 gap-2">
```
To:
```tsx
<div className="grid grid-cols-4 gap-2 catalog-grid">
```

- [ ] **Step 4: Verify on mobile viewport**

```bash
npm run dev
```

Open DevTools → toggle device toolbar → test at 375px width.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/BottomCarousel.tsx src/components/FullCatalog.tsx
git commit -m "feat: add mobile responsive adjustments"
```

---

### Task 16: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all tests PASS, 0 failures.

- [ ] **Step 2: Run dev server and do full manual test**

```bash
npm run dev
```

Checklist:
- [ ] Empty state shows logo + placeholder
- [ ] Type "hello world" → detection badge shows "2 слова, разделённых пробелами"
- [ ] Result tiles appear with case conversions + stats + transforms + encodings
- [ ] Click "helloWorldExample" tile → toast "Скопировано!" appears
- [ ] Click "Stats" in carousel → expanded section shows
- [ ] Click ✕ on expanded section → it closes
- [ ] Click "Все" → fullscreen catalog opens
- [ ] Catalog shows tools grouped by category
- [ ] Search in catalog works
- [ ] Press Esc → catalog closes
- [ ] Click tool in catalog → closes catalog, opens expanded section
- [ ] Paste >5000 chars → warning shown, text truncated
- [ ] Resize to mobile width → layout responsive

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: txtkit v1 complete — smart text processing tool"
```
