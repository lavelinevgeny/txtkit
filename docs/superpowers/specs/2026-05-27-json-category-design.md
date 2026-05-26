# JSON Category — Design Spec

## Overview

Add a new tool category `json` to txtkit with 9 JSON-specific utilities. JSON escape/unescape moves from the existing `encode` tool into this new category.

## Type Changes

**`src/types/tool.ts`**: add `'json'` to `Category` union:
```typescript
export type Category = 'transform' | 'analysis' | 'encoding' | 'json' | 'dev'
```

## New Tool: `jsonTool`

**File**: `src/tools/json.ts`

**ToolDescriptor**: `{ id: 'json', name: 'JSON Tools', icon: '{ }', category: 'json' }`

### Text Results (TransformResult[])

These appear as standard result tiles in the UI.

| # | Label | Logic | Error handling |
|---|-------|-------|----------------|
| 1 | **Validate** | Parse JSON. On success: `"Valid JSON"` with green styling. On failure: error message with position. | Show error message from caught exception |
| 2 | **Pretty print** | `JSON.stringify(parsed, null, 2)` | "Error: invalid JSON" |
| 3 | **Minify** | `JSON.stringify(parsed)` | "Error: invalid JSON" |
| 4 | **Flatten** | Recursively flatten nested object into dot-notation keys: `{"a.b.c": 1}` | "Error: invalid JSON" |
| 5 | **Unflatten** | Reverse of flatten — expand dot-notation keys back into nested structure | "Error: invalid JSON" |
| 6 | **JSON → YAML** | `js-yaml.dump(parsed)` | "Error: invalid JSON" |
| 7 | **YAML → JSON** | `js-yaml.load(input)` then `JSON.stringify(result, null, 2)` | "Error: invalid YAML" |
| 8 | **Structure analysis** | Text report: key count, max depth, value types breakdown, array lengths | "Error: invalid JSON" |

### Interactive Component: JSON Tree

| # | Label | Behavior |
|---|-------|----------|
| 9 | **Tree** | Renders `JsonTree` component instead of a result tile |

**`JsonTree` component design:**
- Recursive collapsible tree rendering
- Each node shows:
  - Expand/collapse toggle (▼/►)
  - Key name (if inside object)
  - Type badge: object `(N keys)`, array `[N]`, string, number, boolean, null
  - Leaf values are inline (strings in quotes)
  - Copy button on each leaf value
- Color coding by type:
  - Strings: emerald-400 (#34d399)
  - Numbers: blue-400 (#60a5fa)
  - Booleans: purple-400 (#c084fc)
  - Null: zinc-500 (#71717a)
  - Objects/arrays: amber (#e8a030)
- All nodes collapsed by default; click to expand
- Component rendered inside `ExpandedSection` when json tree sub-tool is active

## Detection Changes

**`src/tools/detect.ts`**: add YAML detector after the JSON detector:
- Heuristic: multiline input with `key: value` patterns, not starting with `{` or `[`
- Confidence: 0.7
- This enables YAML → JSON tool when user pastes YAML

## Registry Changes

**`src/tools/registry.ts`**: add `jsonTool` to the tools array.

**`src/tools/encode.ts`**: remove JSON escape and JSON unescape entries from `encodeTool.transform`.

## Carousel Changes

**`src/components/BottomCarousel.tsx`**:
- Add `'json'` to `CAROUSEL_ORDER` after `'encode'`
- Add entry to `TOOL_META`: `{ icon: '{ }', label: 'JSON' }`

## Dependencies

- `js-yaml` — runtime dependency for JSON ↔ YAML conversion
- `@types/js-yaml` — dev dependency for TypeScript types

## File Structure

```
src/tools/json.ts          — jsonTool with text transforms + tree trigger
src/tools/json-utils.ts    — flatten, unflatten, structure analysis helpers
src/components/JsonTree.tsx — interactive tree component
```
