// Saha araçları (Ayarlar): dilim dönüşümü, noktaya git (pusula), temel ödevler, alan hesabı.
// Mesai hesabından bağımsızdır; girdiler tarayıcıda saklanır.

// ── Jeodezi ────────────────────────────────────────────────────────────
// Elipsoitler. ITRF96 (GRS80) ile WGS84 arasındaki fark saha için ihmal edilebilir (< 1 m).
const ELLIPSOIDS = {
  grs80: {label: 'ITRF96 / GRS80', a: 6378137, f: 1 / 298.257222101},
  hayford: {label: 'ED50 / Hayford', a: 6378388, f: 1 / 297},
};
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;

// Transversal Merkatör (Krüger n-serisi, 6. derece; dilim içinde mm altı doğruluk)
function tmSeries(ell) {
  const n = ell.f / (2 - ell.f), n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
  return {
    n, A: ell.a / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256),
    alpha: [n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800,
      13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360,
      61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440,
      49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600,
      34729 * n5 / 80640 - 3418889 * n6 / 1995840,
      212378941 * n6 / 319334400],
    beta: [n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800,
      n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720,
      17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720,
      4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600,
      4583 * n5 / 161280 - 108847 * n6 / 3991680,
      20648693 * n6 / 638668800],
    delta: [2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45 + 26 * n5 / 45 - 2854 * n6 / 675,
      7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45 + 2704 * n5 / 315 + 2323 * n6 / 945,
      56 * n3 / 15 - 136 * n4 / 35 - 1262 * n5 / 105 + 73814 * n6 / 2835,
      4279 * n4 / 630 - 332 * n5 / 35 - 399572 * n6 / 14175,
      4174 * n5 / 315 - 144838 * n6 / 6237,
      601676 * n6 / 22275],
  };
}
const TM_CACHE = {};
const series = key => TM_CACHE[key] || (TM_CACHE[key] = tmSeries(ELLIPSOIDS[key]));

// Coğrafi (derece) → sağa (Y) / yukarı (X)
function tmForward(lat, lon, {ell = 'grs80', lon0, k0, fe = 500000}) {
  const s = series(ell), c = 2 * Math.sqrt(s.n) / (1 + s.n), phi = toRad(lat), lam = toRad(lon - lon0);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xi0 = Math.atan(t / Math.cos(lam)), eta0 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let xi = xi0, eta = eta0;
  s.alpha.forEach((a, j) => { const k = 2 * (j + 1); xi += a * Math.sin(k * xi0) * Math.cosh(k * eta0); eta += a * Math.cos(k * xi0) * Math.sinh(k * eta0); });
  return {y: fe + k0 * s.A * eta, x: k0 * s.A * xi};
}
// Sağa (Y) / yukarı (X) → coğrafi (derece)
function tmInverse(y, x, {ell = 'grs80', lon0, k0, fe = 500000}) {
  const s = series(ell), xi = x / (k0 * s.A), eta = (y - fe) / (k0 * s.A);
  let xi0 = xi, eta0 = eta;
  s.beta.forEach((b, j) => { const k = 2 * (j + 1); xi0 -= b * Math.sin(k * xi) * Math.cosh(k * eta); eta0 -= b * Math.cos(k * xi) * Math.sinh(k * eta); });
  const chi = Math.asin(Math.sin(xi0) / Math.cosh(eta0));
  let phi = chi; s.delta.forEach((d, j) => { phi += d * Math.sin(2 * (j + 1) * chi); });
  return {lat: toDeg(phi), lon: lon0 + toDeg(Math.atan2(Math.sinh(eta0), Math.cos(xi0)))};
}

// Türkiye dilimleri: 3° (DOM 27…45, k0 = 1) ve 6° UTM (35…38. dilim, k0 = 0,9996)
const TM3_DOMS = [27, 30, 33, 36, 39, 42, 45];
const UTM_ZONES = [35, 36, 37, 38];
const utmLon0 = z => z * 6 - 183;
const nearestDom = lon => TM3_DOMS.reduce((b, d) => Math.abs(d - lon) < Math.abs(b - lon) ? d : b, 27);
const utmZoneOf = lon => Math.min(38, Math.max(35, Math.floor((lon + 180) / 6) + 1));
const sys = (kind, z, ell) => kind === 'tm3' ? {ell, lon0: Number(z), k0: 1} : {ell, lon0: utmLon0(Number(z)), k0: 0.9996};

// Yüzey (WGS84 küre yaklaşımı yerine elipsoit üzerinde Vincenty yerine yeterli: haversine + ilk semt)
function distBearing(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, p1 = toRad(lat1), p2 = toRad(lat2), dp = p2 - p1, dl = toRad(lon2 - lon1);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const b = (toDeg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360;
  return {d, b};
}

// ── Biçim ──────────────────────────────────────────────────────────────
const sNum = v => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); return s === '' ? null : /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : NaN; };
const sFix = (v, d = 3) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ',');
const sGroup = (v, d = 3) => { if (v == null || !Number.isFinite(v)) return '—'; const [i, f] = Math.abs(v).toFixed(d).split('.'); return (v < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : ''); };
const dms = deg => { if (!Number.isFinite(deg)) return '—'; const s = deg < 0 ? '−' : '', a = Math.abs(deg); let d = Math.floor(a), m = Math.floor((a - d) * 60), x = ((a - d) * 60 - m) * 60; if (x >= 59.9995) { x = 0; m++; } if (m === 60) { m = 0; d++; } return `${s}${d}° ${String(m).padStart(2, '0')}′ ${x.toFixed(3).replace('.', ',').padStart(6, '0')}″`; };
const sStore = (key, def) => { try { return {...def, ...(JSON.parse(localStorage.getItem(key) || 'null') || {})}; } catch { return {...def}; } };
const sSave = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const toUnit = (rad, unit) => unit === 'grad' ? rad * 200 / Math.PI : toDeg(rad);
const fromUnit = (v, unit) => unit === 'grad' ? v * Math.PI / 200 : toRad(v);
const norm = (v, unit) => { const full = unit === 'grad' ? 400 : 360; return ((v % full) + full) % full; };

// Ortak: bir sistemdeki girdiyi coğrafiye çevir
function readPoint(p) {
  if (p.kind === 'geo') { const lat = sNum(p.a), lon = sNum(p.b); return Number.isFinite(lat) && Number.isFinite(lon) ? {lat, lon} : null; }
  const y = sNum(p.a), x = sNum(p.b);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
  return tmInverse(y, x, sys(p.kind, p.zone, p.ell || 'grs80'));
}

// ── Dilim dönüşümü ─────────────────────────────────────────────────────
function dilimTool() {
  return {
    d: sStore('saha-dilim', {ell: 'grs80', from: 'tm3', fromZone: '33', to: 'utm', toZone: 'auto', a: '', b: ''}),
    init() { this.$watch('d', v => sSave('saha-dilim', v)); },
    doms: TM3_DOMS, zones: UTM_ZONES, ells: ELLIPSOIDS, fix: sFix, grp: sGroup, dms,
    get geo() { return readPoint({kind: this.d.from, zone: this.d.fromZone, ell: this.d.ell, a: this.d.a, b: this.d.b}); },
    get target() {
      const g = this.geo; if (!g) return null;
      if (this.d.to === 'geo') return {geo: g};
      const z = this.d.toZone === 'auto' ? (this.d.to === 'tm3' ? nearestDom(g.lon) : utmZoneOf(g.lon)) : Number(this.d.toZone);
      return {zone: z, ...tmForward(g.lat, g.lon, sys(this.d.to, z, this.d.ell))};
    },
    get labels() { return this.d.from === 'geo' ? ['Enlem (°)', 'Boylam (°)'] : ['Sağa (Y)', 'Yukarı (X)']; },
    swap() {
      const t = this.target; if (!t) { [this.d.from, this.d.to] = [this.d.to, this.d.from]; return; }
      const from = this.d.to, zone = t.zone;
      Object.assign(this.d, {to: this.d.from, toZone: 'auto', from, fromZone: String(zone || this.d.fromZone),
        a: from === 'geo' ? sFix(t.geo.lat, 9) : sFix(t.y, 3), b: from === 'geo' ? sFix(t.geo.lon, 9) : sFix(t.x, 3)});
    },
    copy(text) { navigator.clipboard?.writeText(text).then(() => this.$dispatch('toast', 'Kopyalandı')).catch(() => {}); },
  };
}

// ── Noktaya git (pusula) ───────────────────────────────────────────────
// Sensör verisi titrek gelir: yön ve ok açısı her karede yumuşatılır, 359°→0° geçişinde tur atmaz.
const angDelta = (to, from) => ((to - from + 540) % 360) - 180;
function gitTool() {
  return {
    g: sStore('saha-git', {kind: 'tm3', zone: '33', ell: 'grs80', a: '', b: '', name: ''}),
    pos: null, acc: null, heading: null, running: false, err: '', watchId: null, onOri: null,
    // Ekranda çizilen (yumuşatılmış, sarılmamış) açılar
    roseRot: 0, arrowRot: 0, startD: null, arrived: false, raf: 0, buzzed: false,
    init() { this.$watch('g', v => { sSave('saha-git', v); this.startD = null; this.arrived = false; }); },
    doms: TM3_DOMS, zones: UTM_ZONES, fix: sFix, grp: sGroup,
    get labels() { return this.g.kind === 'geo' ? ['Enlem (°)', 'Boylam (°)'] : ['Sağa (Y)', 'Yukarı (X)']; },
    get target() { return readPoint(this.g); },
    get nav() { return this.pos && this.target ? distBearing(this.pos.lat, this.pos.lon, this.target.lat, this.target.lon) : null; },
    get off() { const n = this.nav; return n && this.heading != null ? angDelta(n.b, this.heading) : null; },
    get aligned() { return this.off != null && Math.abs(this.off) < 12; },
    get near() { return this.nav && this.nav.d < 25; },
    get progress() { const n = this.nav; return n && this.startD ? Math.min(1, Math.max(0, 1 - n.d / this.startD)) : 0; },
    get hint() {
      if (!this.running) return this.target ? 'Başlat\'a basın' : 'Hedef koordinatı girin';
      if (!this.pos) return 'Konum aranıyor…';
      if (this.arrived) return 'Hedefe vardınız';
      if (this.off == null) return 'Yürüyün, yön bulunacak';
      if (this.aligned) return this.near ? 'Çok yakın, yavaşlayın' : 'Doğru yöndesiniz';
      return this.off > 0 ? 'Sağa dönün' : 'Sola dönün';
    },
    get here() { if (!this.pos) return null; const z = this.g.kind === 'utm' ? Number(this.g.zone) : null; const dom = this.g.kind === 'tm3' ? Number(this.g.zone) : nearestDom(this.pos.lon); return z ? {lbl: 'UTM ' + z, ...tmForward(this.pos.lat, this.pos.lon, sys('utm', z, 'grs80'))} : {lbl: 'DOM ' + dom, ...tmForward(this.pos.lat, this.pos.lon, sys('tm3', dom, 'grs80'))}; },
    get distText() { const n = this.nav; if (!n) return '—'; return n.d >= 1000 ? sFix(n.d / 1000, 2) : n.d >= 100 ? String(Math.round(n.d)) : sFix(n.d, 1); },
    get distUnit() { const n = this.nav; return n && n.d >= 1000 ? 'km' : 'm'; },
    // Her karede hedef açılara yaklaş (yumuşak, en kısa yoldan)
    loop() {
      const k = 0.14, h = this.heading ?? 0, n = this.nav;
      this.roseRot += angDelta(-h, this.roseRot) * k;
      if (n) this.arrowRot += angDelta(n.b - h, this.arrowRot) * k;
      if (n) {
        if (this.startD == null || n.d > this.startD) this.startD = n.d;
        const hit = n.d <= Math.max(3, Math.min(this.acc ?? 5, 8));
        if (hit && !this.arrived) { this.arrived = true; if (!this.buzzed) { navigator.vibrate?.([80, 60, 80, 60, 200]); this.buzzed = true; } }
        if (!hit && n.d > 12) { this.arrived = false; this.buzzed = false; }
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },
    async start() {
      this.err = ''; this.startD = null; this.arrived = false; this.buzzed = false;
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') this.err = 'Pusula izni verilmedi; yön yalnız yürürken GPS ile bulunur.';
        }
      } catch { this.err = 'Pusula izni alınamadı.'; }
      this.onOri = e => {
        let h = null;
        if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
        else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
        if (h != null) { const o = screen.orientation?.angle || 0; this.heading = (h + o + 360) % 360; }
      };
      addEventListener('deviceorientationabsolute', this.onOri); addEventListener('deviceorientation', this.onOri);
      if (!navigator.geolocation) { this.err = 'Bu cihazda konum yok.'; return; }
      this.watchId = navigator.geolocation.watchPosition(p => {
        this.pos = {lat: p.coords.latitude, lon: p.coords.longitude}; this.acc = p.coords.accuracy;
        if (this.err.startsWith('Konum')) this.err = '';
        if (this.heading == null && p.coords.heading != null && p.coords.speed > 0.5) this.heading = p.coords.heading;
      }, e => { this.err = e.code === 1 ? 'Konum izni verilmedi. Ayarlar → Safari → Konum.' : 'Konum alınamadı.'; }, {enableHighAccuracy: true, maximumAge: 1000, timeout: 20000});
      this.running = true; cancelAnimationFrame(this.raf); this.loop();
    },
    stop() {
      if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
      removeEventListener('deviceorientationabsolute', this.onOri); removeEventListener('deviceorientation', this.onOri);
      cancelAnimationFrame(this.raf); this.running = false; this.watchId = null;
    },
    destroy() { this.stop(); },
  };
}

// ── Temel ödevler ──────────────────────────────────────────────────────
function temelTool() {
  return {
    t: sStore('saha-temel', {unit: 'grad', ay: '', ax: '', by: '', bx: '', ang: '', dist: ''}),
    init() { this.$watch('t', v => sSave('saha-temel', v)); },
    fix: sFix, grp: sGroup,
    // 2. temel ödev: A ve B'den semt ve mesafe
    get inv() {
      const [ay, ax, by, bx] = [this.t.ay, this.t.ax, this.t.by, this.t.bx].map(sNum);
      if (![ay, ax, by, bx].every(Number.isFinite)) return null;
      const dy = by - ay, dx = bx - ax;
      return {s: Math.hypot(dy, dx), t: norm(toUnit(Math.atan2(dy, dx), this.t.unit), this.t.unit), dy, dx};
    },
    // 1. temel ödev: A, semt ve mesafeden B
    get fwd() {
      const [ay, ax, a, s] = [this.t.ay, this.t.ax, this.t.ang, this.t.dist].map(sNum);
      if (![ay, ax, a, s].every(Number.isFinite)) return null;
      const r = fromUnit(a, this.t.unit);
      return {y: ay + s * Math.sin(r), x: ax + s * Math.cos(r)};
    },
  };
}

// ── Alan hesabı (koordinatlardan, Gauss) ───────────────────────────────
function alanTool() {
  return {
    p: sStore('saha-alan', {rows: [{y: '', x: ''}, {y: '', x: ''}, {y: '', x: ''}]}),
    init() { this.$watch('p', v => sSave('saha-alan', v)); },
    fix: sFix, grp: sGroup,
    get pts() { return this.p.rows.map(r => ({y: sNum(r.y), x: sNum(r.x)})).filter(q => Number.isFinite(q.y) && Number.isFinite(q.x)); },
    get res() {
      const q = this.pts; if (q.length < 3) return null;
      let a = 0, per = 0;
      for (let i = 0; i < q.length; i++) { const p1 = q[i], p2 = q[(i + 1) % q.length]; a += p1.y * p2.x - p2.y * p1.x; per += Math.hypot(p2.y - p1.y, p2.x - p1.x); }
      return {area: Math.abs(a) / 2, per};
    },
    add() { this.p.rows.push({y: '', x: ''}); },
    del(i) { if (this.p.rows.length > 3) this.p.rows.splice(i, 1); },
    clear() { if (confirm('Tüm noktalar silinsin mi?')) this.p.rows = [{y: '', x: ''}, {y: '', x: ''}, {y: '', x: ''}]; },
    next(ev) { const all = [...this.$root.querySelectorAll('.alan-table input')], i = all.indexOf(ev.target); if (i >= 0 && i < all.length - 1) all[i + 1].focus(); else { this.add(); this.$nextTick(() => [...this.$root.querySelectorAll('.alan-table input')].at(-2)?.focus()); } },
  };
}

// ── Trigonometrik yükseklik (total station) ────────────────────────────
// D = S·sin Z, ΔH = S·cos Z + i − t (+ eğrilik/kırılma (1−k)D²/2R)
function trigTool() {
  return {
    t: sStore('saha-trig', {unit: 'grad', s: '', z: '', i: '', r: '', h0: '', ek: true}),
    init() { this.$watch('t', v => sSave('saha-trig', v)); },
    fix: sFix, grp: sGroup,
    get res() {
      const s = sNum(this.t.s), z = sNum(this.t.z);
      if (!Number.isFinite(s) || !Number.isFinite(z)) return null;
      const zr = fromUnit(z, this.t.unit), i = sNum(this.t.i) || 0, r = sNum(this.t.r) || 0, h0 = sNum(this.t.h0);
      const d = s * Math.sin(zr), cr = this.t.ek ? (1 - 0.13) * d * d / (2 * 6371000) : 0;
      const dh = s * Math.cos(zr) + i - r + cr;
      return {d, dh, cr, kot: Number.isFinite(h0) ? h0 + dh : null, pct: d ? (s * Math.cos(zr)) / d * 100 : null};
    },
  };
}

// ── Eğim ───────────────────────────────────────────────────────────────
function egimTool() {
  return {
    e: sStore('saha-egim', {d: '', h: '', pct: '', d2: ''}),
    init() { this.$watch('e', v => sSave('saha-egim', v)); },
    fix: sFix,
    get res() {
      const d = sNum(this.e.d), h = sNum(this.e.h);
      if (!Number.isFinite(d) || !Number.isFinite(h) || d === 0) return null;
      const a = Math.atan2(h, d);
      return {pct: h / d * 100, deg: toDeg(a), grad: a * 200 / Math.PI, n: h ? Math.abs(d / h) : null, s: Math.hypot(d, h)};
    },
    get back() { const p = sNum(this.e.pct), d = sNum(this.e.d2); return Number.isFinite(p) && Number.isFinite(d) ? d * p / 100 : null; },
  };
}

// ── Birim çevirici (açı ve alan) ───────────────────────────────────────
function birimTool() {
  return {
    b: sStore('saha-birim', {av: '', au: 'grad', arv: '', aru: 'm2'}),
    init() { this.$watch('b', v => sSave('saha-birim', v)); },
    fix: sFix, grp: sGroup, dms,
    // Derece.dakikasaniye (ddd.mmss) girişi
    get rad() {
      const v = sNum(this.b.av); if (!Number.isFinite(v)) return null;
      if (this.b.au === 'dms') { const sg = v < 0 ? -1 : 1, a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 100 + 1e-9), s = ((a - d) * 100 - m) * 100; return sg * toRad(d + m / 60 + s / 3600); }
      return this.b.au === 'grad' ? v * Math.PI / 200 : this.b.au === 'rad' ? v : toRad(v);
    },
    get area() {
      const v = sNum(this.b.arv); if (!Number.isFinite(v)) return null;
      const m2 = v * ({m2: 1, donum: 1000, ha: 10000, km2: 1e6}[this.b.aru]);
      return {m2, donum: m2 / 1000, ha: m2 / 10000, km2: m2 / 1e6};
    },
  };
}

// ── Dik koordinat (doğruya göre) ve aplikasyon ─────────────────────────
// A→B doğrusu boyunca a (absis), dik yönde h (ordinat; sağ +, sol −)
function dikTool() {
  return {
    k: sStore('saha-dik', {ay: '', ax: '', by: '', bx: '', py: '', px: '', a: '', h: ''}),
    init() { this.$watch('k', v => sSave('saha-dik', v)); },
    fix: sFix, grp: sGroup,
    get base() {
      const [ay, ax, by, bx] = [this.k.ay, this.k.ax, this.k.by, this.k.bx].map(sNum);
      if (![ay, ax, by, bx].every(Number.isFinite)) return null;
      const L = Math.hypot(by - ay, bx - ax); if (!L) return null;
      return {ay, ax, uy: (by - ay) / L, ux: (bx - ax) / L, L};
    },
    // Noktadan doğruya: absis, ordinat ve dik ayak
    get toLine() {
      const b = this.base, py = sNum(this.k.py), px = sNum(this.k.px);
      if (!b || !Number.isFinite(py) || !Number.isFinite(px)) return null;
      const dy = py - b.ay, dx = px - b.ax, a = dy * b.uy + dx * b.ux, h = dy * b.ux - dx * b.uy;
      return {a, h, fy: b.ay + a * b.uy, fx: b.ax + a * b.ux};
    },
    // Absis/ordinattan nokta (aplikasyon)
    get fromLine() {
      const b = this.base, a = sNum(this.k.a), h = sNum(this.k.h);
      if (!b || !Number.isFinite(a) || !Number.isFinite(h)) return null;
      return {y: b.ay + a * b.uy + h * b.ux, x: b.ax + a * b.ux - h * b.uy};
    },
  };
}

// ── İki doğrunun kesişimi ──────────────────────────────────────────────
function kesTool() {
  return {
    k: sStore('saha-kes', {a1y: '', a1x: '', a2y: '', a2x: '', b1y: '', b1x: '', b2y: '', b2x: ''}),
    init() { this.$watch('k', v => sSave('saha-kes', v)); },
    fix: sFix, grp: sGroup,
    get res() {
      const v = ['a1y', 'a1x', 'a2y', 'a2x', 'b1y', 'b1x', 'b2y', 'b2x'].map(f => sNum(this.k[f]));
      if (!v.every(Number.isFinite)) return null;
      const [p1y, p1x, p2y, p2x, q1y, q1x, q2y, q2x] = v, ry = p2y - p1y, rx = p2x - p1x, sy = q2y - q1y, sx = q2x - q1x;
      const den = ry * sx - rx * sy;
      if (Math.abs(den) < 1e-12) return {parallel: true};
      const t = ((q1y - p1y) * sx - (q1x - p1x) * sy) / den, u = ((q1y - p1y) * rx - (q1x - p1x) * ry) / den;
      return {y: p1y + t * ry, x: p1x + t * rx, onA: t >= 0 && t <= 1, onB: u >= 0 && u <= 1};
    },
  };
}
