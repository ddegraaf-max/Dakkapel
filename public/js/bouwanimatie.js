// MaatwerkDakkapel — bouwanimatie (prefab: gebouwd in de werkplaats, in één dag geplaatst)
(function () {
  'use strict';
  const svgEl = document.getElementById('buildAnim');
  if (!svgEl) return;
  const caption = document.getElementById('animCaption');
  const dotsEl = document.getElementById('animDots');
  const unitEl = svgEl.querySelector('.phUnit');

  // fase → zichtbare groepen + positie van het prefab-element (ground | air | placed)
  const PHASES = [
    { caption: 'Uw woning — nog zonder dakkapel',                                   on: [], unit: 'ground' },
    { caption: 'In onze werkplaats gebouwd — compleet met kozijnen, glas, isolatie en dak', on: ['phUnit', 'phTrailer'], unit: 'ground' },
    { caption: 'Plaatsingsdag · dakpannen eraf en de opening maken',                on: ['ph1', 'phTegels', 'phKraan', 'phUnit', 'phTrailer'], unit: 'ground' },
    { caption: 'De dakkapel wordt in één geheel ingehesen',                         on: ['ph1', 'phTegels', 'phKraan', 'phUnit', 'phCableAir'], unit: 'air', hold: 3000 },
    { caption: 'Op zijn plek — direct wind- en waterdicht',                         on: ['ph1', 'phKraan', 'phUnit', 'phCablePlaced'], unit: 'placed', hold: 2800 },
    { caption: 'Loodwerk en dakpannen aansluiten, laatste afwerking',               on: ['ph1', 'phUnit', 'phLood'], unit: 'placed' },
    { caption: 'Klaar — in één dag geplaatst',                                      on: ['ph1', 'phUnit', 'phLood', 'ph5'], unit: 'placed', hold: 3600 }
  ];
  const HOLD = 2200; // ms per fase (standaard)

  // dots
  PHASES.forEach(() => {
    const d = document.createElement('span');
    d.className = 'anim-dot';
    dotsEl.appendChild(d);
  });
  const dots = Array.from(dotsEl.children);

  let idx = 0, timer = null, running = false;

  function show(i) {
    idx = i;
    const active = new Set(PHASES[i].on);
    svgEl.querySelectorAll('.ph').forEach(g => {
      const key = Array.from(g.classList).find(c => c.startsWith('ph') && c !== 'ph');
      g.classList.toggle('on', active.has(key));
    });
    if (unitEl && PHASES[i].unit) {
      unitEl.classList.remove('pos-ground', 'pos-air', 'pos-placed');
      unitEl.classList.add('pos-' + PHASES[i].unit);
    }
    caption.textContent = PHASES[i].caption;
    dots.forEach((d, j) => d.classList.toggle('active', j === i));
  }

  function tick() {
    show((idx + 1) % PHASES.length);
    timer = setTimeout(tick, PHASES[idx].hold || HOLD);
  }

  function start() {
    if (running) return;
    running = true;
    show(0);
    timer = setTimeout(tick, HOLD);
  }
  function stop() { running = false; clearTimeout(timer); }

  // start zodra in beeld, pauzeer buiten beeld
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? start() : stop());
    }, { threshold: 0.35 }).observe(svgEl);
  } else {
    start();
  }

  // klik op dots = handmatig naar fase
  dots.forEach((d, j) => d.addEventListener('click', () => { stop(); show(j); setTimeout(() => { running = false; start(); }, 4500); }));
})();
