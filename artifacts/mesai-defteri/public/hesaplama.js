// Net fazla mesai hesabı.
//
// Saatlik net ücret = net maaş / aylık çalışma saati (30 gün × günlük 7,5 saat = 225 saat)
//
// Kurallar (günlük saat = 7,5):
//   Hafta içi        girilen saatin tamamı fazla mesai ................ ×1,5
//   Hafta tatili     çalışılan gün en az 7,5 saat sayılır, üstü de ..... ×1,5
//   Resmî tatil      ilk 7,5 saat ×1, aşan saatler ................... ×1,5
//   Bayram           ilk 7,5 saat ×2, aşan saatler ................... ×1,5
//   Çakışma          hafta tatili resmî tatil/bayrama denk gelirse tatil/bayram kuralı geçerlidir
//   Eksik mesai      önceki aydan aktarılan saatler, türünün katsayısıyla, bölünmeden
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
    ['eksik', 'Eksik mesai'],
  ];
  const yuvarla = x => Math.round(x * 100) / 100;
  const haftaGunu = tarih => { const [y, a, g] = String(tarih).split('-').map(Number); return new Date(y, a - 1, g).getDay(); };

  // Bir kaydı ödeme parçalarına ayırır: [{ satir, saat, katsayi }]
  const parcala = (kayit, { gunluk = 7.5, haftaTatili = 0 } = {}) => {
    const saat = Number(kayit.hours) || 0;
    if (saat <= 0) return [];
    if (kayit.paidMonth) return [{ satir: 'eksik', saat, katsayi: KATSAYI[kayit.type] ?? KATSAYI.normal }];
    if (kayit.type === 'holiday' || kayit.type === 'bayram') {
      const satir = kayit.type === 'bayram' ? 'bayram' : 'resmi-tatil';
      const parca = [{ satir, saat: Math.min(saat, gunluk), katsayi: KATSAYI[kayit.type] }];
      if (saat > gunluk) parca.push({ satir: 'tatil-asim', saat: yuvarla(saat - gunluk), katsayi: ASIM });
      return parca;
    }
    if (haftaGunu(kayit.date) === haftaTatili) return [{ satir: 'hafta-tatili', saat: Math.max(saat, gunluk), katsayi: KATSAYI.normal }];
    return [{ satir: 'hafta-ici', saat, katsayi: KATSAYI.normal }];
  };

  const hesap = ({ netSalary = 0, dailyHours = 7.5, restDay = 0, entries = [] }) => {
    const gunluk = Number(dailyHours) || 7.5;
    const saatlik = (Number(netSalary) || 0) / (30 * gunluk);
    const toplam = new Map(SATIRLAR.map(([k]) => [k, { saat: 0, birim: 0 }]));
    for (const kayit of entries) {
      for (const p of parcala(kayit, { gunluk, haftaTatili: restDay })) {
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
  return hesap;
})();
