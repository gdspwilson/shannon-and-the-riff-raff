// Shared password check. Every change to the site goes through this.
import { createHash, timingSafeEqual } from 'node:crypto';
const sha = (v) => createHash('sha256').update(String(v)).digest();

export async function authed(req, res) {
  const given = req.headers['x-admin-key'] || '';
  const ok = !!process.env.ADMIN_PASSWORD && timingSafeEqual(sha(given), sha(process.env.ADMIN_PASSWORD));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 1500)); // slows down password guessing
    res.status(401).json({ error: 'Wrong password' });
  }
  return ok;
}
export const isJpeg = (b) => Buffer.isBuffer(b) && b.length > 1000 && b.length < 4400000 && b[0] === 0xff && b[1] === 0xd8;
