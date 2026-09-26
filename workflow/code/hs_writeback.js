// ─────────────────────────────────────────────────────────────
// Write back to the sheet: HubSpot IDs (or the error, so nothing fails silently)
// and Created Date only the first time.
// Reached from 3 places: deal saved · deal skipped (contact failed) · lead not pushed (no mobile / do-not-contact).
// ─────────────────────────────────────────────────────────────
const prep = $('HS Prepare').first().json;
const now = $now.setZone('Asia/Riyadh').toFormat('yyyy-MM-dd HH:mm');
if (prep.reason === 'row not found') return [];

const created = prep.created_date || now;
if (prep.skip) {
  // say clearly why this lead was not sent (instead of leaving an old error in the cells)
  const why = prep.reason === 'no mobile/email' ? 'لم يُرسل: لا يوجد جوال صحيح ولا إيميل صحيح' : prep.reason === 'do not contact' ? 'لم يُرسل: العميل طلب عدم التواصل' : 'لم يُرسل: ' + prep.reason;
  return [{ json: { 'Lead ID': prep.lead_id, 'Created Date': created,
    'HubSpot Contact ID': prep.stored_contact_id || why, 'HubSpot Deal ID': prep.stored_deal_id || why } }];
}

const req = $('HS Deal Request').first().json;
const dealRan = $('HS Save Deal').isExecuted;
const deal = dealRan ? $('HS Save Deal').first().json : {};
const dealId = !req.skip_deal && deal.id ? String(deal.id) : null;
const dealErr = req.skip_deal ? 'skipped: contact not saved' : dealId ? null : String(deal.error?.description || deal.error?.message || deal.message || 'deal not saved').slice(0, 150);

return [{
  json: {
    'Lead ID': prep.lead_id,
    // keep a good stored ID; the error goes next to it in the Deal column so it is still visible
    'HubSpot Contact ID': req.contact_id ? String(req.contact_id) : prep.stored_contact_id || `ERROR: ${req.contact_error}`,
    'HubSpot Deal ID': dealId || prep.stored_deal_id || `ERROR: ${req.skip_deal ? 'contact: ' + req.contact_error : dealErr}`,
    'Created Date': created,
  },
}];
