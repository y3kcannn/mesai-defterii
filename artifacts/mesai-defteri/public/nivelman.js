// Nivelman Hesabı (Ayarlar → araçlar). Mesai hesabından tamamen ayrı çalışır; veriler tarayıcıda saklanır.
// Satır = nokta. İlk satırda yalnız Geri, son satırda yalnız İleri, aradaki dönüş noktalarında ikisi de girilir.
// ΔHᵢ = Geriᵢ₋₁ − İleriᵢ ; Kotᵢ = Kotᵢ₋₁ + ΔHᵢ ; Mesafeᵢ = önceki noktadan bu noktaya kurulum mesafesi (m).
const NV_KEY = 'mesai-nivelman';

// "1,522" ve "1.522" aynı kabul edilir; boş → null, geçersiz → NaN
const nvNum = v => {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  return /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};
const nvFmt = (v, d = 3) => v == null || !Number.isFinite(v) ? '' : v.toFixed(d).replace('.', ',').replace(/^-(0,0+)$/, '$1');
const nvSigned = (v, d = 3) => v == null || !Number.isFinite(v) ? '' : (v > 0 ? '+' : '') + nvFmt(v, d);
const nvRow = (no = '') => ({no, geri: '', ileri: '', mesafe: ''});
const nvBlank = () => ({mode: 'kot', k: 12, startKot: '', endKot: '', lManual: '', tab: 'gidis', fixed: {gidis: false, donus: false},
  runs: {gidis: [nvRow(), nvRow()], donus: [nvRow(), nvRow()]}});

// Bir seferin (gidiş ya da dönüş) tüm hesabı
function nvCompute(rows, {startKot = null, endKot = null, k = 12, lManual = null} = {}) {
  const n = rows.length, p = rows.map(r => ({geri: nvNum(r.geri), ileri: nvNum(r.ileri), mesafe: nvNum(r.mesafe)}));
  const dH = Array(n).fill(null), rel = Array(n).fill(null), kot = Array(n).fill(null);
  rel[0] = 0;
  for (let i = 1; i < n; i++) {
    const g = p[i - 1].geri, f = p[i].ileri;
    dH[i] = Number.isFinite(g) && Number.isFinite(f) ? g - f : null;
    rel[i] = rel[i - 1] != null && dH[i] != null ? rel[i - 1] + dH[i] : null;
  }
  if (Number.isFinite(startKot)) for (let i = 0; i < n; i++) kot[i] = rel[i] == null ? null : startKot + rel[i];
  // Kontroller: ΣGeri (son satır hariç), Σİleri (ilk satır hariç)
  let sumG = 0, sumI = 0, okSums = true;
  for (let i = 0; i < n - 1; i++) { const g = p[i].geri; if (Number.isFinite(g)) sumG += g; else okSums = false; }
  for (let i = 1; i < n; i++) { const f = p[i].ileri; if (Number.isFinite(f)) sumI += f; else okSums = false; }
  const total = rel[n - 1];
  // Mesafe: ilk satır hariç; hepsi girildiyse L hesaplanır
  const legs = p.slice(1).map(r => r.mesafe), allDist = n > 1 && legs.every(m => Number.isFinite(m) && m > 0);
  const distM = allDist ? legs.reduce((s, m) => s + m, 0) : null;
  const L = distM != null ? distM / 1000 : (Number.isFinite(lManual) && lManual > 0 ? lManual : null);
  const tolMm = L != null ? k * Math.sqrt(L) : null;
  // Kapanma: bilinen bitiş kotuna göre (yalnız kot modunda)
  const lastKot = kot[n - 1];
  const closureMm = Number.isFinite(endKot) && lastKot != null ? (lastKot - endKot) * 1000 : null;
  const within = closureMm != null && tolMm != null && Math.abs(closureMm) <= tolMm + 1e-9;
  // Düzeltme: hata ters işaretle kurulumlara; mesafe varsa orantılı, yoksa eşit
  let corr = null;
  if (closureMm != null && n > 1) {
    const v = -closureMm / 1000; corr = Array(n).fill(null); corr[0] = kot[0];
    let acc = 0;
    for (let i = 1; i < n; i++) { acc += allDist ? v * legs[i - 1] / distM : v / (n - 1); corr[i] = kot[i] == null ? null : kot[i] + acc; }
  }
  const warn = p.map(r => ({geri: Number.isFinite(r.geri) && (r.geri < 0 || r.geri > 5) || Number.isNaN(r.geri),
    ileri: Number.isFinite(r.ileri) && (r.ileri < 0 || r.ileri > 5) || Number.isNaN(r.ileri), mesafe: Number.isNaN(r.mesafe)}));
  // Her noktaya kadar birikmiş mesafe (gidiş–dönüş aralık toleransı için)
  const cum = Array(n).fill(null); cum[0] = 0;
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] != null && Number.isFinite(p[i].mesafe) ? cum[i - 1] + p[i].mesafe : null;
  return {dH, rel, kot, corr, sumG, sumI, okSums, total, distM, L, tolMm, closureMm, within, warn, cum, setups: n - 1};
}

function nivelman() {
  return {
    nv: nvBlank(), nvFocus: null,
    nvInit() {
      try { const s = JSON.parse(localStorage.getItem(NV_KEY) || 'null'); if (s && s.runs) this.nv = {...nvBlank(), ...s, fixed: {gidis: false, donus: false, ...(s.fixed || {})}}; } catch {}
      this.$watch('nv', v => { try { localStorage.setItem(NV_KEY, JSON.stringify(v)); } catch {} });
    },
    get rows() { return this.nv.runs[this.nv.tab]; },
    nvOpts(tab) {
      const kotMode = this.nv.mode === 'kot', start = nvNum(this.nv.startKot), end = nvNum(this.nv.endKot);
      // Dönüş: gidişin bitişinden başlayıp başlangıca döner (başlangıç/bitiş kotları yer değiştirir)
      let s = tab === 'donus' ? end : start; const e = tab === 'donus' ? start : end;
      // Bitiş kotu bilinmiyorsa dönüş, gidişte hesaplanan son kottan başlar
      if (tab === 'donus' && !Number.isFinite(s) && Number.isFinite(start)) { const g = nvCompute(this.nv.runs.gidis, {startKot: start}); s = g.kot[g.kot.length - 1]; }
      return {startKot: kotMode && Number.isFinite(s) ? s : null, endKot: kotMode && Number.isFinite(e) ? e : null, k: Number(nvNum(this.nv.k)) || 12, lManual: nvNum(this.nv.lManual)};
    },
    calc(tab) { return nvCompute(this.nv.runs[tab], this.nvOpts(tab)); },
    get res() { return this.calc(this.nv.tab); },
    get showCorr() { return this.nv.mode === 'kot' && this.nv.fixed[this.nv.tab] && this.res.within; },
    fmt: nvFmt, signed: nvSigned,
    mm(v) { return v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' mm'; },
    // Hücre etkinliği: ilk satırda İleri yok, son satırda Geri yok, ilk satırda mesafe yok
    off(i, f) { const n = this.rows.length; return (f === 'ileri' || f === 'mesafe') ? i === 0 : f === 'geri' ? i === n - 1 : false; },
    tidy(r, f) { const v = nvNum(r[f]); if (Number.isFinite(v)) r[f] = f === 'mesafe' ? String(Math.round(v * 100) / 100).replace('.', ',') : nvFmt(v); },
    // Enter → sonraki hücre (satır satır)
    nextCell(ev) {
      const all = [...this.$root.querySelectorAll('.nv-table input:not(:disabled)')], i = all.indexOf(ev.target);
      if (i >= 0 && i < all.length - 1) { all[i + 1].focus(); all[i + 1].select?.(); }
      else if (i === all.length - 1) { this.addRow(); this.$nextTick(() => this.$root.querySelector('.nv-row:last-child input:not(:disabled)')?.focus()); }
    },
    addRow() { this.rows.push(nvRow()); },
    delRow() {
      if (this.rows.length <= 2) return;
      const i = this.nvFocus != null && this.nvFocus < this.rows.length ? this.nvFocus : this.rows.length - 1;
      this.rows.splice(i, 1); this.nvFocus = null;
    },
    newSurvey() {
      if (!confirm('Mevcut ölçü silinsin mi? Bu işlem geri alınamaz.')) return;
      const k = this.nv.k, mode = this.nv.mode; this.nv = {...nvBlank(), k, mode};
    },
    fix() { this.nv.fixed[this.nv.tab] = true; },
    // Gidiş–dönüş: iki seferde de bulunan nokta adları (röperler) gidiş sırasına göre eşleştirilir
    get pairs() {
      const g = this.nv.runs.gidis, d = this.nv.runs.donus, rg = this.calc('gidis'), rd = this.calc('donus');
      const key = s => String(s || '').trim().toLocaleUpperCase('tr');
      const idxD = new Map(); d.forEach((r, i) => { const k = key(r.no); if (k && !idxD.has(k)) idxD.set(k, i); });
      const common = []; g.forEach((r, i) => { const k = key(r.no); if (k && idxD.has(k) && !common.some(c => c.k === k)) common.push({k, name: r.no.trim(), gi: i, di: idxD.get(k)}); });
      const kk = Number(nvNum(this.nv.k)) || 12, lMan = nvNum(this.nv.lManual), out = [];
      for (let j = 1; j < common.length; j++) {
        const a = common[j - 1], b = common[j];
        const gd = rg.rel[b.gi] != null && rg.rel[a.gi] != null ? rg.rel[b.gi] - rg.rel[a.gi] : null;
        const dd = rd.rel[a.di] != null && rd.rel[b.di] != null ? rd.rel[a.di] - rd.rel[b.di] : null;
        const diff = gd != null && dd != null ? (gd + dd) * 1000 : null;
        // Aralık uzunluğu: iki seferin mesafe ortalaması; yoksa elle L'nin kurulum oranındaki payı
        const lg = rg.cum[b.gi] != null && rg.cum[a.gi] != null ? Math.abs(rg.cum[b.gi] - rg.cum[a.gi]) : null;
        const ld = rd.cum[a.di] != null && rd.cum[b.di] != null ? Math.abs(rd.cum[a.di] - rd.cum[b.di]) : null;
        let L = lg && ld ? (lg + ld) / 2000 : lg ? lg / 1000 : ld ? ld / 1000 : null;
        if (L == null && Number.isFinite(lMan) && lMan > 0 && rg.setups > 0) L = lMan * (b.gi - a.gi) / rg.setups;
        const tol = L != null ? kk * Math.sqrt(L) : null;
        out.push({from: a.name, to: b.name, gd, dd, diff, tol, bad: diff != null && tol != null && Math.abs(diff) > tol + 1e-9});
      }
      return out;
    },
    csv() {
      const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const lines = [['Mod', this.nv.mode === 'kot' ? 'Kot ile' : 'Yükseklik farkı'], ['k (mm/√km)', this.nv.k]];
      for (const tab of ['gidis', 'donus']) {
        const rows = this.nv.runs[tab], r = this.calc(tab), fixOn = this.nv.mode === 'kot' && this.nv.fixed[tab] && r.within;
        if (!rows.some(x => x.no || x.geri || x.ileri)) continue;
        lines.push([], [tab === 'gidis' ? 'GİDİŞ' : 'DÖNÜŞ'], ['Nokta No', 'Geri (m)', 'İleri (m)', 'Mesafe (m)', 'Fark ΔH (m)', ...(this.nv.mode === 'kot' ? ['Kot (m)'] : []), ...(fixOn ? ['Düzeltilmiş kot (m)'] : [])]);
        rows.forEach((x, i) => lines.push([x.no, nvFmt(nvNum(x.geri)), nvFmt(nvNum(x.ileri)), x.mesafe, nvSigned(r.dH[i]), ...(this.nv.mode === 'kot' ? [nvFmt(r.kot[i])] : []), ...(fixOn ? [nvFmt(r.corr[i])] : [])]));
        lines.push(['ΣGeri', nvFmt(r.sumG)], ['Σİleri', nvFmt(r.sumI)], ['ΣGeri − Σİleri', nvSigned(r.sumG - r.sumI)]);
        if (r.closureMm != null) lines.push(['Kapanma hatası (mm)', r.closureMm.toFixed(1).replace('.', ',')]);
        if (r.tolMm != null) lines.push(['İzin (± mm)', r.tolMm.toFixed(1).replace('.', ','), 'L (km)', nvFmt(r.L)]);
      }
      const pr = this.pairs;
      if (pr.length) { lines.push([], ['GİDİŞ–DÖNÜŞ'], ['Aralık', 'Gidiş ΔH', 'Dönüş ΔH', 'Fark (mm)', 'İzin (± mm)']); pr.forEach(x => lines.push([x.from + ' – ' + x.to, nvSigned(x.gd), nvSigned(x.dd), x.diff == null ? '' : x.diff.toFixed(1).replace('.', ','), x.tol == null ? '' : x.tol.toFixed(1).replace('.', ',')])); }
      const blob = new Blob(['﻿' + lines.map(l => l.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
      const a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(blob); a.download = `nivelman-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    print() { document.documentElement.classList.add('print-nv'); const done = () => { document.documentElement.classList.remove('print-nv'); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); window.print(); },
  };
}
