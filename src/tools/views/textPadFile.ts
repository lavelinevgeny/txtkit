export function downloadTextFile(text: string, filename = 'txtkit-text-buffer.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJsonBackup(
  documents: Array<{ title: string; content: string }>,
): void {
  const backup = documents.map((document) => ({
    version: 1,
    title: document.title,
    content: document.content,
    exportedAt: Date.now(),
  }))
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'txtkit-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}
