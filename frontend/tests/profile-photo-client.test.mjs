import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ApiError, request, subscribeToUnauthorized } from '../src/api/client.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('private photo fetch sends bearer header and returns binary without a token in URL', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/auth/users/2/photo')
    assert.equal(init.headers.Authorization, 'Bearer fixture-token')
    assert.equal(init.headers.Accept, 'image/jpeg')
    assert.equal(init.credentials, 'omit')
    return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } })
  }
  const photo = await request('/auth/users/2/photo', { accessToken: 'fixture-token', responseType: 'blob' })
  assert.equal(photo.type, 'image/jpeg')
  assert.deepEqual([...new Uint8Array(await photo.arrayBuffer())], [255, 216, 255])
})

test('binary photo 401 invalidates exactly its session and does not expose server text', async () => {
  const rejected = []
  const unsubscribe = subscribeToUnauthorized(token => rejected.push(token))
  try {
    globalThis.fetch = async () => new Response('private server diagnostic', { status: 401 })
    await assert.rejects(request('/auth/users/2/photo', { accessToken: 'fixture-token', responseType: 'blob' }), error => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 401)
      assert.ok(!error.message.includes('private server diagnostic'))
      return true
    })
    assert.deepEqual(rejected, ['fixture-token'])
  } finally { unsubscribe() }
})
