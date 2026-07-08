// MaatwerkDakkapel — bouwanimatie (ter plaatse gebouwd)
(function () {
  'use strict';
  const svgEl = document.getElementById('buildAnim');
  if (!svgEl) return;
  const caption = document.getElementById('animCaption');
  const dotsEl = document.getElementById('animDots');

  // fase → zichtbare groepen
  const PHASES = [
    { caption: 'Uw woning — nog zonder dakkapel',                      on: [] },
    { caption: 'Dag 1 · Dakpannen verwijderen en opening maken',       on: ['ph1', 'phTegels', 'phTools'] },
    { caption: 'Constructie ter plaatse opbouwen — balken en stijlen', on: ['ph1', 'phTegels', 'ph2', 'phTools'] },
    { caption: 'Zijwangen, isolatie en kozijnen plaatsen',             on: ['ph1', 'phTegels', 'ph2', 'ph3', 'phTools'] },
    { caption: 'Bitumen dak, boeidelen en loodwerk afwerken',          on: ['ph1', 'phTegels', 'ph2', 'ph3', 'ph4', 'phTools'] },
    { caption: 'Klaar — uw dakkapel, ter plaatse gebouwd',             on: ['ph1', 'ph2', 'ph3', 'ph4', 'ph5'] }
  ];
  const HOLD = 2200; // ms per fase

  // dots
  PHASES.forEach((_, i) => {
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
    caption.textContent = PHASES[i].caption;
    dots.forEach((d, j) => d.classList.toggle('active', j === i));
  }

  function tick() {
    show((idx + 1) % PHASES.length);
    const pause = idx === PHASES.length - 1 ? HOLD + 1400 : HOLD; // extra pauze op eindbeeld
    timer = setTimeout(tick, pause);
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
