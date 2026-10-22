import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from '../src/api/client.ts';

test('multipart upload preserves File objects and lets the browser generate its boundary', async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  const body = new FormData();
  const file = new File([new Uint8Array([255, 216, 255])], 'owner-selected.jpg', { type: 'image/jpeg' });
  body.append('files', file);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/vehicles/17/photos');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer fixture-owner-token');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, body);
    assert.equal(options.body.get('files'), file);
    return Response.json([]);
  };
  assert.deepEqual(await request('/vehicles/17/photos', { method: 'POST', accessToken: 'fixture-owner-token', body }), []);
});

test('PUT sends JSON metadata and DELETE supports an empty 204 response', async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  const order = { photoIds: [6, 4], coverPhotoId: 4 };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/vehicles/17/photos/order');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), order);
    return Response.json([]);
  };
  assert.deepEqual(await request('/vehicles/17/photos/order', { method: 'PUT', accessToken: 'fixture-owner-token', body: order }), []);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/vehicles/17');
    assert.equal(options.method, 'DELETE');
    assert.equal(options.body, undefined);
    return new Response(null, { status: 204 });
  };
  assert.equal(await request('/vehicles/17', { method: 'DELETE', accessToken: 'fixture-owner-token' }), undefined);
});
