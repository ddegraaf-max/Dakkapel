// ============================================================
// MaatwerkDakkapel — lib/dakdata.js
// Adres → PDOK Locatieserver → BAG pand → 3D BAG (LoD2.2) → dakvlakken
//
// Bronnen (allemaal open data, geen API-key nodig):
//  - PDOK Locatieserver  https://api.pdok.nl/bzk/locatieserver/search/v3_1
//  - PDOK BAG WFS        https://service.pdok.nl/lv/bag/wfs/v2_0
//  - 3D BAG API          https://api.3dbag.nl  (CC BY 4.0 — © 3DBAG by tudelft3d and 3DGI)
//
// Per dakvlak berekenen we uit de LoD2.2-geometrie: hellingshoek, oriëntatie
// (azimut), goothoogte en nokhoogte t.o.v. maaiveld, dakbreedte (gootlengte)
// en de schuine daklengte. 3D BAG levert zelf ook b3_hellingshoek / b3_azimut
// per dakvlak; die nemen we mee als controlewaarde.
// ============================================================
'use strict';

const LOCATIESERVER = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';
const BAG_WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const BAG3D = 'https://api.3dbag.nl/collections/pand/items';
const USER_AGENT = 'MaatwerkDakkapel/1.0 (dakkapel-configurator; info@maatwerkdakkapel.nl)';

const ATTRIBUTIE = {
  tekst: '© 3DBAG by tudelft3d and 3DGI (CC BY 4.0)',
  url: 'https://docs.3dbag.nl/en/copyright',
  licentie: 'https://creativecommons.org/licenses/by/4.0/'
};

// ---------- HTTP ----------
async function fetchJson(url, { timeout = 9000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} voor ${url}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Eenvoudige cache (in-memory, TTL) ----------
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = fn().catch(err => { cache.delete(key); throw err; });
  cache.set(key, { value, exp: Date.now() + ttlMs });
  if (cache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.exp < now) cache.delete(k);
  }
  return value;
}

// ---------- PDOK Locatieserver ----------
function parseRd(wkt) {
  const m = /POINT\(\s*([\d.\-]+)\s+([\d.\-]+)\s*\)/.exec(wkt || '');
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

/** Autocomplete: adressen die bij de zoekterm passen. */
async function suggest(q, rows = 7) {
  const term = String(q || '').trim();
  if (term.length < 3) return [];
  const url = `${LOCATIESERVER}/suggest?q=${encodeURIComponent(term)}&fq=type:adres&rows=${rows}`;
  const data = await cached('sug:' + term.toLowerCase() + ':' + rows, 10 * 60 * 1000, () => fetchJson(url));
  return ((data.response && data.response.docs) || []).map(d => ({ id: d.id, adres: d.weergavenaam }));
}

const ADRES_FIELDS = 'id,weergavenaam,straatnaam,huis_nlt,postcode,woonplaatsnaam,gemeentenaam,centroide_rd,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id';

function mapAdres(d) {
  return {
    id: d.id,
    adres: d.weergavenaam,
    straat: d.straatnaam,
    huisnummer: d.huis_nlt,
    postcode: d.postcode,
    plaats: d.woonplaatsnaam,
    gemeente: d.gemeentenaam,
    verblijfsobjectId: d.adresseerbaarobject_id,
    nummeraanduidingId: d.nummeraanduiding_id,
    rd: parseRd(d.centroide_rd)
  };
}

/** Volledig adresrecord op basis van een Locatieserver-id (uit suggest). */
async function lookup(id) {
  const url = `${LOCATIESERVER}/lookup?id=${encodeURIComponent(id)}&fl=${ADRES_FIELDS}`;
  const data = await cached('lookup:' + id, 24 * 3600 * 1000, () => fetchJson(url));
  const d = data.response && data.response.docs && data.response.docs[0];
  return d ? mapAdres(d) : null;
}

/** Vrije zoekopdracht (bijv. "Torenlaan 5A Bussum" of "1402AT 5A") → beste adresmatch. */
async function zoekAdres(q) {
  const term = String(q || '').trim();
  if (term.length < 3) return null;
  const url = `${LOCATIESERVER}/free?q=${encodeURIComponent(term)}&fq=type:adres&rows=1&fl=${ADRES_FIELDS}`;
  const data = await cached('free:' + term.toLowerCase(), 10 * 60 * 1000, () => fetchJson(url));
  const d = data.response && data.response.docs && data.response.docs[0];
  return d ? mapAdres(d) : null;
}

// ---------- BAG: verblijfsobject → pand ----------
async function pandIdVoorVerblijfsobject(vboId) {
  if (!vboId || !/^\d{16}$/.test(String(vboId))) return null;
  const filter = `<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${vboId}</Literal></PropertyIsEqualTo></Filter>`;
  const url = `${BAG_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=bag:verblijfsobject&outputFormat=json&count=1&FILTER=${encodeURIComponent(filter)}`;
  try {
    const data = await cached('vbo:' + vboId, 24 * 3600 * 1000, () => fetchJson(url));
    const f = data.features && data.features[0];
    const pid = f && f.properties && f.properties.pandidentificatie;
    return pid ? String(pid) : null;
  } catch (e) {
    return null; // fallback: bbox-zoektocht in 3D BAG
  }
}

// ---------- 3D BAG ----------
async function pand3dOpId(pandId) {
  const fid = String(pandId).startsWith('NL.IMBAG.Pand.') ? String(pandId) : 'NL.IMBAG.Pand.' + pandId;
  const url = `${BAG3D}/${encodeURIComponent(fid)}`;
  const data = await cached('3d:' + fid, 24 * 3600 * 1000, () => fetchJson(url, { timeout: 12000 }));
  if (!data || !data.feature) return null;
  return { feature: data.feature, transform: data.metadata && data.metadata.transform };
}

async function pand3dOpPunt(rd, marge = 1.0) {
  const bbox = [rd.x - marge, rd.y - marge, rd.x + marge, rd.y + marge].map(n => n.toFixed(2)).join(',');
  const url = `${BAG3D}?bbox=${bbox}&limit=10`;
  const data = await cached('3dbbox:' + bbox, 24 * 3600 * 1000, () => fetchJson(url, { timeout: 12000 }));
  const feats = (data && data.features) || [];
  if (!feats.length) return null;
  const transform = data.metadata && data.metadata.transform;
  // kies het pand waarvan de footprint (LoD0) het adrespunt bevat
  let best = feats[0];
  for (const f of feats) {
    const fp = footprint(f, transform);
    if (fp && pointInPolygon(rd, fp)) { best = f; break; }
  }
  return { feature: best, transform };
}

// ---------- Geometrie ----------
function vertexFn(feature, transform) {
  const s = (transform && transform.scale) || [1, 1, 1];
  const t = (transform && transform.translate) || [0, 0, 0];
  const V = feature.vertices || [];
  return i => {
    const v = V[i];
    return [v[0] * s[0] + t[0], v[1] * s[1] + t[1], v[2] * s[2] + t[2]];
  };
}

function footprint(feature, transform) {
  const co = feature.CityObjects && feature.CityObjects[feature.id];
  if (!co) return null;
  const g = (co.geometry || []).find(x => String(x.lod) === '0');
  if (!g || !g.boundaries || !g.boundaries[0]) return null;
  const vx = vertexFn(feature, transform);
  const ring = g.boundaries[0][0]; // MultiSurface: [surface][ring][idx]
  return ring.map(i => { const p = vx(i); return { x: p[0], y: p[1] }; });
}

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function newellNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

const RICHTINGEN = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
function windrichting(az) {
  return RICHTINGEN[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}
const RICHTING_LABEL = { N: 'noord', NO: 'noordoost', O: 'oost', ZO: 'zuidoost', Z: 'zuid', ZW: 'zuidwest', W: 'west', NW: 'noordwest' };

const r1 = n => Math.round(n * 10) / 10;
const r2 = n => Math.round(n * 100) / 100;

/** Breedte dwars op de helling en diepte in de hellingsrichting (horizontaal gemeten). */
function extentLangsAzimut(pts, azimut) {
  const rad = azimut * Math.PI / 180;
  const dx = Math.sin(rad), dy = Math.cos(rad);   // afloop-richting
  const cx = -dy, cy = dx;                        // dwars-richting
  let cMin = Infinity, cMax = -Infinity, dMin = Infinity, dMax = -Infinity;
  for (const p of pts) {
    const c = p[0] * cx + p[1] * cy, d = p[0] * dx + p[1] * dy;
    if (c < cMin) cMin = c; if (c > cMax) cMax = c;
    if (d < dMin) dMin = d; if (d > dMax) dMax = d;
  }
  return { breedte: cMax - cMin, diepte: dMax - dMin };
}

/** Analyseer één LoD2.2-dakvlak (polygoon in meters, NAP). */
function analyseerVlak(pts, sem) {
  let [nx, ny, nz] = newellNormal(pts);
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const len = Math.hypot(nx, ny, nz);
  if (!len) return null;
  const area3d = len / 2;
  const areaProj = Math.abs(nz) / 2;
  const slope = Math.acos(Math.min(1, nz / len)) * 180 / Math.PI;      // graden
  const azimut = (Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360;    // kompas (0 = N, 90 = O): richting waarin het vlak afloopt
  const zs = pts.map(p => p[2]);
  const hmin = Math.min(...zs), hmax = Math.max(...zs);
  const ext = slope > 2 ? extentLangsAzimut(pts, azimut) : { breedte: 0, diepte: 0 };
  return {
    slope, azimut, hmin, hmax, area3d, areaProj, breedte: ext.breedte, diepte: ext.diepte,
    b3: sem && typeof sem.b3_hellingshoek === 'number'
      ? { hellingshoek: sem.b3_hellingshoek, azimut: sem.b3_azimut, hmin: sem.b3_h_dak_min, hmax: sem.b3_h_dak_max }
      : null,
    rings: [pts]
  };
}

/**
 * Breedte van het dakvlak (dwars op de helling) op hoogte z0: snijd alle randen
 * van de polygonen met het horizontale vlak z = z0 en meet de spreiding dwars op
 * de afloop-richting. Robuuster dan de gootlengte bij schilddaken en L-vormen.
 */
function breedteOpHoogte(rings, azimut, z0) {
  const rad = azimut * Math.PI / 180;
  const cx = -Math.cos(rad), cy = Math.sin(rad);   // dwars-richting
  let cMin = Infinity, cMax = -Infinity, n = 0;
  for (const pts of rings) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const da = a[2] - z0, db = b[2] - z0;
      let p = null;
      if (Math.abs(da) < 1e-9) p = a;
      else if (da * db < 0) { const t = da / (da - db); p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), z0]; }
      if (!p) continue;
      const c = p[0] * cx + p[1] * cy;
      if (c < cMin) cMin = c; if (c > cMax) cMax = c;
      n++;
    }
  }
  return n >= 2 ? cMax - cMin : 0;
}

/** Voeg vlakken samen die in hetzelfde dakvlak liggen (zelfde richting/helling, aansluitende hoogte). */
function clusterVlakken(vlakken) {
  const groepen = [];
  for (const v of vlakken) {
    const g = groepen.find(G =>
      Math.abs(((G.azimut - v.azimut + 540) % 360) - 180) < 8 &&
      Math.abs(G.slope - v.slope) < 5 &&
      Math.abs(G.hmin - v.hmin) < 0.6
    );
    if (g) {
      const tot = g.area3d + v.area3d;
      g.azimut = (g.azimut * g.area3d + v.azimut * v.area3d) / tot;
      g.slope = (g.slope * g.area3d + v.slope * v.area3d) / tot;
      g.area3d = tot; g.areaProj += v.areaProj;
      g.hmin = Math.min(g.hmin, v.hmin); g.hmax = Math.max(g.hmax, v.hmax);
      g.rings = g.rings.concat(v.rings);
      g.delen++;
    } else {
      groepen.push(Object.assign({}, v, { rings: v.rings.slice(), delen: 1 }));
    }
  }
  for (const g of groepen) {
    if (g.delen > 1) {
      const ext = extentLangsAzimut([].concat(...g.rings), g.azimut);
      g.breedte = ext.breedte; g.diepte = ext.diepte;
    }
  }
  return groepen;
}

/**
 * Analyseer een 3D BAG CityJSONFeature → pandgegevens + bruikbare dakvlakken.
 * Alle hoogtes in de uitvoer zijn t.o.v. maaiveld (m), tenzij 'Nap' in de naam.
 */
function analyseerPand(feature, transform) {
  const root = feature.CityObjects[feature.id];
  const a = (root && root.attributes) || {};
  const maaiveld = typeof a.b3_h_maaiveld === 'number' ? a.b3_h_maaiveld : null;
  const vx = vertexFn(feature, transform);

  const ruw = [];
  for (const co of Object.values(feature.CityObjects)) {
    for (const g of (co.geometry || [])) {
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      const surfaces = g.semantics.surfaces || [];
      const shells = g.type === 'Solid' ? g.boundaries : [g.boundaries];
      const values = g.type === 'Solid' ? g.semantics.values : [g.semantics.values];
      shells.forEach((shell, si) => {
        shell.forEach((surface, fi) => {
          const semIdx = values[si] && values[si][fi];
          const sem = surfaces[semIdx];
          if (!sem || sem.type !== 'RoofSurface') return;
          const ring = surface[0];
          if (!ring || ring.length < 3) return;
          const v = analyseerVlak(ring.map(vx), sem);
          if (v) ruw.push(v);
        });
      });
    }
  }

  // alleen schuine dakvlakken die voor een dakkapel in aanmerking komen
  const schuin = ruw.filter(v => v.slope >= 12 && v.slope <= 80 && v.area3d >= 3);
  const groepen = clusterVlakken(schuin).sort((p, q) => q.area3d - p.area3d);

  const dakvlakken = groepen.filter(g => g.area3d >= 6).map((g, i) => {
    const goot = maaiveld != null ? g.hmin - maaiveld : null;
    const nok = maaiveld != null ? g.hmax - maaiveld : null;
    const sinS = Math.sin(g.slope * Math.PI / 180);
    const schuineLengte = (g.hmax - g.hmin) / sinS;
    // breedte gemeten 1 m schuin boven de dakvoet (onderkant dakkapel) en ter hoogte van de
    // bovenkant van een 1,75 m hoge dakkapel — bij schilddaken loopt het vlak naar boven smaller toe
    const sTop = Math.min(schuineLengte - 0.5, 1.0 + 1.75 / sinS);
    const wOnder = breedteOpHoogte(g.rings, g.azimut, g.hmin + 1.0 * sinS) || g.breedte;
    const wMidden = sTop > 2.0 ? (breedteOpHoogte(g.rings, g.azimut, g.hmin + 2.0 * sinS) || wOnder) : wOnder;
    const wBoven = sTop > 1.0 ? (breedteOpHoogte(g.rings, g.azimut, g.hmin + sTop * sinS) || wOnder) : wOnder;
    const dakbreedte = Math.max(wOnder, wMidden);             // breedste deel onderin het dakvlak
    // vergunningsvrij (indicatief): 0,5 m vrij van de zijranden over de hele hoogte van de dakkapel;
    // onderkant 0,5–1 m boven de dakvoet; bovenkant minimaal 0,5 m onder de nok
    const maxBreedteVv = Math.max(0, Math.min(wOnder, wMidden, wBoven) - 1.0);
    const maxHoogteVv = Math.max(0, (schuineLengte - 1.0) * sinS);
    const richting = windrichting(g.azimut);
    return {
      nr: i + 1,
      richting,
      richtingLabel: RICHTING_LABEL[richting],
      azimut: Math.round(g.azimut),
      hellingshoek: r1(g.slope),
      goothoogte: goot != null ? r2(goot) : null,
      nokhoogte: nok != null ? r2(nok) : null,
      goothoogteNap: r2(g.hmin),
      nokhoogteNap: r2(g.hmax),
      dakbreedte: r2(dakbreedte),
      dakbreedteBoven: r2(wBoven),
      daklengteSchuin: r2(schuineLengte),
      oppervlak: r1(g.area3d),
      maxBreedteVergunningsvrij: r2(Math.min(8, maxBreedteVv)),
      maxHoogteVergunningsvrij: r2(Math.min(1.75, maxHoogteVv)),
      // geschikt = helling ≥ 30°, en er past vergunningsvrij minimaal een 2,50 m brede, 1,50 m hoge dakkapel
      geschikt: g.slope >= 30 && maxBreedteVv >= 2.5 && maxHoogteVv >= 1.5,
      controle3dbag: g.delen === 1 && g.b3 ? { hellingshoek: r1(g.b3.hellingshoek), azimut: Math.round(g.b3.azimut) } : null
    };
  });

  return {
    pand: {
      id: a.identificatie || feature.id,
      bouwjaar: a.oorspronkelijkbouwjaar || null,
      status: a.status || null,
      dakType: a.b3_dak_type || null,
      maaiveldNap: maaiveld != null ? r2(maaiveld) : null,
      bouwlagen: a.b3_bouwlagen || null,
      nokhoogte: (maaiveld != null && typeof a.b3_h_dak_max === 'number') ? r2(a.b3_h_dak_max - maaiveld) : null,
      goothoogte: (maaiveld != null && typeof a.b3_h_dak_min === 'number') ? r2(a.b3_h_dak_min - maaiveld) : null,
      oppDakSchuin: typeof a.b3_opp_dak_schuin === 'number' ? a.b3_opp_dak_schuin : null,
      oppDakPlat: typeof a.b3_opp_dak_plat === 'number' ? a.b3_opp_dak_plat : null,
      betrouwbaar: a.b3_kwaliteitsindicator !== false && a.b3_pw_onvoldoende !== true,
      puntenwolk: a.b3_pw_bron ? `${String(a.b3_pw_bron).toUpperCase()} (${a.b3_pw_datum || '?'})` : null
    },
    dakvlakken
  };
}

// ---------- Hoofdfunctie ----------
/**
 * Dakgegevens voor een adres.
 * @param {{id?: string, q?: string}} opts  Locatieserver-id (uit suggest) of vrije zoekterm
 */
async function dakdataVoorAdres(opts) {
  const adres = opts.id ? await lookup(opts.id) : await zoekAdres(opts.q);
  if (!adres) return { ok: false, error: 'Adres niet gevonden.' };
  if (!adres.rd) return { ok: false, error: 'Geen coördinaten voor dit adres.', adres };

  let bron = 'pand';
  const pandId = await pandIdVoorVerblijfsobject(adres.verblijfsobjectId);
  let res = null;
  if (pandId) {
    try { res = await pand3dOpId(pandId); } catch (e) { res = null; }
  }
  if (!res) {
    bron = 'bbox';
    res = await pand3dOpPunt(adres.rd);
  }
  if (!res) return { ok: false, error: 'Geen 3D-gebouwmodel gevonden voor dit adres.', adres };

  const analyse = analyseerPand(res.feature, res.transform);
  return {
    ok: true,
    adres,
    pand: analyse.pand,
    dakvlakken: analyse.dakvlakken,
    bron: { methode: bron, dataset: '3D BAG', attributie: ATTRIBUTIE },
    opmerking: analyse.dakvlakken.length
      ? 'Indicatieve waarden uit het landelijke 3D-gebouwmodel (3D BAG, op basis van AHN-hoogtedata). Bij het inmeten controleren wij alle maten.'
      : 'Geen schuin dakvlak gevonden in het 3D-model (plat dak of onvoldoende hoogtedata).'
  };
}

module.exports = {
  suggest, lookup, zoekAdres, dakdataVoorAdres, analyseerPand, ATTRIBUTIE,
  _intern: { analyseerVlak, clusterVlakken, breedteOpHoogte, pointInPolygon, windrichting, pandIdVoorVerblijfsobject, pand3dOpId, pand3dOpPunt }
};
