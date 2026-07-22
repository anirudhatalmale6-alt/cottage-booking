import db from './db.js';

db.exec('DELETE FROM booking_extras; DELETE FROM bookings; DELETE FROM blocks; DELETE FROM extras; DELETE FROM cottages;');

const cottages = [
  ['Pine Lodge',      'Cozy two-person cabin with a private deck overlooking the pines.', 2, 12000, 'pine'],
  ['Maple Retreat',   'Warm cabin for couples, wood stove and forest views.',            2, 12000, 'maple'],
  ['Cedar Cabin',     'Comfortable family cabin with a small kitchenette.',              4, 18000, 'cedar'],
  ['Birch House',     'Bright family cottage with loft beds for the kids.',              4, 18000, 'birch'],
  ['Willow Cottage',  'Spacious cottage with a full kitchen and dining area.',           6, 24000, 'willow'],
  ['Oak Villa',       'Large villa for groups, wraparound veranda.',                     6, 24000, 'oak'],
  ['Sakura House',    'Premium cottage near the river with an outdoor bath.',            4, 26000, 'sakura'],
  ['Fuji View',       'Our flagship cottage with panoramic mountain views.',            8, 34000, 'fuji'],
  ['Riverside Hut',   'Simple, affordable hut steps from the water.',                    2, 9000,  'river'],
  ['Forest Nest',     'Secluded eco-cabin surrounded by trees.',                         3, 14000, 'forest'],
];

const insCottage = db.prepare('INSERT INTO cottages (name, description, capacity, price_per_night, image) VALUES (?,?,?,?,?)');
for (const c of cottages) insCottage.run(...c);

const extras = [
  ['BBQ Grill Set',      'Charcoal grill, tools and charcoal for the evening.', 3000],
  ['Extra Futon Set',    'Additional futon bedding for an extra guest.',        2000],
  ['Firewood Bundle',    'Bundle of firewood for the wood stove or fire pit.',  1500],
  ['Extra Bed Sheets',   'Fresh sheets and towels.',                            0],
  ['Welcome Tea Set',    'Local green tea and snacks on arrival.',              0],
  ['Late Checkout',      'Check out at 2pm instead of 11am.',                   2500],
];

const insExtra = db.prepare('INSERT INTO extras (name, description, price) VALUES (?,?,?)');
for (const e of extras) insExtra.run(...e);

console.log(`Seeded ${cottages.length} cottages and ${extras.length} extras.`);
