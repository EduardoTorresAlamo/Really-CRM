# Really-CRM — Real Estate CRM

## Stack
- Next.js 16, TypeScript, Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage)
- AI: property matching, email follow-ups

## Structure
- app/ — Next.js App Router pages and API routes
- components/ — React components
- lib/ — Shared utilities, Supabase client
- supabase/ — Schema, migrations, RLS policies

## Key notes
- This is a large project (~134K LOC). Focus on specific files when making changes.
- RLS policies are critical for tenant isolation
- Uses Supabase for both auth and data
