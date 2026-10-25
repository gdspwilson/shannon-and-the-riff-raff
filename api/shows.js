// GET /api/shows -> the next 5 upcoming gigs, read from the band's PRIVATE Google Calendar address.
// The calendar itself stays private: only title, date, time and place are sent to the website.
// Vercel setting needed:  CAL_ICS_URL  = the calendar's "Secret address in iCal format"
// Optional settings:      CAL_FILTER   = only events whose title contains this word (for example "gig")
//                         CAL_TZ       = time zone for the band (default America/New_York)
const TZ = process.env.CAL_TZ || 'America/New_York';
const unfold = (t) => t.replace(/\r?\n[ \t]/g, '');
const unesc = (v) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

function offsetMin(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000;
}
function zoned(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMin(new Date(guess), tz) * 60000;
  t = guess - offsetMin(new Date(t), tz) * 60000;
  return new Date(t);
}
function parseDate(key, val) {
  const m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?)?(Z)?$/.exec(val.trim());
  if (!m) return null;
  const [, y, mo, da, h, mi, , z] = m;
  if (h === undefined) return { d: zoned(+y, +mo, +da, 12, 0, TZ), allDay: true };
  if (z) return { d: new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi)), allDay: false };
  const tz = /TZID=([^;:]+)/.exec(key);
  return { d: zoned(+y, +mo, +da, +h, +mi, tz ? tz[1] : TZ), allDay: false };
}


// If the location starts with a venue name ("Carmine's Bar, 389 Main St, ..."), keep only the street address onward.
// A leading piece is dropped only when it has no digits and a later piece starts with a street number.
function streetOnly(place) {
  const parts = place.split(',').map((x) => x.trim()).filter(Boolean);
  const i = parts.findIndex((x) => /^\d/.test(x));
  if (i > 0 && !parts.slice(0, i).some((x) => /\d/.test(x))) return parts.slice(i).join(', ');
  return place;
}

export default async function handler(req, res) {
  const url = process.env.CAL_ICS_URL;
  if (!url) return res.status(200).json({ shows: [] });
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('calendar ' + r.status);
    const text = unfold(await r.text());
    const now = Date.now(), only = (process.env.CAL_FILTER || '').toLowerCase(), shows = [];
    for (const block of text.split('BEGIN:VEVENT').slice(1)) {
      const body = block.split('END:VEVENT')[0], props = {};
      for (const line of body.split(/\r?\n/)) {
        const i = line.indexOf(':'); if (i < 0) continue;
        const key = line.slice(0, i), name = key.split(';')[0];
        if (!(name in props)) props[name] = { key, val: line.slice(i + 1) };
      }
      if (!props.DTSTART || /CANCELLED/i.test(props.STATUS?.val || '')) continue;
      const st = parseDate(props.DTSTART.key, props.DTSTART.val); if (!st) continue;
      const en = props.DTEND ? parseDate(props.DTEND.key, props.DTEND.val) : null;
      const endMs = en ? en.d.getTime() : st.d.getTime() + 3 * 3600e3;
      if (endMs < now) continue; // already over: drops off automatically
      const title = unesc(props.SUMMARY?.val || 'Show');
      if (only && !title.toLowerCase().includes(only)) continue;
      let place = unesc(props.LOCATION?.val || '').replace(/,?\s*USA$/, '');
      if (place.toLowerCase().startsWith(title.toLowerCase())) place = place.slice(title.length).replace(/^[,\s]+/, '');
      place = streetOnly(place); // Google often puts the venue name first; the title already shows it
      shows.push({ s: st.d.toISOString(), e: en && !st.allDay ? en.d.toISOString() : null, allDay: st.allDay, t: title, p: place });
    }
    shows.sort((a, b) => new Date(a.s) - new Date(b.s));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ shows: shows.slice(0, 5) });
  } catch (e) {
    return res.status(200).json({ shows: [] }); // the site falls back to its saved list
  }
}
