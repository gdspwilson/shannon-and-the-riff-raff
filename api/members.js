// GET  /api/members -> {urls:{shannon:url, ...}} replacement photos for band members
// POST /api/members?k=<member> -> replaces that member's photo (password required)
import { put, list } from '@vercel/blob';
import { authed, isJpeg } from './_lib.js';

const KEYS = ['shannon', 'mark', 'ric', 'steve', 'nick', 'pat'];

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { blobs } = await list({ prefix: 'members/' });
    const urls = {};
    for (const b of blobs) {
      const k = b.pathname.replace(/^members\//, '').replace(/\.jpg$/, '');
      if (KEYS.includes(k)) urls[k] = b.url + '?v=' + new Date(b.uploadedAt).getTime();
    }
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ urls });
  }
  if (req.method === 'POST') {
    if (!(await authed(req, res))) return;
    const k = String(req.query?.k || '');
    if (!KEYS.includes(k)) return res.status(400).json({ error: 'Unknown band member' });
    if (!isJpeg(req.body)) return res.status(400).json({ error: 'Please upload a picture under 4 MB.' });
    const blob = await put('members/' + k + '.jpg', req.body, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    return res.status(200).json({ url: blob.url + '?v=' + Date.now() });
  }
  return res.status(405).end();
}
