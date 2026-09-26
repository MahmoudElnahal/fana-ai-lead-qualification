// ─────────────────────────────────────────────────────────────
// Prepare Message  (deterministic, no AI)
// One place that turns ANY channel into the same shape for the agent:
//   • Telegram (bot chat)
//   • Webhook: website form / Meta lead form / Google lead form / WhatsApp / CSV row / tests
// Output: channel, lead_id (= sheet row + memory key), source, text, agent_input, duplicate flag.
// ─────────────────────────────────────────────────────────────
const inJson = $input.first().json;
const toAscii = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

// Saudi / GCC mobile → +9665XXXXXXXX (null if not valid)
function normMobile(v) {
  let m = toAscii(v).replace(/[^\d+]/g, '');
  if (m.startsWith('00')) m = '+' + m.slice(2);
  if (/^05\d{8}$/.test(m)) m = '+966' + m.slice(1);
  else if (/^5\d{8}$/.test(m)) m = '+966' + m;
  else if (/^9665\d{8}$/.test(m)) m = '+' + m;
  return /^\+9665\d{8}$/.test(m) ? m : null;
}

// ── 1) Call slots for the booking step (KSA time, Sun–Thu, 10:00 / 13:00 / 16:00) ──
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const K = 3 * 3600 * 1000;
const ksa = (t) => { const d = new Date(t + K); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() }; };
const now = Date.now();
const p = ksa(now);
const slots = [];
for (let i = 0; i < 21 && slots.length < 3; i++) {
  const midnight = Date.UTC(p.y, p.m, p.d + i) - K;
  const day = ksa(midnight + 12 * 3600 * 1000);
  if (day.dow === 5 || day.dow === 6) continue; // Fri / Sat off
  for (const h of [10, 13, 16]) {
    const t = midnight + h * 3600 * 1000;
    if (t < now + 2 * 3600 * 1000) continue;
    const part = h < 12 ? 'صباحاً' : h < 15 ? 'ظهراً' : 'عصراً';
    slots.push(`${slots.length + 1}) ${DAYS[day.dow]} ${day.d} ${MONTHS[day.m]} - الساعة ${h > 12 ? h - 12 : h}:00 ${part}`);
    if (slots.length === 3) break;
  }
}
const today = ksa(now);

// ── 2) Read the channel ──
let out;
if (inJson.message && inJson.message.chat) {
  // Telegram
  const msg = inJson.message;
  // Telegram re-delivers old updates after downtime: never answer a message older than 10 minutes
  if (Math.floor(now / 1000) - (msg.date || 0) > 600) return [];
  const from = msg.from || {};
  out = {
    channel: 'telegram',
    chat_id: msg.chat.id,
    lead_id: 'FANA-TG-' + msg.chat.id,
    source: 'Telegram',
    campaign: 'FANA Al Tilal Al Sharqiya Auction',
    text: toAscii(msg.text || msg.caption || '').trim(),
    name: [from.first_name, from.last_name].filter(Boolean).join(' ').replace(/[^\p{L}\p{M}\s'-]/gu, '').trim(),
    mobile: null,
    email: null,
    event_key: 'telegram:' + msg.message_id + ':' + msg.chat.id,
  };
} else {
  // Webhook: accept the field names each source really sends
  let b = inJson.body && typeof inJson.body === 'object' ? inJson.body : inJson;
  const wa = b.entry?.[0]?.changes?.[0]?.value;                 // WhatsApp Cloud API shape
  if (wa?.messages?.[0]) {
    const m = wa.messages[0];
    b = { source: 'whatsapp', from: m.from, text: m.text?.body, profile_name: wa.contacts?.[0]?.profile?.name, message_id: m.id };
  }
  if (Array.isArray(b.user_column_data)) {                        // Google Ads lead form shape
    const g = Object.fromEntries(b.user_column_data.map((c) => [c.column_id, c.string_value]));
    b = { ...b, source: b.source || 'google_form', full_name: g.FULL_NAME, phone_number: g.PHONE_NUMBER, email: g.EMAIL, city: g.CITY };
  }
  const pick = (...keys) => { for (const k of keys) if (b[k] !== undefined && b[k] !== null && String(b[k]).trim() !== '') return String(b[k]).trim(); return null; };
  const SOURCES = { whatsapp: 'WhatsApp', meta_form: 'Meta Lead Form', google_form: 'Google Lead Form', landing_page: 'Website Form', website: 'Website Chat', csv: 'CSV Import', test: 'Test' };
  const srcKey = (pick('source') || 'website').toLowerCase();
  const rawMobile = pick('phone', 'phone_number', 'mobile', 'Mobile', 'الجوال', 'رقم الجوال', 'from', 'wa_id');
  const mobile = normMobile(rawMobile);
  const email = (pick('email', 'Email', 'البريد', 'الإيميل') || '').toLowerCase();
  const eventId = pick('event_id', 'leadgen_id', 'lead_id', 'message_id', 'row_id');
  const session = pick('session_id', 'sessionId');
  const extra = [pick('العقار', 'asset', 'interest'), pick('الميزانية', 'budget')].filter(Boolean);
  out = {
    channel: 'webhook',
    chat_id: null,
    // one lead per person: chat session first, then mobile, then email, then the event
    lead_id: 'FANA-' + (session ? 'S-' + session : mobile ? 'M-' + mobile : email ? 'E-' + email : rawMobile ? 'R-' + toAscii(rawMobile).replace(/\D/g, '') : 'X-' + (eventId || now)),
    source: SOURCES[srcKey] || srcKey,
    campaign: pick('campaign', 'campaign_name', 'campaign_id') || 'FANA Al Tilal Al Sharqiya Auction',
    text: toAscii([pick('message', 'text', 'chatInput', 'الرسالة', 'ملاحظات'), ...extra].filter(Boolean).join(' - ')),
    name: pick('name', 'full_name', 'profile_name', 'الاسم', 'Name'),
    mobile,
    mobile_raw: rawMobile,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    event_key: eventId ? srcKey + ':' + eventId : null,
  };
}

// ── 3) Replayed event? (same source + event id already processed) ──
// Workflow static data persists between production executions of the active workflow.
const store = $getWorkflowStaticData('global');
store.seen = store.seen || [];
const duplicate = !!(out.event_key && store.seen.includes(out.event_key));
if (out.event_key && !duplicate) { store.seen.push(out.event_key); if (store.seen.length > 1000) store.seen.shift(); }

// ── 4) What the agent sees (customer message + internal context it must not show) ──
const known = [
  `القناة: ${out.source}`,
  `اسم العميل: ${out.name || 'غير معروف'}`,
  out.mobile ? `جوال العميل (من النموذج/القناة، لا تسأل عنه): ${out.mobile}` : out.mobile_raw ? `جوال مكتوب في النموذج وغير صحيح: ${out.mobile_raw}` : null,
  out.email ? `إيميل العميل: ${out.email}` : null,
].filter(Boolean).join('\n');

return [{
  json: {
    ...out,
    duplicate,
    slots: slots.map((x) => x.replace(/^\d\)\s*/, '')),
    agent_input:
      `رسالة العميل: ${out.text || '(رسالة فارغة - رحّب به واسأله عن العقار اللي يهمه)'}\n\n` +
      `[سياق داخلي - لا تعرضه كما هو]\n${known}\n` +
      `تاريخ اليوم (السعودية): ${DAYS[today.dow]} ${today.d} ${MONTHS[today.m]} ${today.y}\n` +
      `المواعيد المتاحة لمكالمة مستشار المبيعات (استخدمها كما هي فقط):\n${slots.join('\n')}`,
  },
}];
