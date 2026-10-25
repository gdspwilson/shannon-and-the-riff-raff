// GET /api/ics?s=<start ISO>&e=<end ISO>&t=<title>&p=<place>
// Returns one calendar event. iPhones show "Add to Calendar" when they open this address.
const esc = (v) => String(v || '').replace(/[\r\n]+/g, ' ').replace(/[,;\\]/g, '\\$&').slice(0, 200);
const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

export default function handler(req, res) {
  const { s, e, t, p } = req.query || {};
  const start = new Date(String(s || '')), end = new Date(String(e || ''));
  if (isNaN(start) || isNaN(end) || end <= start || end - start > 24 * 3600e3) return res.status(400).send('Bad event');
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shannon and The Riff Raff//EN', 'BEGIN:VEVENT',
    'UID:' + stamp(start) + '@shannonandtheriffraff.com', 'DTSTAMP:' + stamp(new Date()),
    'DTSTART:' + stamp(start), 'DTEND:' + stamp(end), 'SUMMARY:' + esc(t), 'LOCATION:' + esc(p),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="riff-raff-show.ics"');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(body);
}
