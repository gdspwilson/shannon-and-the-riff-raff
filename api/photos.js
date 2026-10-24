// GET  /api/photos -> {urls:[...]} every band photo (the site shuffles them)
// POST /api/photos -> adds one photo (password required)
import { put, list } from '@vercel/blob';
import { authed, isJpeg } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const urls = []; let cursor;
    do {
      const page = await list({ prefix: 'photos/', limit: 1000, cursor });
      page.blobs.forEach((b) => urls.push(b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ urls });
  }
  if (req.method === 'POST') {
    if (!(await authed(req, res))) return;
    if (!isJpeg(req.body)) return res.status(400).json({ error: 'Please upload a picture under 4 MB.' });
    const name = 'photos/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
    const blob = await put(name, req.body, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false });
    return res.status(200).json({ url: blob.url });
  }
  return res.status(405).end();
}
