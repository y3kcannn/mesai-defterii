# Mesai Defteri

Personelin günlük mesai, tatil ve izin kayıtlarını tutan, bordro hesabı yapan Türkçe PWA.
Statik bir sitedir (Alpine.js); veriler Supabase'te tutulur ve cihazlar arasında anlık eşitlenir.

Canlı adres: https://y3kcannn.github.io/mesai-defterii/

## Klasörler

- `artifacts/mesai-defteri/public/` — uygulamanın kendisi (HTML, JS, CSS, ikonlar, service worker)
- `artifacts/mesai-defteri/scripts/build.mjs` — `public/` → `dist/` kopyalar, sürüm ekler (önbellek kırma, `version.json`)
- `artifacts/mesai-defteri/src/` — `pwa.css` (tailwind.css kaynağı) ve hesaplamanın PHP referans sürümü
- `supabase.sql` — veritabanı şeması (Supabase → SQL Editor'da çalıştırılabilir, tekrar çalıştırmak güvenlidir)

## Yerelde çalıştırma

Kurulum gerekmez:

```sh
cd artifacts/mesai-defteri/public
python3 -m http.server 8000
```

Sonra http://localhost:8000 adresini açın. Derlenmiş hâli denemek için:

```sh
node artifacts/mesai-defteri/scripts/build.mjs
cd artifacts/mesai-defteri/dist && python3 -m http.server 8000
```

## Yayın

`main` dalına her gönderimde `.github/workflows/pages.yml` siteyi derleyip GitHub Pages'e yayınlar
(Actions sekmesinden elle de çalıştırılabilir). Bağımlılık kurulumu yoktur. Açık uygulamalar yeni sürümü
`version.json` üzerinden fark edip kendini yeniler.
