import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  copyPngToClipboard,
  downloadSvgFile,
  prepareSvgMarkup,
  readSvgSize,
} from '../src/tools/views/mermaidExport'

// Реальная форма вывода mermaid при useMaxWidth: true — width="100%",
// height отсутствует, viewBox есть.
const MERMAID_SVG =
  '<svg aria-roledescription="flowchart-v2" role="graphics-document document" viewBox="0 0 320 180" ' +
  'style="max-width: 320px;" xmlns="http://www.w3.org/2000/svg" width="100%" id="mermaid-1">' +
  '<g><text>A</text></g></svg>'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('readSvgSize', () => {
  it('reads the size from viewBox when mermaid omits height', () => {
    expect(readSvgSize(MERMAID_SVG)).toEqual({ width: 320, height: 180 })
  })

  it('prefers viewBox over numeric width/height', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 320 180"></svg>'
    expect(readSvgSize(svg)).toEqual({ width: 320, height: 180 })
  })

  it('falls back to numeric width/height with px units', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80px"></svg>'
    expect(readSvgSize(svg)).toEqual({ width: 120, height: 80 })
  })

  it('falls back to unitless numeric width/height', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>'
    expect(readSvgSize(svg)).toEqual({ width: 120, height: 80 })
  })

  it('throws for percentage width without viewBox instead of reading 100', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"></svg>'
    expect(() => readSvgSize(svg)).toThrow()
  })

  it('throws when height is missing and there is no viewBox', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120"></svg>'
    expect(() => readSvgSize(svg)).toThrow()
  })

  it('throws when the root element is not svg', () => {
    expect(() => readSvgSize('<div width="120" height="80"></div>')).toThrow()
  })

  it('throws on malformed XML', () => {
    expect(() => readSvgSize('<svg viewBox="0 0 10 10"><g></svg>')).toThrow()
  })
})

describe('prepareSvgMarkup', () => {
  it('sets explicit numeric width/height and keeps the content', () => {
    const markup = prepareSvgMarkup(MERMAID_SVG, { width: 320, height: 180 })

    expect(markup).toContain('width="320"')
    expect(markup).toContain('height="180"')
    expect(markup).not.toContain('width="100%"')
    expect(markup).toContain('<text>A</text>')
  })

  it('adds the xmlns attribute when it is missing', () => {
    const markup = prepareSvgMarkup('<svg viewBox="0 0 10 10"><g></g></svg>', {
      width: 10,
      height: 10,
    })

    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
})

describe('downloadSvgFile', () => {
  it('downloads the untouched markup as an svg file', () => {
    const blobs: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:mermaid'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadSvgFile(MERMAID_SVG)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(blobs[0].type).toBe('image/svg+xml;charset=utf-8')
    expect(click).toHaveBeenCalledTimes(1)
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('diagram.svg')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mermaid')
  })

  it('honours a custom filename', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:mermaid', revokeObjectURL: () => {} })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadSvgFile(MERMAID_SVG, 'custom.svg')

    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('custom.svg')
  })
})

describe('copyPngToClipboard', () => {
  it('returns false when ClipboardItem is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', undefined)

    await expect(copyPngToClipboard(MERMAID_SVG)).resolves.toBe(false)
  })

  it('returns false when clipboard.write rejects', async () => {
    vi.stubGlobal('ClipboardItem', class {})
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
    })

    await expect(copyPngToClipboard(MERMAID_SVG)).resolves.toBe(false)
  })

  it('returns true and passes a promise to ClipboardItem when the write succeeds', async () => {
    const items: Array<Record<string, unknown>> = []
    class FakeClipboardItem {
      constructor(data: Record<string, unknown>) {
        items.push(data)
      }
    }
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('navigator', { clipboard: { write } })

    await expect(copyPngToClipboard(MERMAID_SVG)).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    // Blob не дожидается до write — transient user activation сохраняется.
    expect(items[0]['image/png']).toBeInstanceOf(Promise)
  })
})
