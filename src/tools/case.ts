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
    convert: (words) => {
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
    convert: (_words, original) => original.split('').map(c => {
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
