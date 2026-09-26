// ─────────────────────────────────────────────────────────────
// 10 test scenarios (synthetic data). Each line = one customer message, sent in order
// to the Lead Webhook, so the agent really has the conversation.
// ⚠ Paste YOUR production URL of "Lead Webhook" below (workflow must be Active/Published).
// ─────────────────────────────────────────────────────────────
const WEBHOOK_URL = 'https://YOUR-N8N-DOMAIN/webhook/fana-lead';
const run = $now.toFormat('MMddHHmm');  // new chat each run (fresh memory), same phones → same HubSpot contact

const OK = 'ايوه صح، تمام';
const CONTACT = (city) => `واتساب، من ${city}`;
const S = [
  { id: 1, title: 'مشتري جاهز (Hot buyer)', expect: { priority: ['P1'] }, expectText: 'P1 · Qualified', src: 'whatsapp', phone: '0550000001', name: 'فهد العتيبي', turns: [
    'السلام عليكم، أبي فيلا النخيل بالدمام، ميزانيتي مليون كاش وجاهز أدخل المزاد', CONTACT('الدمام'), OK] },
  { id: 2, title: 'يحتاج تمويل', expect: { priority: ['P2'], reasonHas: 'تمويل' }, expectText: 'P2 (مو P1) والسبب يذكر التمويل', src: 'meta_form', phone: '0550000002', name: 'خالد الدوسري', turns: [
    'مهتم بالأرض التجارية في المريكبات، ميزانيتي حوالي مليون ومية ألف، بس أحتاج تمويل من البنك ولسه ما قدمت، وناوي أدخل المزاد', CONTACT('الخبر'), OK] },
  { id: 3, title: 'يسأل عن الأسعار فقط (Browser)', expect: { priority: ['P3'] }, expectText: 'P3 · Browsing', src: 'whatsapp', phone: '0550000003', name: 'ريم', turns: [
    'كم أسعار الفلل عندكم؟', 'بس أسأل عن الأسعار حالياً، ما عندي نية شراء واضحة، وكلموني بعدين', 'اتصال، من الرياض', OK] },
  { id: 4, title: 'بيانات ناقصة', expect: { saved: false }, expectText: 'ما يحفظ ولا يخترع، يسأل عن العقار', src: 'landing_page', phone: '٠٥٥٠٠٠٠٠٠٤', name: 'سعد', turns: [''] },
  { id: 5, title: 'نفس العميل من قناتين + حدث مكرر', expect: { priority: ['P1', 'P2'], duplicateIgnored: true }, expectText: 'سجل واحد + الحدث المكرر يتجاهل', src: 'meta_form', phone: '0550000005', name: 'نورة القحطاني', event: 'mt-5001', turns: [
    'مهتمة بشقة النور، ميزانيتي ٣٥٠ ألف كاش، وأبي أدخل المزاد', { src: 'whatsapp', phone: '966550000005', text: CONTACT('الدمام') }, { src: 'whatsapp', phone: '966550000005', text: OK },
    { replay: true }] },
  { id: 6, title: 'عربي طبيعي (لهجة)', expect: { priority: ['P1', 'P2'], typeHas: 'Residential' }, expectText: 'يفهم عمارة سكنية + ميزانية تقريبية', src: 'whatsapp', phone: '0550000006', name: 'ماجد', turns: [
    'والله ناوي أستثمر، يمكن عمارة سكنية، الميزانية تقريباً مليونين وشوي، والتمويل معتمد من البنك، وإذا الوضع زين ندخل خلال شهر', CONTACT('الدمام'), OK] },
  { id: 7, title: 'العميل غيّر الميزانية', expect: { priority: ['P1'], budgetHas: '1,500,000' }, expectText: 'الميزانية الجديدة 1.5 مليون ← P1', src: 'whatsapp', phone: '0550000007', name: 'سلطان', turns: [
    'مهتم بفيلا العقربية بالخبر، ميزانيتي حوالي مليون، كاش وجاهز للمزاد', 'لا أقول لك خلها مليون ونص', CONTACT('الخبر'), OK] },
  { id: 8, title: 'عميل موجود مسبقاً في HubSpot', expect: { priority: ['P1', 'P2', 'P3'], hubspot: true }, expectText: 'يحدّث نفس الـ Contact بدون تكرار', src: 'landing_page', phone: '0550000008', name: 'عبدالله الشمري', turns: [
    'مهتم بالعمارة التجارية في التحلية، ميزانيتي ٣ مليون ونص كاش، خلال شهر', CONTACT('الخبر'), OK] },
  { id: 9, title: 'الوكيل غير متأكد', expect: { status: ['Needs clarification'], notDisq: true }, expectText: 'Needs clarification · مو Disqualified', src: 'whatsapp', phone: '0550000009', name: 'تركي', turns: [
    'مهتم بالعمارة التجارية في النزهة', 'الميزانية على حسب', 'والله ما أدري، على حسب', 'كاش، وجاد، خلال شهر', CONTACT('الدمام'), OK] },
  { id: 10, title: 'طلب موظف', expect: { status: ['Human requested'], notBelowP2: true }, expectText: 'Human requested · P2 على الأقل', src: 'whatsapp', phone: '0550000010', name: 'هند', turns: [
    'ما أبي أتكلم مع بوت، أبي موظف يكلمني بخصوص فيلا الفيحاء', CONTACT('الدمام'), OK] },
];

const out = [];
for (const s of S) {
  s.turns.forEach((t, i) => {
    const o = typeof t === 'string' ? { text: t } : t;
    const body = o.replay
      ? { source: s.src, event_id: s.event, full_name: s.name, phone: s.phone, message: s.turns[0] }  // same event again
      : { source: o.src || s.src, session_id: `test${run}-${s.id}`, name: s.name, phone: o.phone || s.phone, message: o.text,
          ...(i === 0 && s.event ? { event_id: s.event } : {}) };
    // scenario 5 must share ONE lead across 2 channels → key by mobile, not by chat session
    if (s.id === 5) delete body.session_id;
    if (s.id === 5 && i === 0) body.event_id = `${s.event}-${run}`;
    if (s.id === 5 && o.replay) body.event_id = `${s.event}-${run}`;
    out.push({ json: { url: WEBHOOK_URL, scenario: s.id, title: s.title, expectText: s.expectText, expect: s.expect, turn: i + 1, replay: !!o.replay,
      lead_id: s.id === 5 ? 'FANA-M-+966550000005' : `FANA-S-test${run}-${s.id}`, body } });
  });
}
return out;
