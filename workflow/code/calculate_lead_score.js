// calculate_lead_score (Code Tool): deterministic, explainable scoring.
// The LLM only EXTRACTS facts; score, priority, status, labels are computed HERE,
// so identical facts always give the identical result.
const q = typeof query === 'string' ? JSON.parse(query) : (query || {});
const CATALOG = {
  'TS-01': ['أرض تجارية - المريكبات (476 م²)', 'land', 1150000], 'TS-02': ['أرض تجارية - المريكبات (448 م²)', 'land', 1050000],
  'TS-03': ['فيلا سكنية - الفيحاء', 'villa', 1100000], 'TS-04': ['فيلا سكنية - النخيل', 'villa', 930000],
  'TS-05': ['فيلا سكنية - العقربية', 'villa', 1300000], 'TS-06': ['عمارة سكنية - الجلوية', 'residential_building', 1850000],
  'TS-07': ['عمارة سكنية - طيبة', 'residential_building', 2220000], 'TS-08': ['عمارة تجارية - التحلية', 'commercial_building', 3100000],
  'TS-09': ['عمارة تجارية - النزهة', 'commercial_building', 5100000], 'TS-10': ['شقة سكنية - النور', 'apartment', 304000],
  'TS-11': ['فيلا سكنية - طيبة', 'villa', 1250000],
};
const TYPE_LABEL = { villa: 'Villa', apartment: 'Apartment', land: 'Land', residential_building: 'Residential Building', commercial_building: 'Commercial Building' };
const W = {
  budget: { Strong: 20, Partial: 10, Unknown: 5, Poor: 0 },
  asset: { Strong: 15, Partial: 8, Unknown: 4, Poor: 0 },
  fin: { 'Cash ready': 20, 'Pre-approved financing': 15, 'Financing needed': 8, Unknown: 4, 'Not ready': 0 },
  tl: { Immediately: 15, 'Within 1 month': 12, '1–3 months': 8, '3–6 months': 4, '6+ months': 0, Unknown: 3 },
  intent: { 'Ready to participate': 30, Serious: 20, Browsing: 5, 'No intent': 0, Unknown: 5 },
};
const pick = (v, obj) => (v in obj ? v : 'Unknown');
const fin = pick(q.financial_readiness, W.fin);
const tl = pick(String(q.timeline || '').replace('-', '–'), W.tl);
let intent = pick(q.intent_strength, W.intent);
const uncertain = Array.isArray(q.uncertain_fields) ? q.uncertain_fields.filter((f) => f && f !== 'Unknown') : [];

// mobile: KSA / GCC only, otherwise invalid (agent asks again)
let m = String(q.mobile || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
if (m.startsWith('00')) m = '+' + m.slice(2);
if (/^05\d{8}$/.test(m)) m = '+966' + m.slice(1);
else if (/^5\d{8}$/.test(m)) m = '+966' + m;
else if (/^9665\d{8}$/.test(m)) m = '+' + m;
const mobileValid = /^\+9665\d{8}$/.test(m) || /^\+(971|965|973|974|968)\d{8,9}$/.test(m);

// asset fit: only real catalog assets count
const id = CATALOG[q.interested_asset_id] ? q.interested_asset_id : null;
const type = id ? CATALOG[id][1] : (TYPE_LABEL[q.property_type] ? q.property_type : null);
const typeIds = Object.keys(CATALOG).filter((k) => CATALOG[k][1] === type);
let assetFit = 'Unknown';
if (id) assetFit = 'Strong';
else if (typeIds.length) assetFit = 'Partial';
else if (q.property_type && q.property_type !== 'Unknown') assetFit = 'Poor'; // something the auction doesn't have

// budget fit vs opening prices
const bmin = Number(q.budget_min_sar) || 0;
const bmax = Number(q.budget_max_sar) || 0;
const ref = bmax || bmin;
const budgetKnown = !!ref && !uncertain.includes('budget');
const pool = (id ? [id] : typeIds.length ? typeIds : Object.keys(CATALOG)).map((k) => CATALOG[k][2]);
const cheapest = Math.min(...Object.values(CATALOG).map((a) => a[2]));
let budgetFit = 'Unknown';
if (budgetKnown) {
  if (pool.some((x) => ref >= x)) budgetFit = 'Strong';
  else if (pool.some((x) => ref >= x * 0.9)) budgetFit = 'Partial';
  else budgetFit = 'Poor';
}

// contradiction guard: gave budget + payment + timeline → not "just browsing"
if (intent === 'Browsing' && budgetKnown && fin !== 'Unknown' && tl !== 'Unknown') intent = 'Serious';

const breakdown = { budget_fit: W.budget[budgetFit], asset_fit: W.asset[assetFit], financial_readiness: W.fin[fin], timeline: W.tl[tl], intent_strength: W.intent[intent] };
const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

// priority gates (first match wins). Missing info NEVER disqualifies.
const ORDER = ['P1', 'P2', 'P3', 'Disqualified'];
let priority; let status;
if (q.do_not_contact) { priority = 'Disqualified'; status = 'Disqualified'; }
else if (intent === 'No intent') { priority = 'Disqualified'; status = 'Disqualified'; }
else if (budgetKnown && ref < cheapest * 0.9) { priority = 'Disqualified'; status = 'Disqualified'; }
else if (score >= 80 && ['Cash ready', 'Pre-approved financing'].includes(fin) && ['Strong', 'Partial'].includes(assetFit)
         && ['Strong', 'Partial'].includes(budgetFit) && ['Immediately', 'Within 1 month'].includes(tl) && !uncertain.length) { priority = 'P1'; status = 'Qualified'; }
else if (uncertain.length) { priority = 'P2'; status = 'Needs clarification'; }
else if (score >= 60) { priority = 'P2'; status = 'Follow-up'; }
else { priority = 'P3'; status = 'Nurture'; }
// a person who asks for a human is never below P2 (unless they asked not to be contacted)
if (q.human_requested && priority !== 'Disqualified') {
  status = 'Human requested';
  if (ORDER.indexOf(priority) > 1) priority = 'P2';
}

// labels the agent must copy into the sheet as-is
const fmt = (n) => Number(n).toLocaleString('en-US');
const assetLabel = id ? `${CATALOG[id][0]} (${id})` : 'Unknown';
const typeLabel = type ? TYPE_LABEL[type] : 'Unknown';
const budgetLabel = !ref ? 'Unknown' : bmin && bmax && bmin !== bmax ? `SAR ${fmt(bmin)} – ${fmt(bmax)}` : `SAR ${fmt(ref)}`;
const readiness = q.do_not_contact ? 'Do not contact' : q.contact_later ? 'Contact later' : intent;

// factual Arabic reason (what sales reads first)
const FIN_AR = { 'Cash ready': 'كاش جاهز', 'Pre-approved financing': 'موافقة تمويل مبدئية', 'Financing needed': 'يحتاج تمويل', 'Not ready': 'غير جاهز مالياً', Unknown: 'الدفع غير معروف' };
const TL_AR = { Immediately: 'يدخل هذا المزاد', 'Within 1 month': 'خلال شهر', '1–3 months': 'خلال 1-3 أشهر', '3–6 months': 'خلال 3-6 أشهر', '6+ months': 'بعد 6 أشهر', Unknown: 'التوقيت غير معروف' };
const parts = [];
if (q.do_not_contact) parts.push('طلب عدم التواصل');
if (q.human_requested) parts.push('طلب التحدث مع موظف');
if (uncertain.length) parts.push(`غير مؤكد: ${uncertain.join('، ')}`);
const TYPE_AR = { villa: 'فيلا', apartment: 'شقة', land: 'أرض تجارية', residential_building: 'عمارة سكنية', commercial_building: 'عمارة تجارية' };
parts.push(id ? CATALOG[id][0] : type ? `مهتم بـ${TYPE_AR[type]} (بدون عقار محدد)` : 'العقار غير محدد');
if (ref) parts.push(`ميزانية ${fmt(ref)} ريال (${budgetFit === 'Strong' ? 'تغطي' : budgetFit === 'Partial' ? 'قريبة' : budgetFit === 'Poor' ? 'أقل من السعر' : 'غير مؤكدة'})`);
if (priority === 'Disqualified' && budgetKnown && ref < cheapest * 0.9) parts.push(`أقل من أرخص سعر افتتاحي ${fmt(cheapest)}`);
parts.push(FIN_AR[fin]);
parts.push(TL_AR[tl]);
if (intent === 'Browsing') parts.push('يستفسر عن الأسعار فقط');
if (q.contact_later) parts.push('طلب التواصل لاحقاً');
// high score but not P1 → say exactly what blocks it
if (priority === 'P2' && score >= 70) {
  const block = [];
  if (!['Cash ready', 'Pre-approved financing'].includes(fin)) block.push('التمويل غير محسوم بعد');
  if (!['Strong', 'Partial'].includes(budgetFit)) block.push('الميزانية لا تغطي السعر الافتتاحي');
  if (!['Immediately', 'Within 1 month'].includes(tl)) block.push('التوقيت ليس قريباً');
  if (block.length) parts.push('⚠ ليس P1 لأن: ' + block.join('، '));
}

const missing = [['mobile', mobileValid], ['asset', assetFit !== 'Unknown'], ['budget', budgetKnown],
  ['financial_readiness', fin !== 'Unknown'], ['timeline', tl !== 'Unknown']].filter(([, ok]) => !ok).map(([k]) => k);
const bookable = (priority === 'P1' || priority === 'P2') && status !== 'Needs clarification' && mobileValid;

return JSON.stringify({
  mobile_normalized: mobileValid ? m : null,
  mobile_valid: mobileValid,
  duplicate_key: mobileValid ? m : 'Unknown',
  interested_asset_label: assetLabel,
  property_type_label: typeLabel,
  budget_range_label: budgetLabel,
  intent_strength: intent,
  purchase_readiness: readiness,
  budget_fit: budgetFit,
  asset_fit: assetFit,
  lead_score: score,
  score_breakdown: breakdown,
  priority,
  qualification_status: status,
  score_reason: parts.join('؛ '),
  missing_fields: missing,
  booking_allowed: bookable,
  next_step: !mobileValid ? 'اطلب رقم جوال سعودي صحيح (مثل 05xxxxxxxx) قبل الحفظ'
    : priority === 'Disqualified' ? 'اعرض الملخص، احفظ بعد التأكيد، واشكر العميل بلطف بدون عرض حجز'
    : status === 'Human requested' ? 'اعرض الملخص، احفظ بعد التأكيد، ثم أكد أن موظف سيتواصل واعرض المواعيد'
    : bookable ? 'اعرض الملخص، احفظ بعد التأكيد، ثم اعرض المواعيد الثلاثة للحجز'
    : 'اعرض الملخص، احفظ بعد التأكيد، ثم أخبره أن الفريق سيرسل له التفاصيل',
});
