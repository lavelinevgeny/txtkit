# txtkit — Design Document

## Overview
txtkit — a smart text processing web tool with an intelligent input field that auto-detects text type and shows contextual action tiles. Single-page, client-only, no backend.

## Tech Stack
- React 19 + Vite + TypeScript
- Tailwind CSS 4
- Zustand (state management)
- Client-only, no backend

## Design System
- **Theme**: Dark mode
  - Background: #09090b (zinc-950)
  - Surface: #18181b (zinc-900)
  - Border: #27272a (zinc-800)
  - Muted: #71717a (zinc-500)
  - Text: #e4e4e7 (zinc-200)
  - Accent: #e8a030 (amber/gold)
  - Success: #34d399 (emerald-400)
  - Info: #60a5fa (blue-400)
- **Fonts**: JetBrains Mono (headings, code, results) + Space Grotesk (body, UI text)
- **Border radius**: 8–12px for cards, 6px for buttons, 4px for tags

## Architecture
- **Tool Registry pattern**: each tool is a self-contained module with `ToolDescriptor`
- Tools grouped into categories, categories define sections in UI
- Zustand store holds: input text, active tool (expanded section), catalog open/close

## UI Layout

### Main Screen
1. **Logo** — top center: `txtkit` (amber + zinc)
2. **Smart Input** — centered textarea, auto-expanding up to ~10 lines, monospace
3. **Detection Badge** — small green pill below input: auto-detected type (e.g. "3 words, space-separated")
4. **Result Tiles** — grid of actionable tiles, each showing tool label + result preview + copy button
5. **Bottom Carousel** — horizontal bar pinned to bottom:
   - **Все** (highlighted, first) → opens fullscreen catalog overlay
   - Divider
   - **Aa Case** / **↻ Transform** / **# Stats** / **{ } Encode** → click to expand section

### Expanded Section (click on carousel tool)
- Results dim/collapse to 1 row with "...и ещё N результатов"
- Rich panel expands below with full tool output
- Panel has: icon + title + close button (✕)
- Panel content depends on tool type (stats = large numbers + details, case = all formats, etc.)

### Fullscreen Catalog (click "Все")
- Overlay covering entire screen
- Header: logo + search field + close button (✕ / Esc)
- Tools grouped by category (Трансформации, Анализ, Кодирование, Dev Tools)
- Each tool = card with icon, name, description
- Dev Tools shown as greyed out "Скоро"
- Grid: 4 columns on desktop, responsive on mobile

## Detection Logic
- **Multi-detection with priority**: all matching patterns detected, results sorted by confidence
- Detection patterns (priority order):
  1. Base64 (regex: valid base64 chars, length % 4 == 0, decodeable)
  2. URL-encoded (%XX patterns)
  3. HTML entities (&...; patterns)
  4. JSON (starts with { or [)
  5. camelCase / PascalCase (word boundary detection)
  6. snake_case (underscores between words)
  7. kebab-case (hyphens between words)
  8. Multi-word (space-separated)
  9. Single word (fallback — always matches)

## Long Text Handling
- Max input: ~5000 characters
- If pasted text exceeds limit: show warning, truncate with option to see full text
- Results computed from truncated text

## Mobile (Responsive)
- Same layout, responsive scaling
- Carousel: horizontal scroll
- Result tiles: 1 column on narrow screens
- Catalog: 2 columns on mobile (vs 4 on desktop)

## Phase 1 Tools

### Case Converter (17 formats)
camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE, SCREAMING_SNAKE, lower_case, Title Case, Sentence case, dot.case, path/case, CONSTANT_CASE, Train-Case, Alternating, Inverse, UPPER, lower

### Text Stats (8 metrics)
Characters, Words, Characters (no spaces), Lines, Sentences, Unique words, Bytes (UTF-8), Reading time

### Text Transforms
Reverse, Trim (whitespace), Capitalize, Uncapitalize, Slugify, Remove duplicates, Sort lines, Leet speak, Morse code, Binary

### Encoders
Base64 encode/decode, URL encode/decode, HTML escape/unescape, JSON escape/unescape

## Click Behavior
- Click on result tile → copy value to clipboard
- Show toast notification "Скопировано!" that auto-dismisses after 2s
- Input text is NOT replaced

## Tool Interface (ToolDescriptor)
```typescript
interface ToolDescriptor {
  id: string
  name: string
  icon: string
  category: 'transform' | 'analysis' | 'encoding' | 'dev'
  description: string
  detect?: (input: string) => DetectionResult | null
  transform: (input: string) => TransformResult[]
}
```
