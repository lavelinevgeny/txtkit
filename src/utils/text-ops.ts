export function removeDuplicateLines(input: string): string {
  return [...new Set(input.split('\n'))].join('\n')
}

export function sortLines(input: string): string {
  return input.split('\n').sort((a, b) => a.localeCompare(b)).join('\n')
}

export function removeEmptyLines(input: string): string {
  return input.split('\n').filter(line => line.trim() !== '').join('\n')
}

export function trimLines(input: string): string {
  return input.split('\n').map(line => line.trim()).join('\n')
}

export function shuffleLines(input: string): string {
  const arr = input.split('\n')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('\n')
}

export function addPrefixSuffix(
  input: string,
  opts: { prefix?: string; suffix?: string },
): string {
  const { prefix = '', suffix = '' } = opts
  return input.split('\n').map(line => `${prefix}${line}${suffix}`).join('\n')
}

export type LineEnding = 'LF' | 'CRLF'

export function normalizeLineEndings(input: string, target: LineEnding): string {
  const lf = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return target === 'CRLF' ? lf.replace(/\n/g, '\r\n') : lf
}

export function regexReplaceAll(
  input: string,
  pattern: RegExp | string,
  replacement: string,
): string {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern, 'g')
    : new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
      )

  return input.replace(re, replacement)
}
