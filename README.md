# CareerScope Liberia

Career guidance, counselor learning support, community and subscriptions for
Liberian students.

**Live:** https://careerscope-liberia.vercel.app

## Stack

- React/Vite, Tailwind, role-based student/counselor/admin dashboards.
- Express API on Vercel Functions; Neon PostgreSQL database and bounded uploads.
- JWT authentication in HTTP-only secure cookies.
- Durable, authenticated near-real-time event delivery using a Neon cursor.
- Manual subscription payment approval, bulk school payments, PDF invoices and
  per-student PDF receipts.

## Development

Use Node 24 (`.nvmrc`).

```sh
npm ci --include=dev
npm ci --prefix client --include=dev
npm ci --prefix server
npm run build
npm run dev
```

Configure `server/.env` from its safe template with a Neon `DATABASE_URL` and
strong `JWT_SECRET`. The existing workspace's ignored environment is already
configured for Neon. Frontend: http://localhost:5173; API:
http://localhost:5000/api/health.

## Billing

Subscription: **$20 USD per academic year**, implemented as 12 months from
approval. Mobile Money, Orange Money, bank and VISA payments are recorded as
external transactions pending admin verification. No live card charging is
implied. Company address: **Sinkor, Monrovia, Liberia**.

Admin: `/admin/payments` · Student: `/student/payments`.

Active coverage, pending payments and issued institution invoices block repeat
payments, including bulk allocations. Receipt, transaction and invoice numbers
are individually verifiable by authorized accounts. Completing a counseling
cycle marks the student as alumni when their coverage ends; archives and
counselor assignments are retained.

## Planning, classrooms and private archives

- All roles share `/{role}/appointments` and `/{role}/calendar`. Students and
  counselors accept the other participant’s proposal; edits require a fresh
  acceptance of the latest revision. Quarterly weekly plans are bounded to 93 days.
- Counselors prepare classrooms from accepted plans and start them only during
  their time window. Links do **not** grant access: each account must be explicitly
  invited. Group students need accepted plans covering the same class time.
- Up to six invited members use browser-to-browser WebRTC. Controls include
  microphone/camera, screen sharing, reactions, hands, quality, noise suppression,
  playback volume, supported audio outputs and leave/rejoin while the class is live.
- Configure `TURN_URL`, `TURN_USERNAME` and `TURN_CREDENTIAL` for restrictive
  networks. No hosted group media service is implied. Use HTTPS outside localhost.
- Optional browser captions transcribe only the user’s own microphone, require
  consent, and may use the browser vendor’s speech service. This is **not** a
  complete, server-generated meeting transcript. Captions/output selection depend
  on browser support. Media is not recorded.
- Class notes autosave privately to `/{role}/archive`; users can also save notes
  and upload bounded PDF/text/image/DOCX/XLSX documents (3 MB per file).
- Admins manage profiles, usernames, password/session revocation, counselor career
  mappings, student assignments and progression levels at `/admin/users`. Deletion
  removes account access without destroying financial/audit records.
- `/student/ai-counselors` and `/admin/ai-counselors` list exactly 50 clearly labeled
  career-mapped AI profiles. They remain **inactive** in configure-later mode: no
  fabricated replies, paid model requests or human impersonation. Provider
  integration and explicit activation are still required.

Apply schema v3 using `node --env-file=.env.neon-test.local db/migrate.js --apply`
from `server/` before preview feature tests. The migration seeds inactive AI
profiles idempotently. Never run synthetic billing tests against production.

## Credentials and deployment

Old documented demo passwords are disabled in production. New account passwords
are in ignored `server/.env.accounts.local`; do not publish that file.

See **[DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)** for migrations, environment
variables, operational limitations, invoice email setup and deployment commands.

```sh
npm test --prefix server
npm run test:postgres --prefix server
npm run test:features --prefix server
```

An optional real Chrome test is available in `server/tests/browser-smoke.mjs`.
Provide `PLAYWRIGHT_MODULE` pointing to Playwright’s `index.mjs` and run it from
`server/` with `--env-file=.env.neon-test.local`. It starts local API/Vite servers,
uses fake camera/microphone devices, and tests two-party media and mobile navigation.
