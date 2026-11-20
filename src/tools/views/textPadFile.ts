export function downloadTextFile(text: string, filename = 'txtkit-text-buffer.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadPadFile(blob, filename)
}

export function downloadPadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
