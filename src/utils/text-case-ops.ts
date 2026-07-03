export function toLowerCase(input: string): string {
  return input.toLowerCase()
}

export function toUpperCase(input: string): string {
  return input.toUpperCase()
}

export function toSentenceCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (_, boundary: string, letter: string) => boundary + letter.toUpperCase())
}

export function toTitleCase(input: string): string {
  return input.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
