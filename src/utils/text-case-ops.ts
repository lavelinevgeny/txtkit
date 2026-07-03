export function toLowerCase(input: string): string {
  return input.toLowerCase()
}

export function toUpperCase(input: string): string {
  return input.toUpperCase()
}

export function toSentenceCase(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase()
}

export function toTitleCase(input: string): string {
  return input.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
