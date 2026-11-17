function mesaiDefteri() {
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const sampleDate = new Date();
  const samplePrefix = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth()+1).padStart(2,'0')}-`;
  const sampleDay = day => `${samplePrefix}${String(day).padStart(2,'0')}`;
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
  const religious = [['Ramazan Bayramı','2025-03-30',3],['Kurban Bayramı','2025-06-06',4],['Ramazan Bayramı','2026-03-20',3],['Kurban Bayramı','2026-05-27',4],['Ramazan Bayramı','2027-03-09',3],['Kurban Bayramı','2027-05-16',4]];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const religiousDays = Object.fromEntries(religious.flatMap(([name,start,n]) => { const [y,m,d] = start.split('-').map(Number); return [[iso(new Date(y,m-1,d-1)),['arife',`${name} arifesi (yarım gün)`]], ...Array.from({length:n},(_,i)=>[iso(new Date(y,m-1,d+i)),['bayram',`${name} ${i+1}. gün`]])]; }));
  const holidayOf = date => religiousDays[date] || fixedHolidays[date.slice(5)] || null;
  let syncing = null, syncAgain = false; // sync() çağrıları sıraya alınır; eski bir çekme yenisinin üstüne yazmasın
  // Her senkronda tüm veri yeniden yazılmasın: içerik değişmediyse localStorage'a dokunulmaz
  const saved = {};
  const save = (key, value) => { try { const json = JSON.stringify(value); if (saved[key] === json) return; localStorage.setItem(key, json); saved[key] = json; } catch (error) { delete saved[key]; console.error('Cihaza kaydedilemedi:', error); } };
  const read = (key, fallback) => { try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  // Bozuk yerel kayıt (null, id'siz, tarihsiz) arayüzü kilitlemesin
  const validPeople = list => Array.isArray(list) ? list.filter(p => p && typeof p === 'object' && p.id) : [];
  const validEntries = list => Array.isArray(list) ? list.filter(e => e && typeof e === 'object' && e.id && e.personId && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];
  // Intl biçimleyicileri pahalı: bir kez kurulur (her hücrede yeniden değil)
  const hoursFmt = new Intl.NumberFormat('tr-TR', {maximumFractionDigits:1});
  const moneyFmt = new Intl.NumberFormat('tr-TR', {style:'currency',currency:'TRY',maximumFractionDigits:2});
  const longDateFmt = new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'long',year:'numeric'});
  const avatarCache = new Map(); // id|ad|boyut → SVG (her çizimde yeniden üretilmesin)
  let chartTimer = null;
  return {
     today:new Date(), online:navigator.onLine, syncPending:0, syncError:null, monthNames, view:'ledger', people:[], entries:[], selectedId:null, chartPrev:null, photoId:null, crop:null, theme:document.documentElement?.dataset.theme||'light', netShown:0,  year:new Date().getFullYear(), month:new Date().getMonth(),
     result:null, calcError:false, calcErrorMessage:'', calcRequest:0, modal:'', editingEntry:null, editingPerson:null,
     entryForm:{day:1,ym:'',carry:false,mode:'work',type:'normal',hours:2,hoursText:'2'}, hourPresets:[0.5,1,1.5,2,3,4], personForm:{name:'',role:'',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:0,startDate:'',leaveCarry:0}, toast:'', toastTimer:null, chartShow:{weekday:true,weekend:true,holiday:true,bayram:true,leave:true}, unlockedIds:[], pinInput:'', pinError:false, flashKey:'', flashIds:[], flashTimer:null, newPin:'', removePin:false,
     weekdays:['PZT','SAL','ÇAR','PER','CUM','CMT','PAZ'], dayNames:['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'], restDayOptions:[1,2,3,4,5,6,0], leaveTypes:[{value:'izin-yillik',label:'Yıllık izin',short:'YILLIK'},{value:'izin-ucretsiz',label:'Ücretsiz izin',short:'ÜCRETSİZ'},{value:'izin-rapor',label:'Raporlu',short:'RAPOR'},{value:'izin-mazeret',label:'Mazeret izni',short:'MAZERET'}], entryTypes:[{value:'normal',label:'Normal'},{value:'holiday',label:'Resmî tatil'},{value:'bayram',label:'Bayram'}],
    init(){
      const savedPeople=read('mesai-defteri-people',null), savedEntries=read('mesai-defteri-entries',null);
      if(savedPeople===null){this.people=demoPeople;this.entries=demoEntries;this.persist();}
      else {this.people=validPeople(savedPeople);this.entries=validEntries(savedEntries);}
      this.selectedId=this.preferredId();
      bulut.reset(this.people,this.entries);
      bulut.onChange=()=>{this.syncPending=bulut.pending;this.syncError=bulut.error;if(bulut.reachable!==null)this.online=bulut.reachable;};bulut.onChange();
      bulut.onDrained=()=>this.sync(); // kuyruk boşalınca uzaktaki değişiklikleri al
      if(bulut.on){this.sync();bulut.listen(()=>this.sync());}
      // iOS: sayfa arka plandan dönünce zamanlayıcılar/websocket güvenilmez; görünür olunca hemen gönder ve çek
      let wake=0;const resume=()=>{const now=Date.now();if(now-wake<1000)return;wake=now;this.today=new Date();if(!bulut.on)return;bulut.flush().catch(()=>{});this.sync();};
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume();});
      // Alpine: modal kapanırken yeniden açılınca iptal edilen x-show geçişi yakalanmamış hata olarak düşüyor; zararsız
      const cancelled=e=>{if((e.reason||e.error)?.isFromCancelledTransition)e.preventDefault();};window.addEventListener('unhandledrejection',cancelled);window.addEventListener('error',cancelled);
      window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
      window.addEventListener('storage',()=>{for(const k in saved)delete saved[k];}); // başka sekme yazdıysa bir dahakinde yeniden yaz
      this.$watch('selectedId',id=>{try{if(id&&this.chartPrev===null)localStorage.setItem('mesai-defteri-secili',id);}catch{}this.calculate();}); this.$watch('month',()=>{this.calculate();if(this.view==='chart')this.chartScroll();});this.$watch('view',v=>{if(v==='chart')this.chartScroll();});this.netShown=this.netSlip?.net||0;this.$watch('netSlip',s=>this.tweenNet(s?.net||0));window.addEventListener('resize',()=>{if(this.view==='chart')this.chartScroll();}); this.$watch('year',()=>this.calculate());
       window.addEventListener('online',()=>{this.online=true;bulut.flush().catch(()=>{});this.sync();this.calculate();});
       window.addEventListener('offline',()=>{this.online=false;});
      this.calculate();
      if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{}));
    },
    // Bu cihazda en son seçilen kişi (her telefon kendi kişisini hatırlar)
    preferredId(){let id=null;try{id=localStorage.getItem('mesai-defteri-secili');}catch{}return this.people.some(p=>p.id===id)?id:(this.people[0]?.id||null);},
    // Türkçe tutar girişi: '65.000,50', '65000,50', '65000.50' hepsi 65000.5
    parseMoney(v){let t=String(v??'').replace(/[^\d.,]/g,'');if(t.includes(',')){t=t.replace(/\./g,'').replace(',','.');}else if((t.match(/\./g)||[]).length>1||/\.\d{3}$/.test(t)){t=t.replace(/\./g,'');}const n=Math.round(parseFloat(t)*100)/100;return Number.isFinite(n)?n:0;},
    moneyInput(v){const n=Number(v);return Number.isFinite(n)&&n?n.toLocaleString('tr-TR',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2}):'';},
    get activePerson(){return this.people.find(p=>p.id===this.selectedId)||null;},
    // Maaş gizliliği: PIN'li kişinin tutarları PIN girilene kadar gizli (oturum boyunca açık kalır)
    isLocked(person){return !!person?.pinHash&&!this.unlockedIds.includes(person.id);},
    get salaryLocked(){return this.isLocked(this.activePerson);},
    async hashPin(id,pin){const data=new TextEncoder().encode(`mesai:${id}:${pin}`);const buf=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');},
    async tryUnlock(){const pin=String(this.pinInput).replace(/\D/g,'').slice(0,4);this.pinInput=pin;this.pinError=false;if(pin.length<4||!this.activePerson)return;if(await this.hashPin(this.activePerson.id,pin)===this.activePerson.pinHash){this.unlockedIds.push(this.activePerson.id);this.pinInput='';}else{this.pinError=true;this.pinInput='';}},
    pinPress(d){if(this.pinInput.length>=4)return;this.pinInput+=d;this.tryUnlock();},
    pinBack(){this.pinInput=this.pinInput.slice(0,-1);this.pinError=false;},
    pinKey(e){if(!this.salaryLocked||this.modal||this.view!=='ledger'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;if(/^\d$/.test(e.key))this.pinPress(e.key);else if(e.key==='Backspace')this.pinBack();},
    lockSalary(){this.unlockedIds=this.unlockedIds.filter(id=>id!==this.selectedId);},
    get syncLabel(){if(!this.online)return this.syncPending?`ÇEVRİMDIŞI · ${this.syncPending} BEKLİYOR`:'ÇEVRİMDIŞI';if(this.syncError)return 'HATA · YENİDEN DENENİYOR';if(this.syncPending)return 'KAYDEDİLİYOR…';return bulut.on?'KAYDEDİLDİ':'ÇEVRİMİÇİ';},
    get monthName(){return monthNames[this.month];},
    get monthDays(){return new Date(this.year,this.month+1,0).getDate();},
    get monthKey(){return `${this.year}-${String(this.month+1).padStart(2,'0')}`;},
    // Eksik mesai (paidMonth) kendi tarihinin değil ödendiği ayın hesabına girer
    isLeave(type){return String(type||'').startsWith('izin-');},
    leaveLabel(type){return this.leaveTypes.find(t=>t.value===type)?.label||'İzin';},
    // Resmî tatil / bayram gününde günlük çalışma saatini (7,5) aşan kısım normal fazla mesai (x1,5) sayılır.
    // Eksik mesai kayıtları birden fazla günü kapsayabildiği için bölünmez.
    get workEntries(){return this.monthEntries.filter(e=>!this.isLeave(e.type));},
    get leaveEntries(){return this.monthEntries.filter(e=>this.isLeave(e.type));},
    // Net ödeme dökümü: fazla mesai satırları net tutarla (net maaş / (30 × günlük saat) × saat × katsayı)
    // Net ödeme dökümü: satırlar hesaplama motorundan (hesaplama.js) gelir
    get netSlip(){const p=this.activePerson;if(!p||!this.result)return null;const salary=Number(p.netSalary)||0;return {salary,lines:this.result.lines,net:Math.round((salary-this.unpaidDeduction+this.result.netTotal)*100)/100};},
    // Yıllık izin (4857 s. İş Kanunu md. 53): 1-5 yıl 14, 5-15 yıl 20, 15+ yıl 26 gün; hak 1. yılı doldurunca doğar
    get leaveBalance(){const p=this.activePerson;if(!p)return null;const sd=String(p.startDate||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(sd))return {noStart:true};
      const [sy,sm,sdd]=sd.split('-').map(Number),start=new Date(sy,sm-1,sdd),now=this.today;let years=now.getFullYear()-sy;if(new Date(now.getFullYear(),sm-1,sdd)>now)years--;
      const yearStart=years>=1?new Date(sy+years,sm-1,sdd):start,next=new Date(sy+Math.max(years,0)+1,sm-1,sdd);
      const entitled=years<1?0:years<5?14:years<15?20:26,carry=Number(p.leaveCarry)||0;
      const ys=iso(yearStart),ye=iso(next),used=this.entries.filter(e=>e.personId===p.id&&e.type==='izin-yillik'&&e.date>=ys&&e.date<ye).length;
      const fmt=d=>longDateFmt.format(d);
      return {years,entitled,carry,used,left:entitled+carry-used,from:fmt(yearStart),next:fmt(next)};},
    // Ekip grafiği: kişi × gün tablosu (görüntülenen ay)
    get chartTodayDay(){const t=this.today;return t.getFullYear()===this.year&&t.getMonth()===this.month?t.getDate():0;},
    get chartDays(){const wd=['Pz','Pt','Sa','Ça','Pe','Cu','Ct'],today=this.chartTodayDay;return Array.from({length:this.monthDays},(_,i)=>{const d=i+1,h=holidayOf(this.dateKey(d));return {day:d,wd:wd[new Date(this.year,this.month,d).getDay()],cls:[h?'hol-'+h[0]:'',d===today?'today':''].join(' ')};});},
    get chartRows(){const short={'izin-yillik':'Y','izin-ucretsiz':'Ü','izin-rapor':'R','izin-mazeret':'M'};
      // Getter'lar her erişimde yeniden hesaplanır: döngü dışında bir kez okunur
      const mk=this.monthKey,days=this.monthDays,today=this.chartTodayDay,show=this.chartShow,year=this.year,month=this.month,keys=Array.from({length:days},(_,i)=>this.dateKey(i+1));
      const byPerson=new Map();for(const e of this.entries)if((e.paidMonth||e.date.slice(0,7))===mk){const l=byPerson.get(e.personId);l?l.push(e):byPerson.set(e.personId,[e]);}
      return this.people.map(p=>{const rest=p.restDay??0,flashOn=this.flashIds.includes(p.id);let total=0;
      const own=byPerson.get(p.id)||[],byDate=new Map();for(const e of own)if(!e.paidMonth&&!byDate.has(e.date))byDate.set(e.date,e);
      const cat=e=>{if(e.type!=='normal')return e.type;if(e.paidMonth)return 'weekday';const [y,m,d]=e.date.split('-').map(Number);return new Date(y,m-1,d).getDay()===rest?'weekend':'weekday';};for(const e of own)if(!this.isLeave(e.type)&&show[cat(e)])total+=this.paidHours(e,p);
      const cells=Array.from({length:days},(_,i)=>{const d=i+1,e=byDate.get(keys[i]),dt=new Date(year,month,d);const cls=[dt.getDay()===rest?'rest':'',d===today?'today':'',flashOn&&this.flashKey===keys[i]?'just-saved':''];let text='';
        if(e){if(this.isLeave(e.type)){if(show.leave){cls.push('leave');text=short[e.type]||'İ';}}else{const c=cat(e);if(show[c]){cls.push(c==='weekend'?'weekend':e.type);text=this.formatHours(this.paidHours(e,p));}}}return {day:d,cls:cls.join(' '),text};});
      return {id:p.id,name:p.name,first:this.firstName(p.name),av:this.avatar(p),cells,total:total?this.formatHours(total):'—'};});},
    // Maaştan düşülen günler: ücretsiz izin ve rapor (rapor ödeneği SGK'dan ayrıca ödenir)
    get unpaidDays(){return this.leaveEntries.filter(e=>e.type==='izin-ucretsiz'||e.type==='izin-rapor').length;},
    // Bordro 30 gün esaslı: eksik gün varsa ödenen gün = 31 çeken ayda en çok 30 olmak üzere ay günü − eksik gün, diğer aylarda 30 − eksik gün
    get deductedDays(){const n=this.unpaidDays;if(!n)return 0;const paid=this.monthDays===31?Math.min(30,31-n):30-n;return Math.max(0,30-Math.max(0,paid));},
    // Bordrodaki gibi: ücretsiz izin günü başına net maaş / 30 kesilir
    get unpaidDeduction(){return Math.round((Number(this.activePerson?.netSalary)||0)/30*this.deductedDays*100)/100;},
    get monthEntries(){if(!this.activePerson)return [];const id=this.selectedId,mk=this.monthKey;return this.entries.filter(e=>e.personId===id&&(e.paidMonth||e.date.slice(0,7))===mk);},
    // Bordrodaki gibi döküm: hafta içi / hafta sonu (kişinin hafta tatili) / resmî tatil / bayram / eksik mesai
    get breakdown(){const p=this.activePerson;if(!p)return [];const daily=Number(p.dailyHours)||7.5,rest=p.restDay??0;const rows=[['weekday','Hafta içi','normal'],['weekend','Hafta tatili','rest'],['holiday','Resmî tatil','holiday'],['bayram','Bayram','bayram'],['overflow','7,5 saati aşan (tatil)','normal']].map(([key,label,cls])=>({key,label,cls,hours:0}));const row=k=>rows.find(r=>r.key===k);
      const ROW={'hafta-ici':'weekday','hafta-tatili':'weekend','resmi-tatil':'holiday','bayram':'bayram','tatil-asim':'overflow'};
      for(const e of this.workEntries){const parts=hesapla.parcala(e,{gunluk:daily,haftaTatili:rest});if(e.paidMonth){rows.push({key:'carry-'+e.id,label:'Eksik mesai'+(e.type==='normal'?'':' · '+(this.entryTypes.find(t=>t.value===e.type)?.label||'')),cls:e.type==='normal'?'normal':e.type,hours:Number(e.hours)||0,entry:e});continue;}for(const p of parts)row(ROW[p.satir]).hours+=p.saat;}
      const out=rows.filter(r=>r.key!=='overflow'||r.hours).map(r=>({...r,days:r.hours/daily}));
      const leaves=this.leaveEntries;for(const t of this.leaveTypes){const n=leaves.filter(e=>e.type===t.value).length;if(n)out.push({key:t.value,label:t.label,cls:'leave '+t.value,hours:0,days:n,leave:true});}
      return out;},
    get breakdownTotal(){return this.breakdown.reduce((s,r)=>s+(r.leave?0:r.hours),0);},
    get carryEntries(){return this.monthEntries.filter(e=>e.paidMonth).sort((a,b)=>a.date.localeCompare(b.date));},
    get hasExamples(){return this.people.some(p=>p.example);},
    // Hesaba esas saat: hafta tatilinde çalışılan gün en az günlük saat (7,5) sayılır
    paidHours(e,p){if(!p||this.isLeave(e.type))return Number(e.hours)||0;return hesapla.parcala(e,{gunluk:Number(p.dailyHours)||7.5,haftaTatili:p.restDay??0}).reduce((s,x)=>s+x.saat,0);},
    cellText(c){if(!c.restWork)return this.formatHours(c.hours);const d=Number(this.activePerson?.dailyHours)||7.5,x=Math.round((c.hours-d)*100)/100;return x>0?'HT +'+this.formatHours(x):'HT';},
    get calendarCells(){
      const first=new Date(this.year,this.month,1), start=(first.getDay()+6)%7, days=this.monthDays, prevDays=new Date(this.year,this.month,0).getDate();
      const count=Math.ceil((start+days)/7)*7, rest=this.activePerson?.restDay??0, todayDay=this.chartTodayDay;
      // Ayın kayıtları güne göre bir kez gruplanır (her hücrede tüm kayıtları taramak yerine)
      const byDate=new Map();for(const e of this.monthEntries){const l=byDate.get(e.date);l?l.push(e):byDate.set(e.date,[e]);}
      return Array.from({length:count},(_,i)=>{const day=i-start+1,current=day>0&&day<=days,actualDay=day<1?prevDays+day:day>days?day-days:day;const dt=new Date(this.year,this.month,day);const key=`${dt.getFullYear()}-${dt.getMonth()}-${actualDay}`;const all=current?byDate.get(this.dateKey(day))||[]:[];const entries=all.filter(e=>!this.isLeave(e.type));const leave=all.find(e=>this.isLeave(e.type));const holiday=holidayOf(iso(dt));return {key,day:current?day:actualDay,current,weekend:dt.getDay()===rest,special:holiday?.[0]||'',specialName:holiday?.[1]||'',today:current&&day===todayDay,flash:current&&this.flashKey===this.dateKey(day)&&this.flashIds.includes(this.selectedId),entryCount:entries.length,hours:entries.reduce((s,e)=>s+this.paidHours(e,this.activePerson),0),restWork:current&&dt.getDay()===rest&&entries.some(e=>e.type==='normal'),hasHoliday:entries.some(e=>e.type==='holiday'),hasBayram:entries.some(e=>e.type==='bayram'),leave:leave?.type||'',leaveShort:leave?this.leaveTypes.find(t=>t.value===leave.type)?.short:''};});
    },
    dateKey(day){return `${this.year}-${String(this.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;},
    isToday(day){return this.today.getFullYear()===this.year&&this.today.getMonth()===this.month&&this.today.getDate()===day;},
    weekdayFor(day){return this.weekdays[(this.formDate(day).getDay()+6)%7];},
    // Mesai penceresinin gösterdiği ay (eksik mesai)
    formDate(day){const [y,m]=(this.entryForm.ym||this.monthKey).split('-').map(Number);return new Date(y,m-1,day);},
    get formMonthDays(){const d=this.formDate(1);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate();},
    get formMonthLabel(){const d=this.formDate(1);return monthNames[d.getMonth()]+' '+d.getFullYear();},
    openMulti(){if(!this.people.length)return;const now=new Date(),day=now.getFullYear()===this.year&&now.getMonth()===this.month?now.getDate():1;this.editingEntry=null;const special=holidayOf(this.dateKey(day))?.[0];this.entryForm={day,ym:this.monthKey,carry:false,mode:'work',multi:true,people:this.selectedId?[this.selectedId]:[],type:special==='bayram'?'bayram':special?'holiday':'normal',hours:0,hoursText:''};this.setHours(2);this.modal='entry';},
    toggleMultiPerson(id){const list=this.entryForm.people;this.entryForm.people=list.includes(id)?list.filter(x=>x!==id):[...list,id];},
    openCarry(){if(!this.activePerson)return;this.editingEntry=null;this.entryForm={day:0,ym:this.monthKey,carry:true,mode:'work',type:'normal',hours:0,hoursText:''};this.setHours(2);this.modal='entry';},
    formatHours(value){return hoursFmt.format(Number(value||0));},
    money(value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';return moneyFmt.format(Number(value));},
    // Haritacı avatarı (id'den sabit türetilir): ten, saç/baret, sakal/bıyık/gözlük, yelek ve elinde jalon, GNSS, prizma, total station ya da kumanda
    avatar(p,size=''){if(p?.photo)return `<span class="avatar photo ${size}" aria-hidden="true"><img src="${p.photo}" alt="" decoding="async"></span>`;const s=String(p?.id||'')+'|'+(p?.name||''),ck=s+'|'+size,hit=avatarCache.get(ck);if(hit)return hit;let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
      const pick=(n,k)=>Math.floor(h/k)%n,tone=pick(6,1)+1,sk=[['#f0cfb2','#dcae8f'],['#dcab87','#c4916c'],['#b88360','#9c6a49']][pick(3,7)],hc=['#2a2421','#4b3425','#6e5846','#8a8580'][pick(4,23)],
        style=pick(6,61),beard=pick(3,311)===0,acc=pick(4,1291),vest=pick(2,2087)===0,prop=pick(5,4099);
      const hair=[`<path fill="${hc}" d="M10.1 14.2c-.4-4.4 2.2-7.2 5.9-7.2s6.3 2.8 5.9 7.2c-.5-1.7-1.3-2.9-2.3-3.6-2.1.9-5.4.9-7.2 0-1 .7-1.8 1.9-2.3 3.6z"/>`,
        `<path fill="${hc}" d="M10 14.6c-.6-4.8 2.3-7.7 6.2-7.7 3.7 0 6.4 2.6 5.9 7.3-.4-1.6-1-2.7-1.8-3.4-2.8.2-5.6-.6-7.3-2.1-.6 1.9-1.6 3.8-3 5.9z"/>`,
        `<path fill="${hc}" d="M10.2 15.6c-.2-1.4.1-2.6.6-3.4l.8 3zM21.8 15.6c.2-1.4-.1-2.6-.6-3.4l-.8 3z"/><path fill="#e8bb4f" d="M9.5 12.8a6.5 6.5 0 0 1 13 0z"/><path fill="#cf9f34" d="M8.2 12.4h15.6v1.7H8.2zM15.3 6.4h1.4v6h-1.4z"/>`,
        `<path fill="${hc}" d="M9.6 16.2c-1-5.6 1.9-9.6 6.4-9.6s7.4 4 6.4 9.6c-.4-2.2-.9-3.6-1.6-4.6-1.6.7-3.4 1-4.8 1s-3.2-.3-4.8-1c-.7 1-1.2 2.4-1.6 4.6z"/>`,
        `<g fill="${hc}"><circle cx="11.2" cy="11.4" r="2.2"/><circle cx="13.6" cy="9" r="2.4"/><circle cx="16.4" cy="8.2" r="2.5"/><circle cx="19.1" cy="9.1" r="2.4"/><circle cx="21" cy="11.5" r="2.1"/></g>`,
        `<path fill="${hc}" d="M10.1 15.8c-.4-1.8-.2-3.6.6-4.7l.9 4.2zM21.9 15.8c.4-1.8.2-3.6-.6-4.7l-.9 4.2z"/>`];
      const beardP=beard?`<path fill="${hc}" d="M10.3 15.9c.3 3.9 2.7 6.2 5.7 6.2s5.4-2.3 5.7-6.2c-.6 1.3-1.4 2-2.2 2.2-.9-.9-2.1-1.3-3.5-1.3s-2.6.4-3.5 1.3c-.8-.2-1.6-.9-2.2-2.2z"/>`:'';
      const eyes=acc===1?`<path fill="#1b2023" d="M11.6 14.1h3.9l-.3 1.9c-.1.6-.6 1-1.2 1h-1c-.6 0-1.1-.4-1.2-1zM16.5 14.1h3.9l-.2 1.9c-.1.6-.6 1-1.2 1h-1c-.6 0-1.1-.4-1.2-1zM15.4 14.3h1.2v.6h-1.2z"/><path fill="#fff" opacity=".35" d="M12.2 14.5h1.2l-.9 1.2z"/>`
        :`<g fill="#2a2421"><circle cx="13.8" cy="15" r=".8"/><circle cx="18.2" cy="15" r=".8"/></g><path fill="none" stroke="${hc}" stroke-width=".85" stroke-linecap="round" d="M12.7 13.1h2.2M17.1 13.1h2.2"/>`;
      const must=acc===2?`<path fill="${hc}" d="M13.2 17.7c1-1 1.9-1.1 2.8-.5.9-.6 1.8-.5 2.8.5-.4.7-1.2.9-1.8.6-.4-.2-.7-.4-1-.4s-.6.2-1 .4c-.6.3-1.4.1-1.8-.6z"/>`:'';
      const vestP=vest?`<path fill="#f08a24" d="M5.6 32c.3-4.6 2.6-7.8 7-8.9l1.6 8.9zM26.4 32c-.3-4.6-2.6-7.8-7-8.9L17.8 32z"/><path fill="#eef2e8" d="M6.2 28.4h6.9l.2 1.3H6zM18.7 28.4h6.9l.2 1.3h-7.3z"/>`:'';
      const hand=(x,y)=>`<circle fill="${sk[0]}" cx="${x}" cy="${y}" r="1.7"/>`;
      const props=[
        `<g><path fill="#f3f1ea" d="M25.2 1.5h1.6V32h-1.6z"/><path fill="#d9483b" d="M25.2 1.5h1.6v4h-1.6zM25.2 9.5h1.6v4h-1.6zM25.2 17.5h1.6v4h-1.6zM25.2 25.5h1.6v4h-1.6z"/></g>${hand(26,24.6)}`,
        `<g><path fill="#9aa3a6" d="M25.3 6.5h1.4V32h-1.4z"/><ellipse fill="#f3f4f1" cx="26" cy="5.4" rx="3.6" ry="1.5"/><path fill="#cfd4d2" d="M22.4 5.4c0 .9 1.6 1.6 3.6 1.6s3.6-.7 3.6-1.6v.7c0 .9-1.6 1.6-3.6 1.6s-3.6-.7-3.6-1.6z"/><rect fill="#232a2d" x="23.4" y="17.5" width="5.2" height="3.6" rx=".5"/><rect fill="#7fc7e8" x="24.1" y="18.1" width="3.8" height="2.4"/></g>${hand(26,24.6)}`,
        `<g><path fill="#9aa3a6" d="M25.3 6.5h1.4V32h-1.4z"/><circle fill="#e9edec" cx="26" cy="4.6" r="2.9"/><circle fill="#e8a33a" cx="26" cy="4.6" r="1.9"/><path fill="#fff" opacity=".6" d="M25.1 3.6l1.6 1-1.6 1z"/></g>${hand(26,24.6)}`,
        `<g><path fill="none" stroke="#6f6a5e" stroke-width=".9" stroke-linecap="round" d="M5.6 24.5 2.5 32M5.6 24.5V32M5.6 24.5 8.7 32"/><rect fill="#e8bb4f" x="2.6" y="17.4" width="6" height="6.2" rx=".6"/><rect fill="#232a2d" x="3.6" y="19.2" width="2.3" height="1.9"/><circle fill="#232a2d" cx="7.4" cy="20.2" r="1.2"/><circle fill="#7fc7e8" cx="7.4" cy="20.2" r=".55"/><path fill="#cf9f34" d="M4 16.2h3.2v1.2H4z"/></g>`,
        `<g><rect fill="#232a2d" x="12.4" y="25.2" width="7.2" height="5.2" rx=".7"/><rect fill="#7fc7e8" x="13.1" y="25.9" width="5.8" height="3.1"/><path fill="#f08a24" d="M14 27.6l1.3-1 1.2.8 1.4-1.2v2.3H14z"/></g>${hand(12.4,28.6)}${hand(19.6,28.6)}`][prop];
      const back=prop===3?props:'',front=prop===3?'':props;
      const html=`<span class="avatar c${tone} ${size}" aria-hidden="true"><svg viewBox="0 0 32 32">${back}<path class="av-body" d="M4.5 32c0-6 4.6-9.4 11.5-9.4s11.5 3.4 11.5 9.4z"/>${vestP}<path fill="${sk[1]}" d="M13.7 18.8h4.6v4.4L16 25.4l-2.3-2.2z"/><circle fill="${sk[1]}" cx="10.3" cy="15.2" r="1.35"/><circle fill="${sk[1]}" cx="21.7" cy="15.2" r="1.35"/><ellipse fill="${sk[0]}" cx="16" cy="14.6" rx="5.8" ry="6.5"/>${beardP}${eyes}<path fill="none" stroke="${sk[1]}" stroke-width=".8" stroke-linecap="round" d="M16 15.6v1.5"/>${must}<path fill="none" stroke="${beard?'#e9c6ad':'#9a5a48'}" stroke-width=".85" stroke-linecap="round" d="M14.6 18.5q1.4 1 2.8 0"/>${hair[style]}${front}</svg></span>`;avatarCache.set(ck,html);return html;},
    firstName(name){return (name||'').trim().split(/\s+/)[0]||'';},
    // Tema: düğmeden yayılan dairesel geçiş
    toggleTheme(ev){const t=this.theme==='dark'?'light':'dark',r=document.documentElement,b=ev?.currentTarget?.getBoundingClientRect();
      if(b){const x=b.left+b.width/2,y=b.top+b.height/2;r.style.setProperty('--vx',x+'px');r.style.setProperty('--vy',y+'px');r.style.setProperty('--vr',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px');}
      const apply=()=>{this.theme=t;r.dataset.theme=t;try{localStorage.setItem('mesai-tema',t);}catch{}document.querySelector('meta[name=theme-color]')?.setAttribute('content',t==='dark'?'#101718':'#d7d3c8');document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.setAttribute('content',t==='dark'?'black-translucent':'default');};
      if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(apply);else apply();},
    // Ay değişince takvim/tablo kayma yönü
    slideMonth(dir){this.$nextTick(()=>document.querySelectorAll('.day-grid,.cg-table').forEach(el=>{el.classList.remove('slide-next','slide-prev');void el.offsetWidth;el.classList.add(dir>0?'slide-next':'slide-prev');}));},
    // Net tutar yumuşakça sayarak değişir
    tweenNet(to){const from=Number(this.netShown)||0;to=Number(to)||0;if(from===to)return;cancelAnimationFrame(this._netRaf);if(matchMedia('(prefers-reduced-motion: reduce)').matches||!from){this.netShown=to;return;}
      const t0=performance.now(),d=550,step=now=>{const k=Math.min(1,(now-t0)/d),e=1-Math.pow(1-k,3);this.netShown=Math.round((from+(to-from)*e)*100)/100;if(k<1)this._netRaf=requestAnimationFrame(step);else{this.netShown=to;const n=this.$refs.net;if(n){n.classList.remove('bump');void n.offsetWidth;n.classList.add('bump');}}};this._netRaf=requestAnimationFrame(step);},
    // Yerel kayıt yazılamasa bile (iOS gizli mod / kota) değişiklik bulut kuyruğuna mutlaka girer
    persist(){save('mesai-defteri-people',this.people);save('mesai-defteri-entries',this.entries);bulut.track(this.people,this.entries);},
    sync(){
      if(!bulut.on)return Promise.resolve();
      if(syncing){syncAgain=true;return syncing;}
      return syncing=(async()=>{do{syncAgain=false;await this.syncOnce();}while(syncAgain);})().finally(()=>{syncing=null;});
    },
    async syncOnce(){
      try{
        let data=await bulut.pull();
        // Bu cihaz ilk kez bağlanıyor ve bulut boşsa: yerel kayıtları yükle
        let first=false;try{first=!localStorage.getItem('mesai-defteri-bulut');}catch{}
        if(!data.people.length&&this.people.length&&first){bulut.reset([],[]);bulut.track(this.people,this.entries);data=await bulut.pull();}
        try{localStorage.setItem('mesai-defteri-bulut','1');}catch{}
        // Çekme sürerken yapılmış (hatta gönderilmiş) yerel değişiklik varsa eski veriyle üstüne yazma; kuyruk boşalınca yeniden çekilir.
        // persist(): yerinde değiştirilmiş ama henüz kuyruğa girmemiş alanlar (ayarlar) da önce kuyruğa alınır.
        this.persist();
        if(bulut.pending||bulut.version!==data.version)return;
        bulut.reset(data.people,data.entries);this.people=data.people;this.entries=data.entries;this.persist();
        if(!this.people.some(p=>p.id===this.selectedId))this.selectedId=this.preferredId();
        this.calculate();
      }catch(error){console.error('Eşitleme hatası:',error);}
    },
    selectPerson(id){this.selectedId=id;this.view='ledger';},
    // Tablodan hücreye dokununca o kişinin o günü açılır; kapanınca seçili kişi geri döner
    chartCell(id,day){if(this.chartPrev===null)this.chartPrev=this.selectedId||'';this.selectedId=id;this.openEntry(day);},
    // Gün sütunları görünen alana tam sığacak genişlikte; yarım sütun kalmaz
    chartFit(){const g=document.querySelector('.chart-grid'),t=g&&g.querySelector('.cg-table');if(!g||!g.clientWidth)return;const w=g.clientWidth-64-68-2,n=Math.max(1,Math.min(this.monthDays,Math.floor((w+1)/41)));t.style.setProperty('--col',((w-(n-1))/n).toFixed(2)+'px');},
    chartScroll(){clearTimeout(chartTimer);chartTimer=setTimeout(()=>{this.chartFit();const g=document.querySelector('.chart-grid'),c=g&&g.querySelector('.cg-day.today');if(!g||!g.clientWidth)return;g.scrollLeft=c?Math.max(0,c.offsetLeft-65-Math.floor((g.clientWidth-134)/2/c.offsetWidth)*(c.offsetWidth+1)):0;},60);},
    changeMonth(delta){const date=new Date(this.year,this.month+delta,1);this.month=date.getMonth();this.year=date.getFullYear();this.slideMonth(delta);},
    goCurrentMonth(){const d=(this.today.getFullYear()-this.year)*12+this.today.getMonth()-this.month;this.month=this.today.getMonth();this.year=this.today.getFullYear();if(d)this.slideMonth(d);},
    async calculate(){
      const person=this.activePerson;if(!person){this.result=null;this.calcError=false;return;}
       const request=++this.calcRequest;this.calcError=false;this.calcErrorMessage='';
      const entries=this.workEntries.map(e=>({date:e.date,type:e.type,hours:e.hours,paidMonth:e.paidMonth}));
      const payload={netSalary:Number(person.netSalary)||0,dailyHours:Number(person.dailyHours)||7.5,restDay:person.restDay??0,entries};
       try {const data=hesapla(payload);if(request===this.calcRequest)this.result=data;}
       catch(error){if(request===this.calcRequest){this.result=null;this.calcError=true;this.calcErrorMessage=error instanceof Error?error.message:'Hesaplanamadı';}console.error('Hesaplama hatası:',error);}
    },
    openEntry(day){if(!this.activePerson)return;const existing=this.monthEntries.find(entry=>!entry.paidMonth&&entry.date===this.dateKey(day));if(existing){this.editEntry(existing);return;}this.editingEntry=null;const special=holidayOf(this.dateKey(day))?.[0];this.entryForm={day,ym:this.monthKey,carry:false,mode:'work',type:special==='bayram'?'bayram':special?'holiday':'normal',hours:0,hoursText:'',restWorked:false};this.setHours(this.restMode?0:2);this.modal='entry';},
    setMode(mode){this.entryForm.mode=mode;this.entryForm.type=mode==='leave'?(this.isLeave(this.entryForm.type)?this.entryForm.type:'izin-yillik'):(this.isLeave(this.entryForm.type)?'normal':this.entryForm.type);},
    setHours(h){this.entryForm.hours=h;this.entryForm.hoursText=String(h).replace('.',',');},
    parseHours(){this.entryForm.hours=Number(String(this.entryForm.hoursText).replace(',','.'))||0;},
    get restHours(){return Number(this.activePerson?.dailyHours)||7.5;},
    get isRestDay(){return !this.entryForm.carry&&this.formDate(Number(this.entryForm.day)).getDay()===(this.activePerson?.restDay??0);},
    // Hafta tatili: çalışıldıysa günlük saat (7,5) otomatik eklenir, girilen saat bunun üstüne ek fazla mesaidir
    // Özel gün (hafta tatili, resmî tatil, bayram): çalışıldı işaretlenirse 1 gün (7,5 saat) o günün katsayısıyla yazılır
    get dayKind(){if(this.entryForm.carry)return 'normal';const h=holidayOf(this.formDate&&this.entryForm.day?iso(this.formDate(Number(this.entryForm.day))):'')?.[0];return h==='bayram'?'bayram':h?'holiday':this.isRestDay?'rest':'normal';},
    get restMode(){return !this.entryForm.multi&&!this.entryForm.carry&&this.entryForm.mode!=='leave'&&this.dayKind!=='normal';},
    get dayKindInfo(){return {rest:['Hafta tatilinde çalışıldı','×1,5','rest'],holiday:['Resmî tatilde çalışıldı','×1','holiday'],bayram:['Bayramda çalışıldı','×2','bayram']}[this.dayKind]||['','',''];},
    editEntry(entry){this.editingEntry=entry;this.entryForm={day:Number(entry.date.slice(-2)),ym:entry.date.slice(0,7),carry:!!entry.paidMonth,mode:this.isLeave(entry.type)?'leave':'work',type:entry.type,hours:0,hoursText:'',restWorked:!this.isLeave(entry.type)};const h=Number(entry.hours)||0;this.setHours(this.restMode?Math.max(0,Math.round((h-this.restHours)*100)/100):h);this.modal='entry';},
    saveEntry(){
      if(this.entryForm.multi)return this.saveMulti();
      if(!this.activePerson)return;
      const leave=this.entryForm.mode==='leave'&&!this.entryForm.carry;
      const rest=this.restMode;
      if(rest&&!this.entryForm.restWorked){if(this.editingEntry)this.deleteEntry();else this.closeModal();return;}
      const text=this.entryForm.hoursText;let hours=leave?0:text==null||String(text).trim()===''?Number(this.entryForm.hours):Number(String(text).trim().replace(',','.'));
      if(rest){if(!Number.isFinite(hours)||hours<0){this.notify('Geçerli bir süre girin');return;}hours=this.restHours+hours;this.entryForm.type=this.dayKind==='rest'?'normal':this.dayKind;}
      if(!leave&&(!Number.isFinite(hours)||hours<=0)){this.notify('Geçerli bir süre girin');return;}
      if(leave&&!this.isLeave(this.entryForm.type))this.entryForm.type='izin-yillik';
      if(!this.entryForm.carry&&hours>24){this.notify('Günlük en fazla 24 saat girilebilir');return;}
      this.entryForm.hours=Math.round(hours*100)/100;
      const day=Number(this.entryForm.day);
      if(!this.entryForm.carry&&!(Number.isInteger(day)&&day>=1&&day<=this.formMonthDays)){this.notify('Geçerli bir gün seçin');return;}
      const ym=this.entryForm.ym||this.monthKey,date=`${ym}-${String(this.entryForm.day).padStart(2,'0')}`;
      // Günlük kayıt: aynı kişinin aynı gününde ikinci kayıt açılmasın (takvim yalnızca birini düzenleyebiliyor)
      if(!this.entryForm.carry&&this.entries.some(e=>e.personId===this.selectedId&&!e.paidMonth&&e.date===date&&e.id!==this.editingEntry?.id)){this.notify('Bu güne ait kayıt var');return;}
      const entry={id:this.editingEntry?.id||`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId:this.selectedId,date,type:this.entryForm.type,hours:Number(this.entryForm.hours),...(this.entryForm.carry&&{paidMonth:this.editingEntry?.paidMonth||this.monthKey})};if(this.editingEntry){this.entries=this.entries.map(e=>e.id===entry.id?entry:e);}else this.entries.push(entry);this.persist();this.closeModal();this.calculate();if(!entry.paidMonth)this.flash(entry.date,[entry.personId]);this.notify(leave?this.leaveLabel(entry.type)+' kaydedildi':'Mesai kaydedildi');},
    saveMulti(){
      const f=this.entryForm,leave=f.mode==='leave',hours=leave?0:Number(String(f.hoursText??f.hours).trim().replace(',','.'));
      if(!f.people.length){this.notify('En az bir personel seçin');return;}
      if(!leave&&(!Number.isFinite(hours)||hours<=0||hours>24)){this.notify('Geçerli bir süre girin');return;}
      const date=`${f.ym||this.monthKey}-${String(f.day).padStart(2,'0')}`;let added=0;const skipped=[];
      for(const personId of f.people){if(this.entries.some(e=>e.personId===personId&&!e.paidMonth&&e.date===date)){skipped.push(this.people.find(p=>p.id===personId)?.name);continue;}const p=this.people.find(x=>x.id===personId),daily=Number(p?.dailyHours)||7.5,[yy,mm,dd]=date.split('-').map(Number),restDay=!leave&&f.type==='normal'&&new Date(yy,mm-1,dd).getDay()===(p?.restDay??0);this.entries.push({id:`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId,date,type:f.type,hours:Math.round((restDay?daily+hours:hours)*100)/100});added++;}
      this.persist();this.closeModal();this.calculate();this.flash(date,f.people);
      this.notify(skipped.length?`${added} kişiye eklendi · ${skipped.join(', ')} için kayıt mevcut`:`${added} kişiye ${leave?this.leaveLabel(f.type).toLocaleLowerCase('tr-TR'):'mesai'} eklendi`);},
    deleteEntry(){if(!this.editingEntry)return;const gone=this.editingEntry;this.entries=this.entries.filter(e=>e.id!==this.editingEntry.id);this.persist();this.closeModal();this.calculate();if(!gone.paidMonth)this.flash(gone.date,[gone.personId]);this.notify('Kayıt silindi');},
     openPersonForm(person=null){this.editingPerson=person;this.newPin='';this.removePin=false;this.personForm=person?{restDay:0,...person}:{name:'',role:'',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:0,startDate:'',leaveCarry:0};this.modal='person';},
    // Profil fotoğrafı: ortadan kare kırpılır (portrede yüz için biraz yukarıdan), 480 px JPEG (en fazla ~100 KB)
    // Fotoğraf önizleme: avatara dokununca büyük görünür, buradan değiştirilir ya da kaldırılır
    get photoPerson(){return this.people.find(p=>p.id===this.photoId)||null;},
    openPhoto(id){this.photoId=id;this.modal='photo';},
    setPersonPhoto(id,photo){this.people=this.people.map(p=>p.id===id?{...p,photo}:p);this.persist();this.notify(photo?'Fotoğraf güncellendi':'Fotoğraf kaldırıldı');},
    // Fotoğraf seçilince kırpma ekranı açılır: sürükle ve yakınlaştır, kare alan kaydedilir
    pickPhoto(ev){const f=ev.target.files?.[0];ev.target.value='';if(!f)return;const url=URL.createObjectURL(f),img=new Image();
      img.onload=()=>{this._cropImg=img;this.crop={src:url,w:img.width,h:img.height,zoom:1,x:0,y:0,back:this.modal};this.modal='crop';this.$nextTick(()=>this.cropReset());};
      img.onerror=()=>{URL.revokeObjectURL(url);this.notify('Fotoğraf okunamadı');};img.src=url;},
    cropBox(){return this.$refs.cropBox?.clientWidth||300;},
    cropScale(){const c=this.crop;return this.cropBox()/Math.min(c.w,c.h)*c.zoom;},
    cropClamp(){const c=this.crop,V=this.cropBox(),s=this.cropScale();c.x=Math.min(0,Math.max(V-c.w*s,c.x));c.y=Math.min(0,Math.max(V-c.h*s,c.y));},
    cropReset(){const c=this.crop,V=this.cropBox(),s=this.cropScale();c.x=(V-c.w*s)/2;c.y=c.h>c.w?(V-c.h*s)*.3:(V-c.h*s)/2;this.cropClamp();},
    get cropStyle(){const c=this.crop;if(!c)return '';const s=this.cropScale();return `width:${c.w*s}px;height:${c.h*s}px;transform:translate(${c.x}px,${c.y}px)`;},
    setCropZoom(z,cx,cy){const c=this.crop,V=this.cropBox(),s0=this.cropScale();z=Math.min(4,Math.max(1,z));cx??=V/2;cy??=V/2;const ix=(cx-c.x)/s0,iy=(cy-c.y)/s0;c.zoom=z;const s1=this.cropScale();c.x=cx-ix*s1;c.y=cy-iy*s1;this.cropClamp();},
    cropDown(e){e.currentTarget.setPointerCapture?.(e.pointerId);(this._ptr||=new Map()).set(e.pointerId,{x:e.clientX,y:e.clientY});},
    cropMove(e){const m=this._ptr;if(!m?.has(e.pointerId))return;const prev=m.get(e.pointerId),cur={x:e.clientX,y:e.clientY};
      if(m.size===1){this.crop.x+=cur.x-prev.x;this.crop.y+=cur.y-prev.y;this.cropClamp();}
      else if(m.size===2){const o=[...m.entries()].find(([k])=>k!==e.pointerId)[1],d0=Math.hypot(prev.x-o.x,prev.y-o.y),d1=Math.hypot(cur.x-o.x,cur.y-o.y),r=e.currentTarget.getBoundingClientRect();if(d0>0)this.setCropZoom(this.crop.zoom*d1/d0,(cur.x+o.x)/2-r.left,(cur.y+o.y)/2-r.top);}
      m.set(e.pointerId,cur);},
    cropUp(e){this._ptr?.delete(e.pointerId);},
    cropWheel(e){const r=e.currentTarget.getBoundingClientRect();this.setCropZoom(this.crop.zoom*(e.deltaY<0?1.1:1/1.1),e.clientX-r.left,e.clientY-r.top);},
    cropCancel(){URL.revokeObjectURL(this.crop?.src);const back=this.crop?.back;this.crop=null;this._ptr=null;this.modal=back||'';},
    cropSave(){const c=this.crop,s=this.cropScale(),V=this.cropBox(),cv=document.createElement('canvas');cv.width=cv.height=480;const g=cv.getContext('2d');g.imageSmoothingQuality='high';
      g.drawImage(this._cropImg,-c.x/s,-c.y/s,V/s,V/s,0,0,480,480);let q=.85,d=cv.toDataURL('image/jpeg',q);while(d.length>100000&&q>.4){q-=.1;d=cv.toDataURL('image/jpeg',q);}
      const back=c.back;URL.revokeObjectURL(c.src);this.crop=null;this._ptr=null;this.modal=back||'';
      if(back==='photo'&&this.photoId)this.setPersonPhoto(this.photoId,d);else this.personForm={...this.personForm,photo:d};},
    async savePerson(){const name=String(this.personForm.name||'').trim();if(!name)return;const pin=String(this.newPin||'').trim();if(pin&&!/^\d{4}$/.test(pin)){this.notify('PIN 4 haneli rakam olmalı');return;}const locked=!!this.editingPerson&&this.isLocked(this.editingPerson);const wasEditing=!!this.editingPerson;const record={id:this.editingPerson?.id||`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name,role:String(this.personForm.role||'').trim(),netSalary:Number(this.personForm.netSalary)||65000,dailyHours:Number(this.personForm.dailyHours)||7.5,restDay:Number(this.personForm.restDay)||0,cumulativeTaxBase:Number(this.personForm.cumulativeTaxBase)||0,startDate:String(this.personForm.startDate||''),leaveCarry:Number(this.personForm.leaveCarry)||0,example:false,...(this.personForm.photo!==undefined&&{photo:this.personForm.photo||''})};if(locked){record.netSalary=this.editingPerson.netSalary;record.cumulativeTaxBase=this.editingPerson.cumulativeTaxBase;}const keep=this.editingPerson?.pinHash;if(pin&&!locked){record.pinHash=await this.hashPin(record.id,pin);if(!this.unlockedIds.includes(record.id))this.unlockedIds.push(record.id);}else if(keep&&!(this.removePin&&!locked))record.pinHash=keep;if(this.editingPerson){this.people=this.people.map(p=>p.id===record.id?record:p);}else{this.people.push(record);this.selectedId=record.id;}this.persist();this.closeModal();this.view='ledger';this.calculate();this.notify(wasEditing?'Personel bilgileri güncellendi':'Personel eklendi');},
    removePerson(person){if(!confirm(`${person.name} ve tüm kayıtları silinsin mi?`))return;this.people=this.people.filter(p=>p.id!==person.id);this.entries=this.entries.filter(e=>e.personId!==person.id);if(this.selectedId===person.id)this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Personel silindi');},
    clearExamples(){if(!this.hasExamples)return;if(!confirm('Örnek veriler silinsin mi?'))return;const ids=this.people.filter(p=>p.example).map(p=>p.id);this.people=this.people.filter(p=>!p.example);this.entries=this.entries.filter(e=>!ids.includes(e.personId));if(ids.includes(this.selectedId))this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Örnek veriler silindi');},
    exportData(){const blob=new Blob([JSON.stringify({people:this.people,entries:this.entries,...(bulut.failed?.length&&{unsent:bulut.failed}),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mesai-defteri-yedek.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);this.notify('Yedek indirildi');},
    closeModal(){if(this.chartPrev!==null){this.selectedId=this.chartPrev;this.chartPrev=null;}this.modal='';this.editingEntry=null;this.editingPerson=null;},
    // Kaydedilen/silinen gün takvimde bir kez kısaca işaretlenir (yalnız sınıf; DOM'a dokunmaz)
    flash(date,ids){this.flashKey=date;this.flashIds=ids||[];clearTimeout(this.flashTimer);this.flashTimer=setTimeout(()=>{this.flashKey='';},700);},
    notify(message){this.toast=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast='',2600);}
  };
}
