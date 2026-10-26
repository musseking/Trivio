import { readFile, writeFile, mkdir, rename, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = path.join(root, '.local/catalog');
const fields = ['brand', 'model', 'year', 'price', 'mileage', 'fuelType', 'transmission', 'enginePowerHp', 'color', 'description'];
const normalize = (value) => value.normalize('NFKC').trim().toLocaleLowerCase('sr-Latn');
const same = (vehicle, target) => normalize(vehicle.brand) === normalize(target.brand)
  && normalize(vehicle.model) === normalize(target.model) && vehicle.year === target.year;
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

export function findVehicle(vehicles, item, recordedId) {
  if (recordedId != null) {
    const found = vehicles.find((v) => v.id === recordedId);
    if (!found || !same(found, item.match ?? item) && !same(found, { ...item.match, ...item.fill }))
      throw new Error(`Recorded identity changed: ${item.key}; inspect before retrying.`);
    return found;
  }
  const matches = vehicles.filter((v) => same(v, item.match ?? item)
    || item.match && same(v, { ...item.match, ...item.fill }));
  if (matches.length > 1) throw new Error(`Ambiguous duplicate: ${item.key}; no write performed.`);
  return matches[0];
}

export function existingRequest(vehicle, item, notice) {
  if (vehicle.status !== 'AVAILABLE') return null;
  // Existing identity, year, price, mileage, fuel, archive and lifecycle are preserved.
  const request = Object.fromEntries(fields.map((field) => [field, vehicle[field] ?? null]));
  for (const [field, value] of Object.entries(item.fill)) {
    if (field === 'model' && vehicle.model === item.match.model || request[field] == null || request[field] === '') request[field] = value;
  }
  if (request.description && !request.description.includes(notice)) request.description += '\n\n' + notice;
  return { ...request, version: vehicle.version };
}

async function atomicJson(file, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  try { if (await readFile(file, 'utf8') === content) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', content);
  for (let attempt = 0; ; attempt++) {
    try { await rename(file + '.tmp', file); break; }
    catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
      await delay(150 * (attempt + 1));
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const base = new URL(process.env.TRIVIO_CATALOG_API ?? 'http://127.0.0.1:8080/api');
  // Never send the private token to a remote host, URL credentials, query, or fragment.
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.protocol !== 'http:'
    || base.username || base.password || base.search || base.hash) throw new Error('Use a local HTTP API Gateway URL.');
  const token = (await readFile(path.join(root, '.catalog-owner-token'), 'utf8')).trim();
  if (!token || /\s/.test(token)) throw new Error('Missing or invalid private OWNER token file.');
  async function api(endpoint, method = 'GET', body) {
    let response;
    try {
      response = await fetch(base.href.replace(/\/$/, '') + endpoint, {
        method, redirect: 'error', headers: { Authorization: `Bearer ${token}`,
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000),
      });
    } catch { throw new Error(`${method} ${endpoint}: connection failed; inspect private journal before retrying.`); }
    if (!response.ok) throw new Error(`${method} ${endpoint}: HTTP ${response.status}; no automatic retry.`);
    return response.status === 204 ? null : response.json();
  }
  const user = await api('/auth/me');
  if (user.role !== 'OWNER' || user.enabled !== true) throw new Error('An enabled OWNER session is required.');
  const catalog = await readJson(path.join(root, 'docs/catalog/vehicles.json'));
  const photos = await readJson(path.join(root, 'docs/catalog/photos.json'));
  for (const photo of photos) {
    if (!/^[a-f0-9]{64}\.jpg$/.test(photo.file) || !photo.author || !photo.source.startsWith('https://commons.wikimedia.org/')
      || !/^https:\/\/creativecommons.org\/licenses\/by(?:-sa)?\/[1-4]\.0\/?$/.test(photo.licenseUrl))
      throw new Error('Unverified photo provenance.');
    const bytes = await readFile(path.join(local, 'assets', photo.file));
    if (createHash('sha256').update(bytes).digest('hex') !== photo.sha256 || bytes.length > 5 * 1024 * 1024)
      throw new Error('Missing, modified or oversized source photo: ' + photo.key);
  }
  await mkdir(local, { recursive: true });
  const lock = path.join(local, 'import.lock');
  await mkdir(lock); // Exclusive lock; a crash requires inspecting the journal before removing it.
  try {
    const journalPath = path.join(local, 'journal.json');
    let journal;
    try { journal = await readJson(journalPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    journal ??= { base: base.href, vehicles: {}, photos: {}, pendingPhoto: null };
    if (journal.base !== base.href) throw new Error('Journal belongs to another API installation.');
    if (journal.pendingPhoto) throw new Error('An earlier photo upload has an uncertain outcome. Inspect the API and journal before continuing.');
    const save = () => atomicJson(journalPath, journal);
    const before = await api('/vehicles/manage');
    if (!Array.isArray(before)) throw new Error('Unexpected managed vehicle response.');
    const items = [...catalog.existing, ...catalog.vehicles];
    // Resolve every identity before the first write, including archived vehicles.
    for (const item of items) {
      const found = findVehicle(before, item, journal.vehicles[item.key]);
      if (item.match && !found) throw new Error('Existing vehicle missing: ' + item.key);
      console.log(`${found ? 'Keep/update #' + found.id : 'Create'}: ${item.key}; ${photos.filter((p) => p.key === item.key).length} curated photos`);
    }
    if (!apply) { console.log('Read-only preview complete. Use --apply to back up and import.'); return; }
    const backup = spawnSync(process.env.TRIVIO_PYTHON ?? 'python', ['scripts/catalog-backup.py'], { cwd: root, encoding: 'utf8' });
    if (backup.status !== 0) throw new Error('Private database/media backup failed. No writes performed.');
    console.log(backup.stdout.trim());
    await atomicJson(path.join(local, 'before.json'), before);
    const creditsPath = path.join(root, 'frontend/src/data/catalog-photo-credits.json');
    const credits = await readJson(creditsPath);
    const mediaHashes = new Map();
    async function mediaHash(photo) {
      if (!/^\/api\/vehicles\/media\/[0-9a-f-]{36}\.jpg$/.test(photo.url)) throw new Error('Invalid public media URL.');
      if (!mediaHashes.has(photo.url)) {
        const response = await fetch(base.origin + photo.url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error('Cannot verify imported media content.');
        mediaHashes.set(photo.url, createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'));
      }
      return mediaHashes.get(photo.url);
    }
    for (const item of items) {
      const managed = await api('/vehicles/manage');
      let vehicle = findVehicle(managed, item, journal.vehicles[item.key]);
      if (!vehicle) {
        const body = Object.fromEntries(fields.map((field) => [field, item[field]]));
        body.description += '\n\n' + catalog.notice;
        vehicle = await api('/vehicles', 'POST', body);
      }
      journal.vehicles[item.key] = vehicle.id;
      await save();
      if (item.match) {
        const body = existingRequest(vehicle, item, catalog.notice);
        if (body && fields.some((field) => body[field] !== (vehicle[field] ?? null)))
          vehicle = await api(`/vehicles/${vehicle.id}`, 'PUT', body);
        else if (!body) console.log(`Preserving locked ${vehicle.status} specifications: #${vehicle.id}`);
      }
      let currentPhotos = await api(`/vehicles/${vehicle.id}/photos`);
      for (const photo of photos.filter((p) => p.key === item.key).sort((a,b) => a.position-b.position)) {
        const photoKey = `${vehicle.id}:${photo.sha256}`;
        let uploaded = currentPhotos.find((p) => p.id === journal.photos[photoKey]);
        // Recover from a missing local journal using published attribution for this exact media URL.
        if (!uploaded && !journal.photos[photoKey]) {
          const known = [];
          for (const candidate of currentPhotos) {
            const credit = credits[await mediaHash(candidate)];
            if (credit?.source === photo.source && credit?.title === photo.title) known.push(candidate);
          }
          if (known.length > 1) throw new Error('Ambiguous imported photo attribution; inspect before continuing.');
          if (known.length === 1) { uploaded = known[0]; journal.photos[photoKey] = uploaded.id; await save(); }
        }
        if (!uploaded) {
          // A journaled image removed by the owner stays removed; never re-add it silently.
          if (journal.photos[photoKey]) throw new Error(`Owner removed imported photo for #${vehicle.id}; inspect before continuing.`);
          if (currentPhotos.length >= 10) throw new Error('Photo limit reached; existing images preserved.');
          journal.pendingPhoto = { vehicleId: vehicle.id, sha256: photo.sha256, previousIds: currentPhotos.map((p) => p.id) };
          await save();
          const form = new FormData();
          form.append('files', new Blob([await readFile(path.join(local, 'assets', photo.file))], { type: 'image/jpeg' }), photo.file);
          const result = await api(`/vehicles/${vehicle.id}/photos`, 'POST', form);
          const added = result.filter((p) => !currentPhotos.some((old) => old.id === p.id));
          if (added.length !== 1) throw new Error('Ambiguous photo response; stopped to prevent duplicates.');
          uploaded = added[0]; currentPhotos = result;
          journal.photos[photoKey] = uploaded.id;
          journal.pendingPhoto = null;
          await save();
        }
        credits[await mediaHash(uploaded)] = Object.fromEntries(['title','author','source','license','licenseUrl','changes'].map((f) => [f, photo[f]]));
        await atomicJson(creditsPath, credits);
      }
      console.log(`Imported #${vehicle.id}: ${item.key}; status ${vehicle.status}; ${currentPhotos.length} photos`);
    }
    const after = await api('/vehicles/manage');
    for (const original of before) {
      const current = after.find((v) => v.id === original.id);
      if (!current || current.status !== original.status || current.archived !== original.archived
        || current.price !== original.price || current.mileage !== original.mileage
        || original.photos.some((photo) => !current.photos.some((p) => p.id === photo.id)))
        throw new Error('Preservation check failed for #' + original.id);
    }
    await atomicJson(path.join(local, 'after.json'), after);
    console.log(`Verified: ${after.length} vehicles, preserved original IDs/statuses/prices/mileages/photos.`);
  } finally { await rmdir(lock); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
