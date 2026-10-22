import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverPhoto, vehicleMediaUrl } from '../src/lib/vehicle-photos.ts';

const filename = '3e85522e-8af6-4a09-83d1-2ee220958698';

test('public photos accept only generated same-origin Vehicle media URLs', () => {
  assert.equal(vehicleMediaUrl(`/api/vehicles/media/${filename}.jpg`), `/api/vehicles/media/${filename}.jpg`);
  assert.equal(vehicleMediaUrl(`/api/vehicles/media/${filename}-thumb.jpg`), `/api/vehicles/media/${filename}-thumb.jpg`);
  for (const input of [undefined, '', 'https://example.test/car.jpg', '//example.test/car.jpg',
    '/api/auth/me', '/api/vehicles/media/../private.jpg', '/api/vehicles/media/%2e%2e/private.jpg',
    `/api/vehicles/media/${filename}.svg`, `javascript:${filename}`, `/api/vehicles/media/${filename}.jpg?token=secret`]) {
    assert.equal(vehicleMediaUrl(input), undefined);
  }
});

test('cover selection respects metadata and does not mutate gallery order', () => {
  const photos = [{ id: 1, position: 2, cover: false }, { id: 2, position: 0, cover: true }];
  assert.equal(coverPhoto(photos)?.id, 2);
  assert.deepEqual(photos.map((photo) => photo.id), [1, 2]);
  assert.equal(coverPhoto(photos.map((photo) => ({ ...photo, cover: false })))?.id, 2);
  assert.equal(coverPhoto([]), undefined);
  assert.equal(coverPhoto(undefined), undefined);
});
