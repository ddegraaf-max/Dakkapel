// ============================================================
// MaatwerkDakkapel — server.js
// Creditline B.V. | Node.js / Express / EJS | Railway-ready
// ============================================================
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Prijslogica (indicatief, incl. BTW & montage) ----------
const PRICING = {
  basePrice: 7500,          // 2,50 m breed × 1,50 m hoog, incl. BTW, lift en container
  baseWidth: 250,           // cm
  baseHeight: 150,          // cm
  pricePerCm: 10,           // €1.000,- opslag per extra meter breedte, incl. BTW
  pricePerCmHoogte: 20,     // 1,50 → 1,75 m = + €500
  roosterPerVak: 65,        // ventilatierooster (suskast) per vak, incl. BTW
  horPerStuk: 65,           // inzethor per draaikiepraam, incl. BTW
  triplePerVak: 75,         // HR+++ glas per kozijnvak, incl. BTW
  minWidth: 250,
  maxWidth: 800,
  minHeight: 150,
  maxHeight: 175,
  materials: {
    kunststof: { label: 'Kunststof (onderhoudsarm)', factor: 1.0 },
    hout:      { label: 'Hout (traditioneel)',       factor: 1.14 },
    zink:      { label: 'Zinklook boeidelen',        factor: 1.22 }
  },
  // Drutex decorfolies (palet van bestelkozijnenopmaat.nl)
  colors: {
    'wit':          { label: 'Wit (RAL 9016)' },
    'creme':        { label: 'Crème (RAL 9001)' },
    'grijswit':     { label: 'Grijswit (RAL 9002)' },
    'zilvergrijs':  { label: 'Zilvergrijs (RAL 7001)' },
    'kwartsgrijs':  { label: 'Kwartsgrijs (RAL 7039)' },
    'basaltgrijs':  { label: 'Basaltgrijs (RAL 7012)' },
    'antraciet':    { label: 'Antraciet glad (RAL 7016)' },
    'antraciet-hn': { label: 'Antraciet houtnerf (RAL 7016)' },
    'zwart':        { label: 'Zwart (RAL 9005)' },
    'monument':     { label: 'Monumentengroen (RAL 6009)' },
    'staalblauw':   { label: 'Staalblauw (RAL 5011)' },
    'wijnrood':     { label: 'Wijnrood (RAL 3005)' },
    'golden-oak':   { label: 'Gouden eiken' },
    'winchester':   { label: 'Winchester' },
    'donker-eiken': { label: 'Donker eiken' },
    'mahonie':      { label: 'Mahonie' },
    'noten':        { label: 'Noten' },
    'macore':       { label: 'Macoré' }
  },
  options: {
    triple:     { label: 'Triple glas HR+++ (€ 75 per vak)',  price: 0, perVak: 75 },
    rc2:        { label: 'RC2 inbraakwerend',                 price: 425 },
    screens:    { label: 'Elektrische screens (zonwering)',   price: 0, meerprijs: true },
    rolluiken:  { label: 'Elektrische rolluiken',             price: 0, meerprijs: true },
    vergunning: { label: 'Vergunningsaanvraag',               price: 0, meerprijs: true },
    afwerking:  { label: 'Binnenafwerking (gips, stuc, schilderwerk)', price: 0, meerprijs: true },
    roedes:     { label: 'Roedes (sprossen) in foliekleur',   price: 395 },
    horren:     { label: 'Inzethorren (€ 65 per draaikiepraam)', price: 0, perDraaikiep: 65 }
  }
};

function calculatePrice(config) {
  const width = Math.min(PRICING.maxWidth, Math.max(PRICING.minWidth, parseInt(config.width, 10) || PRICING.baseWidth));
  const height = Math.min(PRICING.maxHeight, Math.max(PRICING.minHeight, parseInt(config.height, 10) || PRICING.maxHeight));
  const material = PRICING.materials[config.material] ? config.material : 'kunststof';
  let price = PRICING.basePrice
    + Math.max(0, width - PRICING.baseWidth) * PRICING.pricePerCm
    + Math.max(0, height - PRICING.baseHeight) * PRICING.pricePerCmHoogte;
  price *= PRICING.materials[material].factor;
  const vakken = Array.isArray(config.vakken) ? config.vakken : [];
  let dkCount = 0;
  vakken.forEach(v => {
    const mode = typeof v === 'string' ? v : (v && v.mode);
    const rooster = typeof v === 'object' && v && v.rooster;
    if (mode === 'dk-links' || mode === 'dk-rechts') dkCount++;
    if (rooster) price += PRICING.roosterPerVak;
  });
  const opts = Array.isArray(config.options) ? config.options : [];
  if (opts.includes('horren')) price += dkCount * PRICING.horPerStuk;
  const glasVakken = vakken.filter(v => (typeof v === 'string' ? v : (v && v.mode)) !== 'paneel').length;
  if (opts.includes('triple')) price += glasVakken * PRICING.triplePerVak;
  let optionsTotal = 0;
  opts.forEach(o => { if (PRICING.options[o]) optionsTotal += PRICING.options[o].price; });
  return Math.round((price + optionsTotal) / 5) * 5;
}

// ---------- Modellen (shop-opzet: 4 modellen met kleurvarianten) ----------
const MODELS = [
  {
    slug: 'basic',
    name: 'Dakkapel Basic',
    subtitle: 'Kunststof · plat dak',
    price: 7500,
    desc: 'Onze instapper met alles wat een goede dakkapel nodig heeft: volledig geïsoleerd, bitumen dakbedekking, kunststof rabatdelen en HR++ draaikiepramen. Prijs incl. BTW, lift en container.',
    colors: ['wit', 'creme'],
    type: 'plat', material: 'kunststof'
  },
  {
    slug: 'comfort',
    name: 'Dakkapel Comfort',
    subtitle: 'Kunststof · plat dak · antraciet',
    price: 8000,
    desc: 'De meest gekozen uitvoering: antraciet houtnerf kozijnen, ventilatieroosters standaard en voorbereid op elektrische screens of rolluiken.',
    colors: ['antraciet', 'wit'],
    type: 'plat', material: 'kunststof'
  },
  {
    slug: 'premium-hout',
    name: 'Dakkapel Premium Hout',
    subtitle: 'Hout · plat dak · houtlook',
    price: 8550,
    desc: 'Traditioneel houten kozijnen en boeidelen in warme houtlook (bruin) of dekkende kleur. Ideaal bij welstandseisen en karakteristieke woningen.',
    colors: ['bruin', 'monument', 'wit'],
    type: 'plat', material: 'hout'
  },
  {
    slug: 'aangekapt',
    name: 'Dakkapel Aangekapt',
    subtitle: 'Schuin dakje · pannen gedekt',
    price: 8950,
    desc: 'Het dakje volgt de lijn van uw bestaande dak, gedekt met dezelfde dakpannen. De klassieke keuze voor jaren \'30-woningen en voorzijdes.',
    colors: ['wit', 'creme', 'monument'],
    type: 'aangekapt', material: 'hout'
  }
];

// ---------- Routes ----------
app.get('/', (req, res) => res.render('index', { page: 'home', models: MODELS }));
app.get('/modellen', (req, res) => res.render('modellen', { page: 'modellen', models: MODELS }));
app.get('/configurator', (req, res) => res.render('configurator', { page: 'configurator', pricing: PRICING }));
app.get('/dakkapellen', (req, res) => res.render('dakkapellen', { page: 'dakkapellen' }));
app.get('/werkwijze', (req, res) => res.render('werkwijze', { page: 'werkwijze' }));
app.get('/over-ons', (req, res) => res.render('over-ons', { page: 'over-ons' }));
app.get('/contact', (req, res) => res.render('contact', { page: 'contact' }));
app.get('/privacy', (req, res) => res.render('privacy', { page: 'privacy' }));
app.get('/voorwaarden', (req, res) => res.render('voorwaarden', { page: 'voorwaarden' }));

// Live prijsberekening voor de configurator
app.post('/api/prijs', (req, res) => {
  try {
    res.json({ ok: true, price: calculatePrice(req.body) });
  } catch (e) {
    res.status(400).json({ ok: false });
  }
});

// Offerte-aanvraag → e-mail via Resend
app.post('/api/offerte', async (req, res) => {
  const { name, email, phone, postcode, message, config } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Naam en e-mail zijn verplicht.' });
  }
  const price = config ? calculatePrice(config) : null;
  const optLabels = (config && Array.isArray(config.options))
    ? config.options.map(o => {
        const opt = PRICING.options[o];
        if (!opt) return o;
        return opt.meerprijs ? opt.label + ' (meerprijs, prijs volgt in offerte)' : opt.label;
      }).join(', ')
    : '—';

  const VAK_LABELS = { 'vast': 'vast glas', 'dk-links': 'draaikiep (scharnieren links)', 'dk-rechts': 'draaikiep (scharnieren rechts)', 'paneel': 'dicht paneel' };
  const vakkenTekst = (config && Array.isArray(config.vakken))
    ? config.vakken.map((v, i) => {
        const mode = typeof v === 'string' ? v : (v && v.mode);
        const rooster = typeof v === 'object' && v && v.rooster;
        const breedte = (typeof v === 'object' && v && v.paneelBreedte) ? ` (${v.paneelBreedte} cm)` : '';
        return `Vak ${i + 1}: ${VAK_LABELS[mode] || mode}${mode === 'paneel' ? breedte : ''}${rooster ? ' + ventilatierooster' : ''}`;
      }).join(' · ')
    : '—';
  const kleur = id => (PRICING.colors[id] ? PRICING.colors[id].label : (id || '—'));
  const SIDE_LABELS = { 'kunststof-rabat': 'Kunststof rabatdelen', 'hout-rabat': 'Houten rabatdelen', 'zink': 'Zinklook', 'plaat': 'Vlak plaatmateriaal' };
  const summary = config ? `
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      <tr><td style="padding:6px 14px 6px 0;color:#777">Type</td><td><strong>${config.type === 'aangekapt' ? 'Aangekapte dakkapel (schuin dak)' : 'Dakkapel met plat dak'}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Breedte</td><td><strong>${(config.width / 100).toFixed(2).replace('.', ',')} m</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Hoogte</td><td><strong>${config.height ? (config.height / 100).toFixed(2).replace('.', ',') + ' m' : '1,75 m (standaard)'}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Indeling</td><td><strong>${vakkenTekst}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Materiaal boeidelen</td><td><strong>${PRICING.materials[config.material] ? PRICING.materials[config.material].label : config.material}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Kleur kozijn</td><td><strong>${kleur(config.colorFrame)}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Kleur draaiende delen</td><td><strong>${kleur(config.colorSash)}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Kleur boeidelen</td><td><strong>${kleur(config.colorBoei)}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Materiaal zijwangen</td><td><strong>${SIDE_LABELS[config.sideMaterial] || config.sideMaterial || '—'}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Kleur zijwangen</td><td><strong>${kleur(config.colorSide)}</strong></td></tr>
      ${(config.vakken || []).some(v => typeof v === 'object' && v && v.mode === 'paneel') ? `<tr><td style="padding:6px 14px 6px 0;color:#777">Kleur panelen</td><td><strong>${kleur(config.colorPaneel)}</strong></td></tr>` : ''}
      <tr><td style="padding:6px 14px 6px 0;color:#777">Opties</td><td><strong>${optLabels || 'Geen'}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#777">Prijsindicatie</td><td><strong>€ ${price ? price.toLocaleString('nl-NL') : '—'} incl. BTW &amp; montage</strong></td></tr>
    </table>` : '<p>Geen configuratie meegestuurd.</p>';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="color:#22272b">Nieuwe offerte-aanvraag — MaatwerkDakkapel</h2>
      <p><strong>Naam:</strong> ${name}<br>
         <strong>E-mail:</strong> ${email}<br>
         <strong>Telefoon:</strong> ${phone || '—'}<br>
         <strong>Postcode:</strong> ${postcode || '—'}</p>
      <h3 style="color:#22272b">Configuratie</h3>
      ${summary}
      ${message ? `<h3 style="color:#22272b">Opmerkingen</h3><p>${String(message).replace(/</g, '&lt;')}</p>` : ''}
    </div>`;

  try {
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.MAIL_FROM || 'MaatwerkDakkapel <onboarding@resend.dev>',
        to: process.env.MAIL_TO || 'info@maatwerkdakkapel.nl',
        reply_to: email,
        subject: `Offerte-aanvraag dakkapel — ${name}${price ? ' — € ' + price.toLocaleString('nl-NL') : ''}`,
        html
      });
    } else {
      console.log('[OFFERTE] RESEND_API_KEY ontbreekt — aanvraag gelogd:', { name, email, phone, postcode, config, price });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Resend fout:', err);
    // Aanvraag niet verliezen: loggen en toch bevestigen
    console.log('[OFFERTE-FALLBACK]', JSON.stringify({ name, email, phone, postcode, config, price }));
    res.json({ ok: true });
  }
});

// 404
app.use((req, res) => res.status(404).render('404', { page: '404' }));

app.listen(PORT, () => console.log(`MaatwerkDakkapel draait op poort ${PORT}`));
