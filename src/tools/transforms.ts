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
