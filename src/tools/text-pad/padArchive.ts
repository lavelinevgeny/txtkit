import { imageBinding } from './padImageSize'
import { encodeBytes } from './padImageEncoding'
import { readPadImage } from '../../db/textPadRepository'
import type { DocumentRecord, PadImageFile, PadImageRecovery } from './types'

type EncodedImage = { mimeType: string; dataBase64: string }

export async function createPadArchive(documents: DocumentRecord[], partial = false) {
  const parts: BlobPart[] = ['[']
  let incomplete = false
  const unreadable = new Set<string>()
  for (const doc of documents) {
    async function encode(imageId: string, knownMissing = false): Promise<EncodedImage | undefined> {
      let file: PadImageFile | undefined
      try {
        file = doc.imageFiles && Object.hasOwn(doc.imageFiles, imageId)
          ? doc.imageFiles[imageId]
          : await readPadImage(doc.id, imageId)
      } catch {
        knownMissing = false
      }
      if (file) return { mimeType: file.mimeType, dataBase64: encodeBytes(file.bytes) }
      if (!knownMissing && !partial) unreadable.add(`${doc.title} (${doc.id}): ${imageId}`)
      incomplete = true
    }

    const record = { title: doc.title, content: doc.content, exportedAt: Date.now() }
    const bindings = doc.images ?? []
    const diagnostics = doc.recovery ?? []
    let serialized: string
    if (bindings.length || diagnostics.length) {
      const images: Array<{ offset: number; scale?: number } & EncodedImage> = []
      const recovery: Array<PadImageRecovery & Partial<EncodedImage> & { fileReason?: string }> = []
      for (const binding of bindings) {
        const encoded = await encode(binding.imageId)
        if (encoded) images.push({ offset: binding.offset, scale: imageBinding(binding).scale, ...encoded })
        else recovery.push({ ...binding, reason: 'unavailable' })
      }
      for (const issue of diagnostics) {
        const knownMissing = issue.reason === 'missing-file'
        const encoded = await encode(issue.imageId, knownMissing)
        recovery.push({ ...issue, ...(encoded ?? (knownMissing ? {} : { fileReason: 'unavailable' })) })
      }
      serialized = JSON.stringify({ version: 2, ...record, images, ...(recovery.length ? { recovery } : {}) })
    } else {
      serialized = JSON.stringify({ version: 1, ...record })
    }
    if (parts.length > 1) parts.push(',')
    parts.push(new Blob([serialized]))
  }
  if (unreadable.size) throw new Error([...unreadable].join(', '))
  parts.push(']')
  return { blob: new Blob(parts, { type: 'application/json;charset=utf-8' }), incomplete }
}
