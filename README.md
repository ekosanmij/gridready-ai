# GridReady AI

GridReady AI is an authenticated site-power feasibility and interconnection-readiness workbench for customer intake, analyst diligence, evidence-backed scoring, report drafting, and delivery preflight.

The current release focus is a secure, end-to-end single-site assessment workflow: customer registration through private evidence upload, analyst review, scored readiness verdict, source-backed report authoring, expert review, and secure customer delivery.

## Current State

The app has moved beyond a static planning workspace into a working internal alpha/pilot workbench. The major foundations now merged into `main` include:

- Customer tenancy, organisation membership, active organisation selection, and RLS repair migrations.
- Server-backed intake drafts, customer upload metadata, private storage paths, and duplicate-submission controls.
- Controlled assessment workflow transitions, audit events, assignment/SLA controls, and background job leasing.
- Governed geospatial dataset registration and PUCT territory import tooling.
- Versioned readiness scoring, confidence calculation, canonical verdict history, and immutable score snapshots.
- Report template and report-section authoring with print-friendly preview.
- Evidence library, findings, source relationships, explicit evidence gaps, report-claim lineage, preflight runs, delivery exceptions, and server-controlled report finalisation.
- Integration tests covering the application contracts that can be exercised without a live Supabase instance.

This is not yet the full production MVP. The remaining work is tracked in `docs/product/GridReady AI Outstanding Development Specification.docx`.

## What Remains Now

Highest-priority remaining work:

- Apply and validate the latest Supabase migrations in the target environment, especially `20260619200000_evidence_lineage_preflight.sql`.
- Run the customer registration -> draft -> upload -> submission -> analyst assessment path against a real migrated Supabase project.
- Finish structured expert review assignment, checklist comments, requested changes, approval, and rejection for the exact report version.
- Generate server-side, versioned PDF and map artifacts rather than relying only on browser print/HTML preview.
- Add secure report delivery for approved artifacts with customer access controls and delivery audit history.
- Implement administrator workflows for invitations, membership changes, suspension, reassignment, and role-change audit reasons.
- Complete operational controls: malware scanning worker implementation, document extraction workers, notifications, retention, backup/recovery, observability, and incident-friendly logs.
- Add CI coverage for real database/RLS tests, browser E2E tests, accessibility, performance, and staging release checks.
- Build portfolio and investor workflows after the single-site path is dependable.
- Add production analytics for turnaround time, report usefulness, evidence gaps, conversion, and operational quality.

## Repository Map

```text
.
|-- README.md
|-- web/                     Next.js application
|-- supabase/                Database migrations, dashboard-safe SQL, and RLS fixtures
|-- docs/product/            Product specifications, implementation prompts, and backlog docs
|-- docs/strategy/           Market thesis and strategy materials
|-- brand/                   Logo source and exported brand assets
```

Important files:

- `docs/product/GridReady AI Outstanding Development Specification.docx` - comprehensive remaining development specification.
- `docs/product/GridReady AI MVP Specification.docx` - original MVP product specification.
- `docs/product/Next 3 MVP Slices Todo Specification.md` - earlier evidence, scoring, and report-builder slice plan.
- `supabase/README.md` - database and migration operating notes.
- `web/README.md` - app-specific setup notes.
- `web/package.json` - application scripts and dependencies.

## Product Workflow

The intended single-site pilot flow is:

1. A customer signs in, is provisioned into an organisation, saves an intake draft, uploads supporting evidence, and submits a site assessment.
2. An analyst triages the request, accepts or rejects inferred values, reviews GIS context, manages evidence and findings, completes checklist and scoring work, and records a verdict.
3. The report builder creates editable sections from structured intake, GIS, checklist, evidence, finding, score, verdict, and review data.
4. The evidence-lineage preflight blocks unsupported material claims, unresolved delivery-blocking evidence gaps, incomplete score/verdict state, and unapproved report sections.
5. A reviewer or administrator approves justified exceptions where appropriate.
6. The system generates and securely delivers an immutable approved report package. This final artifact generation and delivery step is still outstanding.

## Web App Setup

The application lives in `web/`.

```bash
cd web
npm install
cp .env.example .env.local
```

Fill `web/.env.local` with Supabase and optional Geoapify values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_GEOAPIFY_API_KEY=your-geoapify-api-key
```

Start the app:

```bash
npm run dev
```

Open:

- `http://localhost:3000/intake`
- `http://localhost:3000/intake/workspace`
- `http://localhost:3000/intake/assessments`
- `http://localhost:3000/intake/evidence`
- `http://localhost:3000/intake/reports`

## Validation

Run from `web/`:

```bash
npm run test
npm run lint
npm run build
```

Current application-level checks should pass without a live Supabase project. Database-policy confidence still requires applying migrations to an isolated Supabase instance and running the RLS fixture described below.

## Supabase Setup

Apply migrations in timestamp order from `supabase/migrations/`. The deployed Supabase project must already have the core tables referenced in `supabase/README.md`, including organisations, contacts, projects, sites, site assessments, uploaded files, notes, and status history.

Current migration sequence:

```text
20260611164000_analysis_checklists.sql
20260611172000_assessment_grid_assets.sql
20260615130000_evidence_findings.sql
20260615143000_scorecard_verdict_gates.sql
20260615160000_report_builder.sql
20260618120000_workbench_production_readiness.sql
20260619100000_customer_tenancy_foundation.sql
20260619120000_customer_intake_drafts_and_uploads.sql
20260619140000_workflow_audit_background_jobs.sql
20260619160000_geospatial_dataset_governance.sql
20260619180000_scoring_confidence_verdict_history.sql
20260619190000_normalise_membership_roles.sql
20260619200000_evidence_lineage_preflight.sql
20260619200000_repair_customer_assessment_insert_policy.sql
20260619210000_repair_provisioning_variable_conflict.sql
20260619220000_repair_assessment_insert_returning_policy.sql
```

Do not run these directly against production:

- `supabase/tests/customer_tenancy_rls.sql` - isolated test fixture only.
- `supabase/dashboard_safe_*.sql` - dashboard-safe helper queries, not timestamped migrations.

After applying `20260619160000_geospatial_dataset_governance.sql`, import the PUCT territory dataset from `web/`:

```bash
npm run data:import:puct-territories -- --dry-run
```

Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and run the same command without `--dry-run`.

## Database Verification

Run the RLS fixture only against an isolated migrated Supabase database:

```sql
\i supabase/tests/customer_tenancy_rls.sql
```

The fixture is transactional and checks customer golden-path inserts plus denied cross-tenant access. It is not a substitute for the remaining CI work; it should become part of the database-policy CI suite.

## Key Server Controls

Use the server/database functions rather than writing protected records directly:

- `provision_customer_account` for customer organisation provisioning.
- `transition_assessment_status` for assessment lifecycle changes.
- `claim_background_jobs` and `complete_background_job` for leased background processing.
- `save_assessment_scores` for manual score entry and server-calculated score snapshots.
- `save_assessment_verdict` for canonical verdict history.
- `save_assessment_finding` for findings and evidence links.
- `run_assessment_preflight` for auditable delivery or review blocker checks.
- `approve_delivery_exception` for reviewer/admin exception approval.
- `finalize_assessment_report` for server-controlled final report state.

Direct client writes that bypass these controls should be treated as defects.

## GitHub Status

The latest implementation tranche was merged through PR #11:

- PR: `https://github.com/ekosanmij/gridready-ai/pull/11`
- Merge commit: `5a1579a`
- Scope: customer intake/RLS repairs plus evidence lineage and report-delivery preflight.
- Remote checks: Vercel passed.

## Development Notes

- Keep UI changes consistent with the existing internal workbench style.
- Prefer server-enforced workflow rules over client-only button hiding.
- Preserve explicit `unknown` states instead of converting missing diligence into certainty.
- Treat every issued report as reproducible from assessment data, methodology version, evidence snapshots, review state, and report version.
- Keep broad portfolio workflows secondary until the single-site pilot path is secure and repeatable.
