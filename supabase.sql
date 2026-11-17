-- Mesai Defteri veritabanı şeması (canlı veritabanıyla birebir).
-- Supabase → SQL Editor → New query: bu dosyanın tamamını yapıştırıp "Run" deyin.
-- Tekrar çalıştırmak güvenlidir: hiçbir tabloyu/satırı silmez, eksik olanı ekler.

-- Kişiler
create table if not exists public.people (
  id text primary key,
  name text not null,
  role text not null default '',
  net_salary numeric not null default 65000,
  daily_hours numeric not null default 7.5,
  cumulative_tax_base numeric not null default 0, -- yıl başından beri kümülatif gelir vergisi matrahı
  example boolean not null default false,
  created_at timestamptz not null default now()
);
-- Sonradan eklenen sütunlar (eski kurulumlar için de)
alter table public.people add column if not exists rest_day smallint not null default 0; -- hafta tatili: 0=Pazar, 1=Pazartesi … 6=Cumartesi
alter table public.people add column if not exists pin_hash text;                        -- maaş PIN'inin SHA-256 özeti
alter table public.people add column if not exists start_date text;                      -- işe giriş tarihi (YYYY-MM-DD)
alter table public.people add column if not exists leave_carry numeric not null default 0; -- devreden yıllık izin (gün)
alter table public.people add column if not exists photo text; -- profil fotoğrafı (küçük JPEG data URL)
alter table public.people drop constraint if exists people_photo_size;
alter table public.people add constraint people_photo_size check (photo is null or (length(photo) < 120000 and photo like 'data:image/%'));

-- Günlük kayıtlar (mesai, tatil, izin)
create table if not exists public.entries (
  id text primary key,
  person_id text not null references public.people(id) on delete cascade,
  date text not null,  -- YYYY-MM-DD
  type text not null,
  hours numeric not null
);
alter table public.entries add column if not exists paid_month text; -- devreden mesai: ödendiği ay (YYYY-MM)

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('normal','holiday','bayram','izin-yillik','izin-ucretsiz','izin-rapor','izin-mazeret'));

-- Yabancı anahtar için indeks (kişi silinince kayıtların hızlı silinmesi, kişi bazlı sorgular)
create index if not exists entries_person_id_date_idx on public.entries (person_id, date);

-- Giriş yok (bilinçli tercih): anahtarı (site) bilen herkes okuyup yazabilir.
alter table public.people enable row level security;
alter table public.entries enable row level security;
drop policy if exists "herkese acik" on public.people;
drop policy if exists "herkese acik" on public.entries;
create policy "herkese acik" on public.people for all to anon using (true) with check (true);
create policy "herkese acik" on public.entries for all to anon using (true) with check (true);

-- İstemcinin kullanmadığı, RLS'i atlayan yetkiler kapalı (okuma/ekleme/güncelleme/silme açık kalır)
revoke truncate, trigger, references on public.people, public.entries from anon, authenticated;

-- Anlık güncellemeler (bir cihazdaki değişiklik diğerlerinde hemen görünsün)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'people') then
    alter publication supabase_realtime add table public.people;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries') then
    alter publication supabase_realtime add table public.entries;
  end if;
end $$;
