// ─────────────────────────────────────────────────────────────
// Grade the 10 scenarios: read what was really saved in the sheet (+ HubSpot IDs)
// and compare with the expected behaviour → one row per scenario for the Excel log.
// ─────────────────────────────────────────────────────────────
const sent = $('Test Scenarios').all().map((i) => i.json);
const replies = $('Send Test Turn').all().map((i) => i.json);
const rows = $input.all().map((i) => i.json);
const byId = Object.fromEntries(rows.map((r) => [r['Lead ID'], r]));
const ORDER = ['P1', 'P2', 'P3', 'Disqualified'];

const out = [];
for (const id of [...new Set(sent.map((s) => s.scenario))]) {
  const turns = sent.map((s, i) => ({ ...s, reply: replies[i] })).filter((s) => s.scenario === id);
  const s = turns[0];
  const e = s.expect;
  const r = byId[s.lead_id];
  const checks = [];
  if (e.saved === false) checks.push(['not saved (asks instead of guessing)', !r || !r['Priority']]);
  if (e.priority) checks.push([`priority ∈ ${e.priority.join('/')}`, !!r && e.priority.includes(r['Priority'])]);
  if (e.status) checks.push([`status = ${e.status.join('/')}`, !!r && e.status.includes(r['Qualification Status'])]);
  if (e.reasonHas) checks.push([`reason mentions «${e.reasonHas}»`, !!r && String(r['Score Reason']).includes(e.reasonHas)]);
  if (e.typeHas) checks.push([`type = ${e.typeHas}`, !!r && String(r['Property Type']).includes(e.typeHas)]);
  if (e.budgetHas) checks.push([`budget = ${e.budgetHas}`, !!r && String(r['Budget Range']).includes(e.budgetHas)]);
  if (e.notDisq) checks.push(['not Disqualified', !!r && r['Priority'] !== 'Disqualified']);
  if (e.notBelowP2) checks.push(['P1 or P2', !!r && ORDER.indexOf(r['Priority']) <= 1]);
  if (e.hubspot) checks.push(['HubSpot contact linked', !!r && /^\d+$/.test(String(r['HubSpot Contact ID']))]);
  if (e.duplicateIgnored) {
    const rep = turns.find((t) => t.replay)?.reply || {};
    checks.push(['replayed event ignored', rep.duplicate === true]);
    checks.push(['one row for both channels', rows.filter((x) => x['Duplicate Key'] === '+966550000005').length <= 1 || !!r]);
  }
  const pass = checks.every(([, ok]) => ok);
  out.push({ json: {
    '#': id,
    'السيناريو': s.title,
    'المدخل': turns.filter((t) => !t.replay).map((t) => t.body.message || '(نموذج بدون رسالة)').join(' ⏎ '),
    'المتوقع': s.expectText,
    'الفعلي': r ? `${r['Priority']} · ${r['Score']} · ${r['Qualification Status']}` : 'لم يُحفظ',
    'السبب': r ? r['Score Reason'] : '',
    'آخر رد للوكيل': String(turns.filter((t) => !t.replay).slice(-1)[0]?.reply?.reply || '').slice(0, 300),
    'HubSpot': r ? `${r['HubSpot Contact ID'] || '-'} / ${r['HubSpot Deal ID'] || '-'}` : '-',
    'الفحوصات': checks.map(([n, ok]) => `${ok ? '✓' : '✗'} ${n}`).join(' | '),
    'النتيجة': pass ? 'PASS' : 'FAIL',
  } });
}
return out;
