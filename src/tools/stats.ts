import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/context'

export const statsTool: ToolDescriptor = {
  id: 'stats',
  name: 'Text Stats',
  icon: '#',
  category: 'analysis',
  description: t('tools.stats.description'),
  features: [
    { label: 'Characters', description: t('tools.stats.features.Characters.description'), example: '"hello" → 5' },
    { label: 'Words', description: t('tools.stats.features.Words.description'), example: '"hello world" → 2' },
    { label: 'No spaces', description: t('tools.stats.features.No spaces.description'), example: '"a b c" → 3' },
    { label: 'Lines', description: t('tools.stats.features.Lines.description'), example: '"a\\nb\\nc" → 3' },
    { label: 'Sentences', description: t('tools.stats.features.Sentences.description'), example: '"Hi. Bye." → 2' },
    { label: 'Unique words', description: t('tools.stats.features.Unique words.description'), example: '"a a b" → 2' },
    { label: 'Bytes (UTF-8)', description: t('tools.stats.features.Bytes (UTF-8).description'), example: '"hi" → 2 B' },
    { label: 'Reading time', description: t('tools.stats.features.Reading time.description'), example: '500 words → ~2 min' },
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
