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
  'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7',
}

export const transformsTool: ToolDescriptor = {
  id: 'transforms',
  name: 'Text Transforms',
  icon: '↻',
  category: 'transform',
  description: 'Reverse, trim, capitalize, leet speak, morse, binary...',
  features: [
    { label: 'Reverse', description: 'Reverse the entire string character by character', example: 'hello → olleh' },
    { label: 'Trim', description: 'Remove leading/trailing whitespace and collapse multiple blank lines', example: '"  hi  " → "hi"' },
    { label: 'Capitalize', description: 'Capitalize the first letter of each word', example: 'hello world → Hello World' },
    { label: 'Uncapitalize', description: 'Convert the entire text to lowercase', example: 'Hello World → hello world' },
    { label: 'Slugify', description: 'Create a URL-friendly slug from text', example: 'Hello World! → hello-world' },
    { label: 'Remove duplicates', description: 'Remove duplicate lines, keeping only unique ones', example: 'a\\na\\nb → a\\nb' },
    { label: 'Sort lines', description: 'Sort all lines alphabetically', example: 'c\\na\\nb → a\\nb\\nc' },
    { label: 'Leet speak', description: 'Replace letters with similar-looking numbers', example: 'hello → h3ll0' },
    { label: 'Morse code', description: 'Encode text into Morse code with dots and dashes', example: 'HI → .... ..' },
    { label: 'Binary', description: 'Convert each character to its 8-bit binary representation', example: 'A → 01000001' },
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
}
