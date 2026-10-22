import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { ApiError, isAbortError, request, subscribeToUnauthorized } from '../src/api/client.ts'

const originalFetch = globalThis.fetch
const subscriptions = []

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function observeUnauthorized() {
  const rejectedTokens = []
  subscriptions.push(subscribeToUnauthorized((token) => rejectedTokens.push(token)))
  return rejectedTokens
}

function assertSanitized(error, status, sensitiveValues) {
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, status)
  for (const value of sensitiveValues) {
    assert.ok(!error.message.includes(value), 'Error message must not expose request or server details')
    assert.ok(!JSON.stringify(error).includes(value), 'Error properties must not expose sensitive values')
  }
  assert.equal(error.cause, undefined)
  return true
}

// All tests replace fetch; an omitted stub fails locally instead of reaching a server.
describe('API client with isolated fetch responses', { concurrency: false }, () => {
  beforeEach(() => {
    globalThis.fetch = async () => { throw new Error('Unexpected fetch in isolated test') }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    while (subscriptions.length) subscriptions.pop()()
  })

  test('GET /orders/mine sends only the bearer token, without a client user ID', async () => {
    const controller = new AbortController()
    let calls = 0
    globalThis.fetch = async (url, init) => {
      calls += 1
      assert.equal(url, '/api/orders/mine')
      assert.equal(init.method, 'GET')
      assert.equal(init.headers.Authorization, 'Bearer fixture-session-token')
      assert.equal(init.headers.Accept, 'application/json')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.body, undefined)
      assert.ok(init.signal instanceof AbortSignal)
      assert.equal(init.signal.aborted, false)
      return jsonResponse([])
    }

    assert.deepEqual(await request('/orders/mine', {
      accessToken: 'fixture-session-token', signal: controller.signal,
    }), [])
    assert.equal(calls, 1)
  })

  test('public vehicle requests omit bearer tokens and browser credentials', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/vehicles')
      assert.equal(init.method, 'GET')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.headers.Authorization, undefined)
      assert.equal(init.headers['Content-Type'], undefined)
      assert.equal(init.body, undefined)
      return jsonResponse([])
    }

    assert.deepEqual(await request('/vehicles'), [])
  })

  test('authenticated 401 reports exactly the rejected token', async () => {
    const rejectedTokens = observeUnauthorized()
    globalThis.fetch = async () => jsonResponse({ message: 'Internal authentication details' }, 401)

    await assert.rejects(request('/orders/mine', { accessToken: 'fixture-old-token' }),
      (error) => assertSanitized(error, 401, ['Internal authentication details', 'fixture-old-token']))
    assert.deepEqual(rejectedTokens, ['fixture-old-token'])
  })

  test('failed login without a bearer token does not invalidate another session', async () => {
    const rejectedTokens = observeUnauthorized()
    globalThis.fetch = async () => jsonResponse({}, 401)

    await assert.rejects(request('/auth/login', {
      method: 'POST', body: { email: 'fixture@example.test', password: 'fixture-password' },
    }), (error) => error instanceof ApiError && error.status === 401)
    assert.deepEqual(rejectedTokens, [])
  })

  test('network failures hide raw errors, submitted credentials and bearer tokens', async () => {
    const sensitiveValues = ['fixture-sensitive-password', 'fixture-sensitive-token', 'internal-network-host']
    globalThis.fetch = async () => { throw new Error(sensitiveValues.join(' ')) }

    await assert.rejects(request('/auth/login', {
      method: 'POST',
      accessToken: sensitiveValues[1],
      body: { email: 'fixture@example.test', password: sensitiveValues[0] },
    }), (error) => assertSanitized(error, 0, sensitiveValues))
  })

  test('proxy HTML errors never enter UI error messages', async () => {
    const html = '<html>fixture-private-proxy-details</html>'
    globalThis.fetch = async () => new Response(html, { status: 503 })

    await assert.rejects(request('/vehicles'),
      (error) => assertSanitized(error, 503, [html, 'fixture-private-proxy-details']))
  })

  test('successful non-JSON responses become a sanitized bad-gateway error', async () => {
    const html = '<html>fixture-unexpected-server-page</html>'
    globalThis.fetch = async () => new Response(html, { status: 200 })

    await assert.rejects(request('/vehicles'),
      (error) => assertSanitized(error, 502, [html, 'fixture-unexpected-server-page']))
  })

  test('validation responses allow field names while discarding rejected values and server text', async () => {
    const sensitiveValues = ['fixture-rejected-password', 'fixture-server-validation-detail']
    globalThis.fetch = async () => jsonResponse({
      message: sensitiveValues[1],
      fields: ['email', 'password', 'role', null, { password: sensitiveValues[0] }],
      rejectedValue: sensitiveValues[0],
    }, 400)

    await assert.rejects(request('/auth/register', {
      method: 'POST',
      body: { firstName: 'Fixture', lastName: 'User', email: 'fixture@example.test', password: sensitiveValues[0] },
    }), (error) => {
      assertSanitized(error, 400, sensitiveValues)
      assert.deepEqual(error.fieldErrors, ['email', 'password'])
      return true
    })
  })

  test('request cancellation passes through the original AbortError', async () => {
    const abort = new DOMException('Fixture request cancelled', 'AbortError')
    globalThis.fetch = async () => { throw abort }

    await assert.rejects(request('/vehicles'), (error) => {
      assert.equal(error, abort)
      assert.equal(isAbortError(error), true)
      return true
    })
  })

  test('caller cancellation propagates through the internal fetch signal', async () => {
    const controller = new AbortController()
    const abort = new DOMException('Fixture caller cancelled', 'AbortError')
    let fetchSignal
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      fetchSignal = init.signal
      fetchSignal.addEventListener('abort', () => reject(fetchSignal.reason), { once: true })
    })

    const pending = request('/vehicles', { signal: controller.signal })
    const rejected = assert.rejects(pending, (error) => {
      assert.equal(error, abort)
      assert.equal(isAbortError(error), true)
      return true
    })
    assert.ok(fetchSignal instanceof AbortSignal)
    assert.equal(fetchSignal.aborted, false)
    controller.abort(abort)
    assert.equal(fetchSignal.aborted, true)
    assert.equal(fetchSignal.reason, abort)
    await rejected
  })

  test('a stalled request becomes HTTP 504 after 15 seconds using virtual time', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] })
    let fetchSignal
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      fetchSignal = init.signal
      fetchSignal.addEventListener('abort', () => reject(fetchSignal.reason), { once: true })
    })

    const pending = request('/vehicles')
    const rejected = assert.rejects(pending, (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 504)
      assert.equal(isAbortError(error), false)
      assert.deepEqual(error.fieldErrors, [])
      return true
    })
    assert.ok(fetchSignal instanceof AbortSignal)
    context.mock.timers.tick(14_999)
    assert.equal(fetchSignal.aborted, false)
    context.mock.timers.tick(1)
    assert.equal(fetchSignal.aborted, true)
    await rejected
  })
})
