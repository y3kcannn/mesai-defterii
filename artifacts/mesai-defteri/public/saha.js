// Saha araçları (Ayarlar): dilim ve datum dönüşümü, noktaya git (pusula), semt-mesafe, alan, trigonometrik yükseklik.
// Mesai hesabından bağımsızdır; girdiler tarayıcıda saklanır.

// ── Jeodezi ────────────────────────────────────────────────────────────
// Elipsoitler. ITRF96 (GRS80) ile WGS84 arasındaki fark saha için ihmal edilebilir (< 1 m).
const ELLIPSOIDS = {
  grs80: {label: 'ITRF96', a: 6378137, f: 1 / 298.257222101},
  hayford: {label: 'ED50', a: 6378388, f: 1 / 297},
};
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;

// ED50 ↔ WGS84/ITRF96 datum dönüşümü: EPSG:1784 (Türkiye, Position Vector, 7 parametre, ~2 m doğruluk).
// Uygulama içinde coğrafi koordinatlar hep WGS84'tür; ED50 girdi/çıktı bu dönüşümle çevrilir.
const ED50_WGS = {tx: -84.1, ty: -101.8, tz: -129.7, rx: 0, ry: 0, rz: 0.468, s: 1.05};
function geoToEcef(lat, lon, {a, f}) {
  const e2 = f * (2 - f), p = toRad(lat), l = toRad(lon), N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  return [N * Math.cos(p) * Math.cos(l), N * Math.cos(p) * Math.sin(l), N * (1 - e2) * Math.sin(p)];
}
function ecefToGeo([X, Y, Z], {a, f}) {
  const e2 = f * (2 - f), p = Math.hypot(X, Y); let lat = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 6; i++) { const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2); lat = Math.atan2(Z + e2 * N * Math.sin(lat), p); }
  return {lat: toDeg(lat), lon: toDeg(Math.atan2(Y, X))};
}
function helmert([X, Y, Z], dir) {
  const k = ED50_WGS, as = Math.PI / 648000, rx = dir * k.rx * as, ry = dir * k.ry * as, rz = dir * k.rz * as, m = 1 + dir * k.s * 1e-6;
  return [dir * k.tx + m * (X - rz * Y + ry * Z), dir * k.ty + m * (rz * X + Y - rx * Z), dir * k.tz + m * (-ry * X + rx * Y + Z)];
}
const WGS84 = {a: 6378137, f: 1 / 298.257223563};
// Seçili datumdaki coğrafi → WGS84 ve tersi
const toWgs = (g, ell) => ell === 'hayford' ? ecefToGeo(helmert(geoToEcef(g.lat, g.lon, ELLIPSOIDS.hayford), 1), WGS84) : g;
const fromWgs = (g, ell) => ell === 'hayford' ? ecefToGeo(helmert(geoToEcef(g.lat, g.lon, WGS84), -1), ELLIPSOIDS.hayford) : g;

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
const sNum = v => { let s = String(v ?? '').trim().replace(/\s/g, ''); const c = s.lastIndexOf(','), d = s.lastIndexOf('.'); s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); return s === '' ? null : /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : NaN; };
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
  const ell = p.ell || 'grs80';
  if (p.kind === 'geo') { const lat = sNum(p.a), lon = sNum(p.b); return Number.isFinite(lat) && Number.isFinite(lon) ? toWgs({lat, lon}, ell) : null; }
  const y = sNum(p.a), x = sNum(p.b);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
  return toWgs(tmInverse(y, x, sys(p.kind, p.zone, ell)), ell);
}
// WGS84 coğrafi → istenen sistem ve datum (dilim otomatik ya da verilen)
function writePoint(g, kind, zone, ell) {
  const d = fromWgs(g, ell);
  if (kind === 'geo') return {geo: d};
  const z = zone === 'auto' || zone == null ? (kind === 'tm3' ? nearestDom(d.lon) : utmZoneOf(d.lon)) : Number(zone);
  return {zone: z, ...tmForward(d.lat, d.lon, sys(kind, z, ell))};
}

// ── Dilim dönüşümü ─────────────────────────────────────────────────────
function dilimTool() {
  return {
    d: sStore('saha-dilim', {ell: 'grs80', toEll: 'grs80', from: 'tm3', fromZone: '33', to: 'utm', toZone: 'auto', a: '', b: ''}),
    init() { this.$watch('d', v => sSave('saha-dilim', v)); },
    doms: TM3_DOMS, zones: UTM_ZONES, ells: ELLIPSOIDS, fix: sFix, grp: sGroup, dms,
    get geo() { return readPoint({kind: this.d.from, zone: this.d.fromZone, ell: this.d.ell, a: this.d.a, b: this.d.b}); },
    get target() {
      const g = this.geo; if (!g) return null;
      return writePoint(g, this.d.to, this.d.toZone, this.d.toEll || 'grs80');
    },
    get labels() { return this.d.from === 'geo' ? ['Enlem (°)', 'Boylam (°)'] : ['Sağa (Y)', 'Yukarı (X)']; },
    swap() {
      const t = this.target; if (!t) { [this.d.from, this.d.to] = [this.d.to, this.d.from]; return; }
      const from = this.d.to, zone = t.zone;
      Object.assign(this.d, {to: this.d.from, toZone: 'auto', from, fromZone: String(zone || this.d.fromZone), ell: this.d.toEll || 'grs80', toEll: this.d.ell,
        a: from === 'geo' ? sFix(t.geo.lat, 9) : sFix(t.y, 3), b: from === 'geo' ? sFix(t.geo.lon, 9) : sFix(t.x, 3)});
    },
    clear() { this.d.a = ''; this.d.b = ''; },
    // Telefonun konumunu kaynak sisteme çevirip yazar (dilim otomatik seçilir)
    locating: false,
    here() {
      if (!navigator.geolocation) return this.$dispatch('toast', 'Konum desteklenmiyor');
      this.locating = true;
      navigator.geolocation.getCurrentPosition(({coords: c}) => {
        this.locating = false;
        const r = writePoint({lat: c.latitude, lon: c.longitude}, this.d.from, 'auto', this.d.ell);
        if (r.geo) Object.assign(this.d, {a: sFix(r.geo.lat, 8), b: sFix(r.geo.lon, 8)});
        else Object.assign(this.d, {fromZone: String(r.zone), a: sFix(r.y, 3), b: sFix(r.x, 3)});
        this.$dispatch('toast', `Konum alındı · ±${Math.round(c.accuracy)} m`);
      }, () => { this.locating = false; this.$dispatch('toast', 'Konum alınamadı'); }, {enableHighAccuracy: true, timeout: 20000, maximumAge: 0});
    },
  };
}

// ── Noktaya git (pusula) ───────────────────────────────────────────────
// Sensör verisi titrek gelir: yön ve ok açısı her karede yumuşatılır, 359°→0° geçişinde tur atmaz.
const angDelta = (to, from) => ((to - from + 540) % 360) - 180;
function gitTool() {
  return {
    g: sStore('saha-git', {kind: 'tm3', zone: '33', ell: 'grs80', a: '', b: ''}),
    pos: null, acc: null, heading: null, running: false, err: '', watchId: null, onOri: null,
    // Ekranda çizilen (yumuşatılmış, sarılmamış) açılar
    roseRot: 0, arrowRot: 0, arrived: false, raf: 0, buzzed: false,
    init() { this.$watch('g', v => { sSave('saha-git', v); this.arrived = false; }); },
    clear() { if (this.running) this.stop(); this.g.a = ''; this.g.b = ''; },
    doms: TM3_DOMS, zones: UTM_ZONES, ells: ELLIPSOIDS, fix: sFix, grp: sGroup,
    get labels() { return this.g.kind === 'geo' ? ['Enlem (°)', 'Boylam (°)'] : ['Sağa (Y)', 'Yukarı (X)']; },
    get target() { return readPoint(this.g); },
    get nav() { return this.pos && this.target ? distBearing(this.pos.lat, this.pos.lon, this.target.lat, this.target.lon) : null; },
    get off() { const n = this.nav; return n && this.heading != null ? angDelta(n.b, this.heading) : null; },
    get aligned() { return this.off != null && Math.abs(this.off) < 12; },
    get hint() {
      if (!this.running) return this.target ? 'Başlat\'a basın' : 'Hedef koordinatı girin';
      if (!this.pos) return 'Konum aranıyor…';
      if (this.arrived) return 'Hedefe vardınız';
      if (this.off == null) return 'Yürüyün, yön bulunacak';
      if (this.aligned) return this.nav.d < 25 ? 'Çok yakın, yavaşlayın' : 'Doğru yöndesiniz';
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
        const hit = n.d <= Math.max(3, Math.min(this.acc ?? 5, 8));
        if (hit && !this.arrived) { this.arrived = true; if (!this.buzzed) { navigator.vibrate?.([80, 60, 80, 60, 200]); this.buzzed = true; } }
        if (!hit && n.d > 12) { this.arrived = false; this.buzzed = false; }
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },
    async start() {
      this.err = ''; this.arrived = false; this.buzzed = false;
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

// ── Semt ve mesafe (1. ve 2. temel ödev, grad) ──────────────────────────────────────────────────────
function temelTool() {
  return {
    t: sStore('saha-temel', {mode: 'inv', ay: '', ax: '', by: '', bx: '', ang: '', dist: ''}),
    init() { this.$watch('t', v => sSave('saha-temel', v)); },
    clear() { Object.assign(this.t, {ay: '', ax: '', by: '', bx: '', ang: '', dist: ''}); },
    fix: sFix, grp: sGroup,
    // 2. temel ödev: A ve B'den semt ve mesafe
    get inv() {
      const [ay, ax, by, bx] = [this.t.ay, this.t.ax, this.t.by, this.t.bx].map(sNum);
      if (![ay, ax, by, bx].every(Number.isFinite)) return null;
      const dy = by - ay, dx = bx - ax;
      return {s: Math.hypot(dy, dx), t: norm(toUnit(Math.atan2(dy, dx), 'grad'), 'grad'), dy, dx};
    },
    // 1. temel ödev: A, semt ve mesafeden B
    get fwd() {
      const [ay, ax, a, s] = [this.t.ay, this.t.ax, this.t.ang, this.t.dist].map(sNum);
      if (![ay, ax, a, s].every(Number.isFinite)) return null;
      const r = fromUnit(a, 'grad');
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
    clear() { this.p.rows = [{y: '', x: ''}, {y: '', x: ''}, {y: '', x: ''}]; },
    // Excel/CAD'den çok satırlı liste yapıştırılırsa (No Y X ya da Y X) tüm köşeler bir kerede dolar
    paste(e) {
      const rows = e.clipboardData.getData('text').trim().split(/\r?\n/).map(l => l.trim().split(/[\s;\t]+/).filter(v => Number.isFinite(sNum(v)))).filter(r => r.length >= 2);
      if (rows.length < 2) return;
      e.preventDefault();
      this.p.rows = rows.map(r => ({y: r.at(-2), x: r.at(-1)}));
      if (this.p.rows.length < 3) this.p.rows.push({y: '', x: ''});
      this.$dispatch('toast', rows.length + ' nokta yapıştırıldı');
    },
    next(ev) { const all = [...this.$root.querySelectorAll('.alan-table input')], i = all.indexOf(ev.target); if (i >= 0 && i < all.length - 1) all[i + 1].focus(); else { this.add(); this.$nextTick(() => [...this.$root.querySelectorAll('.alan-table input')].at(-2)?.focus()); } },
  };
}

// ── Trigonometrik yükseklik (total station) ────────────────────────────
// D = S·sin Z, ΔH = S·cos Z + i − t (+ eğrilik/kırılma (1−k)D²/2R)
function trigTool() {
  return {
    t: sStore('saha-trig', {s: '', z: '', i: '', r: '', h0: ''}),
    init() { this.$watch('t', v => sSave('saha-trig', v)); },
    clear() { Object.assign(this.t, {s: '', z: '', i: '', r: '', h0: ''}); },
    fix: sFix, grp: sGroup,
    get res() {
      const s = sNum(this.t.s), z = sNum(this.t.z);
      if (!Number.isFinite(s) || !Number.isFinite(z)) return null;
      const zr = fromUnit(z, 'grad'), i = sNum(this.t.i) || 0, r = sNum(this.t.r) || 0, h0 = sNum(this.t.h0);
      const d = s * Math.sin(zr), cr = (1 - 0.13) * d * d / (2 * 6371000);
      const dh = s * Math.cos(zr) + i - r + cr;
      return {d, dh, cr, kot: Number.isFinite(h0) ? h0 + dh : null, pct: d ? (s * Math.cos(zr)) / d * 100 : null};
    },
  };
}

// Koordinat yapıştırma: "Y X" ikilisi tek alana yapıştırılırsa yanındaki alana bölünür
document.addEventListener('paste', e => {
  const el = e.target; if (e.defaultPrevented || !el.matches?.('input.sa-num')) return;
  const parts = e.clipboardData.getData('text').trim().split(/\s*[;\t\n]\s*|\s*,\s+|\s+/).filter(Boolean);
  if (parts.length !== 2 || !parts.every(v => Number.isFinite(sNum(v)))) return;
  const ins = [...el.closest('.sa-card').querySelectorAll('input.sa-num')].filter(i => i.offsetParent), k = ins.indexOf(el);
  if (!ins[k + 1]) return;
  e.preventDefault();
  [el, ins[k + 1]].forEach((i, j) => { i.value = parts[j]; i.dispatchEvent(new Event('input', {bubbles: true})); });
});
