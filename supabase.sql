-- Supabase → SQL Editor → New query: bu dosyanın tamamını yapıştırıp "Run" deyin.

create table if not exists people (
  id text primary key,
  name text not null,
  role text not null default '',
  net_salary numeric not null default 65000,
  daily_hours numeric not null default 7.5,
  rest_day smallint not null default 0, -- hafta tatili: 0=Pazar, 1=Pazartesi … 6=Cumartesi
  cumulative_tax_base numeric not null default 0,
  example boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists entries (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  date text not null,
  type text not null check (type in ('normal', 'holiday', 'bayram')),
  hours numeric not null
);

-- Giriş yok: anahtarı (site) bilen herkes okuyup yazabilir.
alter table people enable row level security;
alter table entries enable row level security;
create policy "herkese acik" on people for all to anon using (true) with check (true);
create policy "herkese acik" on entries for all to anon using (true) with check (true);

-- Anlık güncellemeler (bir cihazdaki değişiklik diğerlerinde hemen görünsün)
alter publication supabase_realtime add table people, entries;

-- Mevcut kurulumlar için (tablo önceden oluşturulduysa):
alter table people add column if not exists rest_day smallint not null default 0;
