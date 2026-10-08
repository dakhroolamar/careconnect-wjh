# CareConnect - facility care tracking across districts

Facilities enroll with their state / union territory, district, location, level and services. New installations start empty. Preloaded directory entries in existing installations are archived without deleting patient or audit history. New facility and patient IDs use CC prefixes. Enrollment requires registration approval; individual facility patient scope is preserved across districts. Verified administrator onboarding is still required before clinical use.

## Run locally

Requires Node.js 24 (built-in SQLite), and npm. From this directory run `npm install`, then `npm run dev -- --port 5173`. Open http://localhost:5173. The local API and frontend run together on loopback only. For the built version use `npm run build`, then `npm start` after stopping the development server. Run `npm test` for workflow and HTTP authorization tests.

SQLite persistence lives at `.pilot/careconnect.sqlite`, ignored by Git. This replaces browser-local patient storage; old v0.1 demo changes are not imported. All cases and clinician rosters are fictional. Do not enter real patient data.

## Facility sign in

Enter a facility ID, staff email and password on the sign-in page. The public credential shortcuts have been removed.

New facilities start through Register a facility. Preloaded facility accounts are archived. The existing approval account remains available for continuity. Verified administrator onboarding and replacement of shared credentials are required before clinical use.

## Facility registration and profiles

Enter state / union territory, district, facility name, facility level, block / location, services, contact and administrator details. The server assigns a CC facility ID. Registration requires approval before sign-in or referrals. After approval, My facility maintains services, referral acceptance and specialist availability. New installations start with no enrolled facilities.

## Patient access rules

- Patient registration is always assigned on the server to the signed-in facility. Clients cannot nominate a different registering facility.
- A permanent `registeredFacility` identifies the origin. `referralFacilities` records explicit destinations. Only these facilities may view that patient, including search, direct detail URLs, timeline and export.
- A destination gains access when a referral is sent; previously involved facilities retain longitudinal tracking access. Administrative SC parent links do not grant access.
- Only the current treating facility can record care, edit the care plan, assign follow-up or initiate referral. During transit, neither facility can record ordinary treatment through this workflow.
- The receiver acknowledges; the sender records departure; the receiver confirms arrival and accepts responsibility. Last confirmed location and clinician change only on arrival.
- Only the assigned facility completes its follow-up. Referrers can track updates after transfer without editing another facility’s care.
- Sender can cancel a handover before departure. History and prior referral access are retained explicitly.

Server-generated timestamps, authenticated actor identity and record versions support accountability. Concurrent stale patient updates return a conflict rather than overwriting a newer record. Sign-out clears the client workspace and invalidates the server session. Polling refreshes authorized records every 15 seconds. There are no offline clinical writes or automatic offline sync in this version.

## Try the workflow

1. Sign in to Nartiang PHC: see Patients 024, 025 and 026, but not Patient 027.
2. Sign in to Jarain PHC: no patients initially. Search and export do not reveal unrelated cases.
3. From Nartiang, refer a new fictional patient to Jarain. That patient becomes visible at Jarain only after this referral.
4. Sign in to the receiver, acknowledge, switch to sender for departure, then receiver for arrival. Responsibility changes only with confirmed arrival.
5. Record care, assign follow-up back to the registering facility and complete it from that facility.
6. Register another facility, sign in to the district approval account, approve it, then use its new facility account. It starts with no patients.

## Directory provenance

Published facility names and SC administrative parent links: https://meghealth.gov.in/health_centres/sc_wjh.pdf (46 SCs, 11 PHCs, 4 CHCs, Padu State Dispensary).

Jowai Civil Hospital: https://westjaintiahills.gov.in/public-utility/jowai-civil-hospital/

External proposed tertiary option, not a district facility or a confirmed referral agreement: NEIGRIHMS, Shillong, https://www.neigrihms.gov.in/ataglance.html

Sources checked 7 October 2026. Verify current facility classification, contacts, services and approved routes with the district before field use. New registration data and demo availability are distinct from published government listings.

## Remaining work before clinical deployment

This remains a synthetic-data pilot. No external notification delivery, ABDM integration, verified facility identity, encrypted database, backups, high availability, ambulance integration or tamper-resistant audit service is implemented. The database administrator can modify records directly.

Next recommended improvements: individually provisioned clinician/nurse/administrator accounts and permissions; verified facility onboarding; patient duplicate detection within authorized scope; returned/declined referral workflows; structured discharge summaries; dependable escalation delivery; verified capacity and transport status; consent/access retention policies; encrypted protected deployment, backup recovery and privacy/security review. Clinical escalation thresholds need local approval and testing, not app-invented medical rules.


## Closing a patient journey

Use **Close patient case** at the responsible facility. Outcomes include treatment completed, died, referral not received, lost to follow-up, declined care, left against advice and other. An outcome date/time, reason and named responsible worker are mandatory; the authenticated recorder and server timestamp are retained.

Open cases are the default view. Closed cases are retained in the **Closed** filter and export, with the same facility access restrictions. Care updates are blocked until the closing facility reopens the case with a reason; the prior closure remains in history.

Referral not received is available to the sender only after the expected arrival passes. Treatment completed cannot close an open referral. Open referrals and follow-ups require explicit acknowledgement and are archived as unresolved, never marked successfully completed. Reopening does not automatically resume these items. Death entries document a reported outcome and reason, not a certified cause of death.

## Cloudflare deployment

Cloudflare Workers serves the built React app and routes `/api/*` to the `PilotDatabase` SQLite-backed Durable Object. The shared API core enforces the same facility scope and closure policies locally and online. The cloud database starts with fresh fictional seed records; no local database is uploaded. Cloud sessions use Secure, HttpOnly, SameSite=Strict cookies.

Workers Builds configuration: repository root `.`, build command `npm run build`, deploy command `npm run deploy`, production branch `main`, Node.js 24. `wrangler.jsonc` provisions the SQLite namespace with migration v1. Pushes to main trigger deployment once the repository is connected in Cloudflare.

Validation: `npm test` and `npm run build`, followed by `npm run test:cloudflare` for the actual Worker runtime, scope, closure and persistence across a restart. Local Node development remains available with `npm run dev`.

This public demo has intentionally published demo logins and a simulated district approval account. Do not enter real patient information. A private GitHub repository does not make the deployed demo private. Before clinical use, replace demo accounts with verified individual staff accounts and complete protected deployment, privacy, backup, operations and clinical governance work.



