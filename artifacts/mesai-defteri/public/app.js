function mesaiDefteri() {
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const sampleDate = new Date();
  const samplePrefix = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth()+1).padStart(2,'0')}-`;
  const sampleDay = day => `${samplePrefix}${String(day).padStart(2,'0')}`;
  const demoPeople = [
    {id:'demo-ali',name:'Ali Demir',role:'Kalıp ustası',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true},
    {id:'demo-emre',name:'Emre Kaya',role:'Demir ustası',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true},
    {id:'demo-hasan',name:'Hasan Yıldız',role:'Şantiye işçisi',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:680000,example:true}
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
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.error('Yerel kayıt yazılamadı:', error); } };
  const read = (key, fallback) => { try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  return {
     today:new Date(), online:navigator.onLine, syncPending:0, syncError:null, monthNames, view:'ledger', people:[], entries:[], selectedId:null, year:new Date().getFullYear(), month:new Date().getMonth(),
     result:null, calcLoading:false, calcError:false, calcErrorMessage:'', calcRequest:0, settingsSaved:false, modal:'', editingEntry:null, editingPerson:null,
     entryForm:{day:1,ym:'',carry:false,mode:'work',type:'normal',hours:2,hoursText:'2'}, hourPresets:[0.5,1,1.5,2,3,4], personForm:{name:'',role:'',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:0,startDate:''}, toast:'', toastTimer:null, payroll:null, unlockedIds:[], pinInput:'', pinError:false, newPin:'', removePin:false,
     weekdays:['PZT','SAL','ÇAR','PER','CUM','CMT','PAZ'], dayNames:['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'], restDayOptions:[1,2,3,4,5,6,0], leaveTypes:[{value:'izin-yillik',label:'Yıllık izin',short:'YILLIK'},{value:'izin-ucretsiz',label:'Ücretsiz izin',short:'ÜCRETSİZ'},{value:'izin-rapor',label:'Raporlu',short:'RAPOR'},{value:'izin-mazeret',label:'Mazeret izni',short:'MAZERET'}], entryTypes:[{value:'normal',label:'Normal',note:'Hafta içi veya hafta sonu'},{value:'holiday',label:'Resmî tatil',note:'Resmî tatil çalışması'},{value:'bayram',label:'Bayram',note:'Bayram çalışması'}],
    init(){
      const savedPeople=read('mesai-defteri-people',null), savedEntries=read('mesai-defteri-entries',null);
      if(savedPeople===null){this.people=demoPeople;this.entries=demoEntries;this.persist();}
      else {this.people=Array.isArray(savedPeople)?savedPeople:[];this.entries=Array.isArray(savedEntries)?savedEntries:[];}
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
      window.addEventListener('focus',resume); window.addEventListener('pageshow',resume);
      this.$watch('selectedId',id=>{try{if(id)localStorage.setItem('mesai-defteri-secili',id);}catch{}this.calculate();}); this.$watch('month',()=>this.calculate()); this.$watch('year',()=>this.calculate());
       window.addEventListener('online',()=>{this.online=true;bulut.flush().catch(()=>{});this.sync();this.calculate();});
       window.addEventListener('offline',()=>{this.online=false;});
      this.calculate();
      if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
    },
    // Bu cihazda en son seçilen kişi (her telefon kendi kişisini hatırlar)
    preferredId(){let id=null;try{id=localStorage.getItem('mesai-defteri-secili');}catch{}return this.people.some(p=>p.id===id)?id:(this.people[0]?.id||null);},
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
    get syncLabel(){if(!this.online)return this.syncPending?`ÇEVRİMDIŞI · ${this.syncPending} BEKLİYOR`:'ÇEVRİMDIŞI';if(this.syncError)return 'KAYDEDİLEMEDİ · TEKRAR DENENİYOR';if(this.syncPending)return 'KAYDEDİLİYOR…';return bulut.on?'KAYDEDİLDİ':'ÇEVRİMİÇİ';},
    get monthName(){return monthNames[this.month];},
    get monthDays(){return new Date(this.year,this.month+1,0).getDate();},
    get todayLabel(){return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',year:'numeric'}).format(this.today).toLocaleUpperCase('tr-TR');},
    get monthKey(){return `${this.year}-${String(this.month+1).padStart(2,'0')}`;},
    // Eksik mesai (paidMonth) kendi tarihinin değil ödendiği ayın hesabına girer
    isLeave(type){return String(type||'').startsWith('izin-');},
    leaveLabel(type){return this.leaveTypes.find(t=>t.value===type)?.label||'İzin';},
    // Resmî tatil / bayram gününde günlük çalışma saatini (7,5) aşan kısım normal fazla mesai (x1,5) sayılır.
    // Eksik mesai kayıtları birden fazla günü kapsayabildiği için bölünmez.
    get payEntries(){const daily=Number(this.activePerson?.dailyHours)||7.5;return this.workEntries.flatMap(e=>{const h=Number(e.hours)||0;if(e.paidMonth||e.type==='normal'||h<=daily)return [{id:e.id,type:e.type,hours:h,date:e.date,paidMonth:e.paidMonth,src:e}];return [{id:e.id,type:e.type,hours:daily,date:e.date,src:e},{id:e.id+'-asim',type:'normal',hours:Math.round((h-daily)*100)/100,date:e.date,src:e,overflow:true}];});},
    get workEntries(){return this.monthEntries.filter(e=>!this.isLeave(e.type));},
    get leaveEntries(){return this.monthEntries.filter(e=>this.isLeave(e.type));},
    // Yıl içindeki kaçıncı çalışma ayı (asgari ücret istisnası kümülatifi işe girişten başlar)
    get payrollMonthIndex(){const sd=String(this.activePerson?.startDate||'');const [y,m]=sd.split('-').map(Number);if(y===this.year&&m)return Math.max(1,this.month+2-m);return this.month+1;},
    // Bordro görünümü: kazanç günleri (30 gün esası) ve fazla çalışma satırları, KSE bordro düzeniyle
    get payslip(){const p=this.activePerson,pr=this.payroll;if(!p||!pr)return null;const rest=p.restDay??0,daily=Number(p.dailyHours)||7.5;
      let ht=0,rt=0;for(let d=1;d<=this.monthDays;d++){const dt=new Date(this.year,this.month,d);if(holidayOf(iso(dt)))rt++;else if(dt.getDay()===rest)ht++;}
      const cnt=t=>this.leaveEntries.filter(e=>e.type===t).length,unpaid=cnt('izin-ucretsiz'),paidLeave=cnt('izin-yillik')+cnt('izin-mazeret'),rapor=cnt('izin-rapor');
      const paidDays=Math.max(1,30-unpaid),dayGross=pr.normalBrut/paidDays,r2=x=>Math.round(x*100)/100;
      const normalDays=Math.max(0,30-ht-rt-unpaid-paidLeave);
      const earn=[['Normal',normalDays],['Hafta tatili',ht],['Resmî tatil',rt],['Ücretli izin',paidLeave]].map(([label,days])=>({label,days,amount:r2(days*dayGross)}));
      earn[0].amount=r2(pr.normalBrut-earn.slice(1).reduce((s,x)=>s+x.amount,0));
      const info=[['Ücretsiz izin',unpaid],['Rapor',rapor]].filter(x=>x[1]).map(([label,days])=>({label,days}));
      const MULT={normal:1.5,holiday:1,bayram:2};const ot={weekday:['Hafta içi',0,0],weekend:['Hafta sonu',0,0],holiday:['Resmî tatil',0,0],bayram:['Bayram',0,0]};
      for(const e of this.payEntries){const h=Number(e.hours)||0;let k=e.type==='holiday'?'holiday':e.type==='bayram'?'bayram':'weekday';if(k==='weekday'&&!e.paidMonth){const [y,m,d]=e.date.split('-').map(Number);if(new Date(y,m-1,d).getDay()===rest)k='weekend';}ot[k][1]+=h;ot[k][2]+=h*MULT[e.type==='bayram'?'bayram':e.type==='holiday'?'holiday':'normal'];}
      const W=Object.values(ot).reduce((s,x)=>s+x[2],0),rate=W?pr.mesaiBrut/W:0;
      const overtime=Object.values(ot).filter(x=>x[1]).map(([label,hours,w])=>({label,hours,days:hours/daily,amount:r2(w*rate)}));
      if(overtime.length){const diff=r2(pr.mesaiBrut-overtime.reduce((s,x)=>s+x.amount,0));overtime[0].amount=r2(overtime[0].amount+diff);}
      return {earn:earn.filter(x=>x.days||x.label==='Normal'),info,overtime,sigortaGunu:paidDays};},
    get unpaidDays(){return this.leaveEntries.filter(e=>e.type==='izin-ucretsiz').length;},
    // Bordrodaki gibi: ücretsiz izin günü başına net maaş / 30 kesilir
    get unpaidDeduction(){return Math.round((Number(this.activePerson?.netSalary)||0)/30*this.unpaidDays*100)/100;},
    get monthEntries(){if(!this.activePerson)return [];return this.entries.filter(e=>e.personId===this.selectedId&&(e.paidMonth||e.date.slice(0,7))===this.monthKey);},
     monthEntryCount(index){if(!this.activePerson)return 0;const key=`${this.year}-${String(index+1).padStart(2,'0')}`;return this.entries.filter(e=>e.personId===this.selectedId&&(e.paidMonth||e.date.slice(0,7))===key).length;},
    get entryDayCount(){return new Set(this.monthEntries.filter(e=>!e.paidMonth).map(e=>e.date)).size;},
    // Bordrodaki gibi döküm: hafta içi / hafta sonu (kişinin hafta tatili) / resmî tatil / bayram / eksik mesai
    get breakdown(){const p=this.activePerson;if(!p)return [];const daily=Number(p.dailyHours)||7.5,rest=p.restDay??0;const rows=[['weekday','Hafta içi','normal'],['weekend','Hafta sonu','rest'],['holiday','Resmî tatil','holiday'],['bayram','Bayram','bayram'],['overflow','Tatil/bayram 7,5 sa üstü','normal']].map(([key,label,cls])=>({key,label,cls,hours:0}));const row=k=>rows.find(r=>r.key===k);
      for(const e of this.payEntries){const h=Number(e.hours)||0;if(e.paidMonth)rows.push({key:'carry-'+e.id,label:'Eksik mesai'+(e.type==='normal'?'':' · '+(this.entryTypes.find(t=>t.value===e.type)?.label||'')),cls:e.type==='normal'?'normal':e.type,hours:h,entry:e.src});else if(e.overflow)row('overflow').hours+=h;else if(e.type==='holiday')row('holiday').hours+=h;else if(e.type==='bayram')row('bayram').hours+=h;else{const [y,m,d]=e.date.split('-').map(Number);row(new Date(y,m-1,d).getDay()===rest?'weekend':'weekday').hours+=h;}}
      const out=rows.filter(r=>r.key!=='overflow'||r.hours).map(r=>({...r,days:r.hours/daily}));
      for(const t of this.leaveTypes){const n=this.leaveEntries.filter(e=>e.type===t.value).length;if(n)out.push({key:t.value,label:t.label,cls:'leave '+t.value,hours:0,days:n,leave:true});}
      return out;},
    get breakdownTotal(){return this.breakdown.reduce((s,r)=>s+(r.leave?0:r.hours),0);},
    get carryEntries(){return this.monthEntries.filter(e=>e.paidMonth).sort((a,b)=>a.date.localeCompare(b.date));},
    shortDate(date){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short'}).format(new Date(date+'T12:00'));},
    get hasExamples(){return this.people.some(p=>p.example);},
    get calendarCells(){
      const first=new Date(this.year,this.month,1), start=(first.getDay()+6)%7, days=this.monthDays, prevDays=new Date(this.year,this.month,0).getDate();
      const count=Math.ceil((start+days)/7)*7;
      return Array.from({length:count},(_,i)=>{const day=i-start+1,current=day>0&&day<=days,actualDay=day<1?prevDays+day:day>days?day-days:day;const dt=new Date(this.year,this.month,day);const key=`${dt.getFullYear()}-${dt.getMonth()}-${actualDay}`;const all=current?this.monthEntries.filter(e=>e.date===this.dateKey(day)):[];const entries=all.filter(e=>!this.isLeave(e.type));const leave=all.find(e=>this.isLeave(e.type));const holiday=holidayOf(iso(dt));return {key,day:current?day:actualDay,current,weekend:dt.getDay()===(this.activePerson?.restDay??0),special:holiday?.[0]||'',specialName:holiday?.[1]||'',today:current&&this.isToday(day),entryCount:entries.length,hours:entries.reduce((s,e)=>s+Number(e.hours||0),0),hasHoliday:entries.some(e=>e.type==='holiday'),hasBayram:entries.some(e=>e.type==='bayram'),leave:leave?.type||'',leaveShort:leave?this.leaveTypes.find(t=>t.value===leave.type)?.short:''};});
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
    formatHours(value){return Number(value||0).toLocaleString('tr-TR',{maximumFractionDigits:1});},
    money(value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(value));},
    initials(name){return (name||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toLocaleUpperCase('tr-TR');},
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
      }catch(error){console.error('Senkron hatası:',error);}
    },
    selectPerson(id){this.selectedId=id;this.view='ledger';}, onPersonChange(){this.calculate();},
    changeMonth(delta){const date=new Date(this.year,this.month+delta,1);this.month=date.getMonth();this.year=date.getFullYear();},
    goCurrentMonth(){this.month=this.today.getMonth();this.year=this.today.getFullYear();},
    async calculate(){
      const person=this.activePerson;if(!person){this.result=null;this.calcError=false;return;}
       const request=++this.calcRequest;this.calcLoading=true;this.calcError=false;this.calcErrorMessage='';
      const entries=this.payEntries.map(e=>({id:e.id,type:e.type,hours:e.hours}));
      const payload={netSalary:Number(person.netSalary)||0,daysInMonth:this.monthDays,dailyHours:Number(person.dailyHours)||7.5,cumulativeTaxBase:Number(person.cumulativeTaxBase)||0,entries};
       try {const data=hesapla(payload);const payroll=bordroHesapla({maasNet:Math.round(((Number(person.netSalary)||0)-this.unpaidDeduction)*100)/100,mesaiNet:data.netTotal,kumulatif:Number(person.cumulativeTaxBase)||0,ay:this.payrollMonthIndex});if(request===this.calcRequest){this.result=data;this.payroll=payroll;}}
       catch(error){if(request===this.calcRequest){this.result=null;this.calcError=true;this.calcErrorMessage=error instanceof Error?error.message:'Hesaplama alınamadı';}console.error('Mesai hesaplama hatası:',error);}
      finally{if(request===this.calcRequest)this.calcLoading=false;}
    },
    openEntry(day){if(!this.activePerson)return;const existing=this.monthEntries.find(entry=>!entry.paidMonth&&entry.date===this.dateKey(day));if(existing){this.editEntry(existing);return;}this.editingEntry=null;const special=holidayOf(this.dateKey(day))?.[0];this.entryForm={day,ym:this.monthKey,carry:false,mode:'work',type:special==='bayram'?'bayram':special?'holiday':'normal',hours:0,hoursText:''};this.setHours(2);this.modal='entry';},
    setMode(mode){this.entryForm.mode=mode;this.entryForm.type=mode==='leave'?(this.isLeave(this.entryForm.type)?this.entryForm.type:'izin-yillik'):(this.isLeave(this.entryForm.type)?'normal':this.entryForm.type);},
    setHours(h){this.entryForm.hours=h;this.entryForm.hoursText=String(h).replace('.',',');},
    parseHours(){this.entryForm.hours=Number(String(this.entryForm.hoursText).replace(',','.'))||0;},
    get restHours(){return Number(this.activePerson?.dailyHours)||7.5;},
    get isRestDay(){return !this.entryForm.carry&&this.formDate(Number(this.entryForm.day)).getDay()===(this.activePerson?.restDay??0);},
    editEntry(entry){this.editingEntry=entry;this.entryForm={day:Number(entry.date.slice(-2)),ym:entry.date.slice(0,7),carry:!!entry.paidMonth,mode:this.isLeave(entry.type)?'leave':'work',type:entry.type,hours:0,hoursText:''};this.setHours(Number(entry.hours));this.modal='entry';},
    saveEntry(){
      if(this.entryForm.multi)return this.saveMulti();
      if(!this.activePerson)return;
      const leave=this.entryForm.mode==='leave'&&!this.entryForm.carry;
      const text=this.entryForm.hoursText,hours=leave?0:text==null||String(text).trim()===''?Number(this.entryForm.hours):Number(String(text).trim().replace(',','.'));
      if(!leave&&(!Number.isFinite(hours)||hours<=0)){this.notify('Geçerli bir mesai süresi girin');return;}
      if(leave&&!this.isLeave(this.entryForm.type))this.entryForm.type='izin-yillik';
      if(!this.entryForm.carry&&hours>24){this.notify('Bir gün için en fazla 24 saat girilebilir');return;}
      this.entryForm.hours=Math.round(hours*100)/100;
      const day=Number(this.entryForm.day);
      if(!this.entryForm.carry&&!(Number.isInteger(day)&&day>=1&&day<=this.formMonthDays)){this.notify('Geçerli bir gün seçin');return;}
      const ym=this.entryForm.ym||this.monthKey,date=`${ym}-${String(this.entryForm.day).padStart(2,'0')}`;
      // Günlük kayıt: aynı kişinin aynı gününde ikinci kayıt açılmasın (takvim yalnızca birini düzenleyebiliyor)
      if(!this.entryForm.carry&&this.entries.some(e=>e.personId===this.selectedId&&!e.paidMonth&&e.date===date&&e.id!==this.editingEntry?.id)){this.notify('Bu günde zaten bir kayıt var');return;}
      const entry={id:this.editingEntry?.id||`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId:this.selectedId,date,type:this.entryForm.type,hours:Number(this.entryForm.hours),...(this.entryForm.carry&&{paidMonth:this.editingEntry?.paidMonth||this.monthKey})};if(this.editingEntry){this.entries=this.entries.map(e=>e.id===entry.id?entry:e);}else this.entries.push(entry);this.persist();this.closeModal();this.calculate();this.notify(leave?this.leaveLabel(entry.type)+' kaydedildi':'Mesai kaydedildi');},
    saveMulti(){
      const f=this.entryForm,leave=f.mode==='leave',hours=leave?0:Number(String(f.hoursText??f.hours).trim().replace(',','.'));
      if(!f.people.length){this.notify('En az bir personel seçin');return;}
      if(!leave&&(!Number.isFinite(hours)||hours<=0||hours>24)){this.notify('Geçerli bir mesai süresi girin');return;}
      const date=`${f.ym||this.monthKey}-${String(f.day).padStart(2,'0')}`;let added=0;const skipped=[];
      for(const personId of f.people){if(this.entries.some(e=>e.personId===personId&&!e.paidMonth&&e.date===date)){skipped.push(this.people.find(p=>p.id===personId)?.name);continue;}this.entries.push({id:`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId,date,type:f.type,hours:Math.round(hours*100)/100});added++;}
      this.persist();this.closeModal();this.calculate();
      this.notify(skipped.length?`${added} kişiye eklendi · ${skipped.join(', ')} için o gün zaten kayıt var`:`${added} kişiye ${leave?this.leaveLabel(f.type).toLocaleLowerCase('tr-TR'):'mesai'} eklendi`);},
    deleteEntry(){if(!this.editingEntry)return;this.entries=this.entries.filter(e=>e.id!==this.editingEntry.id);this.persist();this.closeModal();this.calculate();this.notify('Kayıt silindi');},
     openPersonForm(person=null){this.editingPerson=person;this.newPin='';this.removePin=false;this.personForm=person?{restDay:0,...person}:{name:'',role:'',netSalary:65000,dailyHours:7.5,restDay:0,cumulativeTaxBase:0,startDate:''};this.modal='person';},
    async savePerson(){const name=String(this.personForm.name||'').trim();if(!name)return;const pin=String(this.newPin||'').trim();if(pin&&!/^\d{4}$/.test(pin)){this.notify('PIN 4 haneli rakam olmalı');return;}const locked=!!this.editingPerson&&this.isLocked(this.editingPerson);const wasEditing=!!this.editingPerson;const record={id:this.editingPerson?.id||`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name,role:String(this.personForm.role||'').trim(),netSalary:Number(this.personForm.netSalary)||65000,dailyHours:Number(this.personForm.dailyHours)||7.5,restDay:Number(this.personForm.restDay)||0,cumulativeTaxBase:Number(this.personForm.cumulativeTaxBase)||0,startDate:String(this.personForm.startDate||''),example:false};if(locked){record.netSalary=this.editingPerson.netSalary;record.cumulativeTaxBase=this.editingPerson.cumulativeTaxBase;}const keep=this.editingPerson?.pinHash;if(pin&&!locked){record.pinHash=await this.hashPin(record.id,pin);if(!this.unlockedIds.includes(record.id))this.unlockedIds.push(record.id);}else if(keep&&!(this.removePin&&!locked))record.pinHash=keep;if(this.editingPerson){this.people=this.people.map(p=>p.id===record.id?record:p);}else{this.people.push(record);this.selectedId=record.id;}this.persist();this.closeModal();this.view='ledger';this.calculate();this.notify(wasEditing?'Personel bilgileri güncellendi':'Personel eklendi');},
    removePerson(person){if(!confirm(`${person.name} ve bu kişiye ait tüm mesai kayıtları silinsin mi?`))return;this.people=this.people.filter(p=>p.id!==person.id);this.entries=this.entries.filter(e=>e.personId!==person.id);if(this.selectedId===person.id)this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Personel ve kayıtları silindi');},
    savePersonSettings(){if(!this.activePerson)return;this.activePerson.netSalary=Number(this.activePerson.netSalary)||0;this.activePerson.restDay=Number(this.activePerson.restDay)||0;this.activePerson.cumulativeTaxBase=Number(this.activePerson.cumulativeTaxBase)||0;this.activePerson.startDate=String(this.activePerson.startDate||'');this.persist();this.calculate();this.settingsSaved=true;setTimeout(()=>this.settingsSaved=false,2200);},
    clearExamples(){if(!this.hasExamples)return;if(!confirm('Örnek personel ve mesai kayıtları silinsin mi?'))return;const ids=this.people.filter(p=>p.example).map(p=>p.id);this.people=this.people.filter(p=>!p.example);this.entries=this.entries.filter(e=>!ids.includes(e.personId));if(ids.includes(this.selectedId))this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Örnek veriler silindi');},
    exportData(){const blob=new Blob([JSON.stringify({people:this.people,entries:this.entries,...(bulut.failed?.length&&{unsent:bulut.failed}),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mesai-defteri-yedek.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);this.notify('Yedek indirildi');},
    closeModal(){this.modal='';this.editingEntry=null;this.editingPerson=null;},
    notify(message){this.toast=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast='',2600);}
  };
}
