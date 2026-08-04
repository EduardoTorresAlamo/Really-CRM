-- Really CRM — Supabase Schema
-- Run this in your Supabase project's SQL Editor

create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type client_type   as enum ('buyer', 'seller');
create type client_status as enum ('active', 'inactive', 'closed');
create type sale_type     as enum ('cash', 'loan');
create type property_type as enum ('house', 'condo', 'apartment', 'land', 'commercial');
create type doc_type      as enum ('id', 'pre_approval_letter', 'contract', 'other');
create type doc_status    as enum ('pending', 'received', 'verified');
create type client_stage  as enum ('lead', 'contacted', 'showing', 'negotiation', 'closed', 'lost');

-- ============================================================
-- PROFILES (one per authenticated realtor)
-- ============================================================
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null,
  email          text not null,
  phone          text,
  license_number text,
  bio            text,
  photo_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id                  uuid primary key default uuid_generate_v4(),
  realtor_id          uuid not null references profiles(id) on delete cascade,
  client_type         client_type not null,
  status              client_status not null default 'active',
  stage               client_stage not null default 'lead',
  name                text not null,
  email               text,
  phone               text,
  notes               text,
  budget_min          numeric(12,2),
  budget_max          numeric(12,2),
  preferred_locations text[],
  property_types      property_type[],
  sale_type           sale_type,
  bedrooms_min        smallint,
  bedrooms_max        smallint,
  bathrooms_min       numeric(3,1),
  bathrooms_max       numeric(3,1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- EMAIL TEMPLATES (custom, per realtor)
-- Predefined templates live in code (lib/email/templates.ts).
-- ============================================================
create table email_templates (
  id          uuid primary key default uuid_generate_v4(),
  realtor_id  uuid not null references profiles(id) on delete cascade,
  name        text not null,
  subject     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS (per client)
-- ============================================================
create table documents (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  realtor_id  uuid not null references profiles(id) on delete cascade,
  doc_type    doc_type not null,
  doc_status  doc_status not null default 'pending',
  file_url    text,
  file_name   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
create table follow_ups (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  realtor_id      uuid not null references profiles(id) on delete cascade,
  scheduled_date  date not null,
  notes           text,
  completed       boolean not null default false,
  completed_at    timestamptz,
  email_sent      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- CLIENT HISTORY (immutable audit log)
-- ============================================================
create table client_history (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  realtor_id  uuid not null references profiles(id) on delete cascade,
  event_type  text not null,
  description text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles        enable row level security;
alter table clients         enable row level security;
alter table email_templates enable row level security;
alter table documents       enable row level security;
alter table follow_ups      enable row level security;
alter table client_history  enable row level security;

create policy "own profile"    on profiles        for all using (auth.uid() = id);
create policy "own clients"    on clients         for all using (auth.uid() = realtor_id);
create policy "own templates"  on email_templates for all using (auth.uid() = realtor_id);
create policy "own documents"  on documents       for all using (auth.uid() = realtor_id);
create policy "own followups"  on follow_ups     for all using (auth.uid() = realtor_id);
-- client_history is an immutable audit log: SELECT and INSERT only, no UPDATE or DELETE
create policy "own history read"   on client_history for select using (auth.uid() = realtor_id);
create policy "own history insert" on client_history for insert with check (auth.uid() = realtor_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index on clients(realtor_id);
create index on clients(status);
create index on clients(client_type);
create index on clients(stage);
create index on email_templates(realtor_id);
create index on follow_ups(realtor_id);
create index on follow_ups(scheduled_date, completed);
create index on documents(client_id);
create index on client_history(client_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger trg_clients_updated_at
  before update on clients
  for each row execute procedure set_updated_at();

create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute procedure set_updated_at();

create trigger trg_documents_updated_at
  before update on documents
  for each row execute procedure set_updated_at();

create trigger trg_follow_ups_updated_at
  before update on follow_ups
  for each row execute procedure set_updated_at();

-- ============================================================
-- STORAGE BUCKET POLICIES
-- Run these after creating the buckets in the Supabase dashboard
-- ============================================================

-- avatars bucket (public read, realtor-scoped write)
create policy "Upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Delete own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- documents bucket (private, realtor-scoped)
create policy "Upload own documents" on storage.objects
  for insert with check (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Read own documents" on storage.objects
  for select using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Delete own documents" on storage.objects
  for delete using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
