import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_STORAGE_KEY, readStoredSession, saveStoredSession, clearStoredSession } from '../src/auth/session-storage.ts';

function memoryStorage(raw) {
  const values = new Map(raw === undefined ? [] : [[SESSION_STORAGE_KEY, raw]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('reload preserves the original deadline and excludes profile, role and password', () => {
  const storage = memoryStorage();
  saveStoredSession({ accessToken: 'fixture-token', expiresAt: 10000, user: { role: 'OWNER' }, password: 'never-save' }, storage);
  assert.deepEqual(JSON.parse(storage.getItem(SESSION_STORAGE_KEY)), { accessToken: 'fixture-token', expiresAt: 10000 });
  assert.deepEqual(readStoredSession(storage, 9000), { accessToken: 'fixture-token', expiresAt: 10000 });
  assert.equal(readStoredSession(storage, 10000), null);
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), null);
});

test('malformed, expired and invalid session data is discarded', () => {
  for (const raw of ['{', 'null', '[]', '"text"', '{"accessToken":"x","expiresAt":"99999"}',
    '{"accessToken":"x y","expiresAt":99999}', '{"accessToken":"","expiresAt":99999}',
    '{"accessToken":"x","expiresAt":9000}', '{"accessToken":"x","expiresAt":99999.5}']) {
    const storage = memoryStorage(raw);
    assert.equal(readStoredSession(storage, 9000), null);
    assert.equal(storage.getItem(SESSION_STORAGE_KEY), null);
  }
});

test('stored identity and OWNER claims are never returned as trusted session data', () => {
  const storage = memoryStorage(JSON.stringify({ accessToken: 'fixture', expiresAt: 10000, role: 'OWNER', user: { id: 123 } }));
  assert.deepEqual(readStoredSession(storage, 9000), { accessToken: 'fixture', expiresAt: 10000 });
});

test('logout clears the saved credential without removing unrelated browser preferences', () => {
  const storage = memoryStorage();
  storage.setItem('trivio.theme', 'dark');
  saveStoredSession({ accessToken: 'fixture', expiresAt: 10000 }, storage);
  clearStoredSession(storage);
  assert.equal(readStoredSession(storage, 9000), null);
  assert.equal(storage.getItem('trivio.theme'), 'dark');
});

test('blocked browser storage does not break login, restoration or logout', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(readStoredSession(blocked), null);
  assert.doesNotThrow(() => saveStoredSession({ accessToken: 'fixture', expiresAt: 10000 }, blocked));
  assert.doesNotThrow(() => clearStoredSession(blocked));
});
