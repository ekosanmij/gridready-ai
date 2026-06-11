# GridReady AI Intake Console

Internal MVP surface for creating, viewing, and updating GridReady AI site assessment intake records.

## Setup

Create `web/.env.local` using the values from your Supabase project:

```bash
cp .env.example .env.local
```

Then fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

In Supabase, the values are under **Project Settings -> API**.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Current MVP Scope

- Assessment dashboard
- Create site assessment intake
- Edit site assessment intake
- Intake completeness scoring
- Workflow status updates
- Analyst notes
- Document references

## Important

This first slice uses the Supabase anon key from the browser. That is acceptable only for local/internal MVP testing while your Supabase permissions are still being shaped. Before storing confidential customer data, add Supabase Auth, row-level security policies, and private storage buckets.

## Next Build Slices

1. Checklist templates and checklist responses
2. Evidence source library
3. Grid assets and candidate POIs
4. Scoring and findings
5. Report sections and PDF generation

## Deploy

The app can be deployed on Vercel or another Next.js host after environment variables are configured.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
