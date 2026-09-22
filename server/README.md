# Stripe Checkout API

Production Node/Express + Prisma/PostgreSQL service for Guardians of the Ocean. The live site stays a static Render app. This folder is the payment backend. Fulfillment happens **only** in the webhook handler — never from the success URL.

The desktop Wallet Overview button posts to `POST /api/checkout`, then redirects with `window.location.href = session.url`.

## Environment

Copy `.env.example` to `.env` (never commit `.env`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from `stripe listen` or the Dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key (hosted Checkout does not need it in the browser; kept for Stripe.js if you add Elements later) |
| `FRONTEND_ORIGIN` | CORS allow-list, comma-separated (`https://guardians-of-the-ocean1.onrender.com,http://127.0.0.1:8765`) |
| `APP_BASE_URL` | Public site origin used in `success_url` / `cancel_url` |
| `PORT` | API port (default `8787`) |
| `CHECKOUT_USER_SECRET` | Optional. If set, Checkout requires `Authorization: Bearer …` |
| `CHECKOUT_AMOUNT_CENTS` | Default line item (2500 = $25) |
| `CHECKOUT_CURRENCY` | `usd` |

## Local

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

In another terminal:

```bash
stripe listen --forward-to localhost:8787/api/webhooks/stripe
```

Point the static site at the API:

```js
localStorage.setItem('goo-api', 'http://127.0.0.1:8787');
```

Then open Wallet Overview and use **Checkout**.

## Routes

- `POST /api/checkout` — authenticate (optional bearer), upsert user (lowercase email), create Stripe Customer, create Checkout Session first, insert `pending` order with that `session.id`, return `{ url, orderId, sessionId }`
- `POST /api/webhooks/stripe` — raw body + `constructEvent`; claim event as `received`, fulfill, then mark `processed`. Failures stay `failed` and return 500 so Stripe retries.
- `GET /api/ledger?email=` — `{ live, currency, fund, personal }` for desktop and PWA
- `GET /api/orders/status?session_id=` — success-page polling (display only)
- `GET /health` — `{ ok, db }`

Webhook events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, `customer.subscription.deleted`.

## Deploy

Create a **separate** Render Web Service from `server/` (do not convert the static site). Set the env vars above, add a PostgreSQL database, then:

- Build: `npm install && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/index.js`

In the static site, set `js/api/config.js` or `localStorage.goo-api` to that service URL.

`stripe-ui/CheckoutButton.tsx` is a typed copy of the vanilla button and posts to this Express API. The hosted product remains vanilla HTML.
