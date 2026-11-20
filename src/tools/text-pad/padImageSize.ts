import type { PadImageBinding } from './types'

export const imageScaleStep = 25
export const maxImageScale = 200
export const autoImageHeight = 480

export function validImageScale(scale: unknown): scale is number {
  return typeof scale === 'number' && scale >= imageScaleStep && scale <= maxImageScale && scale % imageScaleStep === 0
}

// The original auto-fit is also the representation used by older notes.
export function imageBinding({ offset, imageId, scale }: PadImageBinding): PadImageBinding {
  return validImageScale(scale) && scale !== 100 ? { offset, imageId, scale } : { offset, imageId }
}

export function autoImageWidth(image: HTMLImageElement) {
  return image.naturalHeight ? image.naturalWidth * Math.min(1, autoImageHeight / image.naturalHeight) : 0
}

export function scaledImageWidth(base: number, available: number, scale: number) {
  return Math.min(available, Math.min(base, available) * scale / 100)
}
