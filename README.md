# Really CRM

> ⚠️ **Next.js 16 project.** `cookies()` is async: always `await createClient()`. Route `params` is a Promise: always `await params`. Read [`AGENTS.md`](./AGENTS.md) before modifying Next.js-specific code.

A real estate CRM for realtors. Manage buyers and sellers from first contact through closing. Track clients, documents, and follow-ups, and use Claude AI to match property listings to your buyer pool.

## Features

- **Client management**: Create profiles for buyers and sellers with property preferences, budget range, preferred locations, property types, and sale type (cash or loan)
- **Document tracking**: Upload and manage client documents (IDs, pre-approval letters, contracts) with status tracking: Pending / Received / Verified
- **Follow-up scheduling**: Set follow-up dates per client, mark them complete, and get email reminders via Resend
- **AI property matching**: Paste a listing URL and Claude parses the property details, then ranks your buyer clients by match quality with written explanations
- **Transaction history**: Immutable audit log of all changes per client
- **Realtor profile**: Editable profile with photo upload (Supabase Storage)
- **Daily digest**: Vercel Cron sends a daily email summary of upcoming follow-ups at 8am UTC

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| File storage | Supabase Storage |
| UI | Tailwind CSS v4 + shadcn/ui |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Email | Resend |
| Deployment | Vercel |

## Project Structure

```
app/
├── (auth)/login/           # Magic-link login
├── (app)/
│   ├── dashboard/          # Stats cards, today's follow-ups, recent clients
│   ├── clients/            # Client list, create, detail (4 tabs), edit
│   ├── profile/            # Realtor profile and avatar upload
│   └── property-match/     # Paste listing URL → AI-ranked buyer matches
└── api/
    ├── property-match/     # Claude API integration
    ├── send-followup-email/
    └── cron/               # Daily follow-up digest (Vercel Cron)
```

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/EduardoTorresAlamo/Really-CRM.git
cd Really-CRM
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run the full schema from [`supabase/schema.sql`](./supabase/schema.sql)
3. Go to Storage and create two buckets:
   - `avatars`: set to **public**
   - `documents`: set to **private**

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Supabase (Settings > API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (console.anthropic.com)
ANTHROPIC_API_KEY=

# Resend (resend.com/api-keys)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron (generate a random 32-char secret)
CRON_SECRET=
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a magic link.

## Database Schema

Full SQL (tables, enums, RLS policies, indexes, triggers) is in [`supabase/schema.sql`](./supabase/schema.sql).

**Tables:** `profiles`, `clients`, `documents`, `follow_ups`, `client_history`

All tables use Row Level Security. Realtors can only read and write their own data.

## Deployment

### Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables in the Vercel dashboard
4. The cron job defined in `vercel.json` will run daily at 8am UTC. Secure it with the `CRON_SECRET` env var.

## License

MIT
