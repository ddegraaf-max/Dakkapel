// ============================================================
// MaatwerkDakkapel — configurator.js
// Vooraanzicht dakkapel (zonder woning) · tot 8 m
// Per vak instelbaar · aparte kleuren kozijn / draaiende delen / boeidelen
// Kleurenpalet: Drutex decorfolies (bestelkozijnenopmaat.nl)
// ============================================================
(function () {
  'use strict';

  // ---------- Drutex kleurenpalet ----------
  const PALETTE = [
    { id: 'wit',          label: 'Wit (RAL 9016)',            hex: '#f5f5f2', frame: '#e6e6e1' },
    { id: 'creme',        label: 'Crème (RAL 9001)',          hex: '#efe9d8', frame: '#e0d9c4' },
    { id: 'grijswit',     label: 'Grijswit (RAL 9002)',       hex: '#e4e3dc', frame: '#d5d4cc' },
    { id: 'zilvergrijs',  label: 'Zilvergrijs (RAL 7001)',    hex: '#96a0a6', frame: '#87919a' },
    { id: 'kwartsgrijs',  label: 'Kwartsgrijs (RAL 7039)',    hex: '#6b6f66', frame: '#5d6159' },
    { id: 'basaltgrijs',  label: 'Basaltgrijs (RAL 7012)',    hex: '#4c5257', frame: '#41474c' },
    { id: 'antraciet',    label: 'Antraciet glad (RAL 7016)', hex: '#383e42', frame: '#2f3438' },
    { id: 'antraciet-hn', label: 'Antraciet houtnerf (7016)', hex: '#3a4045', frame: '#31363b' },
    { id: 'zwart',        label: 'Zwart (RAL 9005)',          hex: '#191b1e', frame: '#101214' },
    { id: 'monument',     label: 'Monumentengroen (6009)',    hex: '#27453a', frame: '#1f3a30' },
    { id: 'staalblauw',   label: 'Staalblauw (RAL 5011)',     hex: '#23425f', frame: '#1c3750' },
    { id: 'wijnrood',     label: 'Wijnrood (RAL 3005)',       hex: '#5e1f24', frame: '#4f181d' },
    { id: 'golden-oak',   label: 'Gouden eiken',              hex: '#a5682a', frame: '#935c22' },
    { id: 'winchester',   label: 'Winchester',                hex: '#8a5a33', frame: '#7a4e2a' },
    { id: 'donker-eiken', label: 'Donker eiken',              hex: '#5a3a22', frame: '#4c2f1b' },
    { id: 'mahonie',      label: 'Mahonie',                   hex: '#6e3524', frame: '#5e2b1c' },
    { id: 'noten',        label: 'Noten',                     hex: '#4e2f1e', frame: '#412617' },
    { id: 'macore',       label: 'Macoré',                    hex: '#7c4a2e', frame: '#6c3f26' }
  ];
  const byId = id => PALETTE.find(c => c.id === id) || PALETTE[0];

  // ---------- State ----------
  const state = {
    type: 'plat',
    width: 250,                 // cm (250–800)
    height: 175,                // cm (150–175)
    material: 'kunststof',
    colorFrame: 'wit',          // kozijn
    colorSash: 'wit',           // draaiende delen
    colorBoei: 'wit',           // boeidelen
    sideMaterial: 'kunststof-rabat',  // zijwangen: kunststof-rabat | hout-rabat | zink | plaat
    colorSide: 'antraciet-hn',  // kleur zijwangen
    colorPaneel: 'antraciet-hn', // kleur dichte panelen
    vakken: [
      { mode: 'dk-links', rooster: false },
      { mode: 'dk-rechts', rooster: false },
      { mode: 'dk-links', rooster: false }
    ],  // per vak: mode (vast | dk-links | dk-rechts) + ventilatierooster
    options: [],
    adres: null,                // { adres, postcode, plaats, pandId, bouwjaar } — uit stap 00
    dak: null                   // gekozen dakvlak uit 3D BAG (hellingshoek, goothoogte, dakbreedte, …)
  };

  // ---------- Prijslogica (spiegelt server; server is leidend) ----------
  const PRICING = {
    basePrice: 7500,            // 2,50 m breed × 1,50 m hoog, incl. BTW, kraan en container
    baseWidth: 250,
    baseHeight: 150,
    pricePerCm: 10,             // €1.000,- per extra meter breedte, incl. BTW
    pricePerCmHoogte: 20,       // 1,50 → 1,75 m = + €500
    materials: { kunststof: 1.0, hout: 1.14, zink: 1.22 },
    roosterPerVak: 65,          // ventilatierooster per vak, incl. BTW
    horPerStuk: 65,             // inzethor per draaikiepraam, incl. BTW
    triplePerVak: 75,           // HR+++ glas per kozijnvak, incl. BTW
    options: { rc2: 425, roedes: 395 },
    meerprijsOpties: ['screens', 'rolluiken', 'vergunning', 'afwerking']   // prijs volgt in de offerte
  };

  const MATERIAL_LABELS = { kunststof: 'Kunststof', hout: 'Hout', zink: 'Zinklook' };
  const SIDE_LABELS = { 'kunststof-rabat': 'Kunststof rabatdelen', 'hout-rabat': 'Houten rabatdelen', 'zink': 'Zinklook', 'plaat': 'Vlak plaatmateriaal' };
  const TYPE_LABELS = { plat: 'Plat dak', aangekapt: 'Aangekapt' };
  const VAK_LABELS = { 'vast': 'Vast glas', 'dk-links': 'Draaikiep · scharnieren links', 'dk-rechts': 'Draaikiep · scharnieren rechts', 'paneel': 'Dicht paneel in kleur' };

  const svg = document.getElementById('previewSvg');
  const priceEl = document.getElementById('priceValue');
  const dimLine = document.getElementById('dimLine');
  const dimLine2 = document.getElementById('dimLine2');
  const slider = document.getElementById('widthSlider');
  const widthValue = document.getElementById('widthValue');
  const hSlider = document.getElementById('heightSlider');
  const heightValue = document.getElementById('heightValue');
  const vakList = document.getElementById('vakList');

  function fmt(n) { return '€ ' + n.toLocaleString('nl-NL'); }
  function fmtM(cm) { return (cm / 100).toFixed(2).replace('.', ',') + ' m'; }

  function calcPrice() {
    let p = PRICING.basePrice
      + Math.max(0, state.width - PRICING.baseWidth) * PRICING.pricePerCm
      + Math.max(0, state.height - PRICING.baseHeight) * PRICING.pricePerCmHoogte;
    p *= PRICING.materials[state.material] || 1;
    let dk = 0;
    state.vakken.forEach(v => {
      if (v.mode !== 'vast') dk++;
      if (v.rooster) p += PRICING.roosterPerVak;
    });
    if (state.options.includes('horren')) p += dk * PRICING.horPerStuk;
    const glasVakken = state.vakken.filter(v => v.mode !== 'paneel').length;
    if (state.options.includes('triple')) p += glasVakken * PRICING.triplePerVak;
    state.options.forEach(o => { p += PRICING.options[o] || 0; });
    return Math.round(p / 5) * 5;
  }

  // ---------- Tekening: alléén de dakkapel (vooraanzicht) ----------
  function draw() {
    const frameC = byId(state.colorFrame);
    const sashC = byId(state.colorSash);
    const boeiC = byId(state.colorBoei);

    const W = 480, H = 300;
    const scale = 430 / 800;                    // 8,00 m past altijd in beeld
    const dw = Math.max(70, state.width * scale);
    const dh = Math.round(state.height * 0.62); // hoogte 150–175 cm → 93–109 px
    const cx = W / 2;
    const x0 = cx - dw / 2;
    const topY = state.type === 'aangekapt' ? 108 : 92;

    const zink = state.material === 'zink';
    const boeiFill = zink ? '#8d949b' : boeiC.hex;

    let s = '';
    s += `<defs>
      <linearGradient id="pv-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e7eff5"/><stop offset="1" stop-color="#f6f1e8"/>
      </linearGradient>
      <linearGradient id="pv-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5b4038"/><stop offset="1" stop-color="#7a564a"/>
      </linearGradient>
      <pattern id="pv-tiles" width="26" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 14 Q6.5 8 13 14 T26 14" stroke="rgba(0,0,0,.18)" fill="none"/>
      </pattern>
    </defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#pv-sky)"/>`;

    // zijwangen (eigen materiaal + kleur)
    const sideC = byId(state.colorSide);
    const sideFill = state.sideMaterial === 'zink' ? '#8d949b' : sideC.hex;
    s += `<polygon points="${x0},${topY + 6} ${x0 - 13},${topY + dh + 26} ${x0},${topY + dh + 12}" fill="${sideFill}" stroke="#22272b" stroke-width="2"/>`;
    s += `<polygon points="${x0 + dw},${topY + 6} ${x0 + dw + 13},${topY + dh + 26} ${x0 + dw},${topY + dh + 12}" fill="${sideFill}" stroke="#22272b" stroke-width="2"/>`;
    // textuur: rabatdelen = horizontale lijnen, zink = staande felsnaden
    if (state.sideMaterial === 'kunststof-rabat' || state.sideMaterial === 'hout-rabat') {
      for (let ly = topY + 22; ly < topY + dh + 8; ly += 11) {
        const t = (ly - (topY + 6)) / (dh + 20);
        s += `<line x1="${x0 - 13 * t}" y1="${ly}" x2="${x0}" y2="${ly + 2}" stroke="rgba(0,0,0,.22)" stroke-width="1.2"/>`;
        s += `<line x1="${x0 + dw}" y1="${ly + 2}" x2="${x0 + dw + 13 * t}" y2="${ly}" stroke="rgba(0,0,0,.22)" stroke-width="1.2"/>`;
      }
    } else if (state.sideMaterial === 'zink') {
      s += `<line x1="${x0 - 6}" y1="${topY + 14}" x2="${x0 - 8}" y2="${topY + dh + 22}" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>`;
      s += `<line x1="${x0 + dw + 6}" y1="${topY + 14}" x2="${x0 + dw + 8}" y2="${topY + dh + 22}" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>`;
    }

    if (state.type === 'plat') {
      s += `<rect x="${x0 - 12}" y="${topY - 16}" width="${dw + 24}" height="18" rx="4" fill="${boeiFill}" stroke="#22272b" stroke-width="2.5"/>`;
      if (zink) s += `<line x1="${x0 - 6}" y1="${topY - 7}" x2="${x0 + dw + 6}" y2="${topY - 7}" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>`;
    } else {
      s += `<polygon points="${x0 - 14},${topY + 2} ${cx},${topY - 44} ${x0 + dw + 14},${topY + 2}" fill="url(#pv-roof)" stroke="#22272b" stroke-width="2.5"/>`;
      s += `<polygon points="${x0 - 14},${topY + 2} ${cx},${topY - 44} ${x0 + dw + 14},${topY + 2}" fill="url(#pv-tiles)"/>`;
      s += `<rect x="${x0 - 12}" y="${topY - 2}" width="${dw + 24}" height="8" rx="3" fill="${boeiFill}" stroke="#22272b" stroke-width="2"/>`;
    }

    // kozijnkader (kozijnkleur)
    s += `<rect x="${x0}" y="${topY + 4}" width="${dw}" height="${dh}" fill="${frameC.hex}" stroke="#22272b" stroke-width="3"/>`;

    // vakken: panelen krijgen hun eigen breedte, glasvakken delen de rest
    const pad = 7, gap = 6;
    const n = state.vakken.length;
    const innerW = dw - pad * 2;
    const gy = topY + 12, gh = dh - 20;
    const paneelC = byId(state.colorPaneel);

    let paneelPxTotaal = 0, glasCount = 0;
    state.vakken.forEach(v => {
      if (v.mode === 'paneel') paneelPxTotaal += Math.max(20, (v.paneelBreedte || 60)) * scale;
      else glasCount++;
    });
    const beschikbaar = innerW - gap * (n - 1) - paneelPxTotaal;
    const glasW = glasCount > 0 ? Math.max(18, beschikbaar / glasCount) : 0;

    const horOn = state.options.includes('horren');
    let px = x0 + pad;
    state.vakken.forEach((vakObj, i) => {
      const vak = vakObj.mode;
      const paneW = vak === 'paneel' ? Math.max(20, (vakObj.paneelBreedte || 60)) * scale : glasW;
      if (vak === 'paneel') {
        // dicht paneel in kleur
        s += `<rect x="${px}" y="${gy}" width="${paneW}" height="${gh}" fill="${paneelC.hex}" stroke="${frameC.frame}" stroke-width="3"/>`;
        s += `<line x1="${px + 3}" y1="${gy + 5}" x2="${px + 3}" y2="${gy + gh - 5}" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>`;
        s += `<line x1="${px + paneW - 3}" y1="${gy + 5}" x2="${px + paneW - 3}" y2="${gy + gh - 5}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>`;
        s += `<text x="${px + paneW / 2}" y="${gy + gh - 4}" text-anchor="middle" font-family="Instrument Sans, sans-serif" font-size="10" font-weight="600" fill="rgba(255,255,255,.6)">${i + 1}</text>`;
        px += paneW + gap;
        return;
      }
      const sashColor = vak === 'vast' ? frameC.frame : sashC.hex;
      const sashStroke = vak === 'vast' ? 3 : 5;
      s += `<rect x="${px}" y="${gy}" width="${paneW}" height="${gh}" fill="#bcd7e8" stroke="${sashColor}" stroke-width="${sashStroke}"/>`;
      s += `<line x1="${px + paneW * 0.22}" y1="${gy + 4}" x2="${px + paneW * 0.06}" y2="${gy + gh - 6}" stroke="rgba(255,255,255,.55)" stroke-width="3"/>`;
      // openingssymbolen
      const l = px + 4, r = px + paneW - 4, t = gy + 4, b = gy + gh - 4, mx = px + paneW / 2, my = gy + gh / 2;
      const sym = 'rgba(34,39,43,.45)';
      if (vak === 'dk-links') {
        s += `<path d="M${l} ${t} L${r} ${my} L${l} ${b}" stroke="${sym}" stroke-width="1.6" fill="none"/>`;   // draai: scharnieren links
        s += `<path d="M${l} ${b} L${mx} ${t} L${r} ${b}" stroke="${sym}" stroke-width="1.6" fill="none"/>`;   // kiep
      } else if (vak === 'dk-rechts') {
        s += `<path d="M${r} ${t} L${l} ${my} L${r} ${b}" stroke="${sym}" stroke-width="1.6" fill="none"/>`;
        s += `<path d="M${l} ${b} L${mx} ${t} L${r} ${b}" stroke="${sym}" stroke-width="1.6" fill="none"/>`;
      }
      // vak-nummer
      s += `<text x="${mx}" y="${b - 4}" text-anchor="middle" font-family="Instrument Sans, sans-serif" font-size="10" font-weight="600" fill="rgba(34,39,43,.35)">${i + 1}</text>`;
      // ventilatierooster (per vak)
      if (vakObj.rooster) {
        s += `<rect x="${px + paneW * 0.15}" y="${gy + 3}" width="${paneW * 0.7}" height="5" rx="2.5" fill="#7d848b"/>`;
        s += `<line x1="${px + paneW * 0.22}" y1="${gy + 5.5}" x2="${px + paneW * 0.78}" y2="${gy + 5.5}" stroke="rgba(255,255,255,.6)" stroke-width="1" stroke-dasharray="2 2"/>`;
      }
      // inzethor (alleen op draaikiepramen)
      if (horOn && vak !== 'vast') {
        const hx = px + 3, hw = paneW - 6;
        const hy = gy + gh - Math.min(30, gh * 0.32), hh = Math.min(26, gh * 0.28);
        s += `<rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" fill="rgba(60,66,72,.14)" stroke="rgba(60,66,72,.5)" stroke-width="1.5" rx="2"/>`;
        for (let gx2 = hx + 4; gx2 < hx + hw - 2; gx2 += 5) {
          s += `<line x1="${gx2}" y1="${hy + 2}" x2="${gx2}" y2="${hy + hh - 2}" stroke="rgba(60,66,72,.28)" stroke-width="0.8"/>`;
        }
        for (let gy2 = hy + 4; gy2 < hy + hh - 2; gy2 += 5) {
          s += `<line x1="${hx + 2}" y1="${gy2}" x2="${hx + hw - 2}" y2="${gy2}" stroke="rgba(60,66,72,.28)" stroke-width="0.8"/>`;
        }
      }
      // roedes (sprossen)
      if (state.options.includes('roedes')) {
        s += `<line x1="${px}" y1="${gy + gh / 2}" x2="${px + paneW}" y2="${gy + gh / 2}" stroke="${sashColor}" stroke-width="2.5"/>`;
        s += `<line x1="${mx}" y1="${gy}" x2="${mx}" y2="${gy + gh}" stroke="${sashColor}" stroke-width="2.5"/>`;
      }
      px += paneW + gap;
    });

    // screens/rolluiken-kast
    if (state.options.includes('screens') || state.options.includes('rolluiken')) {
      s += `<rect x="${x0 + 2}" y="${topY + 5}" width="${dw - 4}" height="9" rx="3" fill="${state.options.includes('rolluiken') ? '#6b7178' : '#9aa3ab'}" stroke="#22272b" stroke-width="1.5"/>`;
    }

    // onderdorpel
    s += `<polygon points="${x0},${topY + dh + 4} ${x0 - 12},${topY + dh + 20} ${x0 + dw + 12},${topY + dh + 20} ${x0 + dw},${topY + dh + 4}" fill="#d9d2c3" stroke="#22272b" stroke-width="2.5"/>`;

    // maatlijn
    const mlY = state.type === 'aangekapt' ? topY - 58 : topY - 34;
    s += `<line x1="${x0}" y1="${mlY}" x2="${x0 + dw}" y2="${mlY}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<line x1="${x0}" y1="${mlY - 5}" x2="${x0}" y2="${mlY + 5}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<line x1="${x0 + dw}" y1="${mlY - 5}" x2="${x0 + dw}" y2="${mlY + 5}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<text x="${cx}" y="${mlY - 8}" text-anchor="middle" font-family="Instrument Sans, sans-serif" font-size="13" font-weight="600" fill="#c4502e">${fmtM(state.width)}</text>`;

    // hoogte-maatlijn (rechts)
    const hxL = Math.min(W - 14, x0 + dw + 26);
    const hTop = state.type === 'plat' ? topY - 16 : topY - 2;
    const hBot = topY + dh + 20;
    s += `<line x1="${hxL}" y1="${hTop}" x2="${hxL}" y2="${hBot}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<line x1="${hxL - 5}" y1="${hTop}" x2="${hxL + 5}" y2="${hTop}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<line x1="${hxL - 5}" y1="${hBot}" x2="${hxL + 5}" y2="${hBot}" stroke="#c4502e" stroke-width="1.5"/>`;
    s += `<text x="${hxL + 8}" y="${(hTop + hBot) / 2 + 4}" font-family="Instrument Sans, sans-serif" font-size="12" font-weight="600" fill="#c4502e" transform="rotate(90 ${hxL + 8} ${(hTop + hBot) / 2 + 4})" text-anchor="middle">${fmtM(state.height)}</text>`;

    svg.innerHTML = s;
  }

  // ---------- Kleurgrids ----------
  function buildColorGrid(containerId, stateKey) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    PALETTE.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-chip' + (state[stateKey] === c.id ? ' selected' : '');
      b.title = c.label;
      b.setAttribute('aria-label', c.label);
      b.innerHTML = `<span class="chip-swatch" style="background:${c.hex}"></span>`;
      b.addEventListener('click', () => {
        state[stateKey] = c.id;
        el.querySelectorAll('.color-chip').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        const lbl = document.getElementById(containerId + 'Label');
        if (lbl) lbl.textContent = c.label;
        update();
      });
      el.appendChild(b);
    });
    const lbl = document.getElementById(containerId + 'Label');
    if (lbl) lbl.textContent = byId(state[stateKey]).label;
  }

  // ---------- Vakken-UI ----------
  function setPanelCount(n) {
    const cur = state.vakken;
    const next = [];
    for (let i = 0; i < n; i++) {
      next.push(cur[i] || { mode: (i % 2 === 0 ? 'dk-links' : 'dk-rechts'), rooster: false });
    }
    state.vakken = next;
    buildVakList();
  }

  function buildVakList() {
    if (!vakList) return;
    vakList.innerHTML = '';
    state.vakken.forEach((vakObj, i) => {
      const row = document.createElement('div');
      row.className = 'vak-row';
      row.innerHTML = `<span class="vak-num">Vak ${i + 1}</span>`;
      const opts = document.createElement('div');
      opts.className = 'vak-opts';
      [['vast', 'Vast'], ['dk-links', 'Draaikiep ⟵'], ['dk-rechts', 'Draaikiep ⟶'], ['paneel', 'Paneel']].forEach(([val, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'vak-btn' + (vakObj.mode === val ? ' selected' : '');
        b.textContent = label;
        b.title = VAK_LABELS[val];
        b.addEventListener('click', () => {
          state.vakken[i].mode = val;
          if (val === 'paneel') {
            state.vakken[i].rooster = false;
            if (!state.vakken[i].paneelBreedte) state.vakken[i].paneelBreedte = 60;
          }
          buildVakList();   // rij opnieuw opbouwen (breedte-invoer tonen/verbergen)
          update();
        });
        opts.appendChild(b);
      });
      if (vakObj.mode === 'paneel') {
        // breedte-invoer voor het paneel (cm)
        const wrap = document.createElement('span');
        wrap.className = 'paneel-breedte';
        wrap.innerHTML = '<label>breedte</label>';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 20; inp.max = 300; inp.step = 5;
        inp.value = vakObj.paneelBreedte || 60;
        inp.addEventListener('input', () => {
          const v = Math.min(300, Math.max(20, parseInt(inp.value, 10) || 60));
          state.vakken[i].paneelBreedte = v;
          update();
        });
        const cm = document.createElement('span');
        cm.textContent = 'cm';
        wrap.appendChild(inp);
        wrap.appendChild(cm);
        opts.appendChild(wrap);
      } else {
        // ventilatierooster-toggle per vak (+ € 65) — niet bij een dicht paneel
        const vr = document.createElement('button');
        vr.type = 'button';
        vr.className = 'vak-btn vak-rooster' + (vakObj.rooster ? ' selected' : '');
        vr.innerHTML = 'Rooster <span class="vak-price">+ € 65</span>';
        vr.title = 'Ventilatierooster (suskast) in dit vak — € 65 per stuk';
        vr.addEventListener('click', () => {
          state.vakken[i].rooster = !state.vakken[i].rooster;
          vr.classList.toggle('selected', state.vakken[i].rooster);
          update();
        });
        opts.appendChild(vr);
      }
      row.appendChild(opts);
      vakList.appendChild(row);
    });
  }

  // ---------- UI update ----------
  function update() {
    draw();
    priceEl.textContent = fmt(calcPrice());
    const dk = state.vakken.filter(v => v.mode === 'dk-links' || v.mode === 'dk-rechts').length;
    const pn = state.vakken.filter(v => v.mode === 'paneel').length;
    const paneelWrap = document.getElementById('paneelKleurWrap');
    if (paneelWrap) paneelWrap.style.display = pn > 0 ? '' : 'none';
    const vr = state.vakken.filter(v => v.rooster).length;
    dimLine.textContent = `${fmtM(state.width)} × ${fmtM(state.height)} · ${state.vakken.length} vakken (${dk}× draaikiep${pn ? ', ' + pn + '× paneel' : ''}${vr ? ', ' + vr + '× rooster' : ''})`;
    dimLine2.textContent = `${TYPE_LABELS[state.type]} · ${MATERIAL_LABELS[state.material]} · kozijn ${byId(state.colorFrame).label.split(' (')[0]}`;
    const pct = ((state.width - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', pct + '%');
    // meerprijs-opties (prijs volgt in offerte)
    const mp = state.options.filter(o => PRICING.meerprijsOpties.includes(o));
    const mpEl = document.getElementById('priceMeerprijs');
    if (mpEl) {
      const NAMEN = { screens: 'screens', rolluiken: 'rolluiken', vergunning: 'vergunningsaanvraag', afwerking: 'binnenafwerking' };
      mpEl.textContent = mp.length
        ? '+ meerprijs ' + mp.map(o => NAMEN[o] || o).join(' & ') + ' (in offerte)'
        : '';
    }
    updateDakInfo();
  }

  // ---------- Stap 00: adres → dakgegevens (PDOK Locatieserver + 3D BAG) ----------
  const adresInput = document.getElementById('adresInput');
  const adresSuggest = document.getElementById('adresSuggest');
  const adresZoekBtn = document.getElementById('adresZoekBtn');
  const dakStatus = document.getElementById('dakStatus');
  const dakResult = document.getElementById('dakResult');
  const dakPandEl = document.getElementById('dakPand');
  const dakvlakList = document.getElementById('dakvlakList');
  const dakDoorsnede = document.getElementById('dakDoorsnede');
  const previewDak = document.getElementById('previewDak');
  const widthWarn = document.getElementById('widthWarn');
  let gekozenAdresId = null, suggestTimer = null, suggestItems = [], suggestIdx = -1, dakvlakken = [];

  const fmtMeters = m => (typeof m === 'number' ? m.toFixed(2).replace('.', ',') + ' m' : '—');
  const fmtGraden = g => (typeof g === 'number' ? String(g).replace('.', ',') + '°' : '—');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function setDakStatus(msg, cls) {
    if (!dakStatus) return;
    dakStatus.className = 'form-status' + (cls ? ' ' + cls : '');
    dakStatus.textContent = msg || '';
  }
  function verbergSuggesties() {
    if (adresSuggest) { adresSuggest.hidden = true; adresSuggest.innerHTML = ''; }
    suggestItems = []; suggestIdx = -1;
  }
  function toonSuggesties(items) {
    suggestItems = items; suggestIdx = -1;
    adresSuggest.innerHTML = '';
    if (!items.length) { adresSuggest.hidden = true; return; }
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.textContent = it.adres;
      li.addEventListener('mousedown', e => { e.preventDefault(); kiesSuggestie(i); });
      adresSuggest.appendChild(li);
    });
    adresSuggest.hidden = false;
  }
  function kiesSuggestie(i) {
    const it = suggestItems[i];
    if (!it) return;
    adresInput.value = it.adres;
    gekozenAdresId = it.id;
    verbergSuggesties();
    haalDakdata();
  }
  async function laadSuggesties() {
    const q = adresInput.value.trim();
    if (q.length < 3) { verbergSuggesties(); return; }
    try {
      const res = await fetch('/api/adres/suggest?q=' + encodeURIComponent(q));
      const data = await res.json();
      if (data.ok && adresInput.value.trim() === q) toonSuggesties(data.items || []);
    } catch (e) { /* stil — zoeken via de knop blijft werken */ }
  }
  async function haalDakdata() {
    const q = adresInput.value.trim();
    if (!q) { setDakStatus('Vul eerst uw adres in.', 'err'); return; }
    verbergSuggesties();
    setDakStatus('Dakgegevens ophalen uit het 3D-gebouwmodel…', 'busy');
    adresZoekBtn.disabled = true;
    try {
      const url = gekozenAdresId
        ? '/api/dakdata?id=' + encodeURIComponent(gekozenAdresId)
        : '/api/dakdata?q=' + encodeURIComponent(q);
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Geen gegevens gevonden voor dit adres.');
      toonDakdata(data);
    } catch (e) {
      state.adres = null; state.dak = null; dakvlakken = [];
      dakResult.hidden = true;
      setDakStatus((e && e.message) || 'Dakgegevens konden niet worden opgehaald. U kunt de configurator gewoon verder gebruiken.', 'err');
      update();
    } finally {
      adresZoekBtn.disabled = false;
    }
  }
  function toonDakdata(data) {
    const p = data.pand || {};
    const a = data.adres || {};
    state.adres = { adres: a.adres, postcode: a.postcode, plaats: a.plaats, pandId: p.id, bouwjaar: p.bouwjaar };
    const pc = document.getElementById('fPostcode');
    if (pc && !pc.value && a.postcode) pc.value = String(a.postcode).replace(/^(\d{4})\s?([A-Za-z]{2})$/, '$1 $2').toUpperCase();
    dakvlakken = data.dakvlakken || [];
    const DAKTYPE = { slanted: 'schuin dak', horizontal: 'plat dak', 'multiple horizontal': 'meerdere platte dakdelen' };
    dakPandEl.innerHTML = `<b>${esc(a.adres)}</b>`
      + (p.bouwjaar ? ` · bouwjaar ${esc(p.bouwjaar)}` : '')
      + ` · ${DAKTYPE[p.dakType] || esc(p.dakType || 'daktype onbekend')}`
      + (typeof p.nokhoogte === 'number' ? ` · nok ${fmtMeters(p.nokhoogte)} boven maaiveld` : '')
      + (p.betrouwbaar === false ? ' · <span style="color:var(--accent-deep)">beperkte hoogtedata</span>' : '');
    dakvlakList.innerHTML = '';
    if (!dakvlakken.length) {
      setDakStatus(data.opmerking || 'Geen schuin dakvlak gevonden voor dit adres.', 'err');
      dakResult.hidden = false;
      dakDoorsnede.hidden = true;
      state.dak = null;
      update();
      return;
    }
    dakvlakken.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dakvlak';
      b.innerHTML = `<div class="dv-head"><span>Dakvlak ${v.nr} · ${esc(v.richtingLabel)}</span><span class="dv-badge${v.geschikt ? '' : ' warn'}">${v.geschikt ? 'geschikt' : 'let op'}</span></div>
        <div class="dv-specs">
          <span>Helling <b>${fmtGraden(v.hellingshoek)}</b></span><span>Goothoogte <b>${fmtMeters(v.goothoogte)}</b></span>
          <span>Dakbreedte <b>${fmtMeters(v.dakbreedte)}</b></span><span>Nokhoogte <b>${fmtMeters(v.nokhoogte)}</b></span>
        </div>`;
      b.addEventListener('click', () => kiesDakvlak(i));
      dakvlakList.appendChild(b);
    });
    const n = dakvlakken.length;
    setDakStatus(`Gevonden: ${n} schuin${n === 1 ? '' : 'e'} dakvlak${n === 1 ? '' : 'ken'}. Kies hieronder het dakvlak voor uw dakkapel.`, 'ok');
    dakResult.hidden = false;
    const eerste = dakvlakken.findIndex(v => v.geschikt);
    kiesDakvlak(eerste >= 0 ? eerste : 0);
  }
  function kiesDakvlak(i) {
    const v = dakvlakken[i];
    if (!v) return;
    state.dak = Object.assign({}, v);
    dakvlakList.querySelectorAll('.dakvlak').forEach((el, j) => el.classList.toggle('selected', j === i));
    update();
  }

  // zij-aanzicht op schaal: dakhelling met de dakkapel erop (hoogte uit de configurator)
  function tekenDoorsnede(v) {
    if (!dakDoorsnede) return;
    if (!v || typeof v.hellingshoek !== 'number' || typeof v.goothoogte !== 'number' || v.hellingshoek < 3) { dakDoorsnede.hidden = true; return; }
    const W = 360, Hpx = 210, y0 = 190, xWall = 70;
    const rad = v.hellingshoek * Math.PI / 180;
    const L = v.daklengteSchuin || ((v.nokhoogte - v.goothoogte) / Math.sin(rad));
    const run = L * Math.cos(rad), rise = L * Math.sin(rad);
    const nok = v.goothoogte + rise;
    const s = Math.min(150 / Math.max(nok, 4), 240 / Math.max(run, 2));
    const ex = xWall, ey = y0 - v.goothoogte * s;              // dakvoet
    const nx = ex + run * s, ny = ey - rise * s;                // nok
    const a = 0.75, H = state.height / 100;                     // onderkant dakkapel 0,75 m schuin boven de dakvoet
    const sTop = a + H / Math.sin(rad);
    const P0 = [ex + a * Math.cos(rad) * s, ey - a * Math.sin(rad) * s];
    const P1 = [P0[0], P0[1] - H * s];
    const P2 = [ex + sTop * Math.cos(rad) * s, ey - sTop * Math.sin(rad) * s];
    const past = sTop <= L - 0.5;
    const col = past ? '#2e7d4f' : '#c4502e';
    const font = 'font-family="Instrument Sans, sans-serif" font-size="11" font-weight="600"';
    const ext = Math.min(run, 2.5) * s;
    let d = `<svg viewBox="0 0 ${W} ${Hpx}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Doorsnede van het dakvlak met de dakkapel">`;
    d += `<line x1="10" y1="${y0}" x2="${W - 10}" y2="${y0}" stroke="#7d848b" stroke-width="1.5"/>`;
    d += `<rect x="${ex - 46}" y="${ey}" width="46" height="${y0 - ey}" fill="#e9e2d4" stroke="#22272b" stroke-width="1.5"/>`;
    d += `<line x1="${nx}" y1="${ny}" x2="${Math.min(W - 12, nx + ext)}" y2="${ny + ext * Math.tan(rad)}" stroke="#5b4038" stroke-width="5" stroke-linecap="round" opacity=".4"/>`;
    d += `<line x1="${ex}" y1="${ey}" x2="${nx}" y2="${ny}" stroke="#5b4038" stroke-width="5" stroke-linecap="round"/>`;
    d += `<polygon points="${P0[0]},${P0[1]} ${P1[0]},${P1[1]} ${P2[0]},${P2[1]}" fill="${past ? 'rgba(46,125,79,.18)' : 'rgba(196,80,46,.18)'}" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`;
    d += `<rect x="${P1[0] + 2}" y="${P1[1] + 4}" width="${Math.max(6, (P2[0] - P1[0]) * 0.5)}" height="${Math.max(6, (P0[1] - P1[1]) - 10)}" fill="#bcd7e8" stroke="${col}" stroke-width="1"/>`;
    d += `<text x="${ex + 28}" y="${ey - 6}" ${font} fill="#c4502e">${fmtGraden(v.hellingshoek)}</text>`;
    d += `<text x="${ex - 44}" y="${(ey + y0) / 2 + 4}" ${font} fill="#4a5158">goot ${fmtMeters(v.goothoogte)}</text>`;
    d += `<text x="${Math.min(W - 80, nx + 6)}" y="${ny - 6}" ${font} fill="#4a5158">nok ${fmtMeters(nok)}</text>`;
    d += `<text x="${P1[0] + 4}" y="${P1[1] - 6}" ${font} fill="${col}">dakkapel ${fmtMeters(H)}${past ? '' : ' — te hoog'}</text>`;
    d += '</svg>';
    dakDoorsnede.innerHTML = d;
    dakDoorsnede.hidden = false;
  }

  function updateDakInfo() {
    const v = state.dak;
    tekenDoorsnede(v);
    if (!previewDak) return;
    if (!v) { previewDak.hidden = true; if (widthWarn) widthWarn.hidden = true; return; }
    previewDak.innerHTML = `<b>Uw dak</b> (${esc(v.richtingLabel)}): helling <b>${fmtGraden(v.hellingshoek)}</b> · goothoogte <b>${fmtMeters(v.goothoogte)}</b> · dakbreedte <b>${fmtMeters(v.dakbreedte)}</b> · vergunningsvrij tot ca. <b>${fmtMeters(v.maxBreedteVergunningsvrij)}</b> breed`;
    previewDak.hidden = false;
    if (widthWarn) {
      const w = state.width / 100, h = state.height / 100;
      const msgs = [];
      if (typeof v.maxBreedteVergunningsvrij === 'number' && w > v.maxBreedteVergunningsvrij + 0.005) {
        msgs.push(`Breder dan ca. ${fmtMeters(v.maxBreedteVergunningsvrij)} past op dit dakvlak niet vergunningsvrij (0,5 m vrij van de dakranden).`);
      }
      if (typeof v.maxHoogteVergunningsvrij === 'number' && h > v.maxHoogteVergunningsvrij + 0.005) {
        msgs.push(`Een hoogte van ${fmtMeters(h)} past op dit dakvlak niet vergunningsvrij (bovenkant minimaal 0,5 m onder de nok) — max. ca. ${fmtMeters(v.maxHoogteVergunningsvrij)}.`);
      }
      if (v.hellingshoek < 30) {
        msgs.push('De dakhelling is minder dan 30°; dan is een dakkapel vaak lastiger te plaatsen. Wij beoordelen dit bij het inmeten.');
      }
      widthWarn.textContent = msgs.join(' ');
      widthWarn.hidden = !msgs.length;
    }
  }

  if (adresInput && adresSuggest && adresZoekBtn) {
    adresInput.addEventListener('input', () => {
      gekozenAdresId = null;
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(laadSuggesties, 250);
    });
    adresInput.addEventListener('keydown', e => {
      if (adresSuggest.hidden || !suggestItems.length) {
        if (e.key === 'Enter') { e.preventDefault(); haalDakdata(); }
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); suggestIdx = (suggestIdx + 1) % suggestItems.length; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); suggestIdx = (suggestIdx - 1 + suggestItems.length) % suggestItems.length; }
      else if (e.key === 'Enter') { e.preventDefault(); kiesSuggestie(suggestIdx >= 0 ? suggestIdx : 0); return; }
      else if (e.key === 'Escape') { verbergSuggesties(); return; }
      else return;
      adresSuggest.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === suggestIdx));
    });
    adresInput.addEventListener('blur', () => setTimeout(verbergSuggesties, 150));
    adresZoekBtn.addEventListener('click', haalDakdata);
  }

  // ---------- Events ----------
  slider.addEventListener('input', () => {
    state.width = parseInt(slider.value, 10);
    widthValue.textContent = fmtM(state.width);
    update();
  });

  if (hSlider) {
    hSlider.addEventListener('input', () => {
      state.height = parseInt(hSlider.value, 10);
      heightValue.textContent = fmtM(state.height);
      const pct = ((state.height - hSlider.min) / (hSlider.max - hSlider.min)) * 100;
      hSlider.style.setProperty('--fill', pct + '%');
      update();
    });
  }

  document.querySelectorAll('.choice-grid').forEach(grid => {
    const group = grid.dataset.group;
    grid.querySelectorAll('.choice').forEach(choice => {
      choice.addEventListener('click', () => {
        const input = choice.querySelector('input');
        if (input.type === 'radio') {
          grid.querySelectorAll('.choice').forEach(c => c.classList.remove('selected'));
          choice.classList.add('selected');
          input.checked = true;
          if (group === 'panels') setPanelCount(parseInt(input.value, 10));
          else state[group] = input.value;
        } else {
          input.checked = !input.checked;
          choice.classList.toggle('selected', input.checked);
          state.options = Array.from(document.querySelectorAll('input[name="options"]:checked')).map(i => i.value);
        }
        update();
      });
    });
  });

  // ---------- Offerte ----------
  const statusEl = document.getElementById('formStatus');
  document.getElementById('submitOfferte').addEventListener('click', async () => {
    const name = document.getElementById('fName').value.trim();
    const email = document.getElementById('fEmail').value.trim();
    statusEl.className = 'form-status';
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      statusEl.textContent = 'Vul uw naam en een geldig e-mailadres in.';
      statusEl.classList.add('err');
      return;
    }
    const btn = document.getElementById('submitOfferte');
    btn.disabled = true; btn.textContent = 'Versturen…';
    try {
      const res = await fetch('/api/offerte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email,
          phone: document.getElementById('fPhone').value.trim(),
          postcode: document.getElementById('fPostcode').value.trim(),
          message: document.getElementById('fMessage').value.trim(),
          config: state
        })
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.textContent = 'Dank u wel! Uw aanvraag is verzonden — wij nemen binnen één werkdag contact met u op.';
        statusEl.classList.add('ok');
      } else {
        throw new Error(data.error || 'fout');
      }
    } catch (e) {
      statusEl.textContent = 'Er ging iets mis bij het versturen. Probeer het opnieuw of mail ons direct.';
      statusEl.classList.add('err');
    } finally {
      btn.disabled = false; btn.textContent = 'Offerte aanvragen';
    }
  });

  // init
  buildColorGrid('colorFrameGrid', 'colorFrame');
  buildColorGrid('colorSashGrid', 'colorSash');
  buildColorGrid('colorBoeiGrid', 'colorBoei');
  buildColorGrid('colorSideGrid', 'colorSide');
  buildColorGrid('colorPaneelGrid', 'colorPaneel');
  buildVakList();
  if (hSlider) {
    const pct = ((state.height - hSlider.min) / (hSlider.max - hSlider.min)) * 100;
    hSlider.style.setProperty('--fill', pct + '%');
  }
  update();
})();
