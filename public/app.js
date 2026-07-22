const yen = (n) => '¥' + n.toLocaleString('ja-JP');

// Gradient placeholder art per cottage (real photos drop in later).
const palettes = {
  pine: ['#3f6b4c', '#2f5239'], maple: ['#b5643a', '#8a4526'], cedar: ['#7a6a4f', '#574a34'],
  birch: ['#c9b98f', '#9c8a5e'], willow: ['#5c8a6a', '#3f6b4c'], oak: ['#8a7b52', '#665a38'],
  sakura: ['#d98aa0', '#b5647c'], fuji: ['#5b7fa6', '#3d5c80'], river: ['#4f96a6', '#356c7a'],
  forest: ['#446b3c', '#2e4a28'],
};
function artFor(slug, name) {
  const [a, b] = palettes[slug] || ['#3f6b4c', '#2f5239'];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='170'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>
    <rect width='400' height='170' fill='url(#g)'/>
    <text x='20' y='150' fill='rgba(255,255,255,.35)' font-size='72' font-family='sans-serif'>🏡</text>
    </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

let currentSearch = null; // {check_in, check_out, guests}
let extrasCache = [];

async function loadExtras() {
  extrasCache = await (await fetch('/api/extras')).json();
}

async function loadCottages() {
  const params = new URLSearchParams();
  if (currentSearch) {
    params.set('check_in', currentSearch.check_in);
    params.set('check_out', currentSearch.check_out);
    params.set('guests', currentSearch.guests);
  }
  const cottages = await (await fetch('/api/cottages?' + params)).json();
  renderGrid(cottages);
}

function renderGrid(cottages) {
  const grid = document.getElementById('grid');
  grid.innerHTML = cottages.map((c) => {
    let badge = '';
    let cls = 'card';
    if (c.available === true) badge = `<span class="badge ok">Available</span>`;
    else if (c.available === false) { badge = `<span class="badge no">Booked / Not available</span>`; cls += ' unavailable'; }
    const btn = c.available === false
      ? `<button class="btn ghost block" disabled>Not available</button>`
      : `<button class="btn primary block" data-id="${c.id}">${currentSearch ? 'Book now' : 'Check dates'}</button>`;
    return `<article class="${cls}">
      <div class="card-img" style="background-image:url('${artFor(c.image, c.name)}');background-size:cover"></div>
      <div class="card-body">
        <div class="card-meta"><h3>${c.name}</h3>${badge}</div>
        <p class="card-desc">${c.description}</p>
        <div class="card-meta">
          <span class="price">${yen(c.price_per_night)}<small> / night</small></span>
          <span class="cap">Up to ${c.capacity} guests</span>
        </div>
        ${btn}
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('button[data-id]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!currentSearch) {
        document.getElementById('search-status').textContent = 'Pick your dates above first, then book.';
        document.querySelector('.hero').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      openBooking(cottages.find((c) => c.id == b.dataset.id));
    });
  });
}

// --- Booking modal ---------------------------------------------------------

function nights() {
  const a = new Date(currentSearch.check_in), b = new Date(currentSearch.check_out);
  return Math.round((b - a) / 86400000);
}

function openBooking(cottage) {
  const n = nights();
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  const extrasHtml = extrasCache.map((e) => `
    <label class="extra">
      <input type="checkbox" class="ex-check" value="${e.id}" data-price="${e.price}" />
      <span class="ex-name">${e.name}<br><small class="muted">${e.description}</small></span>
      <span class="ex-price">${e.price === 0 ? '<span class="free">Free</span>' : yen(e.price)}</span>
    </label>`).join('');

  body.innerHTML = `<div class="modal-body-inner">
    <h3>${cottage.name}</h3>
    <p class="sub">${currentSearch.check_in} → ${currentSearch.check_out} · ${n} night${n>1?'s':''} · ${currentSearch.guests} guest(s)</p>

    <div class="form-row"><label>Full name</label><input id="g_name" placeholder="Your name" /></div>
    <div class="form-row"><label>Email</label><input id="g_email" type="email" placeholder="you@example.com" /></div>
    <div class="form-row"><label>Phone</label><input id="g_phone" placeholder="Phone number" /></div>

    <label class="form-row"><span>Optional extras</span></label>
    <div class="extras-list">${extrasHtml}</div>

    <label class="form-row"><span>Payment</span></label>
    <div class="pay-options">
      <div class="pay-opt sel" data-pay="card">💳 Pay by card now</div>
      <div class="pay-opt" data-pay="cash">🏠 Pay cash on arrival</div>
    </div>
    <p class="note" id="pay-note">Secure card payment via Stripe (added in Stage 2).</p>

    <div class="summary" id="summary"></div>
    <button class="btn primary block" id="confirm-btn">Confirm booking</button>
  </div>`;

  modal.classList.remove('hidden');

  const priceNightly = cottage.price_per_night * n;
  let payment = 'card';

  function refreshSummary() {
    let extrasTotal = 0;
    body.querySelectorAll('.ex-check:checked').forEach((c) => extrasTotal += Number(c.dataset.price));
    document.getElementById('summary').innerHTML = `
      <div class="row"><span>${yen(cottage.price_per_night)} × ${n} night${n>1?'s':''}</span><span>${yen(priceNightly)}</span></div>
      <div class="row"><span>Extras</span><span>${yen(extrasTotal)}</span></div>
      <div class="row total"><span>Total</span><span>${yen(priceNightly + extrasTotal)}</span></div>`;
  }
  refreshSummary();
  body.querySelectorAll('.ex-check').forEach((c) => c.addEventListener('change', refreshSummary));

  body.querySelectorAll('.pay-opt').forEach((o) => o.addEventListener('click', () => {
    body.querySelectorAll('.pay-opt').forEach((x) => x.classList.remove('sel'));
    o.classList.add('sel');
    payment = o.dataset.pay;
    document.getElementById('pay-note').textContent = payment === 'card'
      ? 'Secure card payment via Stripe (added in Stage 2).'
      : 'We hold your card as a no-show guarantee but charge nothing now — you pay cash at check-in.';
  }));

  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const name = document.getElementById('g_name').value.trim();
    if (!name) { alert('Please enter your name.'); return; }
    const extras = [...body.querySelectorAll('.ex-check:checked')].map((c) => Number(c.value));
    const res = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cottage_id: cottage.id, guest_name: name,
        guest_email: document.getElementById('g_email').value.trim(),
        guest_phone: document.getElementById('g_phone').value.trim(),
        check_in: currentSearch.check_in, check_out: currentSearch.check_out,
        guests: currentSearch.guests, payment_method: payment, extras,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Something went wrong.'); return; }
    body.innerHTML = `<div class="modal-body-inner confirm-ok">
      <div class="tick">✅</div>
      <h3>Booking confirmed</h3>
      <p class="sub">${data.cottage} · ${data.nights} night(s)</p>
      <div class="summary"><div class="row total"><span>Total</span><span>${yen(data.total)}</span></div></div>
      <p class="note">${payment === 'cash' ? 'Card held as guarantee — pay cash on arrival.' : 'A confirmation will be emailed to you.'}</p>
      <button class="btn primary block" onclick="location.reload()">Done</button>
    </div>`;
  });
}

// --- Wiring ----------------------------------------------------------------

document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const ci = document.getElementById('check_in').value;
  const co = document.getElementById('check_out').value;
  const g = document.getElementById('guests').value;
  if (!ci || !co) return;
  if (new Date(co) <= new Date(ci)) {
    document.getElementById('search-status').textContent = 'Check-out must be after check-in.';
    return;
  }
  currentSearch = { check_in: ci, check_out: co, guests: g };
  document.getElementById('search-status').textContent = `Showing availability for ${ci} → ${co}`;
  loadCottages();
  document.getElementById('cottages').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.add('hidden'));
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') document.getElementById('modal').classList.add('hidden');
});

// Default dates: today+7 to today+9
(function setDefaults() {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const t = new Date();
  document.getElementById('check_in').value = fmt(new Date(t.getTime() + 7 * 86400000));
  document.getElementById('check_out').value = fmt(new Date(t.getTime() + 9 * 86400000));
})();

loadExtras();
loadCottages();
