# GridReady AI Workbench

Authenticated portal for intake, assessment operations, evidence, geospatial inference, and report delivery.

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

Open [http://localhost:3000/intake](http://localhost:3000/intake) and sign in with a Supabase Auth user.

## Workbench Scope

- Assessment dashboard
- Create site assessment intake
- Edit site assessment intake
- Intake completeness scoring
- Workflow status updates
- Analyst notes
- Document references
- Persistent owner and SLA assignment
- Private evidence upload and editing
- Utility/TSP inference with explicit analyst acceptance
- Report authoring and HTML/print-PDF export
- Indexed cross-workbench search

## Authentication and roles

Supabase Auth protects `/intake/*`. Row-level security enforces `admin`, `analyst`, `reviewer`, and `customer` roles; the role shown in the UI is read from the authenticated profile and is not a client-side switch. Evidence is stored in the private `assessment-evidence` bucket and accessed with short-lived signed URLs.

## Validation

```bash
npm run lint
npm test
npm run build
```

## Deploy

The app can be deployed on Vercel or another Next.js host after environment variables are configured.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
