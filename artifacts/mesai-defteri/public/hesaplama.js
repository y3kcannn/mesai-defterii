// HesaplamaEngine.php'nin tarayıcı sürümü. Tutarlar kuruş cinsinden, her kesinti en yakın kuruşa yuvarlanır.
const hesapla = (() => {
  const TAX_YEAR = 2026, SGK = 0.15, STAMP = 0.00759;
  const BRACKETS = [[19_000_000, 0.15], [40_000_000, 0.20], [150_000_000, 0.27], [530_000_000, 0.35], [Infinity, 0.40]];
  const MULT = { normal: 1.5, holiday: 1.0, bayram: 2.0 };
  const round = x => Math.round(+x.toPrecision(15)); // PHP round() ile aynı ön-yuvarlama
  const rate = (c, r) => round(c * r);
  const kurus = v => round(Number(v) * 100);
  const tl = c => Math.round(c) / 100;

  const progressiveTax = base => {
    let tax = 0, prev = 0;
    for (const [limit, r] of BRACKETS) {
      const part = Math.min(base, limit) - prev;
      if (part > 0) tax += rate(part, r);
      if (base <= limit) break;
      prev = limit;
    }
    return tax;
  };
  const taxOnAdditional = (cum, add) => add <= 0 ? 0 : Math.max(0, progressiveTax(cum + add) - progressiveTax(cum));
  const netFromGross = (g, cum) => g - rate(g, SGK) - taxOnAdditional(cum, g - rate(g, SGK)) - rate(g, STAMP);

  const grossForNet = (net, cum) => {
    let lo = 0, hi = Math.max(net * 2, 1_000_000);
    while (netFromGross(hi, cum) < net) hi *= 2;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); netFromGross(mid, cum) < net ? lo = mid + 1 : hi = mid; }
    const d = g => Math.abs(netFromGross(g, cum) - net);
    return [lo, Math.max(0, lo - 1)].sort((a, b) => d(a) - d(b) || a - b)[0];
  };

  // Bordro yöntemi (KSE bordrolarıyla doğrulandı): net saatlik = net maaş / (30 gün × günlük saat);
  // net mesai = net saatlik × saat × katsayı. Brüt, o ayın gelir vergisi dilimine göre net'ten brütleştirilir.
  const marginalRate = base => BRACKETS.find(([limit]) => base <= limit)[1];
  return ({ netSalary = 65000, dailyHours = 7.5, cumulativeTaxBase = 0, entries = [] }) => {
    const cum = kurus(cumulativeTaxBase);
    const monthlyGross = grossForNet(kurus(netSalary), cum);
    const monthlyTaxable = monthlyGross - rate(monthlyGross, SGK);
    const r = marginalRate(cum + monthlyTaxable);
    const netHourly = kurus(netSalary) / (30 * dailyHours);
    const hourly = netHourly / (1 - SGK - (1 - SGK) * r - STAMP);
    const weighted = entries.reduce((s, e) => s + MULT[e.type] * Number(e.hours), 0);
    const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
    const net = round(netHourly * weighted);
    const gross = entries.reduce((s, e) => s + round(hourly * MULT[e.type] * Number(e.hours)), 0);
    const sgk = rate(gross, SGK), stampTax = rate(gross, STAMP), incomeTax = gross - sgk - stampTax - net;
    return {
      monthlyGrossSalary: tl(monthlyGross), hourlyGross: round(hourly) / 100, totalHours: round(totalHours * 100) / 100,
      grossTotal: tl(gross), sgk: tl(sgk), incomeTaxBase: tl(gross - sgk), incomeTax: tl(incomeTax), stampTax: tl(stampTax),
      netTotal: tl(net), taxRate: r, taxYear: TAX_YEAR,
    };
  };
})();

