// server.js — Unity Support Drive backend
//
// Responsibilities:
//   1. Serve campaign data to the frontend (GET /api/campaigns, /api/campaigns/:id)
//   2. Create a Stripe Checkout Session when someone clicks "Donate" (POST /api/checkout-session)
//   3. Listen for Stripe's webhook to confirm payment actually succeeded, then record
//      the donation and update the campaign total (POST /api/webhook)
//
// IMPORTANT: the campaign's raised_cents total is only ever updated from the webhook,
// never from the checkout-session request. That's what stops someone from inflating
// a progress bar by hitting the API without actually paying.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const db = require('./db');

const PORT = process.env.PORT || 4242;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());

// ---------------------------------------------------------------------------
// Stripe webhook needs the RAW request body to verify the signature, so it
// must be registered BEFORE express.json() touches the body.
// ---------------------------------------------------------------------------
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      recordSuccessfulDonation(session).catch((err) =>
        console.error('Failed to record donation:', err)
      );
    }

    res.json({ received: true });
  }
);

// Everything else uses normal JSON parsing.
app.use(express.json());

// ---------------------------------------------------------------------------
// Campaign endpoints
// ---------------------------------------------------------------------------

app.get('/api/campaigns', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM campaigns WHERE status = 'active' ORDER BY created_at DESC`)
    .all();
  res.json(rows.map(toCampaignJson));
});

app.get('/api/campaigns/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Campaign not found' });
  res.json(toCampaignJson(row));
});

app.get('/api/campaigns/:id/donations', (req, res) => {
  const rows = db
    .prepare(
      `SELECT amount_cents, donor_name, is_anonymous, created_at
       FROM donations
       WHERE campaign_id = ? AND status = 'paid'
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .all(req.params.id);

  res.json(
    rows.map((r) => ({
      amount: r.amount_cents / 100,
      donor: r.is_anonymous ? 'Anonymous' : r.donor_name,
      createdAt: r.created_at,
    }))
  );
});

// ---------------------------------------------------------------------------
// Checkout session — called when the user clicks "Donate now"
// ---------------------------------------------------------------------------

app.post('/api/checkout-session', async (req, res) => {
  try {
    const { campaignId, amount, donorName, anonymous, message } = req.body;

    const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return res.status(400).json({ error: 'Minimum donation is $1.00' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Donation to: ${campaign.title}`,
              description: 'Unity Support Drive',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      // Pass-through metadata is how the webhook knows which campaign/donor
      // this payment belongs to once Stripe confirms it succeeded.
      metadata: {
        campaignId,
        donorName: donorName || 'Anonymous',
        anonymous: anonymous ? 'true' : 'false',
        message: message || '',
      },
      success_url: `${PUBLIC_BASE_URL}/campaign.html?id=${campaignId}&donation=success`,
      cancel_url: `${PUBLIC_BASE_URL}/campaign.html?id=${campaignId}&donation=cancelled`,
    });

    // Record a "pending" row now so we have an audit trail even before
    // the webhook confirms payment. It only flips to "paid" via webhook.
    db.prepare(
      `INSERT INTO donations (campaign_id, amount_cents, donor_name, is_anonymous, message, stripe_session_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(campaignId, amountCents, donorName || 'Anonymous', anonymous ? 1 : 0, message || null, session.id);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function recordSuccessfulDonation(session) {
  const existing = db
    .prepare(`SELECT * FROM donations WHERE stripe_session_id = ?`)
    .get(session.id);

  // Already processed (Stripe may retry webhooks) — skip to stay idempotent.
  if (existing && existing.status === 'paid') return;

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE donations
       SET status = 'paid', stripe_payment_intent = ?
       WHERE stripe_session_id = ?`
    ).run(session.payment_intent, session.id);

    const donation = db.prepare(`SELECT * FROM donations WHERE stripe_session_id = ?`).get(session.id);
    if (!donation) return;

    db.prepare(
      `UPDATE campaigns
       SET raised_cents = raised_cents + ?, donor_count = donor_count + 1
       WHERE id = ?`
    ).run(donation.amount_cents, donation.campaign_id);
  });

  update();
}

function toCampaignJson(row) {
  return {
    id: row.id,
    title: row.title,
    story: row.story,
    category: row.category,
    goal: row.goal_cents / 100,
    raised: row.raised_cents / 100,
    progressPct: Math.min(100, Math.round((row.raised_cents / row.goal_cents) * 100)),
    donorCount: row.donor_count,
    organizerName: row.organizer_name,
    organizerRole: row.organizer_role,
    location: row.location,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    status: row.status,
  };
}

app.listen(PORT, () => {
  console.log(`Unity Support Drive backend listening on http://localhost:${PORT}`);
});
