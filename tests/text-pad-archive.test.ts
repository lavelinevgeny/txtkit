import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRecord } from '../src/tools/text-pad/types'
import { createPadArchive } from '../src/tools/text-pad/padArchive'
import { readPadImage } from '../src/db/textPadRepository'

vi.mock('../src/db/textPadRepository', () => ({ readPadImage: vi.fn() }))

const doc: DocumentRecord = {
  id: 'doc', title: 'note', content: 'before', contentRevision: 0,
  updatedAt: 0, createdAt: 0, scrollTop: 0, selection: null,
}

describe('Text Pad archive', () => {
  beforeEach(() => vi.resetAllMocks())

  it('exports a mixed array, preserves memory-only bytes and diagnoses an absent file', async () => {
    const bytes = Uint8Array.from({ length: 64 * 1024 + 1 }, (_, i) => i % 256)
    const imageDoc = {
      ...doc, id: 'two', content: '\uFFFC',
      images: [{ imageId: 'a', offset: 0, scale: 75 }], imageFiles: { a: { mimeType: 'image/png', bytes } },
      recovery: [{ imageId: 'orphan', reason: 'unbound-file' }, { imageId: 'lost', offset: 44, reason: 'missing-file' }],
    }
    vi.mocked(readPadImage).mockImplementation(async (_id, imageId) => imageId === 'orphan'
      ? { mimeType: 'image/webp', bytes: Uint8Array.of(0, 254) } : undefined)
    const { blob, incomplete } = await createPadArchive([doc, imageDoc])
    expect(incomplete).toBe(true)
    const [text, images] = JSON.parse(await blob.text())
    expect(text).toEqual({ version: 1, title: doc.title, content: doc.content, exportedAt: expect.any(Number) })
    expect(images.version).toBe(2)
    expect(images.images[0].scale).toBe(75)
    expect(atob(images.images[0].dataBase64)).toBe(Array.from(bytes, n => String.fromCharCode(n)).join(''))
    expect(images.recovery).toEqual([
      { imageId: 'orphan', reason: 'unbound-file', mimeType: 'image/webp', dataBase64: 'AP4=' },
      { imageId: 'lost', offset: 44, reason: 'missing-file' },
    ])
    expect(readPadImage).toHaveBeenCalledTimes(2)
  })

  it('requires explicit partial export on an unreadable attachment', async () => {
    const broken = { ...doc, content: '\uFFFC', images: [{ imageId: 'missing', offset: 0 }] }
    vi.mocked(readPadImage).mockRejectedValue(new Error('unavailable'))
    await expect(createPadArchive([broken])).rejects.toThrow('missing')
    const { incomplete, blob } = await createPadArchive([broken], true)
    expect(incomplete).toBe(true)
    expect(JSON.parse(await blob.text())[0]).toMatchObject({
      images: [], recovery: [{ imageId: 'missing', offset: 0, reason: 'unavailable' }],
    })
  })
})
