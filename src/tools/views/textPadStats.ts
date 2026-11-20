export const LIVE_DETAILED_STATS_LIMIT_CHARS = 500_000

export interface TextPadStats {
  chars: number
  lines: number
  words: number | null
  paragraphs: number | null
  detailedStatsDisabled: boolean
}

export function getTextPadStats(input: string, images: readonly { offset: number }[] = []): TextPadStats {
  const chars = input.length - images.length
  const lines = input.length === 0 ? 0 : input.split('\n').length

  if (input.length > LIVE_DETAILED_STATS_LIMIT_CHARS) {
    return { chars, lines, words: null, paragraphs: null, detailedStatsDisabled: true }
  }

  // In paragraph counting the anchor remains visible content. For words it is a separator.
  let wordInput = input
  if (images.length) {
    const chunks: string[] = []
    let start = 0
    for (const { offset } of images) {
      chunks.push(input.slice(start, offset))
      start = offset + 1
    }
    chunks.push(input.slice(start))
    wordInput = chunks.join(' ')
  }
  const words = wordInput.trim().split(/\s+/).filter(Boolean).length

  const paragraphs = input
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .length

  return { chars, lines, words, paragraphs, detailedStatsDisabled: false }
}
