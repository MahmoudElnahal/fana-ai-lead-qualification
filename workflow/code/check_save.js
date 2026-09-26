// ─────────────────────────────────────────────────────────────
// Check Save / Booking  (deterministic guard after the agent)
// 1) CLEAN: n8n memory stores tool calls as text «[Used tools: …]»; the model sometimes
//    copies that into its reply. The customer must never see it → strip it.
// 2) RECOVER: if the model WROTE «Tool: Save_FANA_Lead, Input: {…}» instead of really
//    calling the tool, parse that input and save it for real (next nodes).
// 3) BOOKING: if the reply confirms a slot («تم حجز/تغيير») but nothing was saved,
//    write the Appointment ourselves.
// Any of the three → run the sheet + HubSpot sync.
// ─────────────────────────────────────────────────────────────
const pm = $('Prepare Message').first().json;
const raw = String($json.output || '');
const saved = JSON.stringify($json.intermediateSteps || []).includes('Save_FANA_Lead');

// read one JSON object starting at position i (balanced braces, strings respected)
function readJson(s, i) {
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return { text: s.slice(i, k + 1), end: k + 1 }; }
  }
  return null;
}

// 2) recover a save that was only written as text
let recovered = null;
const mark = raw.indexOf('Tool: Save_FANA_Lead, Input:');
if (!saved && mark !== -1) {
  const start = raw.indexOf('{', mark);
  const obj = start !== -1 ? readJson(raw, start) : null;
  try { recovered = obj ? JSON.parse(obj.text) : null; } catch (e) { recovered = null; }
}

// 1) strip every «Used tools: … Result: […]» block
let reply = raw;
for (let guard = 0; guard < 5 && reply.includes('Used tools'); guard++) {
  const i = reply.indexOf('Used tools');
  const from = reply[i - 1] === '[' ? i - 1 : i;
  const r = reply.indexOf('Result:', i);
  let end = -1;
  if (r !== -1) {
    const b = reply.indexOf('[', r);
    const block = b !== -1 ? readJson(reply, b) : null;
    end = block ? block.end : -1;
  }
  if (end === -1) { reply = reply.slice(0, from); break; }
  if (reply[from] === '[' && reply[end] === ']') end++;
  reply = (reply.slice(0, from) + reply.slice(end)).trim();
}
reply = reply.replace(/^[\],\s]+/, '').trim() || 'تم ✅ شكراً لك، وبيتواصل معك فريقنا قريب إن شاء الله.';

// 3) booking confirmed in words but not saved
const norm = (t) => String(t).replace(/[\s\-–:٫,،]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
let appointment = null;
if (/تم\s*(حجز|تغيير|تعديل|تأكيد)/.test(reply) || /موعدك/.test(reply)) {
  const r = norm(reply);
  appointment = (pm.slots || []).find((slot) => r.includes(norm(slot))) || null;
}
if (!appointment && recovered && recovered.appointment && recovered.appointment !== 'Not booked') appointment = recovered.appointment;

// a broken email must never reach HubSpot
if (recovered && recovered.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(recovered.email)) recovered.email = 'Unknown';

return [{ json: { lead_id: pm.lead_id, reply, saved, recovered, appointment, sync: saved || !!recovered || !!appointment } }];
