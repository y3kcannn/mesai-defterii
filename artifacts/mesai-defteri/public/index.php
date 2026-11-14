<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#101718">
  <meta name="description" content="Şantiye mesai defteri — ekip, gün ve hakediş takibi.">
  <title>Mesai Defteri — Şantiye kayıtları</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/tailwind.css">
  <link rel="stylesheet" href="/app.css">
  <script defer src="/app.js"></script>
  <script defer src="/alpine.min.js"></script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 antialiased" x-data="mesaiDefteri()" x-init="init()" @keydown.escape.window="closeModal()">
  <div class="app-shell min-h-screen">
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 24V8h6l5 7 5-7h6v16h-6v-8l-5 6-5-6v8z"/><path d="M4 28h24"/></svg></div>
        <div><div class="brand-name">MESAI<span> / DEFTERİ</span></div><div class="brand-caption">SAHA KAYIT SİSTEMİ <i class="live-dot" :class="online?'':'offline'"></i> <span x-text="online?'ÇEVRİMİÇİ':'ÇEVRİMDIŞI'"></span></div></div>
      </div>
      <div class="top-meta"><span class="meta-label">ŞANTİYE</span><span class="site-name">Kuzey Blok · B2</span><span class="top-divider"></span><span class="clock-mark">TR</span><span class="meta-label" x-text="todayLabel"></span></div>
      <button class="top-action" @click="openPersonForm()" aria-label="Yeni personel"><span class="plus">+</span><span>Personel ekle</span></button>
    </header>

    <section class="people-strip">
      <div class="strip-label"><span class="tiny-kicker">EKİP</span><span class="crew-count" x-text="String(people.length).padStart(2,'0')"></span></div>
      <div class="person-tabs" role="tablist" aria-label="Personel seçimi">
        <template x-for="person in people" :key="person.id"><button class="person-tab" :class="{'selected': selectedId===person.id}" @click="selectPerson(person.id)" role="tab" :aria-selected="selectedId===person.id"><span class="person-initials" x-text="initials(person.name)"></span><span class="person-tab-name" x-text="person.name"></span><span class="tab-presence" :class="person.example ? 'example-dot':''"></span></button></template>
        <button class="add-person-tab" @click="openPersonForm()" aria-label="Personel ekle">＋ <span>Yeni kişi</span></button>
      </div>
      <div class="demo-tag" x-show="hasExamples"><span class="demo-pin"></span> ÖRNEK KAYITLAR</div>
    </section>

    <div class="workspace">
      <nav class="rail" aria-label="Ana gezinme">
        <div class="rail-group"><span class="rail-caption">DEFTER</span>
          <button class="rail-button" :class="{active: view==='ledger'}" @click="view='ledger'" title="Aylık defter"><span class="rail-icon"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4m8-4v4M4 10h16M8 14h3m-3 3h7"/></svg></span><span>Ay görünümü</span></button>
          <button class="rail-button" :class="{active: view==='people'}" @click="view='people'" title="Personel"><span class="rail-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-14a3 3 0 0 1 0 6m1 2a5 5 0 0 1 3 5v1"/></svg></span><span>Personel</span></button>
        </div>
        <div class="rail-bottom"><span class="rail-caption">YÖNETİM</span><button class="rail-button" :class="{active: view==='settings'}" @click="view='settings'" title="Ayarlar"><span class="rail-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.5 1a8 8 0 0 0-2.5-1.5L13.5 2h-4L9 5a8 8 0 0 0-2.5 1.5L4 5.5 2 9l2 1.5a7 7 0 0 0 0 3L2 15l2 3.5 2.5-1A8 8 0 0 0 9 19l.5 3h4l.5-3a8 8 0 0 0 2.5-1.5l2.5 1 2-3.5z"/></svg></span><span>Ayarlar</span></button>
          <div class="rail-footnote">v1.0 <span>·</span> SAHA</div>
        </div>
      </nav>

      <main class="main-panel" x-show="view==='ledger'" x-cloak>
        <div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> PERSONEL DEFTERİ <span class="eyebrow-slash">/</span> <span x-text="activePerson ? activePerson.name.toLocaleUpperCase('tr-TR') : 'EKİP SEÇİN'"></span></div><div class="heading-row"><h1><span x-text="monthName"></span><span class="year" x-text="year"></span></h1><span class="heading-chip"><i></i> AYLIK TAKİP</span></div></div><div class="month-controls"><button class="icon-button" @click="changeMonth(-1)" aria-label="Önceki ay"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button class="month-current" @click="goCurrentMonth()">BUGÜN</button><button class="icon-button" @click="changeMonth(1)" aria-label="Sonraki ay"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button></div></div>

        <div class="ledger-layout">
          <section class="calendar-panel">
            <div class="panel-topline"><div><span class="section-index">01</span><span class="section-title">GÜNLÜK ÇİZELGE</span></div><div class="calendar-hint"><span class="hint-dot"></span> Bir güne dokun · mesai gir</div></div>
            <div class="calendar-wrap" x-show="activePerson">
              <div class="weekday-row"><template x-for="day in weekdays" :key="day"><div x-text="day"></div></template></div>
              <div class="day-grid">
                <template x-for="cell in calendarCells" :key="cell.key"><button class="day-cell" :class="{'outside':!cell.current,'today':cell.today,'has-work':cell.entryCount,'has-holiday':cell.hasHoliday}" @click="cell.current && openEntry(cell.day)" :disabled="!cell.current"><span class="day-number" x-text="cell.day"></span><template x-if="cell.current && cell.entryCount"><span class="day-total" x-text="formatHours(cell.hours)"></span><span class="day-markers"><i :class="cell.hasBayram?'bayram':''"></i><i :class="cell.hasHoliday?'holiday':''"></i></span></template><template x-if="cell.current && !cell.entryCount && cell.today"><span class="today-label">BUGÜN</span></template></button></template>
              </div>
            </div>
            <div class="calendar-empty" x-show="!activePerson"><div class="empty-cross">＋</div><b>Önce bir personel seçin</b><p>Ekibinizin aylık mesai çizelgesi burada görünür.</p><button class="button-primary" @click="openPersonForm()">İlk personeli ekle <span>→</span></button></div>
             <div class="calendar-legend" x-show="activePerson"><span><i class="legend-dot normal"></i> Normal mesai</span><span><i class="legend-dot holiday"></i> Resmî tatil</span><span><i class="legend-dot bayram"></i> Bayram</span><span class="legend-note">Saat değerleri günlük toplamdır</span></div>
            <div class="calendar-footer"><span><b x-text="entryDayCount"></b> kayıtlı gün</span><span class="footer-divider"></span><span><b x-text="monthDays"></b> gün / bu ay</span><span class="footer-right">GÜN SEÇİLİNCE KAYIT AÇILIR <span>↗</span></span></div>
          </section>

          <aside class="summary-column">
           <section class="summary-card months-card"><div class="panel-topline"><div><span class="section-index">02</span><span class="section-title">AYLAR</span></div><span class="months-year" x-text="year"></span></div><div class="month-list"><template x-for="(name,index) in monthNames" :key="name"><button class="month-list-item" :class="{selected:month===index}" @click="month=index" :aria-pressed="month===index"><span class="month-label"><i></i><span x-text="name"></span></span><span class="month-list-count" x-text="monthEntryCount(index) || '—'"></span></button></template></div><div class="period-bottom"><span x-text="monthName+' '+year"></span><span class="period-days" x-text="monthDays+' GÜN'"></span></div></section>
            <section class="summary-card pay-card"><div class="panel-topline"><div><span class="section-index">03</span><span class="section-title">HAKEDİŞ ÖZETİ</span></div><span class="currency-tag">TRY</span></div>
               <div class="net-block"><div class="metric-label">TAHMİNİ NET MESAİ</div><div class="net-value" x-text="result ? money(result.netTotal) : '—' "></div><div class="net-sub"><span class="status-square" :class="calcError ? 'status-error':''"></span><span x-text="calcLoading ? 'Hesaplanıyor…' : calcError ? calcErrorMessage : 'Kesintiler sonrası · tahmini'"></span></div></div>
               <div class="metric-list"><div><span>Toplam mesai</span><b x-text="result ? formatHours(result.totalHours)+' sa' : '—'"></b></div><div><span>Brüt mesai</span><b x-text="result ? money(result.grossTotal) : '—'"></b></div><div><span>SGK + işsizlik</span><b class="deduction" x-text="result ? '− '+money(result.sgk) : '—'"></b></div><div><span>Gelir vergisi <small>TAHMİN</small></span><b class="deduction" x-text="result ? '− '+money(result.incomeTax) : '—'"></b></div><div><span>Damga vergisi <small>TAHMİN</small></span><b class="deduction" x-text="result ? '− '+money(result.stampTax) : '—'"></b></div></div>
               <div class="calc-warning"><span>i</span><p>2026 GİB ücret tarifesiyle, belirttiğiniz kesinti kurallarına göre tahmindir; asgari ücret istisnası ve diğer özel bordro uygulamaları dahil değildir. Resmî bordro değildir. <a href="https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv/yardim-kaynaklar/yararli-bilgiler/gelir-vergisi-tarifeleri/gelir-vergisi-tarifesi-2026.pdf" target="_blank" rel="noopener noreferrer">GİB tarifesi</a></p></div>
              <button class="retry-button" x-show="calcError" @click="calculate()">Yeniden dene <span>↗</span></button>
            </section>
             <section class="summary-card rate-card"><div class="panel-topline"><div><span class="section-index">04</span><span class="section-title">KAYIT PARAMETRELERİ</span></div><button class="edit-settings" @click="view='settings'">DÜZENLE ↗</button></div><div class="rate-row"><span>Aylık net ücret</span><b x-text="activePerson ? money(activePerson.netSalary) : '—'"></b></div><div class="rate-row"><span>Saatlik çıplak brüt</span><b x-text="result ? money(result.hourlyGross) : '—'"></b></div><div class="rate-row"><span>Günlük çalışma</span><b x-text="activePerson ? activePerson.dailyHours+' sa' : '—'"></b></div></section>
             <button class="quick-add" :disabled="!activePerson" @click="goCurrentMonth(); openEntry(today.getDate())"><span class="quick-plus">+</span><span><b>Mesai kaydı ekle</b><small>Bugün veya başka bir gün seçin</small></span><span class="quick-arrow">↗</span></button>
          </aside>
        </div>
      </main>

      <main class="main-panel management-panel" x-show="view==='people'" x-cloak>
        <div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> EKİP YÖNETİMİ</div><div class="heading-row"><h1>Personel <span class="year">listesi</span></h1></div></div><button class="button-primary" @click="openPersonForm()">＋ Yeni personel</button></div>
        <div class="manage-intro"><span class="section-index">01</span><span>SAHADAKİ EKİP</span><span class="manage-count" x-text="people.length+' KİŞİ'"></span></div>
        <div class="person-list" x-show="people.length"><template x-for="person in people" :key="person.id"><article class="person-row"><div class="person-initials large" x-text="initials(person.name)"></div><div class="person-info"><b x-text="person.name"></b><span x-text="person.role || 'Saha personeli'"></span></div><span class="example-badge" x-show="person.example">ÖRNEK</span><div class="person-rate"><small>AYLIK NET</small><b x-text="money(person.netSalary)"></b></div><div class="person-rate"><small>GÜNLÜK SAAT</small><b x-text="person.dailyHours+' sa' "></b></div><button class="row-edit" @click="openPersonForm(person)">Düzenle ↗</button><button class="row-remove" @click="removePerson(person)" aria-label="Personeli sil">×</button></article></template></div>
        <div class="empty-state" x-show="!people.length"><b>Henüz ekip kaydı yok</b><p>İlk personeli ekleyerek defteri oluşturmaya başlayın.</p><button class="button-primary" @click="openPersonForm()">Personel ekle →</button></div>
      </main>

      <main class="main-panel settings-panel" x-show="view==='settings'" x-cloak>
        <div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> DEFTER YÖNETİMİ</div><div class="heading-row"><h1>Hesap <span class="year">ayarları</span></h1></div></div><button class="button-secondary" @click="view='ledger'">← Deftere dön</button></div>
        <div class="settings-layout"><section class="settings-card"><div class="panel-topline"><div><span class="section-index">01</span><span class="section-title">ÜCRET VE VERGİ PARAMETRELERİ</span></div></div><p class="settings-desc">Seçili personelin hesaplamada kullanılan bilgileri. Değişiklikler otomatik kaydedilir.</p><template x-if="activePerson"><div class="settings-form"><label>Personel<select x-model="selectedId" @change="onPersonChange()"><template x-for="person in people" :key="person.id"><option :value="person.id" x-text="person.name"></option></template></select></label><label>Aylık net ücret <span class="input-unit">TL</span><input type="number" min="0" step="100" x-model.number="activePerson.netSalary" @change="savePersonSettings()"></label><label>Günlük çalışma saati <span class="input-unit">SAAT</span><input type="number" min="1" max="24" step="0.5" x-model.number="activePerson.dailyHours" @change="savePersonSettings()"></label><label>Önceki aylar kümülatif vergi matrahı <span class="input-unit">TL</span><input type="number" min="0" step="500" x-model.number="activePerson.cumulativeTaxBase" @change="savePersonSettings()"><small>Bu yıl, bu aydan önce oluşan toplam gelir vergisi matrahı.</small></label><div class="settings-saved" x-show="settingsSaved"><i></i> Ayarlar kaydedildi</div></div></template><div class="empty-state compact" x-show="!activePerson">Ayarları düzenlemek için önce personel ekleyin.</div></section>
          <section class="settings-card storage-card"><div class="panel-topline"><div><span class="section-index">02</span><span class="section-title">VERİ VE GİZLİLİK</span></div></div><div class="storage-icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8zM9 2v4m6-4v4M9 18v4m6-4v4"/></svg></div><h3>Kayıtlar bu cihazda</h3><p>Personel ve mesai kayıtları yalnızca bu tarayıcının yerel deposunda saklanır. Sunucuya yalnızca finansal hesaplama için gerekli özet gönderilir.</p><button class="text-action" @click="exportData()">Verileri dışa aktar <span>↓</span></button><div class="storage-divider"></div><button class="danger-action" @click="clearExamples()" :disabled="!hasExamples">Örnek kayıtları kaldır <span>×</span></button></section></div>
      </main>
    </div>
    <footer class="app-footer"><span>MESAI / DEFTERİ <i>·</i> ŞANTİYEDE NET KAYIT</span><span>GELİR VERGİSİ TAHMİNİDİR <b>·</b> RESMİ BORDRO DEĞİLDİR</span></footer>
  </div>

  <div class="modal-backdrop" x-show="modal==='entry' || modal==='person'" x-transition.opacity @click.self="closeModal()" x-cloak>
    <section class="dialog" x-show="modal==='entry'" x-transition.scale.95 @click.stop aria-modal="true" role="dialog" aria-labelledby="entry-title">
      <div class="dialog-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> GÜNLÜK KAYIT <span class="eyebrow-slash">/</span> <span x-text="activePerson?.name || ''"></span></div><h2 id="entry-title" x-text="editingEntry ? 'Mesaiyi düzenle' : 'Mesai gir'"></h2></div><button class="close-button" @click="closeModal()" aria-label="Kapat">×</button></div>
      <form @submit.prevent="saveEntry()"><label class="field-label">Tarih</label><div class="date-field"><span>GÜN</span><select x-model.number="entryForm.day"><template x-for="day in monthDays" :key="day"><option :value="day" x-text="String(day).padStart(2,'0')+'  /  '+weekdayFor(day)"></option></template></select><span class="date-month" x-text="monthName+' '+year"></span></div>
        <label class="field-label">Mesai türü</label><div class="type-options"><template x-for="type in entryTypes" :key="type.value"><button type="button" class="type-option" :class="[type.value, entryForm.type===type.value?'chosen':'']" @click="entryForm.type=type.value"><span class="type-marker"></span><span><b x-text="type.label"></b><small x-text="type.note"></small></span><span class="type-check">✓</span></button></template></div>
        <label class="field-label" for="hours-input">Mesai saati</label><div class="hours-input-wrap"><input id="hours-input" type="number" min="0.5" max="24" step="0.5" x-model.number="entryForm.hours" required placeholder="0"><span>SAAT</span></div>
        <div class="dialog-actions"><button type="button" class="button-secondary" @click="closeModal()">Vazgeç</button><button type="submit" class="button-primary" x-text="editingEntry ? 'Değişikliği kaydet →' : 'Kaydı oluştur →'"></button></div>
        <button type="button" class="delete-entry" x-show="editingEntry" @click="deleteEntry()">Bu mesai kaydını sil <span>×</span></button>
      </form>
    </section>
    <section class="dialog" x-show="modal==='person'" x-transition.scale.95 @click.stop aria-modal="true" role="dialog" aria-labelledby="person-title">
      <div class="dialog-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> EKİP KAYDI</div><h2 id="person-title" x-text="editingPerson ? 'Personeli düzenle' : 'Yeni personel' "></h2></div><button class="close-button" @click="closeModal()" aria-label="Kapat">×</button></div>
      <form @submit.prevent="savePerson()"><label class="field-label" for="person-name">Ad soyad</label><input class="form-input" id="person-name" type="text" x-model="personForm.name" required maxlength="60" placeholder="Örn. Murat Yılmaz"><label class="field-label" for="person-role">Görev / unvan <span class="optional">İSTEĞE BAĞLI</span></label><input class="form-input" id="person-role" type="text" x-model="personForm.role" maxlength="60" placeholder="Örn. Kalıp ustası"><div class="form-grid"><label class="field-label">Aylık net ücret <span class="input-unit">TL</span><input class="form-input" type="number" min="0" step="100" x-model.number="personForm.netSalary" required></label><label class="field-label">Günlük çalışma <span class="input-unit">SAAT</span><input class="form-input" type="number" min="1" max="24" step="0.5" x-model.number="personForm.dailyHours" required></label></div><label class="field-label">Önceki kümülatif vergi matrahı <span class="input-unit">TL</span><input class="form-input" type="number" min="0" step="500" x-model.number="personForm.cumulativeTaxBase" required></label><div class="dialog-actions"><button type="button" class="button-secondary" @click="closeModal()">Vazgeç</button><button type="submit" class="button-primary" x-text="editingPerson ? 'Kaydet →' : 'Personeli ekle →'"></button></div></form>
    </section>
  </div>
  <div class="toast" :class="{'show':toast}" x-text="toast" x-cloak></div>
</body>
</html>
