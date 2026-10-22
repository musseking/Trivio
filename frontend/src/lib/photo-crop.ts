// Coordinates are normalized (0..1) relative to the source image.
export interface PhotoCrop { x: number; y: number; width: number; height: number }
export type CropAspect = 'free' | '4:3' | '16:9' | '1:1'
export const FULL_PHOTO: PhotoCrop = { x: 0, y: 0, width: 1, height: 1 }
export const MIN_CROP_SIZE = 0.10

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function aspectValue(preset: CropAspect): number | null {
  if (preset === '4:3') return 4 / 3
  if (preset === '16:9') return 16 / 9
  if (preset === '1:1') return 1
  return null
}

export function cropForAspect(preset: CropAspect, imageWidth: number, imageHeight: number): PhotoCrop {
  const target = aspectValue(preset)
  if (!target || imageWidth <= 0 || imageHeight <= 0) return { ...FULL_PHOTO }
  const native = imageWidth / imageHeight
  if (native >= target) {
    const width = target / native
    return { x: (1 - width) / 2, y: 0, width, height: 1 }
  }
  const height = native / target
  return { x: 0, y: (1 - height) / 2, width: 1, height }
}

export function moveCrop(original: PhotoCrop, dx: number, dy: number): PhotoCrop {
  return { ...original, x: clamp(original.x + dx, 0, 1 - original.width), y: clamp(original.y + dy, 0, 1 - original.height) }
}

export function zoomCrop(original: PhotoCrop, base: PhotoCrop, zoomPercent: number): PhotoCrop {
  const scale = 1 - clamp(zoomPercent, 0, 100) * .0085
  const width = base.width * scale
  const height = base.height * scale
  return {
    x: clamp(original.x + original.width / 2 - width / 2, 0, 1 - width),
    y: clamp(original.y + original.height / 2 - height / 2, 0, 1 - height),
    width, height,
  }
}

export function resizeCrop(original: PhotoCrop, dx: number, dy: number, aspect: CropAspect,
  imageWidth: number, imageHeight: number): PhotoCrop {
  const ratio = aspectValue(aspect)
  if (!ratio || imageWidth <= 0 || imageHeight <= 0) {
    return { ...original, width: clamp(original.width + dx, MIN_CROP_SIZE, 1 - original.x),
      height: clamp(original.height + dy, MIN_CROP_SIZE, 1 - original.y) }
  }
  // In normalized coordinates, height = width * (imageWidth / imageHeight) / targetAspect.
  const heightPerWidth = imageWidth / (imageHeight * ratio)
  const widthChange = Math.abs(dx) >= Math.abs(dy) ? dx : dy / heightPerWidth
  const maxWidth = Math.min(1 - original.x, (1 - original.y) / heightPerWidth)
  const minWidth = Math.min(maxWidth, Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE / heightPerWidth))
  const width = clamp(original.width + widthChange, minWidth, maxWidth)
  return { ...original, width, height: width * heightPerWidth }
}

export function cropToPixels(crop: PhotoCrop, width: number, height: number) {
  const x = clamp(Math.round(crop.x * width), 0, width - 1)
  const y = clamp(Math.round(crop.y * height), 0, height - 1)
  return { x, y, width: clamp(Math.round(crop.width * width), 1, width - x),
    height: clamp(Math.round(crop.height * height), 1, height - y) }
}

export function isFullPhoto(crop: PhotoCrop): boolean {
  return crop.x < 0.00001 && crop.y < 0.00001 && crop.width > 0.99999 && crop.height > 0.99999
}
