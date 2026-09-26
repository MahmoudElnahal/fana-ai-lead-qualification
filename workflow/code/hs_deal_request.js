// ─────────────────────────────────────────────────────────────
// HubSpot · Deal request
// One deal per customer for this auction:
//   stored deal ID → PATCH · existing FANA deal on this contact → PATCH · else create + associate.
// Stage is set ONLY when the deal is created, so a stage moved by sales is never reset.
// ─────────────────────────────────────────────────────────────
const prep = $('HS Prepare').first().json;
const saved = $('HS Save Contact').first().json || {};
const contactId = saved.id || null;
const dealSearch = $input.first().json || {};
const existingDeal = prep.stored_deal_id || dealSearch.results?.[0]?.id || null;

if (!contactId) {
  return [{ json: { skip_deal: true, contact_id: null, contact_error: String(saved.error?.description || saved.error?.message || saved.message || 'contact not saved').slice(0, 200) } }];
}

const properties = { ...prep.deal };
if (existingDeal) {
  return [{ json: { skip_deal: false, contact_id: contactId, method: 'PATCH', url: `https://api.hubapi.com/crm/v3/objects/deals/${existingDeal}`, body: { properties } } }];
}
properties.pipeline = 'default';
properties.dealstage = prep.disqualified ? 'closedlost' : 'appointmentscheduled';
return [{
  json: {
    skip_deal: false,
    contact_id: contactId,
    method: 'POST',
    url: 'https://api.hubapi.com/crm/v3/objects/deals',
    body: {
      properties,
      // deal → contact, HubSpot-defined association type 3
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }],
    },
  },
}];
