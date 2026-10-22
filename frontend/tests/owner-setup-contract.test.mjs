import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { ApiError, request } from '../src/api/client.ts'

const actualFetch = globalThis.fetch
const response = (payload, status = 200) => Response.json(payload, { status })

describe('First-time OWNER API contract (mocked, no live services)', { concurrency: false }, () => {
  afterEach(() => { globalThis.fetch = actualFetch })

  test('setup status is public and receives the Boolean setupAvailable flag', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/auth/setup/status')
      assert.equal(init.method, 'GET')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.headers.Authorization, undefined)
      return response({ setupAvailable: true })
    }
    assert.deepEqual(await request('/auth/setup/status'), { setupAvailable: true })
  })

  test('owner creation sends exactly the supplied setup payload and no bearer token', async () => {
    const payload = {
      firstName: 'First', lastName: 'Owner', email: 'owner@example.invalid',
      password: 'test-password-not-real', setupKey: 'fixture-install-key',
    }
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/auth/setup/owner')
      assert.equal(init.method, 'POST')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.headers.Authorization, undefined)
      assert.deepEqual(JSON.parse(init.body), payload)
      return response({ id: 1, role: 'OWNER', enabled: true }, 201)
    }
    assert.deepEqual(await request('/auth/setup/owner', { method: 'POST', body: payload }),
      { id: 1, role: 'OWNER', enabled: true })
  })

  test('rejected second OWNER returns HTTP 409 without leaking the submitted secrets', async () => {
    globalThis.fetch = async () => response({ message: 'fixture-install-key' }, 409)
    await assert.rejects(request('/auth/setup/owner', {
      method: 'POST', body: { setupKey: 'fixture-install-key' },
    }), error => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 409)
      assert.ok(!error.message.includes('fixture-install-key'))
      return true
    })
  })

  test('invalid installation key receives a distinct generic message', async () => {
    globalThis.fetch = async () => response({ message: 'fixture-install-key' }, 403)
    await assert.rejects(request('/auth/setup/owner', { method: 'POST', body: { setupKey: 'fixture-install-key' } }), error => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 403)
      assert.ok(!error.message.includes('fixture-install-key'))
      return true
    })
  })
})
