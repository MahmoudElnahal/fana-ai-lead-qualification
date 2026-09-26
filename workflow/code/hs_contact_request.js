// ─────────────────────────────────────────────────────────────
// HubSpot · Contact request
// Stored ID (from an earlier save) → PATCH it.
// Found by phone/email (already in HubSpot, e.g. scenario 8) → PATCH that one.
// Nothing found → create a new contact.
// ─────────────────────────────────────────────────────────────
const prep = $('HS Prepare').first().json;
const search = $input.first().json || {};
const found = Array.isArray(search.results) ? search.results : [];
const existingId = prep.stored_contact_id || found[0]?.id || null;

return [{
  json: {
    action: prep.stored_contact_id ? 'updated' : found.length ? 'updated_existing' : 'created',
    method: existingId ? 'PATCH' : 'POST',
    url: existingId ? `https://api.hubapi.com/crm/v3/objects/contacts/${existingId}` : 'https://api.hubapi.com/crm/v3/objects/contacts',
    body: { properties: prep.contact },
    possible_duplicates: found.length > 1 ? found.map((f) => f.id) : [],
    search_error: search.error ? String(search.error.message || search.error).slice(0, 150) : null,
  },
}];
