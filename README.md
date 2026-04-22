# Really CRM

A full-featured real estate CRM built for realtors to manage clients from first contact through closing. Track buyers and sellers, manage documents, schedule follow-ups, and use AI to match property listings to the right clients.

## Features

- **Client Management** — Create detailed profiles for buyers and sellers with property preferences, budget range, preferred locations, property types, and sale type (cash or loan)
- **Document Tracking** — Upload and manage client documents (IDs, pre-approval letters, contracts) with status tracking (Pending / Received / Verified)
- **Follow-up System** — Schedule follow-ups with date reminders, mark them complete, and receive email notifications via Resend
- **AI Property Matching** — Paste any real estate listing URL and Claude AI will parse the property details and rank your buyer clients by match quality with explanations
- **Transaction History** — Immutable audit log of all changes per client
- **Realtor Profile** — Customizable profile with photo upload

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security)
- **File Storage:** Supabase Storage
- **UI:** Tailwind CSS + shadcn/ui
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Email:** Resend

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/really-crm.git
cd really-crm
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full schema from [`supabase/schema.sql`](./supabase/schema.sql)
3. Go to **Storage** and create two buckets:
   - `avatars` — set to **public**
   - `documents` — set to **private**

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Supabase — Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic — console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Resend — resend.com/api-keys
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=reminders@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a magic link.

## Project Structure

```
app/
├── (auth)/login/          # Magic-link login
├── (app)/
│   ├── dashboard/         # Stats, today's follow-ups, recent clients
│   ├── clients/           # Client list, create, detail (4 tabs), edit
│   ├── profile/           # Realtor profile & avatar
│   └── property-match/    # AI listing URL → matched clients
└── api/
    ├── property-match/    # Claude AI integration
    ├── send-followup-email/
    └── cron/              # Daily follow-up digest (Vercel Cron)
```

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables in the Vercel dashboard
4. The Vercel Cron job in `vercel.json` will send daily follow-up email digests at 8am UTC

> Add `CRON_SECRET` to your environment variables and set the `Authorization: Bearer <secret>` header in `vercel.json` to secure the cron endpoint.

## Database Schema

The full SQL schema (tables, enums, RLS policies, indexes, triggers) is in [`supabase/schema.sql`](./supabase/schema.sql).

**Tables:** `profiles`, `clients`, `documents`, `follow_ups`, `client_history`

All tables use Row Level Security — realtors can only access their own data.

## License

MIT
