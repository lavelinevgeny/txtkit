import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'

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
  'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7',
}

export const transformsTool: ToolDescriptor = {
  id: 'transforms',
  name: 'Text Transforms',
  icon: '↻',
  category: 'transform',
  description: t('tools.transforms.description'),
  features: [
    { label: 'Reverse', description: t('tools.transforms.features.Reverse.description'), example: 'hello → olleh' },
    { label: 'Trim', description: t('tools.transforms.features.Trim.description'), example: '"  hi  " → "hi"' },
    { label: 'Capitalize', description: t('tools.transforms.features.Capitalize.description'), example: 'hello world → Hello World' },
    { label: 'Uncapitalize', description: t('tools.transforms.features.Uncapitalize.description'), example: 'Hello World → hello world' },
    { label: 'Slugify', description: t('tools.transforms.features.Slugify.description'), example: 'Hello World! → hello-world' },
    { label: 'Remove duplicates', description: t('tools.transforms.features.Remove duplicates.description'), example: 'a\\na\\nb → a\\nb' },
    { label: 'Sort lines', description: t('tools.transforms.features.Sort lines.description'), example: 'c\\na\\nb → a\\nb\\nc' },
    { label: 'Leet speak', description: t('tools.transforms.features.Leet speak.description'), example: 'hello → h3ll0' },
    { label: 'Morse code', description: t('tools.transforms.features.Morse code.description'), example: 'HI → .... ..' },
    { label: 'Binary', description: t('tools.transforms.features.Binary.description'), example: 'A → 01000001' },
  ],
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
  relevance: {
    'multi-word': { tool: 0.3, transforms: { 'Slugify': 1.5, 'Remove duplicates': 1.5, 'Sort lines': 1.5 } },
  },
}
