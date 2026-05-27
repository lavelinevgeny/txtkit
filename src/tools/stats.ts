import type { ToolDescriptor } from '../types/tool'

export const statsTool: ToolDescriptor = {
  id: 'stats',
  name: 'Text Stats',
  icon: '#',
  category: 'analysis',
  description: 'Символы, слова, строки, предложения, время чтения, байты',
  features: [
    { label: 'Characters', description: 'Total number of characters including spaces', example: '"hello" → 5' },
    { label: 'Words', description: 'Number of words separated by whitespace', example: '"hello world" → 2' },
    { label: 'No spaces', description: 'Character count excluding all whitespace', example: '"a b c" → 3' },
    { label: 'Lines', description: 'Number of lines in the text', example: '"a\\nb\\nc" → 3' },
    { label: 'Sentences', description: 'Estimated sentence count based on punctuation', example: '"Hi. Bye." → 2' },
    { label: 'Unique words', description: 'Number of distinct words (case-insensitive)', example: '"a a b" → 2' },
    { label: 'Bytes (UTF-8)', description: 'Size of the text in bytes when encoded as UTF-8', example: '"hi" → 2 B' },
    { label: 'Reading time', description: 'Estimated reading time at 250 words per minute', example: '500 words → ~2 min' },
  ],
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
    const readingTimeSec = Math.floor((wordCount / 250) * 60)
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
