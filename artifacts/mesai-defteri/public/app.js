function mesaiDefteri() {
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const pad2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  // 'YYYY-AA-GG' → yerel Date
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isLeave = type => String(type || '').startsWith('izin-');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const newId = (prefix, n) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 2 + n)}`;

  // Örnek veri (ilk açılışta): içinde bulunulan ayın günlerine yazılır
  const sampleDate = new Date();
  const samplePrefix = `${sampleDate.getFullYear()}-${pad2(sampleDate.getMonth() + 1)}-`;
  const sampleDay = day => `${samplePrefix}${pad2(day)}`;
  const demoPeople = [
    {id:'demo-ali',name:'Ali Demir',role:'Harita mühendisi',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true},
    {id:'demo-emre',name:'Emre Kaya',role:'Harita teknikeri',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true},
    {id:'demo-hasan',name:'Hasan Yıldız',role:'Saha teknisyeni',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true}
  ];
  const demoEntries = [
    {id:'d1',personId:'demo-ali',date:sampleDay(2),type:'normal',hours:3},{id:'d2',personId:'demo-ali',date:sampleDay(3),type:'holiday',hours:5},
    {id:'d3',personId:'demo-ali',date:sampleDay(8),type:'normal',hours:2.5},{id:'d4',personId:'demo-ali',date:sampleDay(9),type:'holiday',hours:4},
    {id:'d5',personId:'demo-ali',date:sampleDay(14),type:'bayram',hours:7},{id:'d6',personId:'demo-ali',date:sampleDay(18),type:'normal',hours:3},
    {id:'d7',personId:'demo-ali',date:sampleDay(22),type:'holiday',hours:6},{id:'d8',personId:'demo-ali',date:sampleDay(26),type:'normal',hours:2},
    {id:'d9',personId:'demo-emre',date:sampleDay(1),type:'normal',hours:2},{id:'d10',personId:'demo-emre',date:sampleDay(8),type:'normal',hours:3},
    {id:'d11',personId:'demo-emre',date:sampleDay(17),type:'holiday',hours:4},{id:'d12',personId:'demo-emre',date:sampleDay(19),type:'bayram',hours:5},
    {id:'d13',personId:'demo-hasan',date:sampleDay(3),type:'holiday',hours:4},{id:'d14',personId:'demo-hasan',date:sampleDay(15),type:'normal',hours:2.5}
  ];

  // Resmî tatiller: [tür, ad]. tür: resmi (millî), bayram (dinî bayram), arife (yarım gün)
  const fixedHolidays = {'01-01':['resmi','Yılbaşı'],'04-23':['resmi','Ulusal Egemenlik ve Çocuk Bayramı'],'05-01':['resmi','Emek ve Dayanışma Günü'],'05-19':['resmi',"Atatürk'ü Anma, Gençlik ve Spor Bayramı"],'07-15':['resmi','Demokrasi ve Millî Birlik Günü'],'08-30':['resmi','Zafer Bayramı'],'10-28':['arife','Cumhuriyet Bayramı arifesi (yarım gün)'],'10-29':['resmi','Cumhuriyet Bayramı']};
  // Dinî bayramlar: [ad, ilk gün, gün sayısı]; önceki gün arife
  const religious = [['Ramazan Bayramı','2025-03-30',3],['Kurban Bayramı','2025-06-06',4],['Ramazan Bayramı','2026-03-20',3],['Kurban Bayramı','2026-05-27',4],['Ramazan Bayramı','2027-03-09',3],['Kurban Bayramı','2027-05-16',4]];
  const religiousDays = Object.fromEntries(religious.flatMap(([name, start, n]) => {
    const [y, m, d] = start.split('-').map(Number);
    return [
      [iso(new Date(y, m - 1, d - 1)), ['arife', `${name} arifesi (yarım gün)`]],
      ...Array.from({length: n}, (_, i) => [iso(new Date(y, m - 1, d + i)), ['bayram', `${name} ${i + 1}. gün`]]),
    ];
  }));
  const holidayOf = date => religiousDays[date] || fixedHolidays[date.slice(5)] || null;

  // Yerel kayıt. Her senkronda tüm veri yeniden yazılmasın: içerik değişmediyse localStorage'a dokunulmaz
  const saved = {};
  const save = (key, value) => {
    try { const json = JSON.stringify(value); if (saved[key] === json) return; localStorage.setItem(key, json); saved[key] = json; }
    catch (error) { delete saved[key]; console.error('Cihaza kaydedilemedi:', error); }
  };
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  // Bozuk yerel kayıt (null, id'siz, tarihsiz) arayüzü kilitlemesin
  const validPeople = list => Array.isArray(list) ? list.filter(p => p && typeof p === 'object' && p.id) : [];
  const validEntries = list => Array.isArray(list) ? list.filter(e => e && typeof e === 'object' && e.id && e.personId && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];

  // Kayıt dizini: getter'lar her erişimde tüm kayıtları (reaktif proxy üzerinden) taramasın diye kayıtlar bir kez gruplanır.
  // Kayıtlar yerinde değiştirilmez (düzenleme/silme yeni dizi atar, ekleme uzunluğu değiştirir): dizi + uzunluk yeterli anahtar.
  // list.length proxy üzerinden okunur → önbellekten dönse bile Alpine bağımlılığı izler, push'ta da yeniden çizer.
  let index = null;
  const entryIndex = list => {
    const n = list.length, src = Alpine.raw(list);
    if (index && index.src === src && index.n === n) return index;
    const add = (map, key, e) => { const l = map.get(key); l ? l.push(e) : map.set(key, [e]); };
    const add2 = (map, k1, k2, e) => { let m = map.get(k1); if (!m) map.set(k1, m = new Map()); add(m, k2, e); };
    const month = new Map(), cal = new Map(), paid = new Map(), leave = new Map(), annual = new Map();
    for (const e of src) {
      add2(month, e.paidMonth || e.date.slice(0, 7), e.personId, e); // ödendiği ay (bordro)
      if (!e.date.endsWith('-00')) add2(cal, e.date.slice(0, 7), e.personId, e); // takvimdeki ay
      if (e.paidMonth) add(paid, e.paidMonth, e);
      if (isLeave(e.type)) { const s = leave.get(e.personId); s ? s.add(e.date) : leave.set(e.personId, new Set([e.date])); }
      if (e.type === 'izin-yillik') add(annual, e.personId, e);
    }
    return index = {src, n, month, cal, paid, leave, annual};
  };

  // Intl biçimleyicileri pahalı: bir kez kurulur (her hücrede yeniden değil)
  const hoursFmt = new Intl.NumberFormat('tr-TR', {maximumFractionDigits:1});
  const moneyFmt = new Intl.NumberFormat('tr-TR', {style:'currency',currency:'TRY',maximumFractionDigits:2});
  const longDateFmt = new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'long',year:'numeric'});
  const avatarCache = new Map(); // id|ad|boyut → SVG (her çizimde yeniden üretilmesin)

  // Reaktif olmayan geçici durum (Alpine proxy'sine girmesin)
  let syncing = null, syncAgain = false; // sync() çağrıları sıraya alınır; eski bir çekme yenisinin üstüne yazmasın
  let chartTimer = null, netRaf = 0, cropImg = null, pointers = null;
  const slid = new WeakSet(); // animationend dinleyicisi eklenmiş ay ızgaraları

  return {
    today:new Date(), online:navigator.onLine, syncPending:0, syncError:null, monthNames, view:'ledger', people:[], entries:[], selectedId:null, chartPrev:null, photoId:null, crop:null, crew:'yol', lockOpen:false,
    pat:null, patFirst:'', patMsg:'', newPattern:'', theme:document.documentElement?.dataset.theme||'light', netShown:0, year:new Date().getFullYear(), month:new Date().getMonth(),
    result:null, calcError:false, calcErrorMessage:'', calcRequest:0, modal:'', editingEntry:null, editingPerson:null,
    entryForm:{day:1,ym:'',carry:false,mode:'work',type:'normal',hours:2,hoursText:'2'}, hourPresets:[0.5,1,1.5,2,3,4],
    personForm:{name:'',role:'',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:0,startDate:'',leaveCarry:0},
    toast:'', toastTimer:null, chartShow:{weekday:true,weekend:true,holiday:true,bayram:true,leave:true}, unlockedIds:[], flashKey:'', flashIds:[], flashTimer:null, removePin:false,
    weekdays:['PZT','SAL','ÇAR','PER','CUM','CMT','PAZ'], dayNames:['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'], restDayOptions:[1,2,3,4,5,6,0],
    leaveTypes:[{value:'izin-yillik',label:'Yıllık izin',short:'YILLIK'},{value:'izin-haftalik',label:'Haftalık izin',short:'HI'},{value:'izin-ucretsiz',label:'Ücretsiz izin',short:'ÜCRETSİZ'},{value:'izin-rapor',label:'Raporlu',short:'RAPOR'},{value:'izin-mazeret',label:'Mazeret izni',short:'MAZERET'}],
    entryTypes:[{value:'normal',label:'Normal'},{value:'holiday',label:'Resmî tatil'},{value:'bayram',label:'Bayram'}],

    // ── Başlatma ────────────────────────────────────────────────────────────

    // Sekmeler arası kaydırma: panel parmağı izler; bırakınca yumuşakça kayarak çıkar, yeni sekme aynı yönden girer
    init() {
      const savedPeople = read('mesai-defteri-people', null), savedEntries = read('mesai-defteri-entries', null);
      if (savedPeople === null) { this.people = demoPeople; this.entries = demoEntries; this.persist(); }
      else { this.people = validPeople(savedPeople); this.entries = validEntries(savedEntries); }
      try { const c = localStorage.getItem('mesai-ekip'); if (c === 'tunel' || c === 'yol') this.crew = c; } catch {}
      this.selectedId = this.preferredId();

      bulut.reset(this.people, this.entries);
      bulut.onChange = () => { this.syncPending = bulut.pending; this.syncError = bulut.error; if (bulut.reachable !== null) this.online = bulut.reachable; };
      bulut.onChange();
      bulut.onDrained = () => this.sync(); // kuyruk boşalınca uzaktaki değişiklikleri al
      bulut.onRejected = () => this.notify('Bir kayıt sunucuya kaydedilemedi'); // sunucu reddetti; sonraki eşitlemede geri alınır
      if (bulut.on) { this.sync(); bulut.listen(() => this.sync()); }

      // iOS: sayfa arka plandan dönünce zamanlayıcılar/websocket güvenilmez; görünür olunca hemen gönder ve çek
      let wake = 0;
      const resume = () => {
        const now = Date.now(); if (now - wake < 1000) return; wake = now;
        this.today = new Date();
        if (!bulut.on) return;
        bulut.flush().catch(() => {}); this.sync();
      };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
      window.addEventListener('focus', resume);
      window.addEventListener('pageshow', resume);
      // Alpine: modal kapanırken yeniden açılınca iptal edilen x-show geçişi yakalanmamış hata olarak düşüyor; zararsız
      const cancelled = e => { if ((e.reason || e.error)?.isFromCancelledTransition) e.preventDefault(); };
      window.addEventListener('unhandledrejection', cancelled);
      window.addEventListener('error', cancelled);
      window.addEventListener('storage', () => { for (const k in saved) delete saved[k]; }); // başka sekme yazdıysa bir dahakinde yeniden yaz
      window.addEventListener('online', () => { this.online = true; bulut.flush().catch(() => {}); this.sync(); this.calculate(); });
      window.addEventListener('offline', () => { this.online = false; });
      window.addEventListener('resize', () => { if (this.view === 'chart') this.chartScroll(); });

      this.$watch('selectedId', id => {
        try { if (id && this.chartPrev === null) localStorage.setItem('mesai-defteri-secili', id); } catch {}
        this.calculate();
      });
      this.$watch('month', () => { this.calculate(); if (this.view === 'chart') this.chartScroll(); });
      this.$watch('year', () => this.calculate());
      this.$watch('view', v => { if (v === 'chart') this.chartScroll(); });
      this.netShown = this.netSlip?.net || 0;
      this.$watch('netSlip', s => this.tweenNet(s?.net || 0));
      this.calculate();
      if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).catch(() => {}));
    },

    // Bu cihazda en son seçilen kişi (her telefon kendi kişisini hatırlar)
    preferredId() {
      let id = null;
      try { id = localStorage.getItem('mesai-defteri-secili'); } catch {}
      const list = this.crewPeople;
      return list.some(p => p.id === id) ? id : (list[0]?.id || null);
    },

    // ── Biçim ───────────────────────────────────────────────────────────────

    // Türkçe tutar girişi: '65.000,50', '65000,50', '65000.50' hepsi 65000.5
    parseMoney(v) {
      let t = String(v ?? '').replace(/[^\d.,]/g, '');
      if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
      else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, ''); // nokta binlik ayırıcı
      const n = Math.round(parseFloat(t) * 100) / 100;
      return Number.isFinite(n) ? n : 0;
    },
    moneyInput(v) { const n = Number(v); return Number.isFinite(n) && n ? n.toLocaleString('tr-TR', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}) : ''; },
    formatHours(value) { return hoursFmt.format(Number(value || 0)); },
    money(value) { if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'; return moneyFmt.format(Number(value)); },
    firstName(name) { return (name || '').trim().split(/\s+/)[0] || ''; },

    // ── Kişi ve kilit ───────────────────────────────────────────────────────

    // Ekip: Yol (açık saha) ya da Tünel; seçilen ekibin dışındakiler hiçbir listede görünmez
    crews: [{id: 'yol', label: 'Yol ekibi', icon: 'i-road'}, {id: 'tunel', label: 'Tünel ekibi', icon: 'i-tunnel'}],
    get crewInfo() { return this.crews.find(c => c.id === this.crew) || this.crews[0]; },
    crewCount(id) { return this.people.filter(p => (p.team === 'tunel' ? 'tunel' : 'yol') === id).length; },
    get crewPeople() { return this.people.filter(p => (p.team === 'tunel' ? 'tunel' : 'yol') === this.crew); },
    setCrew(id) {
      if (id === this.crew) return;
      this.crew = id;
      try { localStorage.setItem('mesai-ekip', id); } catch {}
      if (!this.crewPeople.some(p => p.id === this.selectedId)) this.selectedId = this.crewPeople[0]?.id || null;
      this.calculate();
    },
    get activePerson() { return this.people.find(p => p.id === this.selectedId) || null; },
    // Maaş gizliliği: desen kilitli kişinin tutarları desen çizilene kadar gizli (oturum boyunca açık kalır)
    isLocked(person) { return this.hasLock(person) && !this.unlockedIds.includes(person.id); },
    hasLock(p) { return String(p?.pinHash || '').startsWith('pat:'); },
    get salaryLocked() { return this.isLocked(this.activePerson); },
    async hashPin(id, pin) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mesai:${id}:${pin}`));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    },
    unlockActive() { const id = this.activePerson?.id; if (id && !this.unlockedIds.includes(id)) this.unlockedIds.push(id); },
    lockSalary() { this.unlockedIds = this.unlockedIds.filter(id => id !== this.selectedId); },

    // Desen: 3×3 kare noktalar, sürüklerken çizgi; en az 4 nokta
    patDown(e, target) { e.currentTarget.setPointerCapture?.(e.pointerId); this.pat = {target, seq: [], cur: null, error: false}; this.patMove(e); },
    patMove(e) {
      const p = this.pat; if (!p || !p.target) return;
      const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      p.cur = {x, y};
      const c = Math.floor(x * 3), rw = Math.floor(y * 3);
      if (c < 0 || c > 2 || rw < 0 || rw > 2) return;
      if (Math.hypot(x - (c + .5) / 3, y - (rw + .5) / 3) > .13) return; // nokta merkezine yakın değil
      const i = rw * 3 + c;
      if (p.seq.includes(i)) return;
      // Aradaki noktanın üstünden atlandıysa (ör. 0→2) o da eklenir
      const last = p.seq[p.seq.length - 1];
      if (last != null) {
        const lr = Math.floor(last / 3), lc = last % 3;
        if ((lr + rw) % 2 === 0 && (lc + c) % 2 === 0) { const mid = ((lr + rw) / 2) * 3 + (lc + c) / 2; if (!p.seq.includes(mid)) p.seq.push(mid); }
      }
      p.seq.push(i);
      navigator.vibrate?.(8);
    },
    async patUp() {
      const p = this.pat; if (!p || !p.target) return;
      const seq = p.seq.join('-'), target = p.target;
      p.target = null; p.cur = null;
      if (p.seq.length < 4) { if (p.seq.length) this.patFail(target === 'set' ? 'En az 4 nokta birleştirin' : ''); return; }
      if (target === 'unlock') {
        const ok = 'pat:' + await this.hashPin(this.activePerson.id, 'pat:' + seq) === this.activePerson.pinHash;
        if (ok) { this.unlockActive(); this.pat = null; } else this.patFail('Desen hatalı');
      }
      else if (!this.patFirst) { this.patFirst = seq; this.patMsg = 'Onaylamak için deseni tekrar çizin'; this.pat = null; }
      else if (this.patFirst === seq) { this.newPattern = seq; this.patMsg = 'Desen hazır'; this.pat = null; }
      else { this.patFirst = ''; this.patFail('Desenler eşleşmedi, baştan çizin'); }
    },
    patFail(msg) {
      this.pat.error = true;
      if (msg) this.patMsg = msg;
      setTimeout(() => { if (this.pat?.error) this.pat = null; }, 600);
      navigator.vibrate?.([30, 40, 30]);
    },
    patPoints() {
      const s = this.pat?.seq || [];
      const pts = s.map(i => `${(i % 3 + .5) / 3 * 100},${(Math.floor(i / 3) + .5) / 3 * 100}`);
      if (this.pat?.target && this.pat.cur && s.length) pts.push(`${this.pat.cur.x * 100},${this.pat.cur.y * 100}`);
      return pts.join(' ');
    },
    patOn(i) { return (this.pat?.seq || []).includes(i); },
    patReset() { this.patFirst = ''; this.newPattern = ''; this.patMsg = 'Deseni çizin (en az 4 nokta)'; this.pat = null; },

    get syncLabel() {
      if (!this.online) return this.syncPending ? `ÇEVRİMDIŞI · ${this.syncPending} BEKLİYOR` : 'ÇEVRİMDIŞI';
      if (this.syncError) return 'HATA · YENİDEN DENENİYOR';
      if (this.syncPending) return 'KAYDEDİLİYOR…';
      return bulut.on ? 'KAYDEDİLDİ' : 'ÇEVRİMİÇİ';
    },

    // ── Ay ve kayıtlar ──────────────────────────────────────────────────────

    get monthName() { return monthNames[this.month]; },
    get monthDays() { return new Date(this.year, this.month + 1, 0).getDate(); },
    get monthKey() { return `${this.year}-${pad2(this.month + 1)}`; },
    isLeave(type) { return isLeave(type); },
    leaveLabel(type) { return this.leaveTypes.find(t => t.value === type)?.label || 'İzin'; },
    // Seçili kişinin bu ayın bordrosuna giren kayıtları: eksik mesai (paidMonth) kendi tarihinin değil ödendiği ayın hesabına girer.
    // Dönen dizi dizinle paylaşılır: değiştirmeyin.
    get monthEntries() { if (!this.activePerson) return []; return entryIndex(this.entries).month.get(this.monthKey)?.get(this.selectedId) || []; },
    // Takvimde bu ayın günlerinde görünen kayıtlar (ödendiği aydan bağımsız)
    get calendarEntries() { if (!this.activePerson) return []; return entryIndex(this.entries).cal.get(this.monthKey)?.get(this.selectedId) || []; },
    get workEntries() { return this.monthEntries.filter(e => !isLeave(e.type)); },
    get leaveEntries() { return this.monthEntries.filter(e => isLeave(e.type)); },
    get carryEntries() { return this.monthEntries.filter(e => e.paidMonth).sort((a, b) => a.date.localeCompare(b.date)); },
    get hasExamples() { return this.people.some(p => p.example); },
    nextMonthKey(ym) { const [y, m] = ym.split('-').map(Number), d = new Date(y, m, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; },
    monthLabel(ym) { const [y, m] = String(ym).split('-').map(Number); return monthNames[m - 1] + ' ' + y; },
    dateKey(day) { return `${this.year}-${pad2(this.month + 1)}-${pad2(day)}`; },

    // ── Bordro ──────────────────────────────────────────────────────────────

    // Net ödeme dökümü: satırlar hesaplama motorundan (hesaplama.js) gelir
    get netSlip() {
      const p = this.activePerson; if (!p || !this.result) return null;
      const salary = Number(p.netSalary) || 0;
      return {salary, lines: this.result.lines, net: Math.round((salary - this.unpaidDeduction + this.result.netTotal) * 100) / 100};
    },
    // Maaştan düşülen günler: ücretsiz izin ve rapor (rapor ödeneği SGK'dan ayrıca ödenir)
    get unpaidDays() { return this.leaveEntries.filter(e => e.type === 'izin-ucretsiz' || e.type === 'izin-rapor').length; },
    // Bordro 30 gün esaslı: eksik gün varsa ödenen gün = 31 çeken ayda en çok 30 olmak üzere ay günü − eksik gün, diğer aylarda 30 − eksik gün
    get deductedDays() {
      const n = this.unpaidDays; if (!n) return 0;
      const paid = this.monthDays === 31 ? Math.min(30, 31 - n) : 30 - n;
      return Math.max(0, 30 - Math.max(0, paid));
    },
    // Bordrodaki gibi: ücretsiz izin günü başına net maaş / 30 kesilir
    get unpaidDeduction() { return Math.round((Number(this.activePerson?.netSalary) || 0) / 30 * this.deductedDays * 100) / 100; },

    // Bordrodaki gibi döküm: hafta içi / hafta sonu (kişinin hafta tatili) / resmî tatil / bayram / eksik mesai
    get breakdown() {
      const p = this.activePerson; if (!p) return [];
      const daily = Number(p.dailyHours) || 7.5, rest = p.restDay ?? 0, izinler = this.leaveSet(p.id);
      const rows = [['weekday','Hafta içi','normal'],['weekend','Hafta tatili','rest'],['holiday','Resmî tatil','holiday'],['bayram','Bayram','bayram'],['overflow','7,5 saati aşan (tatil)','normal']]
        .map(([key, label, cls]) => ({key, label, cls, hours: 0}));
      const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
      const ROW = {'hafta-ici':'weekday','hafta-tatili':'weekend','resmi-tatil':'holiday','bayram':'bayram','tatil-asim':'overflow'};
      let carry = 0;
      for (const e of this.workEntries) {
        const parts = hesapla.parcala(e, {gunluk: daily, haftaTatili: rest, izinler});
        // Önceki aydan devredenler ayrı satırda; eski tip (-00) saatler bölünmeden
        if (e.paidMonth) { carry += e.date.endsWith('-00') ? Number(e.hours) || 0 : parts.reduce((s, x) => s + x.saat, 0); continue; }
        for (const x of parts) byKey[ROW[x.satir]].hours += x.saat;
      }
      if (carry) rows.push({key: 'carry', label: 'Önceki aydan', cls: 'normal', hours: carry});
      const out = rows.filter(r => r.key !== 'overflow' || r.hours).map(r => ({...r, days: r.hours / daily}));
      const leaves = this.leaveEntries;
      for (const t of this.leaveTypes) {
        const n = leaves.filter(e => e.type === t.value).length;
        if (n) out.push({key: t.value, label: t.label, cls: 'leave ' + t.value, hours: 0, days: n, leave: true});
      }
      return out;
    },
    get breakdownTotal() { return this.breakdown.reduce((s, r) => s + (r.leave ? 0 : r.hours), 0); },

    // Kişinin izin günleri (izinli hafta kuralı için); kayıtlar değişince dizinle birlikte yeniden kurulur
    leaveSet(pid) { return entryIndex(this.entries).leave.get(pid) || new Set(); },
    // Hafta tatilinde çalışılan gün, haftada izin varsa normal iş günü sayılır (ilk 7,5 saat ödenmez)
    restLost(e, p) { return !!p && e.type === 'normal' && !e.paidMonth && hesapla.izinliHafta(e.date, this.leaveSet(p.id)); },
    // Hesaba esas saat: hafta tatilinde çalışılan gün en az günlük saat (7,5) sayılır
    paidHours(e, p) {
      if (!p || isLeave(e.type)) return Number(e.hours) || 0;
      return hesapla.parcala(e, {gunluk: Number(p.dailyHours) || 7.5, haftaTatili: p.restDay ?? 0, izinler: this.leaveSet(p.id)}).reduce((s, x) => s + x.saat, 0);
    },

    async calculate() {
      const person = this.activePerson;
      if (!person) { this.result = null; this.calcError = false; return; }
      const request = ++this.calcRequest;
      this.calcError = false; this.calcErrorMessage = '';
      const entries = this.workEntries.map(e => ({date: e.date, type: e.type, hours: e.hours, paidMonth: e.paidMonth}));
      const payload = {netSalary: Number(person.netSalary) || 0, dailyHours: Number(person.dailyHours) || 7.5, restDay: person.restDay ?? 0, entries, leaveDates: [...this.leaveSet(person.id)]};
      try { const data = hesapla(payload); if (request === this.calcRequest) this.result = data; }
      catch (error) {
        if (request === this.calcRequest) { this.result = null; this.calcError = true; this.calcErrorMessage = error instanceof Error ? error.message : 'Hesaplanamadı'; }
        console.error('Hesaplama hatası:', error);
      }
    },

    // ── Yıllık izin ─────────────────────────────────────────────────────────

    // Yıllık izin (İş Kanunu md. 53–56): her hizmet yılı dolduğunda hak eklenir (1–4. yıl 14, 5–14. yıl 20, 15+ 26 gün);
    // kullanılmayan izin silinmez, birikir. Hafta tatili ve resmî tatil/bayram günleri izinden sayılmaz.
    // leaveCarry: uygulama öncesi kalan (+) ya da kullanılmış (−) gün düzeltmesi.
    leaveDayCounts(e, p) { return parseDate(e.date).getDay() !== (p.restDay ?? 0) && !holidayOf(e.date); },
    get leaveBalance() {
      const p = this.activePerson; if (!p) return null;
      const sd = String(p.startDate || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return {noStart: true};
      const [sy, sm, sdd] = sd.split('-').map(Number), start = new Date(sy, sm - 1, sdd), now = this.today;
      let years = now.getFullYear() - sy;
      if (new Date(now.getFullYear(), sm - 1, sdd) > now) years--;
      years = Math.max(0, years);
      const rate = k => k < 5 ? 14 : k < 15 ? 20 : 26;
      let earned = 0;
      for (let k = 1; k <= years; k++) earned += rate(k);
      const carry = Number(p.leaveCarry) || 0, next = new Date(sy + years + 1, sm - 1, sdd);
      const all = entryIndex(this.entries).annual.get(p.id) || [];
      const used = all.filter(e => this.leaveDayCounts(e, p)).length, skipped = all.length - used;
      return {years, earned, carry, used, skipped, left: earned + carry - used, nextRate: rate(years + 1), next: longDateFmt.format(next), start: longDateFmt.format(start)};
    },

    // ── Ekip tablosu (kişi × gün, görüntülenen ay) ──────────────────────────

    get chartTodayDay() { const t = this.today; return t.getFullYear() === this.year && t.getMonth() === this.month ? t.getDate() : 0; },
    // Önceki aylardan bu aya devredilen günler: tabloda ayın başına eklenir (29 30 31 | 1 2 …)
    get chartLead() {
      const mk = this.monthKey, set = new Set();
      for (const e of entryIndex(this.entries).paid.get(mk) || []) if (!e.date.endsWith('-00') && e.date.slice(0, 7) !== mk && !isLeave(e.type)) set.add(e.date);
      if (!set.size) return [];
      const ds = [...set].sort(), [y, m, d] = ds[0].split('-').map(Number);
      const span = Math.round((new Date(this.year, this.month, 0) - new Date(y, m - 1, d)) / 864e5) + 1;
      // İki haftaya kadar aralık kesintisiz gösterilir, daha uzunsa yalnız kayıtlı günler
      if (span <= 14) return Array.from({length: span}, (_, k) => iso(new Date(y, m - 1, d + k)));
      return ds;
    },
    get chartLegacy() { return (entryIndex(this.entries).paid.get(this.monthKey) || []).some(e => e.date.endsWith('-00')); },
    get chartDays() {
      const wd = ['Pz','Pt','Sa','Ça','Pe','Cu','Ct'], mo = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      const today = this.chartTodayDay, lead = this.chartLead;
      const pre = lead.map((k, i) => {
        const [, m, d] = k.split('-').map(Number), h = holidayOf(k);
        return {key: k, day: d, lead: true, wd: mo[m - 1], cls: ['lead', i === lead.length - 1 ? 'lead-end' : '', h ? 'hol-' + h[0] : ''].join(' ')};
      });
      return pre.concat(Array.from({length: this.monthDays}, (_, i) => {
        const d = i + 1, k = this.dateKey(d), h = holidayOf(k);
        return {key: k, day: d, wd: wd[new Date(this.year, this.month, d).getDay()], cls: [h ? 'hol-' + h[0] : '', d === today ? 'today' : ''].join(' ')};
      }));
    },
    get chartRows() {
      const short = {'izin-yillik':'Y','izin-haftalik':'HI','izin-ucretsiz':'Ü','izin-rapor':'R','izin-mazeret':'M'};
      // Getter'lar her erişimde yeniden hesaplanır: döngü dışında bir kez okunur
      const mk = this.monthKey, today = this.chartTodayDay, show = this.chartShow, cols = this.chartDays, flashKey = this.flashKey, flashIds = this.flashIds;
      const byPerson = entryIndex(this.entries).month.get(mk) || new Map();
      // Sütun tarihlerinin haftanın günü bir kez hesaplanır
      const colDay = cols.map(col => parseDate(col.key).getDay());
      return this.crewPeople.map(p => {
        const rest = p.restDay ?? 0, daily = Number(p.dailyHours) || 7.5, flashOn = flashIds.includes(p.id);
        const own = byPerson.get(p.id) || [], byDate = new Map();
        let carry = 0, total = 0;
        for (const e of own) {
          // Eski tip devreden saatler (tarih -00) ayrı sütunda; bu aya ait günün kendi kaydı gün hücresinde
          if (e.paidMonth && e.date.endsWith('-00')) { if (!isLeave(e.type)) carry += this.paidHours(e, p); continue; }
          if (e.paidMonth && e.date.slice(0, 7) === mk) continue;
          const l = byDate.get(e.date); l ? l.push(e) : byDate.set(e.date, [e]);
        }
        // Filtre kategorisi: hafta içi / hafta tatili / resmî tatil / bayram
        const cat = e => {
          if (e.type === 'fazla') return 'weekday';
          if (e.type !== 'normal') return e.type;
          if (e.paidMonth) return 'weekday';
          return parseDate(e.date).getDay() === rest ? 'weekend' : 'weekday';
        };
        for (const e of own) if (!isLeave(e.type) && show[cat(e)]) total += this.paidHours(e, p);
        const cells = cols.map((col, ci) => {
          const d = col.day, list = byDate.get(col.key) || [], work = list.filter(x => !isLeave(x.type)), e = list.find(x => isLeave(x.type)) || work[0];
          const cls = [colDay[ci] === rest ? 'rest' : '', !col.lead && d === today ? 'today' : '', col.lead ? 'lead' : '', col.lead && col.cls.includes('lead-end') ? 'lead-end' : '', flashOn && flashKey === col.key ? 'just-saved' : ''];
          let text = '';
          if (work.length > 1) {
            const vis = work.filter(x => show[cat(x)]);
            if (vis.length) {
              const k = vis[0], c = cat(k);
              cls.push(c === 'weekend' ? 'weekend' : k.type === 'fazla' ? 'normal' : k.type);
              text = this.formatHours(vis.reduce((s, x) => s + this.paidHours(x, p), 0));
            }
          } else if (e) {
            if (isLeave(e.type)) { if (show.leave) { cls.push('leave'); text = short[e.type] || 'İ'; } }
            else {
              const c = cat(e);
              if (show[c]) {
                cls.push(c === 'weekend' ? 'weekend' : e.type === 'fazla' ? 'normal' : e.type);
                const h = this.paidHours(e, p);
                // Hafta tatili çalışması: 'HT', günlük saati aşan kısım 'HT+2'
                if (e.type === 'normal' && !e.paidMonth && parseDate(e.date).getDay() === rest && !this.restLost(e, p)) {
                  const x = Math.round((h - daily) * 100) / 100;
                  text = x > 0 ? 'HT+' + this.formatHours(x) : 'HT';
                } else text = this.formatHours(h);
              }
            }
          }
          return {key: col.key, day: d, lead: !!col.lead, cls: cls.join(' '), text};
        });
        return {id: p.id, name: p.name, first: this.firstName(p.name), av: this.avatar(p), cells, carry: carry ? this.formatHours(carry) : '', total: total ? this.formatHours(total) : '—'};
      });
    },

    // ── Takvim ──────────────────────────────────────────────────────────────

    cellText(c) {
      if (!c.restWork) return this.formatHours(c.hours);
      const d = Number(this.activePerson?.dailyHours) || 7.5, x = Math.round((c.hours - d) * 100) / 100;
      return x > 0 ? 'HT +' + this.formatHours(x) : 'HT';
    },
    get calendarCells() {
      const p = this.activePerson, sel = this.selectedId, mk = this.monthKey;
      const first = new Date(this.year, this.month, 1), start = (first.getDay() + 6) % 7, days = this.monthDays, prevDays = new Date(this.year, this.month, 0).getDate();
      const count = Math.ceil((start + days) / 7) * 7, rest = p?.restDay ?? 0, todayDay = this.chartTodayDay;
      const flashOn = this.flashIds.includes(sel), flashKey = this.flashKey;
      // Ayın kayıtları güne göre bir kez gruplanır (her hücrede tüm kayıtları taramak yerine)
      const byDate = new Map();
      for (const e of this.calendarEntries) { const l = byDate.get(e.date); l ? l.push(e) : byDate.set(e.date, [e]); }
      // Önceki aydan bu aya devredilenler, takvimin baştaki önceki ay günlerinde gösterilir
      const inbound = new Map();
      if (p) for (const e of entryIndex(this.entries).paid.get(mk) || []) {
        if (e.personId === sel && !e.date.endsWith('-00') && e.date.slice(0, 7) < mk && !isLeave(e.type)) { const l = inbound.get(e.date); l ? l.push(e) : inbound.set(e.date, [e]); }
      }
      const sumHours = list => list.reduce((s, e) => s + this.paidHours(e, p), 0);
      return Array.from({length: count}, (_, i) => {
        const day = i - start + 1, current = day > 0 && day <= days, actualDay = day < 1 ? prevDays + day : day > days ? day - days : day;
        const dt = new Date(this.year, this.month, day), dk = current ? this.dateKey(day) : '', dIso = iso(dt);
        // Not: anahtar 0 tabanlı ay içerir (ör. 2026-9-31); x-for anahtarı olarak benzersiz olması yeterli
        const key = `${dt.getFullYear()}-${dt.getMonth()}-${actualDay}`;
        const all = current ? byDate.get(dk) || [] : [];
        const entries = all.filter(e => !isLeave(e.type)), leave = all.find(e => isLeave(e.type));
        const holiday = holidayOf(dIso), inb = !current && day < 1 ? inbound.get(dIso) || [] : [];
        const isRest = dt.getDay() === rest;
        return {
          key, inbound: inb[0] || null, inboundText: inb.length ? this.formatHours(sumHours(inb)) : '',
          day: current ? day : actualDay, current, weekend: isRest,
          special: holiday?.[0] || '', specialName: holiday?.[1] || '',
          today: current && day === todayDay, flash: current && flashKey === dk && flashOn,
          entryCount: entries.length, hours: sumHours(entries), moved: entries.some(e => e.paidMonth),
          restWork: current && isRest && entries.some(e => e.type === 'normal' && !this.restLost(e, p)),
          hasHoliday: entries.some(e => e.type === 'holiday'), hasBayram: entries.some(e => e.type === 'bayram'),
          leave: leave?.type || '', leaveShort: leave ? this.leaveTypes.find(t => t.value === leave.type)?.short : '',
        };
      });
    },
    weekdayFor(day) { return this.weekdays[(this.formDate(day).getDay() + 6) % 7]; },

    // ── Kayıt penceresi ─────────────────────────────────────────────────────

    // Mesai penceresinin gösterdiği ay (eksik mesai)
    formDate(day) { const [y, m] = (this.entryForm.ym || this.monthKey).split('-').map(Number); return new Date(y, m - 1, day); },
    get formMonthDays() { const d = this.formDate(1); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); },
    get formMonthLabel() { const d = this.formDate(1); return monthNames[d.getMonth()] + ' ' + d.getFullYear(); },
    // Tatil gününde tür varsayılanı: bayram / resmî tatil / normal
    defaultType(date) { const special = holidayOf(date)?.[0]; return special === 'bayram' ? 'bayram' : special ? 'holiday' : 'normal'; },
    openMulti() {
      if (!this.crewPeople.length) return;
      const now = new Date(), day = now.getFullYear() === this.year && now.getMonth() === this.month ? now.getDate() : 1;
      this.editingEntry = null;
      this.entryForm = {day, ym: this.monthKey, carry: false, mode: 'work', multi: true, people: this.selectedId ? [this.selectedId] : [], type: this.defaultType(this.dateKey(day)), hours: 0, hoursText: ''};
      this.setHours(2);
      this.modal = 'entry';
    },
    toggleMultiPerson(id) { const list = this.entryForm.people; this.entryForm.people = list.includes(id) ? list.filter(x => x !== id) : [...list, id]; },
    // Geçmiş aydan mesai: geçmiş aylardan gün seçilir; kayıt kendi gününde görünür, açık olan ayın bordrosunda ödenir
    get pastMonths() {
      const [y, m] = this.monthKey.split('-').map(Number);
      return Array.from({length: 12}, (_, i) => { const d = new Date(y, m - 2 - i, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; });
    },
    openCarry() {
      if (!this.activePerson) return;
      this.editingEntry = null;
      const ym = this.pastMonths[0], [y, m] = ym.split('-').map(Number), last = new Date(y, m, 0).getDate();
      this.entryForm = {day: last, ym, carry: false, past: true, payMonth: this.monthKey, moved: true, mode: 'work', type: 'normal', hours: 0, hoursText: '', restWorked: false};
      this.setHours(this.restMode ? 0 : 2);
      this.modal = 'entry';
    },
    openEntry(day) {
      if (!this.activePerson) return;
      const existing = this.calendarEntries.find(entry => entry.date === this.dateKey(day));
      if (existing) { this.editEntry(existing); return; }
      this.editingEntry = null;
      this.entryForm = {day, ym: this.monthKey, carry: false, mode: 'work', type: this.defaultType(this.dateKey(day)), hours: 0, hoursText: '', restWorked: false, moved: false};
      this.setHours(this.restMode ? 0 : 2);
      this.modal = 'entry';
    },
    editEntry(entry) {
      this.editingEntry = entry;
      const legacy = entry.date.endsWith('-00'), paid = !legacy && !!entry.paidMonth, past = paid && this.monthKey === entry.paidMonth;
      this.entryForm = {moved: paid, past, payMonth: paid ? entry.paidMonth : '', day: Number(entry.date.slice(-2)), ym: entry.date.slice(0, 7), carry: legacy,
        mode: isLeave(entry.type) ? 'leave' : 'work', type: entry.type, hours: 0, hoursText: '', restWorked: !isLeave(entry.type) && entry.type !== 'fazla'};
      // Özel günde kayıtlı saat = günlük saat + ek fazla mesai; pencerede yalnız ek kısım gösterilir
      const h = Number(entry.hours) || 0;
      this.setHours(this.restMode && this.entryForm.restWorked ? Math.max(0, Math.round((h - this.restHours) * 100) / 100) : h);
      this.modal = 'entry';
    },
    setMode(mode) {
      const f = this.entryForm;
      f.mode = mode;
      f.type = mode === 'leave' ? (isLeave(f.type) ? f.type : 'izin-yillik') : (isLeave(f.type) ? 'normal' : f.type);
    },
    setHours(h) { this.entryForm.hours = h; this.entryForm.hoursText = String(h).replace('.', ','); },
    parseHours() { this.entryForm.hours = Number(String(this.entryForm.hoursText).replace(',', '.')) || 0; },
    get restHours() { return Number(this.activePerson?.dailyHours) || 7.5; },
    get isRestDay() { return !this.entryForm.carry && this.formDate(Number(this.entryForm.day)).getDay() === (this.activePerson?.restDay ?? 0); },
    // Özel gün (hafta tatili, resmî tatil, bayram): çalışıldı işaretlenirse 1 gün (7,5 saat) o günün katsayısıyla yazılır,
    // girilen saat bunun üstüne ek fazla mesaidir
    get dayKind() {
      if (this.entryForm.carry) return 'normal';
      const h = holidayOf(this.entryForm.day ? iso(this.formDate(Number(this.entryForm.day))) : '')?.[0];
      return h === 'bayram' ? 'bayram' : h ? 'holiday' : this.isRestDay ? 'rest' : 'normal';
    },
    get restMode() { return !this.entryForm.multi && !this.entryForm.carry && this.entryForm.mode !== 'leave' && this.dayKind !== 'normal'; },
    get restWeekLost() { return this.dayKind === 'rest' && !!this.entryForm.day && hesapla.izinliHafta(iso(this.formDate(Number(this.entryForm.day))), this.leaveSet(this.selectedId)); },
    get dayKindInfo() {
      return {
        rest: ['Hafta tatilinde çalışıldı', this.restWeekLost ? 'ödenmez · haftada izin var' : '×1,5', 'rest'],
        holiday: ['Resmî tatilde çalışıldı', '×1', 'holiday'],
        bayram: ['Bayramda çalışıldı', '×2', 'bayram'],
      }[this.dayKind] || ['', '', ''];
    },

    saveEntry() {
      const f = this.entryForm;
      if (f.multi) return this.saveMulti();
      if (!this.activePerson) return;
      const leave = f.mode === 'leave' && !f.carry;
      if (leave && f.type === 'izin-yillik' && !this.leaveDayCounts({date: `${f.ym || this.monthKey}-${pad2(f.day)}`}, this.activePerson)) { this.notify('Hafta tatili ve resmî tatil yıllık izinden sayılmaz'); return; }
      const rest = this.restMode;
      if (!f.carry && !leave && !rest) f.type = 'normal';

      // Süre: metin kutusu boşsa hazır düğmeyle seçilen değer
      const text = f.hoursText;
      let hours = leave ? 0 : text == null || String(text).trim() === '' ? Number(f.hours) : Number(String(text).trim().replace(',', '.'));
      if (rest && f.restWorked) {
        // Özel günde çalışıldı: günlük saat + ek saat, tür günün türü
        if (!Number.isFinite(hours) || hours < 0) { this.notify('Geçerli bir süre girin'); return; }
        hours = this.restHours + hours;
        f.type = this.dayKind === 'rest' ? 'normal' : this.dayKind;
      } else if (rest) f.type = 'fazla'; // gün ayrıca ödendi: yalnız fazla mesai
      if (!leave && (!Number.isFinite(hours) || hours <= 0)) { this.notify('Geçerli bir süre girin'); return; }
      if (leave && !isLeave(f.type)) f.type = 'izin-yillik';
      if (!f.carry && hours > 24) { this.notify('Günlük en fazla 24 saat girilebilir'); return; }
      f.hours = Math.round(hours * 100) / 100;
      const day = Number(f.day);
      if (!f.carry && !(Number.isInteger(day) && day >= 1 && day <= this.formMonthDays)) { this.notify('Geçerli bir gün seçin'); return; }
      const ym = f.ym || this.monthKey, date = `${ym}-${pad2(f.day)}`;

      // Günlük kayıt: aynı kişinin aynı gününde ikinci kayıt açılmasın (takvim yalnızca birini düzenleyebiliyor)
      if (f.past) f.moved = true;
      const movedNew = !!f.moved && !leave;
      const twin = f.past && !this.editingEntry && this.entries.find(e => e.personId === this.selectedId && e.date === date && e.paidMonth === (f.payMonth || this.monthKey));
      if (twin) { this.notify('Bu günün kaydı açıldı'); this.editEntry(twin); return; }
      if (!f.carry && this.entries.some(e => e.personId === this.selectedId && e.date === date && e.id !== this.editingEntry?.id && !!e.paidMonth === movedNew)) { this.notify('Bu güne ait bir kayıt zaten var'); return; }

      const entry = {id: this.editingEntry?.id || newId('m', 5), personId: this.selectedId, date, type: f.type, hours: Number(f.hours),
        ...(f.carry ? {paidMonth: this.editingEntry?.paidMonth || this.monthKey} : f.moved && !leave ? {paidMonth: f.payMonth || this.nextMonthKey(date.slice(0, 7))} : {})};
      if (this.editingEntry) this.entries = this.entries.map(e => e.id === entry.id ? entry : e);
      else this.entries.push(entry);
      this.persist(); this.closeModal(); this.calculate();
      if (!entry.paidMonth) this.flash(entry.date, [entry.personId]);
      this.notify(leave ? this.leaveLabel(entry.type) + ' kaydedildi' : 'Mesai kaydedildi');
    },
    // Ekibe mesai: seçilen her kişiye aynı gün; o gün kaydı olan atlanır
    saveMulti() {
      const f = this.entryForm, leave = f.mode === 'leave', hours = leave ? 0 : Number(String(f.hoursText ?? f.hours).trim().replace(',', '.'));
      if (!f.people.length) { this.notify('En az bir personel seçin'); return; }
      if (!leave && (!Number.isFinite(hours) || hours <= 0 || hours > 24)) { this.notify('Geçerli bir süre girin'); return; }
      const date = `${f.ym || this.monthKey}-${pad2(f.day)}`, weekDay = parseDate(date).getDay();
      let added = 0;
      const skipped = [];
      for (const personId of f.people) {
        const p = this.people.find(x => x.id === personId);
        if (this.entries.some(e => e.personId === personId && e.date === date)) { skipped.push(p?.name); continue; }
        // Kişinin hafta tatiline denk gelen normal mesai: günlük saat eklenir
        const daily = Number(p?.dailyHours) || 7.5, restDay = !leave && f.type === 'normal' && weekDay === (p?.restDay ?? 0);
        this.entries.push({id: newId('m', 5), personId, date, type: f.type, hours: Math.round((restDay ? daily + hours : hours) * 100) / 100});
        added++;
      }
      this.persist(); this.closeModal(); this.calculate(); this.flash(date, f.people);
      this.notify(skipped.length ? `${added} kişiye eklendi · ${skipped.join(', ')} için o gün kayıt var` : `${added} kişiye ${leave ? this.leaveLabel(f.type).toLocaleLowerCase('tr-TR') : 'mesai'} eklendi`);
    },
    deleteEntry() {
      if (!this.editingEntry) return;
      const gone = this.editingEntry;
      this.entries = this.entries.filter(e => e.id !== gone.id);
      this.persist(); this.closeModal(); this.calculate();
      if (!gone.paidMonth) this.flash(gone.date, [gone.personId]);
      this.notify('Kayıt silindi');
    },

    // ── Personel ────────────────────────────────────────────────────────────

    selectPerson(id) { this.selectedId = id; this.view = 'ledger'; },
    openPersonForm(person = null) {
      this.editingPerson = person; this.removePin = false; this.patReset(); this.lockOpen = false;
      this.personForm = person ? {restDay: 0, team: 'yol', ...person} : {name: '', role: '', team: this.crew, netSalary: 65000, dailyHours: 7.5, restDay: 0, cumulativeTaxBase: 0, startDate: '', leaveCarry: 0};
      this.modal = 'person';
    },
    async savePerson() {
      const pf = this.personForm, editing = this.editingPerson, name = String(pf.name || '').trim();
      if (!name) return;
      if (this.patFirst && !this.newPattern) { this.notify('Deseni onaylamak için tekrar çizin'); return; }
      const locked = !!editing && this.isLocked(editing);
      const record = {id: editing?.id || newId('p', 4), name, role: String(pf.role || '').trim(), team: pf.team === 'tunel' ? 'tunel' : 'yol', netSalary: Number(pf.netSalary) || 65000, dailyHours: Number(pf.dailyHours) || 7.5,
        restDay: Number(pf.restDay) || 0, cumulativeTaxBase: Number(pf.cumulativeTaxBase) || 0, startDate: String(pf.startDate || ''), leaveCarry: Number(pf.leaveCarry) || 0, example: false,
        ...(pf.photo !== undefined && {photo: pf.photo || ''})};
      // Kilitliyken maaş alanları değiştirilemez
      if (locked) { record.netSalary = editing.netSalary; record.cumulativeTaxBase = editing.cumulativeTaxBase; }
      const keep = editing?.pinHash;
      if (this.newPattern && !locked) {
        record.pinHash = 'pat:' + await this.hashPin(record.id, 'pat:' + this.newPattern);
        if (!this.unlockedIds.includes(record.id)) this.unlockedIds.push(record.id);
      } else if (keep && !(this.removePin && !locked)) record.pinHash = keep;
      if (editing) this.people = this.people.map(p => p.id === record.id ? record : p);
      else { this.people.push(record); this.selectedId = record.id; }
      this.persist(); this.closeModal(); this.view = 'ledger'; this.calculate();
      this.notify(editing ? 'Personel bilgileri güncellendi' : 'Personel eklendi');
    },
    removePerson(person) {
      if (!confirm(`${person.name} ve tüm kayıtları silinsin mi?`)) return;
      this.people = this.people.filter(p => p.id !== person.id);
      this.entries = this.entries.filter(e => e.personId !== person.id);
      if (this.selectedId === person.id) this.selectedId = this.people[0]?.id || null;
      this.persist(); this.calculate(); this.notify('Personel silindi');
    },
    clearExamples() {
      if (!this.hasExamples) return;
      if (!confirm('Örnek veriler silinsin mi?')) return;
      const ids = new Set(this.people.filter(p => p.example).map(p => p.id));
      this.people = this.people.filter(p => !p.example);
      this.entries = this.entries.filter(e => !ids.has(e.personId));
      if (ids.has(this.selectedId)) this.selectedId = this.people[0]?.id || null;
      this.persist(); this.calculate(); this.notify('Örnek veriler silindi');
    },

    // Haritacı avatarı (id'den sabit türetilir): ten, saç/baret, sakal/bıyık/gözlük, yelek ve elinde jalon, GNSS, prizma, total station ya da kumanda
    avatar(p, size = '') {
      if (p?.photo) return `<span class="avatar photo ${size}" aria-hidden="true"><img src="${p.photo}" alt="" decoding="async"></span>`;
      const s = String(p?.id || '') + '|' + (p?.name || ''), ck = s + '|' + size, hit = avatarCache.get(ck);
      if (hit) return hit;
      let h = 2166136261; // FNV-1a
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      const pick = (n, k) => Math.floor(h / k) % n, tone = pick(6, 1) + 1, sk = [['#f0cfb2','#dcae8f'],['#dcab87','#c4916c'],['#b88360','#9c6a49']][pick(3, 7)], hc = ['#2a2421','#4b3425','#6e5846','#8a8580'][pick(4, 23)],
        style = pick(6, 61), beard = pick(3, 311) === 0, acc = pick(4, 1291), vest = pick(2, 2087) === 0, prop = pick(5, 4099);
      const hair = [`<path fill="${hc}" d="M10.1 14.2c-.4-4.4 2.2-7.2 5.9-7.2s6.3 2.8 5.9 7.2c-.5-1.7-1.3-2.9-2.3-3.6-2.1.9-5.4.9-7.2 0-1 .7-1.8 1.9-2.3 3.6z"/>`,
        `<path fill="${hc}" d="M10 14.6c-.6-4.8 2.3-7.7 6.2-7.7 3.7 0 6.4 2.6 5.9 7.3-.4-1.6-1-2.7-1.8-3.4-2.8.2-5.6-.6-7.3-2.1-.6 1.9-1.6 3.8-3 5.9z"/>`,
        `<path fill="${hc}" d="M10.2 15.6c-.2-1.4.1-2.6.6-3.4l.8 3zM21.8 15.6c.2-1.4-.1-2.6-.6-3.4l-.8 3z"/><path fill="#e8bb4f" d="M9.5 12.8a6.5 6.5 0 0 1 13 0z"/><path fill="#cf9f34" d="M8.2 12.4h15.6v1.7H8.2zM15.3 6.4h1.4v6h-1.4z"/>`,
        `<path fill="${hc}" d="M9.6 16.2c-1-5.6 1.9-9.6 6.4-9.6s7.4 4 6.4 9.6c-.4-2.2-.9-3.6-1.6-4.6-1.6.7-3.4 1-4.8 1s-3.2-.3-4.8-1c-.7 1-1.2 2.4-1.6 4.6z"/>`,
        `<g fill="${hc}"><circle cx="11.2" cy="11.4" r="2.2"/><circle cx="13.6" cy="9" r="2.4"/><circle cx="16.4" cy="8.2" r="2.5"/><circle cx="19.1" cy="9.1" r="2.4"/><circle cx="21" cy="11.5" r="2.1"/></g>`,
        `<path fill="${hc}" d="M10.1 15.8c-.4-1.8-.2-3.6.6-4.7l.9 4.2zM21.9 15.8c.4-1.8.2-3.6-.6-4.7l-.9 4.2z"/>`];
      const beardP = beard ? `<path fill="${hc}" d="M10.3 15.9c.3 3.9 2.7 6.2 5.7 6.2s5.4-2.3 5.7-6.2c-.6 1.3-1.4 2-2.2 2.2-.9-.9-2.1-1.3-3.5-1.3s-2.6.4-3.5 1.3c-.8-.2-1.6-.9-2.2-2.2z"/>` : '';
      const eyes = acc === 1 ? `<path fill="#1b2023" d="M11.6 14.1h3.9l-.3 1.9c-.1.6-.6 1-1.2 1h-1c-.6 0-1.1-.4-1.2-1zM16.5 14.1h3.9l-.2 1.9c-.1.6-.6 1-1.2 1h-1c-.6 0-1.1-.4-1.2-1zM15.4 14.3h1.2v.6h-1.2z"/><path fill="#fff" opacity=".35" d="M12.2 14.5h1.2l-.9 1.2z"/>`
        : `<g fill="#2a2421"><circle cx="13.8" cy="15" r=".8"/><circle cx="18.2" cy="15" r=".8"/></g><path fill="none" stroke="${hc}" stroke-width=".85" stroke-linecap="round" d="M12.7 13.1h2.2M17.1 13.1h2.2"/>`;
      const must = acc === 2 ? `<path fill="${hc}" d="M13.2 17.7c1-1 1.9-1.1 2.8-.5.9-.6 1.8-.5 2.8.5-.4.7-1.2.9-1.8.6-.4-.2-.7-.4-1-.4s-.6.2-1 .4c-.6.3-1.4.1-1.8-.6z"/>` : '';
      const vestP = vest ? `<path fill="#f08a24" d="M5.6 32c.3-4.6 2.6-7.8 7-8.9l1.6 8.9zM26.4 32c-.3-4.6-2.6-7.8-7-8.9L17.8 32z"/><path fill="#eef2e8" d="M6.2 28.4h6.9l.2 1.3H6zM18.7 28.4h6.9l.2 1.3h-7.3z"/>` : '';
      const hand = (x, y) => `<circle fill="${sk[0]}" cx="${x}" cy="${y}" r="1.7"/>`;
      const props = [
        `<g><path fill="#f3f1ea" d="M25.2 1.5h1.6V32h-1.6z"/><path fill="#d9483b" d="M25.2 1.5h1.6v4h-1.6zM25.2 9.5h1.6v4h-1.6zM25.2 17.5h1.6v4h-1.6zM25.2 25.5h1.6v4h-1.6z"/></g>${hand(26, 24.6)}`,
        `<g><path fill="#9aa3a6" d="M25.3 6.5h1.4V32h-1.4z"/><ellipse fill="#f3f4f1" cx="26" cy="5.4" rx="3.6" ry="1.5"/><path fill="#cfd4d2" d="M22.4 5.4c0 .9 1.6 1.6 3.6 1.6s3.6-.7 3.6-1.6v.7c0 .9-1.6 1.6-3.6 1.6s-3.6-.7-3.6-1.6z"/><rect fill="#232a2d" x="23.4" y="17.5" width="5.2" height="3.6" rx=".5"/><rect fill="#7fc7e8" x="24.1" y="18.1" width="3.8" height="2.4"/></g>${hand(26, 24.6)}`,
        `<g><path fill="#9aa3a6" d="M25.3 6.5h1.4V32h-1.4z"/><circle fill="#e9edec" cx="26" cy="4.6" r="2.9"/><circle fill="#e8a33a" cx="26" cy="4.6" r="1.9"/><path fill="#fff" opacity=".6" d="M25.1 3.6l1.6 1-1.6 1z"/></g>${hand(26, 24.6)}`,
        `<g><path fill="none" stroke="#6f6a5e" stroke-width=".9" stroke-linecap="round" d="M5.6 24.5 2.5 32M5.6 24.5V32M5.6 24.5 8.7 32"/><rect fill="#e8bb4f" x="2.6" y="17.4" width="6" height="6.2" rx=".6"/><rect fill="#232a2d" x="3.6" y="19.2" width="2.3" height="1.9"/><circle fill="#232a2d" cx="7.4" cy="20.2" r="1.2"/><circle fill="#7fc7e8" cx="7.4" cy="20.2" r=".55"/><path fill="#cf9f34" d="M4 16.2h3.2v1.2H4z"/></g>`,
        `<g><rect fill="#232a2d" x="12.4" y="25.2" width="7.2" height="5.2" rx=".7"/><rect fill="#7fc7e8" x="13.1" y="25.9" width="5.8" height="3.1"/><path fill="#f08a24" d="M14 27.6l1.3-1 1.2.8 1.4-1.2v2.3H14z"/></g>${hand(12.4, 28.6)}${hand(19.6, 28.6)}`][prop];
      // Total station (sehpa) gövdenin arkasında, diğerleri önünde çizilir
      const back = prop === 3 ? props : '', front = prop === 3 ? '' : props;
      const html = `<span class="avatar c${tone} ${size}" aria-hidden="true"><svg viewBox="0 0 32 32">${back}<path class="av-body" d="M4.5 32c0-6 4.6-9.4 11.5-9.4s11.5 3.4 11.5 9.4z"/>${vestP}<path fill="${sk[1]}" d="M13.7 18.8h4.6v4.4L16 25.4l-2.3-2.2z"/><circle fill="${sk[1]}" cx="10.3" cy="15.2" r="1.35"/><circle fill="${sk[1]}" cx="21.7" cy="15.2" r="1.35"/><ellipse fill="${sk[0]}" cx="16" cy="14.6" rx="5.8" ry="6.5"/>${beardP}${eyes}<path fill="none" stroke="${sk[1]}" stroke-width=".8" stroke-linecap="round" d="M16 15.6v1.5"/>${must}<path fill="none" stroke="${beard ? '#e9c6ad' : '#9a5a48'}" stroke-width=".85" stroke-linecap="round" d="M14.6 18.5q1.4 1 2.8 0"/>${hair[style]}${front}</svg></span>`;
      avatarCache.set(ck, html);
      return html;
    },

    // ── Fotoğraf ────────────────────────────────────────────────────────────

    // Fotoğraf önizleme: avatara dokununca büyük görünür, buradan değiştirilir ya da kaldırılır
    get photoPerson() { return this.people.find(p => p.id === this.photoId) || null; },
    // Personel formundaki avatar: fotoğraf önizlemesine geçer (fotoğraf oradan eklenir/değiştirilir)
    formPhoto() { const id = this.editingPerson?.id; if (!id) return; this.closeModal(); this.openPhoto(id); },
    openPhoto(id) { this.photoId = id; this.modal = 'photo'; },
    setPersonPhoto(id, photo) { this.people = this.people.map(p => p.id === id ? {...p, photo} : p); this.persist(); this.notify(photo ? 'Fotoğraf güncellendi' : 'Fotoğraf kaldırıldı'); },
    // Fotoğraf seçilince kırpma ekranı açılır: sürükle ve yakınlaştır, kare alan 480 px JPEG (en fazla ~100 KB) kaydedilir
    pickPhoto(ev) {
      const f = ev.target.files?.[0];
      ev.target.value = '';
      if (!f) return;
      if (f.type === 'image/gif') return this.pickGif(f);
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => { cropImg = img; this.crop = {src: url, w: img.width, h: img.height, zoom: 1, x: 0, y: 0, back: this.modal}; this.modal = 'crop'; this.$nextTick(() => this.cropReset()); };
      img.onerror = () => { URL.revokeObjectURL(url); this.notify('Fotoğraf okunamadı'); };
      img.src = url;
    },
    // GIF kırpılmaz (hareket kaybolur); olduğu gibi yüklenir, avatarda ortalanıp kareye sığdırılır
    async pickGif(f) {
      if (f.size > 4 * 1024 * 1024) { this.notify('GIF en fazla 4 MB olabilir'); return; }
      const back = this.modal, id = back === 'photo' && this.photoId ? this.photoId : (this.personForm?.id || 'yeni');
      this.notify('GIF yükleniyor…');
      try {
        const url = await bulut.uploadPhoto(f, id);
        if (back === 'photo' && this.photoId) this.setPersonPhoto(this.photoId, url);
        else { this.personForm = {...this.personForm, photo: url}; this.notify('GIF eklendi'); }
      } catch { this.notify('GIF yüklenemedi, bağlantıyı kontrol edin'); }
    },
    cropBox() { return this.$refs.cropBox?.clientWidth || 300; },
    cropScale() { const c = this.crop; return this.cropBox() / Math.min(c.w, c.h) * c.zoom; },
    cropClamp() { const c = this.crop, V = this.cropBox(), s = this.cropScale(); c.x = Math.min(0, Math.max(V - c.w * s, c.x)); c.y = Math.min(0, Math.max(V - c.h * s, c.y)); },
    // Başlangıç: ortalanır; portrede yüz için biraz yukarıdan
    cropReset() { const c = this.crop, V = this.cropBox(), s = this.cropScale(); c.x = (V - c.w * s) / 2; c.y = c.h > c.w ? (V - c.h * s) * .3 : (V - c.h * s) / 2; this.cropClamp(); },
    get cropStyle() { const c = this.crop; if (!c) return ''; const s = this.cropScale(); return `width:${c.w * s}px;height:${c.h * s}px;transform:translate(${c.x}px,${c.y}px)`; },
    // Yakınlaştırma (cx, cy) noktası sabit kalacak şekilde
    setCropZoom(z, cx, cy) {
      const c = this.crop, V = this.cropBox(), s0 = this.cropScale();
      z = Math.min(4, Math.max(1, z)); cx ??= V / 2; cy ??= V / 2;
      const ix = (cx - c.x) / s0, iy = (cy - c.y) / s0;
      c.zoom = z;
      const s1 = this.cropScale();
      c.x = cx - ix * s1; c.y = cy - iy * s1;
      this.cropClamp();
    },
    cropDown(e) { e.currentTarget.setPointerCapture?.(e.pointerId); (pointers ||= new Map()).set(e.pointerId, {x: e.clientX, y: e.clientY}); },
    cropMove(e) {
      const m = pointers; if (!m?.has(e.pointerId)) return;
      const prev = m.get(e.pointerId), cur = {x: e.clientX, y: e.clientY};
      if (m.size === 1) { this.crop.x += cur.x - prev.x; this.crop.y += cur.y - prev.y; this.cropClamp(); }
      else if (m.size === 2) {
        // İki parmak: aradaki mesafe oranında yakınlaştır
        const o = [...m.entries()].find(([k]) => k !== e.pointerId)[1], d0 = Math.hypot(prev.x - o.x, prev.y - o.y), d1 = Math.hypot(cur.x - o.x, cur.y - o.y), r = e.currentTarget.getBoundingClientRect();
        if (d0 > 0) this.setCropZoom(this.crop.zoom * d1 / d0, (cur.x + o.x) / 2 - r.left, (cur.y + o.y) / 2 - r.top);
      }
      m.set(e.pointerId, cur);
    },
    cropUp(e) { pointers?.delete(e.pointerId); },
    cropWheel(e) { const r = e.currentTarget.getBoundingClientRect(); this.setCropZoom(this.crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); },
    cropCancel() { URL.revokeObjectURL(this.crop?.src); const back = this.crop?.back; this.crop = null; pointers = null; cropImg = null; this.modal = back || ''; },
    cropSave() {
      const c = this.crop, s = this.cropScale(), V = this.cropBox(), cv = document.createElement('canvas');
      cv.width = cv.height = 480;
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cropImg, -c.x / s, -c.y / s, V / s, V / s, 0, 0, 480, 480);
      let q = .85, d = cv.toDataURL('image/jpeg', q);
      while (d.length > 100000 && q > .4) { q -= .1; d = cv.toDataURL('image/jpeg', q); }
      const back = c.back;
      URL.revokeObjectURL(c.src); this.crop = null; pointers = null; cropImg = null; this.modal = back || '';
      if (back === 'photo' && this.photoId) this.setPersonPhoto(this.photoId, d);
      else this.personForm = {...this.personForm, photo: d};
    },

    // ── Görünüm ve animasyon ────────────────────────────────────────────────

    // Tema: düğmeden yayılan dairesel geçiş
    toggleTheme(ev) {
      const r = document.documentElement, b = ev?.currentTarget?.getBoundingClientRect();
      if (b) {
        const x = b.left + b.width / 2, y = b.top + b.height / 2;
        r.style.setProperty('--vx', x + 'px'); r.style.setProperty('--vy', y + 'px');
        r.style.setProperty('--vr', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      }
      // Yeni tema uygulama anında belirlenir: hızlı çift dokunuşta geçişler üst üste binse de tema doğru kalır
      const apply = () => {
        const t = this.theme === 'dark' ? 'light' : 'dark';
        this.theme = t; r.dataset.theme = t;
        try { localStorage.setItem('mesai-tema', t); } catch {}
        document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#1d1b17' : '#ece5d3');
        document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.setAttribute('content', t === 'dark' ? 'black-translucent' : 'default');
      };
      if (document.startViewTransition && !reduceMotion()) document.startViewTransition(apply).ready.catch(() => {}); // yarıda kesilen geçiş hata sayılmasın
      else apply();
    },
    // Ay değişince takvim/tablo kayma yönü
    slideMonth(dir) {
      if (reduceMotion()) return;
      this.$nextTick(() => document.querySelectorAll('.day-grid,.cg-table').forEach(el => {
        el.classList.remove('slide-next', 'slide-prev');
        if (!el.getClientRects().length) return; // gizli sekmedeki tablo: gösterilince yeniden oynamasın
        // Animasyon bitince sınıf kalkar (sekme yeniden görünürken tekrar oynamaz)
        if (!slid.has(el)) { slid.add(el); el.addEventListener('animationend', e => { if (e.target === el && e.animationName.startsWith('slide-')) el.classList.remove('slide-next', 'slide-prev'); }); }
        void el.offsetWidth; // yeniden akış: aynı sınıf tekrar eklenince animasyon baştan başlar
        el.classList.add(dir > 0 ? 'slide-next' : 'slide-prev');
      }));
    },
    // Net tutar yumuşakça sayarak değişir
    tweenNet(to) {
      const from = Number(this.netShown) || 0;
      to = Number(to) || 0;
      if (from === to) return;
      cancelAnimationFrame(netRaf);
      if (reduceMotion() || !from) { this.netShown = to; return; }
      const t0 = performance.now(), d = 550;
      const step = now => {
        const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); // easeOutCubic
        this.netShown = Math.round((from + (to - from) * e) * 100) / 100;
        if (k < 1) { netRaf = requestAnimationFrame(step); return; }
        this.netShown = to;
        const n = this.$refs.net;
        if (n) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
      };
      netRaf = requestAnimationFrame(step);
    },
    // Tablodan hücreye dokununca o kişinin o günü açılır; kapanınca seçili kişi geri döner
    chartCell(id, c) {
      if (c.lead) {
        const e = this.entries.find(x => x.personId === id && x.date === c.key && x.paidMonth === this.monthKey);
        if (!e) return;
        if (this.chartPrev === null) this.chartPrev = this.selectedId || '';
        this.selectedId = id; this.editEntry(e);
        return;
      }
      if (this.chartPrev === null) this.chartPrev = this.selectedId || '';
      this.selectedId = id; this.openEntry(c.day);
    },
    // Gün sütunları görünen alana tam sığacak genişlikte; yarım sütun kalmaz (64 ad + 77 önceki ay + 68 toplam sütunu)
    chartFit() {
      const g = document.querySelector('.chart-grid'), t = g && g.querySelector('.cg-table');
      if (!g || !g.clientWidth) return;
      const w = g.clientWidth - 64 - (this.chartLegacy ? 77 : 0) - 68 - 2, n = Math.max(1, Math.min(this.chartDays.length, Math.floor((w + 1) / 41)));
      t.style.setProperty('--col', ((w - (n - 1)) / n).toFixed(2) + 'px');
    },
    // Bugünün sütunu görünür alanın ortasına kaydırılır
    chartScroll() {
      clearTimeout(chartTimer);
      chartTimer = setTimeout(() => {
        this.chartFit();
        const g = document.querySelector('.chart-grid'), c = g && g.querySelector('.cg-day.today');
        if (!g || !g.clientWidth) return;
        g.scrollLeft = c ? Math.max(0, c.offsetLeft - 65 - Math.floor((g.clientWidth - 134) / 2 / c.offsetWidth) * (c.offsetWidth + 1)) : 0;
      }, 60);
    },
    changeMonth(delta) { const date = new Date(this.year, this.month + delta, 1); this.month = date.getMonth(); this.year = date.getFullYear(); this.slideMonth(delta); },
    goCurrentMonth() {
      const d = (this.today.getFullYear() - this.year) * 12 + this.today.getMonth() - this.month;
      this.month = this.today.getMonth(); this.year = this.today.getFullYear();
      if (d) this.slideMonth(d);
    },

    // ── Kayıt ve eşitleme ───────────────────────────────────────────────────

    // Yerel kayıt yazılamasa bile (iOS gizli mod / kota) değişiklik bulut kuyruğuna mutlaka girer
    persist() { save('mesai-defteri-people', this.people); save('mesai-defteri-entries', this.entries); bulut.track(this.people, this.entries); },
    sync() {
      if (!bulut.on) return Promise.resolve();
      if (syncing) { syncAgain = true; return syncing; }
      return syncing = (async () => { do { syncAgain = false; await this.syncOnce(); } while (syncAgain); })().finally(() => { syncing = null; });
    },
    async syncOnce() {
      try {
        let data = await bulut.pull();
        // Bu cihaz ilk kez bağlanıyor ve bulut boşsa: yerel kayıtları yükle
        let first = false;
        try { first = !localStorage.getItem('mesai-defteri-bulut'); } catch {}
        if (!data.people.length && this.people.length && first) { bulut.reset([], []); bulut.track(this.people, this.entries); data = await bulut.pull(); }
        try { localStorage.setItem('mesai-defteri-bulut', '1'); } catch {}
        // Çekme sürerken yapılmış (hatta gönderilmiş) yerel değişiklik varsa eski veriyle üstüne yazma; kuyruk boşalınca yeniden çekilir.
        // persist(): yerinde değiştirilmiş ama henüz kuyruğa girmemiş alanlar (ayarlar) da önce kuyruğa alınır.
        this.persist();
        if (bulut.pending || bulut.version !== data.version) return;
        bulut.reset(data.people, data.entries);
        this.people = data.people; this.entries = data.entries;
        this.persist();
        if (!this.people.some(p => p.id === this.selectedId)) this.selectedId = this.preferredId();
        this.calculate();
      } catch (error) { console.error('Eşitleme hatası:', error); }
    },


    // ── Pencere ve bildirim ─────────────────────────────────────────────────

    closeModal() {
      if (this.chartPrev !== null) { this.selectedId = this.chartPrev; this.chartPrev = null; }
      this.modal = ''; this.editingEntry = null; this.editingPerson = null;
    },
    // Kaydedilen/silinen gün takvimde bir kez kısaca işaretlenir (yalnız sınıf; DOM'a dokunmaz)
    flash(date, ids) { this.flashKey = date; this.flashIds = ids || []; clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => { this.flashKey = ''; }, 700); },
    notify(message) { this.toast = message; clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.toast = '', 2600); }
  };
}
