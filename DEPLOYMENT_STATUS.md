# CareerScope — Neon / Vercel deployment

## Live resources

- Production: https://careerscope-liberia.vercel.app
- Health: https://careerscope-liberia.vercel.app/api/health
- Vercel project: `careerscope-liberia`, Hobby plan.
- Neon project: `careerscope` (`red-dawn-20317762`), free plan, AWS us-east-1,
  PostgreSQL 17, fixed 0.25 CU.
- Production and preview use different Neon branches and JWT secrets.

## Runtime architecture

- React/Vite frontend and Express API on the same Vercel origin.
- `api/index.js` exports `server/app.js`; it never opens a listener.
- All production database operations use asynchronous PostgreSQL queries.
  Transactions use a checked-out connection and AsyncLocalStorage; payment
  reviews lock their row to prevent duplicate concurrent approvals.
- `npm run build:server` deterministically generates asynchronous routes and
  baseline schema from the shared route/schema definitions. Generated artifacts
  are ignored in Git and recreated during every build. The generator rejects
  unawaited database operations.
- Legacy SQLite route definitions remain for migration regression tests.
  New planning, classroom, archive, management, AI-directory and billing mutation
  APIs live in `server/features/` and mount before generated compatibility routes.
  `server/index.js` uses PostgreSQL whenever DATABASE_URL exists. Production
  refuses to fall back to SQLite. Native SQLite/bcrypt/Socket.IO packages are
  development-only and not installed in the Vercel production API.
- Bounded uploads are stored durably in Neon, not the Vercel filesystem.
  Uploads are limited to 3 MB per file / under 4 MB per HTTP request. Message
  attachments require a participating user's session.
- Real-time delivery uses a durable PostgreSQL event outbox and authenticated
  cursor polling every 2 seconds while a page is visible (15 seconds hidden).
  This is near-real-time HTTP delivery, NOT a hosted Socket.IO/WebSocket server.
  Message/community events are committed with their database mutations. It does
  not require Ably credentials. Event rows are retained for approximately a day.
- WebRTC signaling uses authenticated call-participant events. Actual audio/video
  connectivity depends on device permissions and network/STUN/TURN availability;
  local two-party Chrome media was verified with fake devices (19 browser checks).
  Restrictive/cross-network connectivity still requires operator TURN setup and
  deployment-specific verification.

## Subscription and billing

- Price: **20 USD per academic year** (2000 integer cents).
- Operational term: **12 months from approval**. Student-row locks block new
  payments during active coverage, pending review, or an issued institution
  invoice; individual and bulk/invoice paths share these rules. Renewal opens
  after coverage expires. This is not tied to a school-specific calendar date.
- Company: **CareerScope, Sinkor, Monrovia, Liberia**.
- Methods: Mobile Money, Orange Money, bank transfer, VISA external checkout;
  administrators can additionally record cash.
- These are **manually verified external-payment records**, not automatic
  charges. No card PAN, CVV, mobile-money PIN or OTP is collected or stored.
- Students submit a reference for their own subscription. Admins can record
  payments for one/many students, create school invoices, approve or reject.
- Approval creates a unique PDF receipt for each beneficiary. Beneficiary,
  payer and admin can access the authorized receipt. References are verifiable
  from the signed-in Payments page.
- Company identity is snapshotted when an invoice/payment record is created.
- PDF invoices include the logo, name, address, reference, date, allocations,
  term and total. The admin invoice page supports PDF download and email send.
- Email sending requires `RESEND_API_KEY` and a verified `EMAIL_FROM`; these
  were not supplied. Without them, the endpoint returns a clear 503 message
  and admins can download/send the invoice manually.
- Supply actual merchant destination details through `PAYMENT_INSTRUCTIONS`.
  A live VISA/card checkout requires a merchant processor and signed-webhook
  integration; selecting VISA in the current manual ledger does not charge it.
- Legacy mocked payments are read-only; no unverified mock can grant access.

## Schema v3 and feature operations

- `server/db/features.sql` adds revisioned planning, assignments, classroom ACLs,
  private archives, payer snapshots, AI profiles and admin audit/session fields.
  Apply explicitly to preview before testing and to production before deploying
  this version; migration/AI seeding are idempotent.
- Plans require counterparty acceptance, including student acceptance of counselor
  proposals. Revision mismatches return 409 instead of accepting stale changes.
  Revisions retire unstarted classrooms; active classes must end before editing.
- Counselors start accepted classes only within their time window. Up to six
  explicitly invited members can join/rejoin a live room; sharing a UUID link
  does not grant access. Students invited to groups need matching confirmed time.
- Media uses a bounded WebRTC mesh, not an SFU or media recording service. Set
  `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` for restrictive networks. Browser
  captions are opt-in microphone-only speech recognition, not full meeting
  transcription. Audio-output support varies by browser.
- Notes autosave to owner-only archives; even admins cannot read another user’s
  private archive. Uploads are bounded to 3 MB per document.
- Account deletion is soft deletion. Password/profile credential changes revoke
  prior JWT sessions through `token_version`; financial/audit history is retained.
- Exactly 50 labeled AI profiles are seeded across the available careers. They
  cannot sign in as human counselors and make no paid model calls. Configure-later
  mode intentionally rejects live activation/messages until provider integration
  and explicit approval are implemented.
- Alumni status begins after cycle completion **and** subscription expiry;
  materials, private archives and counselor assignments remain available.

## Credentials and environment

Documented demo passwords are blocked in production. Before deployment, only
the three documented demo-account passwords were rotated to strong random
values. Existing non-demo passwords are not changed by the preparation script.

**New credentials are in ignored `server/.env.accounts.local`**, grouped under
`production` and `preview`. This is JSON despite its `.env` filename. It is
owner-readable and must never be committed, emailed indiscriminately or copied
into a client-side environment variable. The local Neon API uses production
accounts. Old README demo passwords no longer authenticate against Neon.

- `server/.env`: local Neon runtime and configuration.
- `server/.env.neon.local`: pooled/direct production database URLs.
- `server/.env.neon-test.local`: preview database URL and independent JWT secret.
- `.vercel/`: local Vercel project linkage/bypass information; ignored.
- `server/.env.example`, `client/.env.example`: safe templates.

Configured in both Vercel environments:

| Variable | Value / handling |
| --- | --- |
| `DATABASE_URL` | Branch-specific pooled Neon URL; server only |
| `JWT_SECRET` | Separate strong secrets for production and preview |
| `SUBSCRIPTION_AMOUNT_MINOR` | `2000` |
| `SUBSCRIPTION_CURRENCY` | `USD` |
| `COMPANY_NAME` | `CareerScope` |
| `COMPANY_ADDRESS` | `Sinkor, Monrovia, Liberia` |
| `VITE_API_URL` | `/api` (public same-origin API path only) |

`DATABASE_URL_UNPOOLED` stays local for controlled migration tasks. Never put
database credentials, JWT secrets or mail API keys into `VITE_*` variables.

## Commands

```sh
npm ci --include=dev
npm ci --prefix client --include=dev
npm ci --prefix server
npm run build
npm run dev
```

Database schema updates are explicit, not performed on every request:

```sh
cd server
node --env-file=.env.neon.local db/migrate.js --apply
```

The initial migration copied the **active `server/sqlite.db`** schema/data into
an empty Neon database with transactional row-count verification and serial
sequence repair. Source SQLite files were preserved. The separate root
`sqlite.db` was not silently merged, because IDs/accounts may conflict.

For a brand-new empty Neon project, run `npm run build:server` and the schema
migration above. It seeds careers and assessment questions but never default
passwords. Bootstrap the first admin with `scripts/bootstrap-admin.js` using
secure `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` environment variables.
Use `scripts/set-password.js` with `NEW_PASSWORD` in the environment to reset
an existing account; do not pass secrets in command-line arguments.

To deploy later:

```sh
npx vercel login
npx vercel link --project careerscope-liberia
node server/scripts/configure-vercel-env.js preview
node server/scripts/configure-vercel-env.js production
npx vercel deploy --environment preview
# Verify preview before publishing:
npx vercel deploy --prod
```

The environment helper does not silently overwrite existing variables; use
the Vercel settings/CLI update flow when rotating an existing secret.
GitHub is connected to the Vercel project for future deployments.

## Verification

- `npm run build`: PostgreSQL generation and frontend production build.
- `npm test --prefix server`: 11 isolated regression/scheduling/SQL translation tests.
- `npm run test:postgres --prefix server`: 85 integration checks against the
  isolated Neon preview branch, covering all role dashboards, registration,
  learning/grading, appointments, sessions, billing concurrency, PDF generation,
  durable uploads and authenticated event delivery.
- `npm run test:features --prefix server`: 96 preview integration checks covering
  revisions/acceptance, classroom ACLs/time/limits/signaling, private documents,
  concurrent payment coverage, institution sponsorship, alumni and session revocation.
- `server/tests/browser-smoke.mjs`: optional real Chrome two-party WebRTC/mobile
  workflow test using fake devices; 19 checks passed. See README for the Playwright
  module setting.
- `node server/scripts/verify-deployment.js <url> preview|production`: live
  deployment authentication/API/PDF checks without printing secrets.
- `npm run test:client-forms`: actual login/registration schema regression checks.
- `npm audit --omit=dev --prefix server` and `--prefix client`: zero production
  dependency advisories at verification time. Development-tool advisories and pre-existing UI lint debt
  are separate from this runtime audit.

Financial workflow tests write synthetic data only to the preview branch.
Production deployment verification performs logins and reads, not test charges.
