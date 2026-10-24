// GET  /api/videos -> {slots:[{id,title}|null x4]} slot 0 is the Highlight Reel
// POST /api/videos -> {slot, url, title} swaps one video (password required)
import { put, list } from '@vercel/blob';
import { authed } from './_lib.js';

const FILE = 'config/videos.json';
async function read() {
  const { blobs } = await list({ prefix: FILE });
  if (!blobs[0]) return { slots: [] };
  const r = await fetch(blobs[0].url + '?v=' + new Date(blobs[0].uploadedAt).getTime());
  return r.ok ? await r.json() : { slots: [] };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(await read());
  }
  if (req.method === 'POST') {
    if (!(await authed(req, res))) return;
    const { slot, url, title } = req.body || {};
    const id = /(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/.exec(String(url || ''))?.[1];
    if (!id || !Number.isInteger(slot) || slot < 0 || slot > 3) return res.status(400).json({ error: 'Not a YouTube link' });
    let name = String(title || '').trim().slice(0, 80);
    if (!name) {
      try {
        const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
        if (o.ok) name = (await o.json()).title || '';
      } catch (e) { /* the tile just keeps its old title */ }
    }
    const data = await read();
    const slots = Array.from({ length: 4 }, (_, i) => data.slots[i] || null);
    slots[slot] = { id, title: name };
    await put(FILE, JSON.stringify({ slots }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    return res.status(200).json({ slots });
  }
  return res.status(405).end();
}
