export const LIVE_DETAILED_STATS_LIMIT_CHARS = 500_000

export interface TextPadStats {
  chars: number
  lines: number
  words: number | null
  paragraphs: number | null
  detailedStatsDisabled: boolean
}

export function getTextPadStats(input: string): TextPadStats {
  const chars = input.length
  const lines = input.length === 0 ? 0 : input.split('\n').length

  if (input.length > LIVE_DETAILED_STATS_LIMIT_CHARS) {
    return { chars, lines, words: null, paragraphs: null, detailedStatsDisabled: true }
  }

  const words = input.trim().split(/\s+/).filter(Boolean).length

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
