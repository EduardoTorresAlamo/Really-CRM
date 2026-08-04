-- Really CRM — Migration 0001
-- Adds the pipeline `stage` column to clients and an `email_templates` table.
-- Run this in your Supabase project's SQL Editor (safe to run once, on an existing DB).

-- ============================================================
-- PIPELINE STAGE
-- ============================================================
create type client_stage as enum (
  'lead', 'contacted', 'showing', 'negotiation', 'closed', 'lost'
);

alter table clients
  add column stage client_stage not null default 'lead';

create index on clients(stage);

-- ============================================================
-- EMAIL TEMPLATES (custom, per realtor)
-- Predefined templates live in code (lib/email/templates.ts); this table
-- only stores realtor-authored custom templates.
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

alter table email_templates enable row level security;

create policy "own templates" on email_templates
  for all using (auth.uid() = realtor_id);

create index on email_templates(realtor_id);

create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute procedure set_updated_at();
