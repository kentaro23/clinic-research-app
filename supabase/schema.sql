-- Enable extensions
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('patient', 'clinic', 'admin')),
  avatar text not null default '👤',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clinics
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  short text,
  address text not null,
  tel text,
  hours text,
  access text,
  description text,
  lat double precision not null default 35.6812,
  lng double precision not null default 139.7671,
  beds integer not null default 0,
  founded integer not null default 2020,
  depts text[] not null default array['内科']::text[],
  parking boolean not null default false,
  night_service boolean not null default false,
  female boolean not null default false,
  online boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id text not null,
  clinic_name text not null,
  booking_type text not null check (booking_type in ('visit', 'online')),
  date date not null,
  time text not null,
  dept text not null,
  status text not null default '確定',
  concern text,
  created_at timestamptz not null default now()
);

-- Compatibility migration for older schema
alter table if exists public.bookings
  drop constraint if exists bookings_clinic_id_fkey;
alter table if exists public.bookings
  alter column clinic_id type text using clinic_id::text;
alter table if exists public.bookings
  add column if not exists clinic_name text;

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  author text not null,
  av text not null,
  age text not null default '',
  date date not null,
  rating integer not null check (rating between 1 and 5),
  dept text not null,
  did integer,
  title text not null,
  body text not null,
  tags text[] not null default array[]::text[],
  helpful integer not null default 0,
  dr integer not null default 0,
  fr integer not null default 0,
  wr integer not null default 0,
  reply text,
  created_at timestamptz not null default now()
);

-- Review reports (moderation)
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id text not null,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Audit logs
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_clinics_touch on public.clinics;
create trigger trg_clinics_touch before update on public.clinics
for each row execute function public.touch_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_upsert_self" on public.profiles;
create policy "profiles_upsert_self" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

-- Clinics policies
drop policy if exists "clinics_public_read" on public.clinics;
create policy "clinics_public_read" on public.clinics
for select using (true);

drop policy if exists "clinics_owner_write" on public.clinics;
create policy "clinics_owner_write" on public.clinics
for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- Bookings policies
drop policy if exists "bookings_user_or_owner_read" on public.bookings;
create policy "bookings_user_or_owner_read" on public.bookings
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.clinics c
    where c.id::text = clinic_id and c.owner_user_id = auth.uid()
  )
);

drop policy if exists "bookings_user_insert" on public.bookings;
create policy "bookings_user_insert" on public.bookings
for insert with check (auth.uid() = user_id);

-- Reviews policies
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
for select using (true);

drop policy if exists "reviews_insert_self" on public.reviews;
create policy "reviews_insert_self" on public.reviews
for insert with check (auth.uid() = user_id);

-- Review reports policies
drop policy if exists "reports_insert_self" on public.review_reports;
create policy "reports_insert_self" on public.review_reports
for insert with check (auth.uid() = reporter_user_id);

drop policy if exists "reports_owner_read" on public.review_reports;
create policy "reports_owner_read" on public.review_reports
for select using (true);

-- Audit log policies
drop policy if exists "audit_insert_self" on public.audit_logs;
create policy "audit_insert_self" on public.audit_logs
for insert with check (auth.uid() = actor_user_id or actor_user_id is null);
