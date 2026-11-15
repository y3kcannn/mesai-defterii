// Supabase senkronizasyonu: yerel değişiklikleri kuyruğa alır, gönderilene kadar tekrar dener; uzaktaki değişiklikleri dinler.
const bulut = (() => {
  const on = !!(typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && typeof supabase !== 'undefined');
  const TIMEOUT = 15000, RETRY = 10000;
  // Her isteğe zaman aşımı: iOS'ta arka plana alınan sayfada askıda kalan bir istek kuyruğu sonsuza dek kilitlemesin
  const timedFetch = (url, init = {}) => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    if (init.signal) init.signal.aborted ? ctl.abort() : init.signal.addEventListener('abort', () => ctl.abort(), { once: true });
    return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
  };
  // accessToken verilince supabase.auth hiç kurulmaz: oturum yok, navigator.locks kilidi yok, visibilitychange yenilemesi yok.
  // (Varsayılan istemci her istekten önce auth kilidini bekler; iOS'ta sayfa dondurulup geri gelince bu kilit
  // takılı kalabiliyor ve hiçbir istek ağa çıkmıyordu.) null → istekler publishable anahtarla gider (eskisiyle aynı).
  const db = on ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { accessToken: async () => null, global: { fetch: timedFetch } }) : null;
  const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const toRow = {
    people: p => ({ id: p.id, name: p.name || '', role: p.role || '', net_salary: num(p.netSalary), daily_hours: num(p.dailyHours, 7.5), rest_day: num(p.restDay), cumulative_tax_base: num(p.cumulativeTaxBase), example: !!p.example, pin_hash: p.pinHash || null }),
    entries: e => ({ id: e.id, person_id: e.personId, date: e.date, type: e.type, hours: num(e.hours), paid_month: e.paidMonth || null }),
  };
  const fromRow = {
    people: r => ({ id: r.id, name: r.name, role: r.role || '', netSalary: +r.net_salary, dailyHours: +r.daily_hours, restDay: +(r.rest_day ?? 0), cumulativeTaxBase: +r.cumulative_tax_base, example: !!r.example, ...(r.pin_hash && { pinHash: r.pin_hash }) }),
    entries: r => ({ id: r.id, personId: r.person_id, date: r.date, type: r.type, hours: +r.hours, ...(r.paid_month && { paidMonth: r.paid_month }) }),
  };
  const QKEY = 'mesai-defteri-kuyruk', FKEY = 'mesai-defteri-gonderilemeyen';
  const load = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('Kuyruk kaydedilemedi:', e); } };
  let queue = load(QKEY), failed = load(FKEY), last = null, flushing = null, retry = null, version = 0;
  const saveQueue = () => store(QKEY, queue);
  const index = (people, entries) => ({
    people: new Map(people.map(p => [p.id, JSON.stringify(toRow.people(p))])),
    entries: new Map(entries.map(e => [e.id, JSON.stringify(toRow.entries(e))])),
  });
  const withTimeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zaman aşımı')), TIMEOUT + 2000))]);
  // Tekrar denemekle düzelmeyecek hatalar: geçersiz veri (22xxx), bütünlük (23xxx), bozuk istek gövdesi
  const permanent = err => /^2[23]\d{3}$/.test(err?.code || '') || err?.code === '21000' || err?.code === 'PGRST102';
  const scheduleRetry = () => { clearTimeout(retry); retry = setTimeout(() => api.flush().catch(() => {}), RETRY); };

  const api = {
    on,
    error: null,
    reachable: null, // son istek sunucuya ulaştı mı (navigator.onLine iOS'ta güvenilir değil)
    onChange: () => {},
    onDrained: () => {},
    get pending() { return queue.length; },
    get version() { return version; },
    get failed() { return failed; },
    // Karşılaştırma tabanını ayarlar (kuyruğa bir şey eklemeden)
    reset(people, entries) { last = index(people, entries); },
    // Son tabana göre farkları kuyruğa ekler ve göndermeyi dener
    track(people, entries) {
      if (!on) return;
      const cur = index(people, entries);
      if (last) {
        const ups = t => [...cur[t]].filter(([id, j]) => last[t].get(id) !== j).map(([, j]) => ({ op: 'upsert', t, row: JSON.parse(j) }));
        const dels = t => [...last[t].keys()].filter(id => !cur[t].has(id)).map(id => ({ op: 'delete', t, id }));
        const items = [...ups('people'), ...ups('entries'), ...dels('entries'), ...dels('people')];
        if (items.length) { queue.push(...items); saveQueue(); version++; }
      }
      last = cur;
      this.onChange();
      this.flush().catch(() => {});
    },
    flush() {
      if (flushing) return flushing;
      if (!on || !queue.length) return Promise.resolve();
      // navigator.onLine'a bakılmaz: iOS'ta yanlışlıkla false olabiliyor; gerçekten çevrimdışıysak istek hızla düşer ve tekrar denenir
      return flushing = (async () => {
        let single = false;
        while (queue.length) {
          // Aynı tablo ve işlemdeki ardışık değişiklikleri tek istekte gönder
          const { op, t } = queue[0];
          const end = queue.findIndex(q => q.op !== op || q.t !== t);
          const n = single ? 1 : end === -1 ? queue.length : end;
          const batch = queue.slice(0, n);
          // Aynı kayıt iki kez upsert edilemez (Postgres 21000): son hâlini gönder
          const rows = [...new Map(batch.map(q => [q.row?.id, q.row])).values()];
          const ids = [...new Set(batch.map(q => q.id))];
          const { error } = await withTimeout(op === 'upsert' ? db.from(t).upsert(rows) : db.from(t).delete().in('id', ids));
          if (error) {
            if (!permanent(error)) throw error;
            if (n > 1) { single = true; continue; } // hatalı kaydı bulmak için tek tek dene
            // Hiçbir zaman gönderilemeyecek kayıt kuyruğu kilitlemesin; ama silinmez, ayrı saklanır (yedekte de çıkar)
            if (error.code !== '23503') console.error('Gönderilemeyen kayıt ayrıldı:', batch[0], error);
            failed.push({ ...batch[0], error: { code: error.code, message: error.message }, at: new Date().toISOString() });
            store(FKEY, failed);
          }
          queue.splice(0, n); saveQueue(); single = false; this.reachable = true; this.onChange();
        }
        this.error = null; this.reachable = true;
        clearTimeout(retry);
      })().catch(error => {
        // Gönderilemedi: kuyruk korunur, 10 sn sonra tekrar denenir
        this.error = error?.message || 'Gönderilemedi';
        if (!error?.code) this.reachable = false; // ağ hatası / zaman aşımı
        scheduleRetry();
        throw error;
      }).finally(() => {
        flushing = null; this.onChange();
        if (!queue.length && !this.error) this.onDrained();
      });
    },
    async pull() {
      await this.flush();
      const v = version; // bu andan sonra yapılan yerel değişiklik, gelen veriyi bayatlatır
      const [p, e] = await withTimeout(Promise.all([db.from('people').select('*').order('created_at'), db.from('entries').select('*')]));
      if (p.error || e.error) { if (!(p.error || e.error).code) this.reachable = false; throw p.error || e.error; }
      this.reachable = true;
      return { people: p.data.map(fromRow.people), entries: e.data.map(fromRow.entries), version: v };
    },
    listen(cb) {
      let timer;
      db.channel('mesai').on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(timer); timer = setTimeout(cb, 300); }).subscribe();
    },
  };
  // Kuyruk boşalana kadar düzenli dene (zamanlayıcı iOS'ta dondurulsa bile sayfa geri gelince çalışır)
  if (on) setInterval(() => { if (queue.length && !flushing) api.flush().catch(() => {}); }, 15000);
  return api;
})();
