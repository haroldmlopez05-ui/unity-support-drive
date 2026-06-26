// seed.js — populates the database with the same placeholder campaigns
// used in the frontend mockups. Run with: npm run seed
const db = require('./db');

const campaigns = [
  {
    id: 'help-maria-recover',
    title: 'Help Maria recover after surgery',
    story: `Three weeks ago, Maria underwent emergency surgery after a sudden medical complication. She's recovering well, but the road ahead includes physical therapy, follow-up procedures, and weeks away from work as a home health aide — income her family depends on.

Maria has spent years showing up for other people's families as a caregiver. Now her own family needs a hand. Every dollar raised here goes directly toward her medical bills, rehab sessions, and basic household costs while she heals.`,
    category: 'Medical',
    goal_cents: 2000000,      // $20,000.00
    raised_cents: 1284000,    // $12,840.00 (matches mockup)
    donor_count: 186,
    organizer_name: 'Janet Cole',
    organizer_role: 'Family friend',
    location: 'Los Angeles, CA',
    photo_url: null,
  },
  {
    id: 'keep-alvarez-family-housed',
    title: 'Keep the Alvarez family housed',
    story: `A rent shortfall after a layoff put eviction on the table for the Alvarez family. Help close the gap so they can stay in their home while they get back on their feet.`,
    category: 'Housing',
    goal_cents: 900000,
    raised_cents: 369000,
    donor_count: 74,
    organizer_name: 'Marcus Alvarez',
    organizer_role: 'Neighbor',
    location: 'Phoenix, AZ',
    photo_url: null,
  },
  {
    id: 'lincoln-hs-robotics-nationals',
    title: 'Send the Lincoln HS robotics team to nationals',
    story: `First-ever nationals qualification for the Lincoln High School robotics team. Funding covers travel, lodging, and competition fees for twelve students.`,
    category: 'Education',
    goal_cents: 1000000,
    raised_cents: 880000,
    donor_count: 203,
    organizer_name: 'Coach Diane Wu',
    organizer_role: 'Team coach',
    location: 'Austin, TX',
    photo_url: null,
  },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO campaigns
    (id, title, story, category, goal_cents, raised_cents, donor_count, organizer_name, organizer_role, location, photo_url)
  VALUES
    (@id, @title, @story, @category, @goal_cents, @raised_cents, @donor_count, @organizer_name, @organizer_role, @location, @photo_url)
`);

const tx = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

tx(campaigns);

console.log(`Seeded ${campaigns.length} campaigns into unity-support-drive.db`);
