// ─────────────────────────────────────────────────────────────
// HubSpot · Prepare  (runs only on turns where the agent SAVED the lead)
// Reads the saved sheet row (the source of truth) and builds:
//   • the contact search (by stored ID / phone in 2 formats / email) → no duplicates
//   • contact properties + deal properties (all case-study fields mapped)
// ─────────────────────────────────────────────────────────────
const row = $input.first().json || {};
const U = (v) => (v === undefined || v === null || String(v).trim() === '' || String(v).trim() === 'Unknown' ? null : String(v).trim());

// the sheet may hold the phone as a number (966523456789) or 05… → always +9665XXXXXXXX
function normMobile(v) {
  let m = String(v ?? '').replace(/[^\d+]/g, '');
  if (m.startsWith('00')) m = '+' + m.slice(2);
  if (/^05\d{8}$/.test(m)) m = '+966' + m.slice(1);
  else if (/^5\d{8}$/.test(m)) m = '+966' + m;
  else if (/^9665\d{8}$/.test(m)) m = '+' + m;
  return /^\+\d{11,13}$/.test(m) ? m : null;
}
const mobile = normMobile(U(row['Mobile']));
const emailRaw = U(row['Email']);
const email = emailRaw && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(emailRaw) ? emailRaw.toLowerCase() : null;  // «name@gmail» → not sent
const leadId = U(row['Lead ID']) || $('Prepare Message').first().json.lead_id;
const doNotContact = /do not contact/i.test(row['Consent / Contact Status'] || '');

// no row, no way to reach the person, or asked not to be contacted → don't push to the CRM
if (!row['Lead ID'] || (!mobile && !email) || doNotContact) {
  const keep = (v) => (v && /^\d+$/.test(String(v)) ? String(v) : null);
  return [{ json: { skip: true, lead_id: leadId, created_date: U(row['Created Date']),
    stored_contact_id: keep(row['HubSpot Contact ID']), stored_deal_id: keep(row['HubSpot Deal ID']), reason: !row['Lead ID'] ? 'row not found' : doNotContact ? 'do not contact' : 'no mobile/email' } }];
}

// contact search: any ONE matching filter group is enough
const groups = [];
if (mobile) {
  const local = mobile.startsWith('+966') ? '0' + mobile.slice(4) : mobile;
  const variants = [...new Set([mobile, local, mobile.replace('+', '')])];
  groups.push({ filters: [{ propertyName: 'phone', operator: 'IN', values: variants }] });
  groups.push({ filters: [{ propertyName: 'mobilephone', operator: 'IN', values: variants }] });
}
if (email) groups.push({ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] });

const parts = String(U(row['Name']) || '').split(/\s+/).filter(Boolean);
const contact = { firstname: parts[0], lastname: parts.slice(1).join(' ') || undefined, phone: mobile || undefined, mobilephone: mobile || undefined, email: email || undefined, city: U(row['City']) || undefined };
Object.keys(contact).forEach((k) => contact[k] === undefined && delete contact[k]);

// budget → amount (largest number in "SAR 800,000 – 900,000")
const nums = String(row['Budget Range'] || '').replace(/,/g, '').match(/\d+(\.\d+)?/g) || [];
const amount = nums.length ? Math.max(...nums.map(Number)) : null;
const asset = U(row['Interested Asset']) || U(row['Property Type']) || 'غير محدد';
const priority = U(row['Priority']) || 'P3';

const description = [
  `الأولوية: ${priority} (${row['Score'] ?? '-'}/100) — ${row['Qualification Status'] || '-'}`,
  `السبب: ${row['Score Reason'] || '-'}`,
  `العقار: ${asset} | النوع: ${row['Property Type'] || '-'}`,
  `الميزانية: ${row['Budget Range'] || '-'} (${row['Budget Fit'] || '-'})`,
  `الدفع: ${row['Financial Readiness'] || '-'} | التوقيت: ${row['Timeline'] || '-'} | النية: ${row['Intent Strength'] || '-'}`,
  `الغرض: ${row['Investment Purpose'] || '-'} | نوع المشتري: ${row['Buyer Type'] || '-'} | خبرة مزادات: ${row['Auction Experience'] || '-'}`,
  `التواصل المفضل: ${row['Preferred Contact Method'] || '-'} | الموعد: ${row['Appointment'] || 'Not booked'}`,
  `المصدر: ${row['Source'] || '-'} / ${row['Campaign'] || '-'} | Lead ID: ${leadId}`,
  `ملخص: ${row['AI Summary'] || '-'}`,
].join('\n');

const deal = {
  dealname: `مزاد التلال الشرقية - ${U(row['Name']) || mobile || email} - ${asset}`,
  hs_priority: priority === 'P1' ? 'high' : priority === 'P2' ? 'medium' : 'low',
  description,
  // custom deal properties created by "▶ Setup HubSpot (run once)"
  fana_priority: priority,
  fana_score: Number(row['Score']) || 0,
  fana_reason: String(row['Score Reason'] || '').slice(0, 1000),
  fana_status: U(row['Qualification Status']) || 'Unknown',
  fana_asset: asset,
  fana_timeline: U(row['Timeline']) || 'Unknown',
  fana_funding: U(row['Financial Readiness']) || 'Unknown',
  fana_source: U(row['Source']) || 'Unknown',
  fana_ai_summary: String(row['AI Summary'] || '').slice(0, 1000),
};
if (amount) deal.amount = amount;

return [{
  json: {
    skip: false,
    lead_id: leadId,
    created_date: U(row['Created Date']),
    stored_contact_id: U(row['HubSpot Contact ID']) && /^\d+$/.test(row['HubSpot Contact ID']) ? String(row['HubSpot Contact ID']) : null,
    stored_deal_id: U(row['HubSpot Deal ID']) && /^\d+$/.test(row['HubSpot Deal ID']) ? String(row['HubSpot Deal ID']) : null,
    disqualified: priority === 'Disqualified',
    search_body: { filterGroups: groups, properties: ['firstname', 'phone', 'email'], limit: 5 },
    contact,
    deal,
  },
}];
