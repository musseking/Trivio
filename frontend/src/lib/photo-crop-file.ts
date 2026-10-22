import { cropToPixels, isFullPhoto } from './photo-crop'
import type { PhotoCrop } from './photo-crop'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_DIMENSION = 2400

function encode(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Nije moguće sačuvati izabrani kadar.')), mime, quality)
  })
}

// Runs only in the browser after the user confirms cropping; the original File is left untouched.
export async function cropPhotoFile(file: File, crop: PhotoCrop): Promise<File> {
  if (isFullPhoto(crop)) return file
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 20_000_000) {
      throw new Error('Fotografija premašuje dozvoljenih 20 megapiksela.')
    }
    const rectangle = cropToPixels(crop, bitmap.width, bitmap.height)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(rectangle.width, rectangle.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(rectangle.width * scale))
    canvas.height = Math.max(1, Math.round(rectangle.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Pregledač ne podržava obradu fotografija.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    // When PNG must fall back to JPEG, give transparent areas a white background.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, rectangle.x, rectangle.y, rectangle.width, rectangle.height,
      0, 0, canvas.width, canvas.height)

    let mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    let blob = await encode(canvas, mime, mime === 'image/jpeg' ? .92 : undefined)
    if (blob.size > MAX_BYTES) {
      mime = 'image/jpeg'
      for (const quality of [.90, .80, .70, .60]) {
        blob = await encode(canvas, mime, quality)
        if (blob.size <= MAX_BYTES) break
      }
    }
    if (!blob.size || blob.size > MAX_BYTES) throw new Error('Izabrani kadar je prevelik. Pokušaj sa manjim kadrom.')
    const extension = mime === 'image/png' ? 'png' : 'jpg'
    const basename = file.name.replace(/\.(jpe?g|png)$/i, '')
    return new File([blob], `${basename}-crop.${extension}`, { type: mime, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
