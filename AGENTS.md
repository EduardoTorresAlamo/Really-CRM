---
# AGENTS.md — Really CRM

**Stack**: Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS + Storage), Anthropic Claude API, Resend, Tailwind CSS 4, shadcn/ui
**Deploy**: Vercel
**Language**: TypeScript
**Type**: micro-saas
**Fintech**: no

---

CRM for PR real estate agents. Manage buyers/sellers from first contact through closing. Track clients, documents, follow-ups, and use Claude AI to match property listings to buyer pool.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm test             # run tests
npm run typecheck    # TypeScript check
npm run lint         # lint (eslint)
```

## Rules

- All sensitive data is PCI/NACHA-protected when fintech=true
- Mobile-first responsive design (PR market)
- Conventional commits: feat:, fix:, chore:
- Test before merge to main
- No force-push

## Related

- [[wiki/projects/Really-CRM.md]] in Obsidian vault
