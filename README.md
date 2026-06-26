# Unity Support Drive — Backend & Stripe Payments

This is the backend + database for the Unity Support Drive site. It stores
campaigns and donations in SQLite, and uses **Stripe Checkout** to take real
payments — when someone clicks "Donate now" on the frontend, they're sent to
a Stripe-hosted payment page (the actual card form lives on Stripe's domain,
not yours, which keeps you out of PCI-compliance scope).

## How it fits together

```
campaign.html  --POST /api/checkout-session-->  server.js  --creates session-->  Stripe
campaign.html  <--------- redirect to Stripe's hosted checkout URL ------------------
[ person pays on Stripe's page ]
Stripe --webhook: checkout.session.completed--> server.js --records donation--> SQLite
```

The campaign's "raised" total is **only** updated by the webhook, after Stripe
confirms the card actually succeeded — never directly from the checkout
request. That's what stops someone from faking a donation by calling the API
without paying.

## 1. Install dependencies

```bash
cd backend
npm install
```

## 2. Get your Stripe keys

1. Create a free account at https://dashboard.stripe.com/register if you don't have one.
2. Go to **Developers → API keys** and copy your **Secret key** (starts with `sk_test_...` while testing).
3. Copy `.env.example` to `.env` and paste it in:

```bash
cp .env.example .env
```

```
STRIPE_SECRET_KEY=sk_test_...
PUBLIC_BASE_URL=http://localhost:8080
PORT=4242
```

## 3. Set up the webhook (so donations actually get recorded)

**For local testing**, use the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:4242/api/webhook
```

It will print a `whsec_...` value — put that in `.env` as `STRIPE_WEBHOOK_SECRET`.

**For production**, go to Stripe Dashboard → Developers → Webhooks → "Add endpoint",
point it at `https://yourdomain.com/api/webhook`, subscribe to the
`checkout.session.completed` event, and copy the signing secret it gives you
into `STRIPE_WEBHOOK_SECRET`.

## 4. Seed sample campaigns and start the server

```bash
npm run seed
npm start
```

The backend now runs at `http://localhost:4242`.

## 5. Connect the frontend

Open `campaign.html` and serve the frontend folder with any static server, e.g.:

```bash
cd ..
npx serve .
```

The donate button on `campaign.html` already calls
`http://localhost:4242/api/checkout-session` — update the `API_BASE` constant
near the bottom of `campaign.html` if you deploy the backend somewhere else.

## API reference

| Method | Path                              | Purpose                                  |
|--------|------------------------------------|-------------------------------------------|
| GET    | `/api/campaigns`                   | List active campaigns                     |
| GET    | `/api/campaigns/:id`                | Get one campaign                           |
| GET    | `/api/campaigns/:id/donations`      | Recent paid donations for a campaign       |
| POST   | `/api/checkout-session`             | Create a Stripe Checkout session, returns `{ url }` |
| POST   | `/api/webhook`                      | Stripe calls this; do not call it yourself |

## Going live

1. Swap your `sk_test_...` key for your `sk_live_...` key once you've tested end-to-end.
2. Re-create the webhook endpoint against your live domain (test and live webhooks are separate).
3. Deploy this `backend/` folder anywhere that runs Node (Render, Railway, Fly.io, an EC2 box, etc.) — it needs persistent disk for the SQLite file, or swap `better-sqlite3` for a hosted Postgres if your platform is ephemeral.
4. Update `PUBLIC_BASE_URL` in `.env` and `API_BASE` in `campaign.html` to your real domains.
