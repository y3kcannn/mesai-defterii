function mesaiDefteri() {
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const sampleDate = new Date();
  const samplePrefix = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth()+1).padStart(2,'0')}-`;
  const sampleDay = day => `${samplePrefix}${String(day).padStart(2,'0')}`;
  const demoPeople = [
    {id:'demo-ali',name:'Ali Demir',role:'Kalıp ustası',netSalary:65000,dailyHours:7.5,cumulativeTaxBase:680000,example:true},
    {id:'demo-emre',name:'Emre Kaya',role:'Demir ustası',netSalary:65000,dailyHours:7.5,cumulativeTaxBase:680000,example:true},
    {id:'demo-hasan',name:'Hasan Yıldız',role:'Şantiye işçisi',netSalary:65000,dailyHours:7.5,cumulativeTaxBase:680000,example:true}
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
  const read = (key, fallback) => { try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  return {
     today:new Date(), online:navigator.onLine, monthNames, view:'ledger', people:[], entries:[], selectedId:null, year:new Date().getFullYear(), month:new Date().getMonth(),
     result:null, calcLoading:false, calcError:false, calcErrorMessage:'', calcRequest:0, settingsSaved:false, modal:'', editingEntry:null, editingPerson:null,
     entryForm:{day:1,type:'normal',hours:2}, personForm:{name:'',role:'',netSalary:65000,dailyHours:7.5,cumulativeTaxBase:0}, toast:'', toastTimer:null,
     weekdays:['PZT','SAL','ÇAR','PER','CUM','CMT','PAZ'], entryTypes:[{value:'normal',label:'Normal mesai',note:'Hafta içi veya hafta sonu'},{value:'holiday',label:'Resmî tatil',note:'Resmî tatil çalışması'},{value:'bayram',label:'Bayram',note:'Bayram çalışması'}],
    init(){
      const savedPeople=read('mesai-defteri-people',null), savedEntries=read('mesai-defteri-entries',null);
      if(savedPeople===null){this.people=demoPeople;this.entries=demoEntries;this.persist();}
      else {this.people=Array.isArray(savedPeople)?savedPeople:[];this.entries=Array.isArray(savedEntries)?savedEntries:[];}
      this.selectedId=this.people[0]?.id||null;
      bulut.reset(this.people,this.entries);
      if(bulut.on){this.sync();bulut.listen(()=>this.sync());}
      this.$watch('selectedId',()=>this.calculate()); this.$watch('month',()=>this.calculate()); this.$watch('year',()=>this.calculate());
       window.addEventListener('online',()=>{this.online=true;this.sync();this.calculate();});
       window.addEventListener('offline',()=>{this.online=false;});
      this.calculate();
      if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
    },
    get activePerson(){return this.people.find(p=>p.id===this.selectedId)||null;},
    get monthName(){return monthNames[this.month];},
    get monthDays(){return new Date(this.year,this.month+1,0).getDate();},
    get todayLabel(){return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short',year:'numeric'}).format(this.today).toLocaleUpperCase('tr-TR');},
    get monthEntries(){if(!this.activePerson)return [];const prefix=`${this.year}-${String(this.month+1).padStart(2,'0')}-`;return this.entries.filter(e=>e.personId===this.selectedId&&e.date.startsWith(prefix));},
     monthEntryCount(index){if(!this.activePerson)return 0;const prefix=`${this.year}-${String(index+1).padStart(2,'0')}-`;return this.entries.filter(e=>e.personId===this.selectedId&&e.date.startsWith(prefix)).length;},
    get entryDayCount(){return new Set(this.monthEntries.map(e=>e.date)).size;},
    get hasExamples(){return this.people.some(p=>p.example);},
    get calendarCells(){
      const first=new Date(this.year,this.month,1), start=(first.getDay()+6)%7, days=this.monthDays, prevDays=new Date(this.year,this.month,0).getDate();
      const count=Math.ceil((start+days)/7)*7;
      return Array.from({length:count},(_,i)=>{const day=i-start+1,current=day>0&&day<=days,actualDay=day<1?prevDays+day:day>days?day-days:day;const dt=current?new Date(this.year,this.month,day):new Date(this.year,this.month-1,actualDay);const key=`${dt.getFullYear()}-${dt.getMonth()}-${actualDay}`;const entries=current?this.monthEntries.filter(e=>e.date===this.dateKey(day)):[];return {key,day:current?day:actualDay,current,today:current&&this.isToday(day),entryCount:entries.length,hours:entries.reduce((s,e)=>s+Number(e.hours||0),0),hasHoliday:entries.some(e=>e.type==='holiday'),hasBayram:entries.some(e=>e.type==='bayram')};});
    },
    dateKey(day){return `${this.year}-${String(this.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;},
    isToday(day){return this.today.getFullYear()===this.year&&this.today.getMonth()===this.month&&this.today.getDate()===day;},
    weekdayFor(day){return this.weekdays[(new Date(this.year,this.month,day).getDay()+6)%7];},
    formatHours(value){return Number(value||0).toLocaleString('tr-TR',{maximumFractionDigits:1});},
    money(value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(value));},
    initials(name){return (name||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toLocaleUpperCase('tr-TR');},
    persist(){localStorage.setItem('mesai-defteri-people',JSON.stringify(this.people));localStorage.setItem('mesai-defteri-entries',JSON.stringify(this.entries));bulut.track(this.people,this.entries);},
    async sync(){
      if(!bulut.on)return;
      try{
        let data=await bulut.pull();
        // Bu cihaz ilk kez bağlanıyor ve bulut boşsa: yerel kayıtları yükle
        if(!data.people.length&&this.people.length&&!localStorage.getItem('mesai-defteri-bulut')){bulut.reset([],[]);bulut.track(this.people,this.entries);data=await bulut.pull();}
        localStorage.setItem('mesai-defteri-bulut','1');
        if(bulut.pending)return; // gönderilmeyi bekleyen değişiklik var; sonraki senkronda alınır
        bulut.reset(data.people,data.entries);this.people=data.people;this.entries=data.entries;this.persist();
        if(!this.people.some(p=>p.id===this.selectedId))this.selectedId=this.people[0]?.id||null;
        this.calculate();
      }catch(error){console.error('Senkron hatası:',error);}
    },
    selectPerson(id){this.selectedId=id;this.view='ledger';}, onPersonChange(){this.calculate();},
    changeMonth(delta){const date=new Date(this.year,this.month+delta,1);this.month=date.getMonth();this.year=date.getFullYear();},
    goCurrentMonth(){this.month=this.today.getMonth();this.year=this.today.getFullYear();},
    async calculate(){
      const person=this.activePerson;if(!person){this.result=null;this.calcError=false;return;}
       const request=++this.calcRequest;this.calcLoading=true;this.calcError=false;this.calcErrorMessage='';
      const entries=this.monthEntries.map(e=>({id:e.id,type:e.type,hours:Number(e.hours)}));
      const payload={netSalary:Number(person.netSalary)||0,daysInMonth:this.monthDays,dailyHours:Number(person.dailyHours)||8,cumulativeTaxBase:Number(person.cumulativeTaxBase)||0,entries};
       try {const data=hesapla(payload);if(request===this.calcRequest)this.result=data;}
       catch(error){if(request===this.calcRequest){this.result=null;this.calcError=true;this.calcErrorMessage=error instanceof Error?error.message:'Hesaplama alınamadı';}console.error('Mesai hesaplama hatası:',error);}
      finally{if(request===this.calcRequest)this.calcLoading=false;}
    },
    openEntry(day){if(!this.activePerson)return;const existing=this.monthEntries.find(entry=>Number(entry.date.slice(-2))===Number(day));if(existing){this.editEntry(existing);return;}this.editingEntry=null;this.entryForm={day,type:'normal',hours:2};this.modal='entry';},
    editEntry(entry){this.editingEntry=entry;this.entryForm={day:Number(entry.date.slice(-2)),type:entry.type,hours:Number(entry.hours)};this.modal='entry';},
    saveEntry(){if(!this.activePerson||!this.entryForm.hours||this.entryForm.hours<=0)return;const entry={id:this.editingEntry?.id||`m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId:this.selectedId,date:this.dateKey(Number(this.entryForm.day)),type:this.entryForm.type,hours:Number(this.entryForm.hours)};if(this.editingEntry){this.entries=this.entries.map(e=>e.id===entry.id?entry:e);}else this.entries.push(entry);this.persist();this.closeModal();this.calculate();this.notify('Mesai kaydı kaydedildi');},
    deleteEntry(){if(!this.editingEntry)return;this.entries=this.entries.filter(e=>e.id!==this.editingEntry.id);this.persist();this.closeModal();this.calculate();this.notify('Mesai kaydı silindi');},
     openPersonForm(person=null){this.editingPerson=person;this.personForm=person?{...person}:{name:'',role:'',netSalary:65000,dailyHours:7.5,cumulativeTaxBase:0};this.modal='person';},
    savePerson(){const name=this.personForm.name.trim();if(!name)return;const wasEditing=!!this.editingPerson;const record={id:this.editingPerson?.id||`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name,role:this.personForm.role.trim(),netSalary:Number(this.personForm.netSalary)||65000,dailyHours:Number(this.personForm.dailyHours)||8,cumulativeTaxBase:Number(this.personForm.cumulativeTaxBase)||0,example:false};if(this.editingPerson){this.people=this.people.map(p=>p.id===record.id?record:p);}else{this.people.push(record);this.selectedId=record.id;}this.persist();this.closeModal();this.view='ledger';this.calculate();this.notify(wasEditing?'Personel bilgileri güncellendi':'Personel eklendi');},
    removePerson(person){if(!confirm(`${person.name} ve bu kişiye ait tüm mesai kayıtları silinsin mi?`))return;this.people=this.people.filter(p=>p.id!==person.id);this.entries=this.entries.filter(e=>e.personId!==person.id);if(this.selectedId===person.id)this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Personel ve kayıtları silindi');},
    savePersonSettings(){if(!this.activePerson)return;this.activePerson.netSalary=Number(this.activePerson.netSalary)||0;this.activePerson.dailyHours=Number(this.activePerson.dailyHours)||8;this.activePerson.cumulativeTaxBase=Number(this.activePerson.cumulativeTaxBase)||0;this.persist();this.calculate();this.settingsSaved=true;setTimeout(()=>this.settingsSaved=false,2200);},
    clearExamples(){if(!this.hasExamples)return;if(!confirm('Örnek personel ve örnek mesai kayıtları kaldırılsın mı?'))return;const ids=this.people.filter(p=>p.example).map(p=>p.id);this.people=this.people.filter(p=>!p.example);this.entries=this.entries.filter(e=>!ids.includes(e.personId));if(ids.includes(this.selectedId))this.selectedId=this.people[0]?.id||null;this.persist();this.calculate();this.notify('Örnek kayıtlar kaldırıldı');},
    exportData(){const blob=new Blob([JSON.stringify({people:this.people,entries:this.entries,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mesai-defteri-yedek.json';a.click();URL.revokeObjectURL(url);this.notify('Yedek dosyası indirildi');},
    closeModal(){this.modal='';this.editingEntry=null;this.editingPerson=null;},
    notify(message){this.toast=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast='',2600);}
  };
}
