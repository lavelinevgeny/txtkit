import type { DocumentRecord } from './types'

export function createPadArchive(documents: DocumentRecord[]): Blob {
  const parts: BlobPart[] = ['[']
  for (const { title, content } of documents) {
    if (parts.length > 1) parts.push(',')
    parts.push(new Blob([JSON.stringify({ version: 1, title, content, exportedAt: Date.now() })]))
  }
  parts.push(']')
  return new Blob(parts, { type: 'application/json;charset=utf-8' })
}
