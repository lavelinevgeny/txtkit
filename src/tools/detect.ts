import type { DetectionResult } from '../types/tool'
import { t } from '../i18n/translate'
import { pluralRu } from '../i18n/plural'
import { useStore } from '../store/useStore'
import { blocksTool } from './1c-blocks'
import { hasListMarker } from './list-converter'

const detectors: Array<{
  type: string
  label: string | ((input: string) => string)
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
    type: '1c-blocks',
    label: '1C Blocks',
    detect: (input) => {
      return blocksTool.detect!(input)
    },
  },
  {
    type: 'list',
    label: 'List',
    detect: (input) => {
      const lines = input.split('\n').filter(line => line.trim())
      if (lines.length < 2) return null
      const markedCount = lines.filter(hasListMarker).length
      if (markedCount < 2 || markedCount / lines.length < 0.5) return null
      return { type: 'list', label: 'List', confidence: 0.85 }
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
    type: 'yaml',
    label: 'YAML',
    detect: (input) => {
      const trimmed = input.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null
      if (!trimmed.includes(':')) return null
      const lines = trimmed.split('\n')
      const keyValueLines = lines.filter(l => /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(l))
      if (keyValueLines.length === 0) return null
      const confidence = Math.min(0.6 + keyValueLines.length * 0.1, 0.95)
      return { type: 'yaml', label: 'YAML', confidence }
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
      const words = input.split(/\s+/)
      if (words.some(w => /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(w))) {
        return { type: 'snake_case', label: 'snake_case', confidence: 0.7 }
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
    label: '',
    detect: (input) => {
      const words = input.split(/\s+/).filter(Boolean)
      if (words.length >= 2) {
        const locale = useStore.getState().locale
        const form = locale === 'ru'
          ? pluralRu(words.length, ['слово', 'слова', 'слов'])
          : words.length === 1 ? 'word' : 'words'
        const wordLabel = t('detect.words', { count: words.length, form })
        return { type: 'multi-word', label: wordLabel, confidence: 0.5 }
      }
      return null
    },
  },
  {
    type: 'single-word',
    label: '',
    detect: (input) => {
      if (input.trim().length > 0 && !/\s/.test(input.trim())) {
        return { type: 'single-word', label: t('detect.singleWord'), confidence: 0.2 }
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
