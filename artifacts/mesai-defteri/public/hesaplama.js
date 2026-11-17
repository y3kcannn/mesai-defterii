// Net fazla mesai hesabı.
//
// Saatlik net ücret = net maaş / aylık çalışma saati (30 gün × günlük 7,5 saat = 225 saat)
//
// Kurallar (günlük saat = 7,5):
//   Hafta içi        girilen saatin tamamı fazla mesai ................ ×1,5
//   Hafta tatili     çalışılan gün 1 tam gün (7,5 saat) ................ ×1,5, aşan saatler hafta içi ×1,5
//   Resmî tatil      ilk 7,5 saat ×1, aşan saatler ................... ×1,5
//   Bayram           ilk 7,5 saat ×2, aşan saatler ................... ×1,5
//   İzinli hafta     hafta tatilinden önceki 6 günde izin varsa izin günü hafta tatili sayılır: o hafta tatilinde
//                    çalışılan ilk 7,5 saat ödenmez (normal iş günü), aşan saatler hafta içi ×1,5
//   Çakışma          hafta tatili resmî tatil/bayrama denk gelirse tatil/bayram kuralı geçerlidir
//   Devreden mesai   takvimdeki gün sonraki aya devredilirse kendi kurallarıyla o ayın bordrosuna girer;
//                    takvimde olmayan saatler (tarih YYYY-AA-00) türünün katsayısıyla, bölünmeden
//
// Bordrodaki gibi her satır ayrı yuvarlanır; net toplam satırların toplamıdır.
// Tatilde 7,5 saati aşan saatler bordroda hafta içi fazla mesaisine yazıldığı için ödeme satırında oraya eklenir.
// KSE bordrolarıyla doğrulandı: Nisan, Mayıs, Temmuz, Ağustos 2026 (kuruşu kuruşuna).
const hesapla = (() => {
  const KATSAYI = { normal: 1.5, holiday: 1, bayram: 2 };
  const ASIM = 1.5;
  const SATIRLAR = [
    ['hafta-ici', 'Hafta içi'],
    ['hafta-tatili', 'Hafta tatili'],
    ['resmi-tatil', 'Resmî tatil'],
    ['bayram', 'Bayram'],
    ['tatil-asim', 'Tatilde 7,5 saat üstü'],
    ['eksik', 'Devreden mesai'],
  ];
  const yuvarla = x => Math.round(x * 100) / 100;
  const haftaGunu = tarih => { const [y, a, g] = String(tarih).split('-').map(Number); return new Date(y, a - 1, g).getDay(); };
  const gunOnce = (tarih, n) => { const [y, a, g] = String(tarih).split('-').map(Number), d = new Date(y, a - 1, g - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // Hafta tatilinden önceki 6 günden birinde izin var mı
  const izinliHafta = (tarih, izinler) => !!izinler?.size && [1, 2, 3, 4, 5, 6].some(n => izinler.has(gunOnce(tarih, n)));

  // Bir kaydı ödeme parçalarına ayırır: [{ satir, saat, katsayi }]
  const parcala = (kayit, { gunluk = 7.5, haftaTatili = 0, izinler } = {}) => {
    const saat = Number(kayit.hours) || 0;
    if (saat <= 0) return [];
    // Eski tip devreden mesai (yalnız saat, tarih YYYY-AA-00): türünün katsayısıyla, bölünmeden
    if (kayit.paidMonth && String(kayit.date).endsWith('-00')) return [{ satir: 'eksik', saat, katsayi: KATSAYI[kayit.type] ?? KATSAYI.normal }];
    if (kayit.type === 'holiday' || kayit.type === 'bayram') {
      const satir = kayit.type === 'bayram' ? 'bayram' : 'resmi-tatil';
      const parca = [{ satir, saat: Math.min(saat, gunluk), katsayi: KATSAYI[kayit.type] }];
      if (saat > gunluk) parca.push({ satir: 'tatil-asim', saat: yuvarla(saat - gunluk), katsayi: ASIM });
      return parca;
    }
    if (haftaGunu(kayit.date) === haftaTatili && izinliHafta(kayit.date, izinler)) {
      // Haftada izin var: izin günü hafta tatili sayıldığından bu gün normal iş günüdür
      return saat > gunluk ? [{ satir: 'hafta-ici', saat: yuvarla(saat - gunluk), katsayi: KATSAYI.normal }] : [];
    }
    if (haftaGunu(kayit.date) === haftaTatili) {
      // Bordrodaki gibi: hafta tatili tam gün (7,5 saat) yazılır, aşan saatler hafta içi fazla mesaisine gider
      const parca = [{ satir: 'hafta-tatili', saat: gunluk, katsayi: KATSAYI.normal }];
      if (saat > gunluk) parca.push({ satir: 'tatil-asim', saat: yuvarla(saat - gunluk), katsayi: ASIM });
      return parca;
    }
    return [{ satir: 'hafta-ici', saat, katsayi: KATSAYI.normal }];
  };

  const hesap = ({ netSalary = 0, dailyHours = 7.5, restDay = 0, entries = [], leaveDates = [] }) => {
    const izinler = new Set(leaveDates);
    const gunluk = Number(dailyHours) || 7.5;
    const saatlik = (Number(netSalary) || 0) / (30 * gunluk);
    const toplam = new Map(SATIRLAR.map(([k]) => [k, { saat: 0, birim: 0 }]));
    for (const kayit of entries) {
      for (const p of parcala(kayit, { gunluk, haftaTatili: restDay, izinler })) {
        const t = toplam.get(p.satir);
        t.saat += p.saat;
        t.birim += p.saat * p.katsayi;
      }
    }
    const asim = toplam.get('tatil-asim'), ici = toplam.get('hafta-ici');
    ici.saat += asim.saat; ici.birim += asim.birim; asim.saat = asim.birim = 0;
    const lines = SATIRLAR
      .map(([key, label]) => ({ key, label, hours: yuvarla(toplam.get(key).saat), amount: yuvarla(saatlik * toplam.get(key).birim) }))
      .filter(l => l.hours > 0);
    const netTotal = yuvarla(lines.reduce((s, l) => s + l.amount, 0));
    return {
      hourlyNet: yuvarla(saatlik),
      totalHours: yuvarla(lines.reduce((s, l) => s + l.hours, 0)),
      netTotal,
      lines,
    };
  };
  hesap.parcala = parcala;
  hesap.izinliHafta = izinliHafta;
  return hesap;
})();
