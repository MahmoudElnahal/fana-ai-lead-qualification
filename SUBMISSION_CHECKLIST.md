# What to submit → where it is

| Required | In this package | Status |
|---|---|---|
| Short channel plan + one architecture diagram | `docs/Channel_Plan_AR.md`, `docs/architecture.png` | ✅ |
| Runnable prototype + test fixtures | `workflow/FANA_Tilal_Final_Workflow.json` (+ `workflow/code/`), `tests/FANA_Lead_Webhook.postman_collection.json`, ▶ Run 10 Tests inside the workflow | ✅ |
| README: setup, tech choices, qualification & scoring logic, assumptions, limitations | `README.md` | ✅ |
| Evidence of HubSpot Contacts & Deals created and updated | `screenshots/` | ⬜ add your screenshots (list below) |
| Prioritized sales list + results of the 10 scenarios | `samples/FANA_Sales_Queue_and_Test_Results.xlsx` (+ export of your live sheet) | ✅ engine results · ⬜ fill column J from your live run |
| 5–7 min demo | follow `DEMO_SCRIPT.md` | ⬜ record |

## Screenshots to add (synthetic numbers 05500000xx only)
1. `01_hubspot_contact.png` — a contact created by the flow (phone +9665…).
2. `02_hubspot_deal.png` — the deal with the FANA properties filled and the contact associated.
3. `03_hubspot_deal_updated.png` — the same deal after a change (e.g. budget 1M → 1.5M, or new appointment).
4. `04_hubspot_existing_contact.png` — «عبدالله الشمري (موجود مسبقاً)» updated, no duplicate.
5. `05_sheet_leads.png` — Leads tab with Priority, Score Reason, HubSpot IDs, Sales Queue Rank.
6. `06_n8n_canvas.png` and `07_n8n_execution.png` — the workflow and one successful execution.
7. `08_postman_tests.png` — Postman run with all ✓.

## Before sending
- [ ] Remove real personal data from the sheet and HubSpot (use only the synthetic test numbers).
- [ ] No API keys in any file (the exported workflow contains credential names only).
- [ ] Deadline: Sat 26 Sep 2026, 11:59 PM KSA.
