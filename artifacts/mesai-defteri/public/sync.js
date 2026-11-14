// Supabase senkronizasyonu: yerel değişiklikleri kuyruğa alır, çevrimiçi olunca gönderir; uzaktaki değişiklikleri dinler.
const bulut = (() => {
  const on = !!(SUPABASE_URL && SUPABASE_KEY);
  const db = on ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const toRow = {
    people: p => ({ id: p.id, name: p.name, role: p.role || '', net_salary: Number(p.netSalary), daily_hours: Number(p.dailyHours), rest_day: Number(p.restDay) || 0, cumulative_tax_base: Number(p.cumulativeTaxBase), example: !!p.example }),
    entries: e => ({ id: e.id, person_id: e.personId, date: e.date, type: e.type, hours: Number(e.hours), paid_month: e.paidMonth || null }),
  };
  const fromRow = {
    people: r => ({ id: r.id, name: r.name, role: r.role, netSalary: +r.net_salary, dailyHours: +r.daily_hours, restDay: r.rest_day ?? 0, cumulativeTaxBase: +r.cumulative_tax_base, example: r.example }),
    entries: r => ({ id: r.id, personId: r.person_id, date: r.date, type: r.type, hours: +r.hours, ...(r.paid_month && { paidMonth: r.paid_month }) }),
  };
  const QKEY = 'mesai-defteri-kuyruk';
  let queue = JSON.parse(localStorage.getItem(QKEY) || '[]'), last = null, flushing = null, retry = null;
  const saveQueue = () => localStorage.setItem(QKEY, JSON.stringify(queue));
  const index = (people, entries) => ({
    people: new Map(people.map(p => [p.id, JSON.stringify(toRow.people(p))])),
    entries: new Map(entries.map(e => [e.id, JSON.stringify(toRow.entries(e))])),
  });

  return {
    on,
    error: null,
    onChange: () => {},
    get pending() { return queue.length; },
    // Karşılaştırma tabanını ayarlar (kuyruğa bir şey eklemeden)
    reset(people, entries) { last = index(people, entries); },
    // Son tabana göre farkları kuyruğa ekler ve göndermeyi dener
    track(people, entries) {
      if (!on) return;
      const cur = index(people, entries);
      if (last) {
        const ups = t => [...cur[t]].filter(([id, j]) => last[t].get(id) !== j).map(([, j]) => ({ op: 'upsert', t, row: JSON.parse(j) }));
        const dels = t => [...last[t].keys()].filter(id => !cur[t].has(id)).map(id => ({ op: 'delete', t, id }));
        queue.push(...ups('people'), ...ups('entries'), ...dels('entries'), ...dels('people'));
        saveQueue();
      }
      last = cur;
      this.onChange();
      this.flush().catch(() => {});
    },
    flush() {
      if (flushing) return flushing;
      if (!on || !navigator.onLine || !queue.length) return Promise.resolve();
      return flushing = (async () => {
        let single = false;
        while (queue.length) {
          // Aynı tablo ve işlemdeki ardışık değişiklikleri tek istekte gönder
          const { op, t } = queue[0];
          const n = single ? 1 : (queue.findIndex(q => q.op !== op || q.t !== t) + 1 || queue.length + 1) - 1;
          const batch = queue.slice(0, n);
          const { error } = op === 'upsert' ? await db.from(t).upsert(batch.map(q => q.row)) : await db.from(t).delete().in('id', batch.map(q => q.id));
          if (error?.code === '23503' && n > 1) { single = true; continue; } // kişi başka cihazda silinmiş: tek tek dene
          if (error && error.code !== '23503') throw error;
          queue.splice(0, n); saveQueue(); single = false; this.onChange();
        }
        this.error = null;
      })().catch(error => {
        // Gönderilemedi: kuyruk korunur, 10 sn sonra tekrar denenir
        this.error = error?.message || 'Gönderilemedi';
        clearTimeout(retry); retry = setTimeout(() => this.flush().catch(() => {}), 10000);
        throw error;
      }).finally(() => { flushing = null; this.onChange(); });
    },
    async pull() {
      await this.flush();
      const [p, e] = await Promise.all([db.from('people').select('*').order('created_at'), db.from('entries').select('*')]);
      if (p.error || e.error) throw p.error || e.error;
      return { people: p.data.map(fromRow.people), entries: e.data.map(fromRow.entries) };
    },
    listen(cb) {
      let timer;
      db.channel('mesai').on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(timer); timer = setTimeout(cb, 300); }).subscribe();
    },
  };
})();
