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
