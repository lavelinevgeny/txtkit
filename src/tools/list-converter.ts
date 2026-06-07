import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'

type MarkerFormat = 'none' | 'numbered' | 'checkbox' | '-' | '*' | '+' | '•' | '—'

interface ListLine {
  text: string
  empty: boolean
  marker: MarkerFormat
}

function parseLine(line: string): ListLine {
  if (!line.trim()) return { text: '', empty: true, marker: 'none' }

  const checkbox = line.match(/^\s*-\s+\[[ xX]\]\s+(.+)$/)
  if (checkbox) return { text: checkbox[1].trim(), empty: false, marker: 'checkbox' }

  const parenthesizedNumber = line.match(/^\s*\(\d+\)\s+(.+)$/)
  if (parenthesizedNumber) return { text: parenthesizedNumber[1].trim(), empty: false, marker: 'numbered' }

  const numbered = line.match(/^\s*(?:\d+|[A-Za-zА-Яа-яЁё])[.)]\s+(.+)$/)
  if (numbered) return { text: numbered[1].trim(), empty: false, marker: 'numbered' }

  const bullet = line.match(/^\s*([-*+•—])\s+(.+)$/)
  if (bullet) {
    return { text: bullet[2].trim(), empty: false, marker: bullet[1] as MarkerFormat }
  }

  return { text: line.trim(), empty: false, marker: 'none' }
}

export function hasListMarker(line: string): boolean {
  return parseLine(line).marker !== 'none'
}

function firstMarker(lines: ListLine[]): MarkerFormat {
  return lines.find(line => line.marker !== 'none')?.marker ?? 'none'
}

function formatLines(lines: ListLine[], marker: MarkerFormat, preserveEmpty = true): string {
  let number = 0
  return lines
    .filter(line => preserveEmpty || !line.empty)
    .map((line) => {
      if (line.empty) return ''
      number += 1
      if (marker === 'none') return line.text
      if (marker === 'numbered') return `${number}. ${line.text}`
      if (marker === 'checkbox') return `- [ ] ${line.text}`
      return `${marker} ${line.text}`
    })
    .join('\n')
}

function removeDuplicates(lines: ListLine[]): ListLine[] {
  const seen = new Set<string>()
  const result: ListLine[] = []

  for (const line of lines) {
    if (line.empty) {
      if (result.length > 0 && !result[result.length - 1].empty) result.push(line)
      continue
    }
    if (seen.has(line.text)) continue
    seen.add(line.text)
    result.push(line)
  }

  if (result[result.length - 1]?.empty) result.pop()
  return result
}

export const listConverterTool: ToolDescriptor = {
  id: 'list-converter',
  name: 'List Converter',
  icon: '≡',
  category: 'transform',
  description: t('tools.list-converter.description'),
  features: [
    { label: 'Hyphen list', description: t('tools.list-converter.features.Hyphen list.description'), example: '1. item → - item' },
    { label: 'Asterisk list', description: t('tools.list-converter.features.Asterisk list.description'), example: '1. item → * item' },
    { label: 'Bullet list', description: t('tools.list-converter.features.Bullet list.description'), example: '1. item → • item' },
    { label: 'Numbered list', description: t('tools.list-converter.features.Numbered list.description'), example: '- item → 1. item' },
    { label: 'Checkbox list', description: t('tools.list-converter.features.Checkbox list.description'), example: '- item → - [ ] item' },
    { label: 'Remove markers', description: t('tools.list-converter.features.Remove markers.description'), example: '- item → item' },
    { label: 'Sort list', description: t('tools.list-converter.features.Sort list.description'), example: '- b\\n- a → - a\\n- b' },
    { label: 'Remove duplicates', description: t('tools.list-converter.features.Remove duplicates.description'), example: '- a\\n- a → - a' },
  ],
  transform: (input: string) => {
    if (!input.trim()) return []

    const lines = input.split('\n').map(parseLine)
    const sourceMarker = firstMarker(lines)
    const sorted = lines
      .filter(line => !line.empty)
      .sort((a, b) => a.text.localeCompare(b.text))
    const unique = removeDuplicates(lines)

    return [
      { label: 'Hyphen list', value: formatLines(lines, '-') },
      { label: 'Asterisk list', value: formatLines(lines, '*') },
      { label: 'Bullet list', value: formatLines(lines, '•') },
      { label: 'Numbered list', value: formatLines(lines, 'numbered') },
      { label: 'Checkbox list', value: formatLines(lines, 'checkbox') },
      { label: 'Remove markers', value: formatLines(lines, 'none') },
      { label: 'Sort list', value: formatLines(sorted, sourceMarker, false) },
      { label: 'Remove duplicates', value: formatLines(unique, sourceMarker) },
    ]
  },
  relevance: {
    list: {
      tool: 2,
      transforms: {
        'Hyphen list': 1,
        'Numbered list': 1,
        'Checkbox list': 1,
        'Remove markers': 1,
      },
    },
  },
  scope: {
    multiLine: true,
  },
}
