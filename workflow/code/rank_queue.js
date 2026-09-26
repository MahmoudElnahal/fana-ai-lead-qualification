// ─────────────────────────────────────────────────────────────
// Rank Sales Queue: not just "sort by score".
// Order: priority → asked for a human → call booked → money ready → timeline → score → most recent.
// Writes "Sales Queue Rank" back to the sheet (1 = call first). Disqualified get no rank.
// ─────────────────────────────────────────────────────────────
const rows = $input.all().map((i) => i.json).filter((r) => r['Lead ID']);
const P = { P1: 0, P2: 1, P3: 2 };
const FIN = { 'Cash ready': 0, 'Pre-approved financing': 1, 'Financing needed': 2, 'Not ready': 4 };
const TL = { Immediately: 0, 'Within 1 month': 1, '1–3 months': 2, '3–6 months': 3, '6+ months': 4 };
const key = (r) => [
  P[r['Priority']] ?? 9,
  r['Qualification Status'] === 'Human requested' ? 0 : 1,
  r['Appointment'] && r['Appointment'] !== 'Not booked' ? 0 : 1,
  FIN[r['Financial Readiness']] ?? 3,
  TL[r['Timeline']] ?? 5,
  -(Number(r['Score']) || 0),
  -(Date.parse(String(r['Last Interaction'] || '').replace(' ', 'T')) || 0),
];
const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const ranked = rows.filter((r) => r['Priority'] in P).sort(cmp);
const out = ranked.map((r, i) => ({ json: { 'Lead ID': r['Lead ID'], 'Sales Queue Rank': i + 1 } }));
rows.filter((r) => !(r['Priority'] in P)).forEach((r) => out.push({ json: { 'Lead ID': r['Lead ID'], 'Sales Queue Rank': '-' } }));
return out;
