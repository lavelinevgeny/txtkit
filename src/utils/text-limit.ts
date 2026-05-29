const encoder = new TextEncoder()

export const MAX_INPUT_BYTES = 10 * 1024 * 1024
export const MAX_INPUT_SIZE_LABEL = '10 MB'

export function getUtf8ByteLength(input: string): number {
  return encoder.encode(input).length
}

function getUtf8CodePointLength(codePoint: number): number {
  if (codePoint <= 0x7f) {
    return 1
  }

  if (codePoint <= 0x7ff) {
    return 2
  }

  if (codePoint <= 0xffff) {
    return 3
  }

  return 4
}

export function truncateUtf8ByBytes(input: string, maxBytes: number): string {
  if (getUtf8ByteLength(input) <= maxBytes) {
    return input
  }

  let bytes = 0
  let truncated = ''

  for (const char of input) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) {
      continue
    }

    const charBytes = getUtf8CodePointLength(codePoint)
    if (bytes + charBytes > maxBytes) {
      break
    }

    bytes += charBytes
    truncated += char
  }

  return truncated
}