/** Re-download curated, licensed source bytes to the private import cache. No hotlinking in UI. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const photos = JSON.parse(await readFile(path.join(root, 'docs/catalog/photos.json'), 'utf8'));
const directory = path.join(root, '.local/catalog/assets');
await mkdir(directory, { recursive: true });
for (const photo of photos) {
  if (!/^[a-f0-9]{64}\.jpg$/.test(photo.file)) throw new Error('Invalid asset filename.');
  const url = new URL(photo.downloadUrl);
  if (url.protocol !== 'https:' || !['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname))
    throw new Error('Source must be Wikimedia HTTPS media.');
  const destination = path.join(directory, photo.file);
  let cached;
  try { cached = await readFile(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (cached && createHash('sha256').update(cached).digest('hex') === photo.sha256) continue;
  const response = await fetch(url, { redirect: 'error', headers: { 'User-Agent': 'TrivioDemoCatalog/1.0 (educational project)' }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Photo download failed: HTTP ${response.status}; rerun later to resume.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== photo.sha256)
    throw new Error('Source changed: review image and license before updating the curated manifest.');
  await writeFile(destination, bytes);
  console.log('Downloaded licensed photo: ' + photo.key);
}
console.log(`Verified ${photos.length} licensed source files in private cache.`);
