// GET  /api/poster -> {url} of the newest show poster (anyone can view)
// POST /api/poster -> saves a new poster (password required)
import { put, list } from '@vercel/blob';
import { authed, isJpeg } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { blobs } = await list({ prefix: 'poster/' });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(blobs[0] ? { url: blobs[0].url } : {});
  }
  if (req.method === 'POST') {
    if (!(await authed(req, res))) return;
    if (!isJpeg(req.body)) return res.status(400).json({ error: 'Please upload a picture under 4 MB.' });
    const blob = await put('poster/' + Date.now() + '.jpg', req.body, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false });
    return res.status(200).json({ url: blob.url });
  }
  return res.status(405).end();
}
