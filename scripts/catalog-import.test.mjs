import test from 'node:test';
import assert from 'node:assert/strict';
import { findVehicle, existingRequest } from './catalog-import.mjs';

const existing = { id: 3, brand: 'Toyota', model: 'Corolla', year: 2023, price: 22900, mileage: 22000,
  fuelType: 'HYBRID', status: 'AVAILABLE', archived: false, version: 4, transmission: null,
  enginePowerHp: null, color: null, description: null, photos: [] };
const item = { key: 'toyota', match: { brand: 'Toyota', model: 'Corolla', year: 2023 },
  fill: { model: 'Corolla 1.8 Hybrid', enginePowerHp: 140, color: 'Siva' } };

test('reruns resolve the original ID after descriptive model enrichment, including archive', () => {
  const updated = { ...existing, ...item.fill, archived: true };
  assert.equal(findVehicle([updated], item).id, 3);
  assert.equal(findVehicle([updated], item, 3).id, 3);
});
test('ambiguous duplicates and changed recorded identities stop instead of adding another car', () => {
  assert.throws(() => findVehicle([existing, { ...existing, id: 5 }], item), /duplicate/);
  assert.throws(() => findVehicle([{ ...existing, model: 'Changed by owner' }], item, 3), /identity/);
});
test('existing updates preserve price, mileage, fuel, year, version and owner-filled metadata', () => {
  const body = existingRequest({ ...existing, color: 'Owner choice' }, item, 'Demo');
  assert.equal(body.color, 'Owner choice');
  for (const field of ['price','mileage','fuelType','year','version']) assert.equal(body[field], existing[field]);
  assert.equal(body.enginePowerHp, 140);
  assert.equal(body.status, undefined);
  assert.equal(body.archived, undefined);
});
test('SOLD and RESERVED specifications are never written or reset', () => {
  for (const status of ['SOLD', 'RESERVED']) assert.equal(existingRequest({ ...existing, status }, item, 'Demo'), null);
});
test('demo disclosure is added only once', () => {
  const v = { ...existing, description: 'Professional description\n\nDemo' };
  assert.equal(existingRequest(v, item, 'Demo').description, v.description);
});
