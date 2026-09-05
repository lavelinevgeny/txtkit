const SVG_MIME = 'image/svg+xml'
const SVG_NS = 'http://www.w3.org/2000/svg'
const PNG_MIME = 'image/png'

export type SvgSize = { width: number; height: number }

function parseLength(value: string | null): number | null {
  if (value == null) return null
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:px)?\s*$/.exec(value)
  if (!match) return null
  const parsed = Number(match[1])
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseSvgRoot(svg: string): SVGElement {
  const doc = new DOMParser().parseFromString(svg, SVG_MIME)
  const root = doc.documentElement
  // DOMParser не бросает на битом вводе — отдаёт документ с <parsererror>.
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('mermaid export: root element is not <svg>')
  }
  return root as unknown as SVGElement
}

/**
 * Размеры SVG, отрендеренного mermaid. Приоритет — viewBox: при
 * useMaxWidth: true mermaid пишет width="100%" и не пишет height вообще,
 * зато всегда ставит viewBox.
 */
export function readSvgSize(svg: string): SvgSize {
  const root = parseSvgRoot(svg)

  const viewBox = root.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4) {
      const [, , width, height] = parts
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { width, height }
      }
    }
  }

  // Только если присутствуют оба и оба — конечные положительные числа
  // (px или без единиц). '100%' отбрасывается: parseFloat дал бы 100.
  const width = parseLength(root.getAttribute('width'))
  const height = parseLength(root.getAttribute('height'))
  if (width != null && height != null) {
    return { width, height }
  }

  throw new Error('mermaid export: cannot determine SVG size')
}

export function prepareSvgMarkup(svg: string, size: SvgSize): string {
  const root = parseSvgRoot(svg).cloneNode(true) as SVGElement
  root.setAttribute('width', String(size.width))
  root.setAttribute('height', String(size.height))
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', SVG_NS)
  }
  return new XMLSerializer().serializeToString(root)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadSvgFile(svg: string, filename = 'diagram.svg'): void {
  // Исходную строку не трогаем — на диск уходит ровно то, что отрендерил mermaid.
  downloadBlob(new Blob([svg], { type: `${SVG_MIME};charset=utf-8` }), filename)
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  if (typeof image.decode === 'function') {
    await image.decode()
    return image
  }
  return await new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('mermaid export: image failed to load'))
  })
}

export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const size = readSvgSize(svg)
  const markup = prepareSvgMarkup(svg, size)
  const url = URL.createObjectURL(new Blob([markup], { type: SVG_MIME }))

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(size.width * scale))
    canvas.height = Math.max(1, Math.round(size.height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('mermaid export: canvas 2d context unavailable')

    // Фон прозрачный — осознанный компромисс, как в mermaid.live.
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('mermaid export: canvas.toBlob returned null'))
      }, PNG_MIME)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function copyPngToClipboard(svg: string): Promise<boolean> {
  try {
    // В ClipboardItem передаётся промис, а не готовый Blob: await растеризации
    // до clipboard.write съедает transient user activation (Safari → NotAllowedError).
    const png = svgToPngBlob(svg)
    // Если ClipboardItem/write недоступны, промис останется без потребителя —
    // гасим unhandled rejection, не мешая write получить исходный промис.
    png.catch(() => {})
    await navigator.clipboard.write([new ClipboardItem({ [PNG_MIME]: png })])
    return true
  } catch {
    return false
  }
}
