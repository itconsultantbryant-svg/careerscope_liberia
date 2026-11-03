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

## Credentials and deployment

Old documented demo passwords are disabled in production. New account passwords
are in ignored `server/.env.accounts.local`; do not publish that file.

See **[DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)** for migrations, environment
variables, operational limitations, invoice email setup and deployment commands.

```sh
npm test --prefix server
npm run test:postgres --prefix server
```
