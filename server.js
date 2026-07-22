import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// --- Helpers ---------------------------------------------------------------

// Two date ranges overlap when start < otherEnd AND otherStart < end.
// Nights are [check_in, check_out): checkout day is free for the next guest.
function isCottageAvailable(cottageId, checkIn, checkOut) {
  const booking = db.prepare(`
    SELECT 1 FROM bookings
    WHERE cottage_id = ? AND status != 'cancelled'
      AND check_in < ? AND ? < check_out
    LIMIT 1
  `).get(cottageId, checkOut, checkIn);
  if (booking) return false;

  const block = db.prepare(`
    SELECT 1 FROM blocks
    WHERE cottage_id = ? AND start_date < ? AND ? < end_date
    LIMIT 1
  `).get(cottageId, checkOut, checkIn);
  return !block;
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// --- API -------------------------------------------------------------------

// List cottages, optionally filtered by availability + guest count.
app.get('/api/cottages', (req, res) => {
  const { check_in, check_out, guests } = req.query;
  const rows = db.prepare('SELECT * FROM cottages WHERE active = 1 ORDER BY price_per_night').all();

  const result = rows.map((c) => {
    let available = null;
    if (check_in && check_out) {
      available = isCottageAvailable(c.id, check_in, check_out)
        && (!guests || c.capacity >= Number(guests));
    }
    return { ...c, available };
  });
  res.json(result);
});

app.get('/api/cottages/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM cottages WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.get('/api/extras', (req, res) => {
  res.json(db.prepare('SELECT * FROM extras ORDER BY price DESC, name').all());
});

// Create a booking.
app.post('/api/bookings', (req, res) => {
  const {
    cottage_id, guest_name, guest_email, guest_phone,
    check_in, check_out, guests, payment_method, extras = [],
  } = req.body;

  if (!cottage_id || !guest_name || !check_in || !check_out) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const nights = nightsBetween(check_in, check_out);
  if (nights < 1) return res.status(400).json({ error: 'Check-out must be after check-in.' });

  const cottage = db.prepare('SELECT * FROM cottages WHERE id = ? AND active = 1').get(cottage_id);
  if (!cottage) return res.status(404).json({ error: 'Cottage not found.' });

  if (!isCottageAvailable(cottage_id, check_in, check_out)) {
    return res.status(409).json({ error: 'Sorry, those dates were just taken. Please pick another range.' });
  }
  if (guests && cottage.capacity < Number(guests)) {
    return res.status(400).json({ error: `This cottage holds up to ${cottage.capacity} guests.` });
  }

  const chosenExtras = db.prepare(
    `SELECT * FROM extras WHERE id IN (${extras.map(() => '?').join(',') || 'NULL'})`
  ).all(...extras);
  const extrasTotal = chosenExtras.reduce((s, e) => s + e.price, 0);
  const total = cottage.price_per_night * nights + extrasTotal;

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO bookings (cottage_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, payment_method, total)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(cottage_id, guest_name, guest_email || null, guest_phone || null,
           check_in, check_out, guests || 1, payment_method || 'card', total);
    const bid = info.lastInsertRowid;
    const insBE = db.prepare('INSERT INTO booking_extras (booking_id, extra_id) VALUES (?,?)');
    for (const e of chosenExtras) insBE.run(bid, e.id);
    return bid;
  });
  const bookingId = tx();

  // Owner notification (stub — wired to email/SMS in Stage 3).
  console.log(`[NOTIFY] New booking #${bookingId}: ${cottage.name}, ${check_in} to ${check_out}, ` +
    `${guest_name}, extras: ${chosenExtras.map((e) => e.name).join(', ') || 'none'}`);

  res.status(201).json({ id: bookingId, total, nights, cottage: cottage.name });
});

// --- Owner dashboard API (basic) -------------------------------------------

app.get('/api/admin/bookings', (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, c.name AS cottage_name
    FROM bookings b JOIN cottages c ON c.id = b.cottage_id
    ORDER BY b.check_in
  `).all();
  for (const b of rows) {
    b.extras = db.prepare(`
      SELECT e.name, e.price FROM booking_extras be
      JOIN extras e ON e.id = be.extra_id WHERE be.booking_id = ?
    `).all(b.id);
  }
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cottage booking demo running on http://localhost:${PORT}`));
