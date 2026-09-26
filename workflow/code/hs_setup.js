// ─────────────────────────────────────────────────────────────
// ▶ Setup HubSpot (run once): creates the 9 custom Deal properties (free plan allows 10)
// and one "existing" test contact for scenario 8. Safe to re-run (409 = already exists).
// ─────────────────────────────────────────────────────────────
const P = (name, label, type = 'string', fieldType = 'text') => ({ kind: 'property', body: { name, label, type, fieldType, groupName: 'dealinformation' } });
return [
  P('fana_priority', 'FANA Priority'),
  P('fana_score', 'FANA Score', 'number', 'number'),
  P('fana_reason', 'FANA Priority Reason', 'string', 'textarea'),
  P('fana_status', 'FANA Qualification Status'),
  P('fana_asset', 'FANA Interested Asset'),
  P('fana_timeline', 'FANA Timeline'),
  P('fana_funding', 'FANA Financial Readiness'),
  P('fana_source', 'FANA Lead Source'),
  P('fana_ai_summary', 'FANA AI Summary', 'string', 'textarea'),
].map((x) => ({ json: { ...x, url: 'https://api.hubapi.com/crm/v3/properties/deals' } })).concat([
  // scenario 8: a customer who is ALREADY in HubSpot before talking to the bot
  { json: { kind: 'test contact', url: 'https://api.hubapi.com/crm/v3/objects/contacts',
    body: { properties: { firstname: 'عبدالله', lastname: 'الشمري (موجود مسبقاً)', phone: '+966550000008', email: 'abdullah.test@example.com', city: 'الخبر' } } } },
]);
