import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropForAspect, cropToPixels, isFullPhoto, moveCrop, resizeCrop, zoomCrop } from '../src/lib/photo-crop.ts'

test('crop selector starts with the full original image', () => {
  const crop = cropForAspect('free', 1600, 900)
  assert.ok(isFullPhoto(crop))
  assert.deepEqual(cropToPixels(crop, 1600, 900), { x: 0, y: 0, width: 1600, height: 900 })
})

test('fixed 4:3 and square crop use actual pixel aspect ratios', () => {
  const landscape = cropForAspect('4:3', 1600, 900)
  const pixels = cropToPixels(landscape, 1600, 900)
  assert.ok(Math.abs(pixels.width / pixels.height - 4 / 3) < 0.003)
  assert.equal(pixels.y, 0)
  assert.ok(pixels.x > 0)
  const square = cropToPixels(cropForAspect('1:1', 900, 1600), 900, 1600)
  assert.equal(square.width, square.height)
})

test('drag cannot move selected crop outside photograph', () => {
  const crop = { x: .2, y: .2, width: .4, height: .4 }
  assert.deepEqual(moveCrop(crop, -4, 5), { ...crop, x: 0, y: .6 })
})

test('zoom keeps the selected region within the original', () => {
  const base = cropForAspect('16:9', 1600, 900)
  const crop = zoomCrop(base, base, 80)
  assert.ok(crop.width < base.width && crop.height < base.height)
  assert.ok(crop.x >= 0 && crop.x + crop.width <= 1)
  assert.ok(crop.y >= 0 && crop.y + crop.height <= 1)
})

test('resize respects image boundaries and locked aspect ratio', () => {
  const base = cropForAspect('4:3', 1600, 900)
  const cropped = resizeCrop(base, -.1, -.1, '4:3', 1600, 900)
  const pixels = cropToPixels(cropped, 1600, 900)
  assert.ok(cropped.x + cropped.width <= 1)
  assert.ok(cropped.y + cropped.height <= 1)
  assert.ok(Math.abs(pixels.width / pixels.height - 4 / 3) < .003)
})
