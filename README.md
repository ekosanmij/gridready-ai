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
- Structured expert-review assignment, checklist comments, requested changes, rejection, and approval bound to an immutable report version.
- Server-generated, versioned PDF and map artifacts with checksums, private storage, delivery preflight, organisation-scoped publication, revocation, expiring downloads, and audit history.
- Integration tests covering the application contracts that can be exercised without a live Supabase instance.

This is not yet the full production MVP. The remaining work is tracked in `docs/product/GridReady AI Outstanding Development Specification.docx`.

## What Remains Now

Highest-priority remaining work:

- Apply and validate the latest Supabase migrations in the target environment through `20260620150000_atomic_customer_intake_submission.sql`.
- Run the customer registration -> draft -> upload -> submission -> analyst assessment path against a real migrated Supabase project.
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
5. A reviewer completes the structured checklist and approves, rejects, or requests changes against the exact finalised report version; authorised exceptions remain separately audited.
6. An analyst generates the immutable, checksumed PDF and site-map package from the approved version snapshot.
7. Delivery publishes that version only to active customer members of the assessment organisation through revocable, 60-second signed download links with audit history.

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
20260619230000_expert_review_version_approval.sql
20260620000000_report_artifacts_secure_delivery.sql
20260620100000_customer_internal_visibility.sql
20260620110000_report_artifact_immutability.sql
20260620120000_expert_review_assignment_checklist.sql
20260620130000_report_revision_workflow.sql
20260620140000_upload_security_metadata.sql
20260620150000_atomic_customer_intake_submission.sql
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
- `save_expert_review_packet` for version-bound reviewer assignment, checklist and decisions.
- `start_report_revision` for a controlled editable successor after requested changes or rejection.
- `submit_customer_intake_draft` for idempotent, transactional draft persistence, tenant provisioning, assessment creation, and file linking.
- `request_report_artifact_generation`, `complete_report_artifact_generation`, and `fail_report_artifact_generation` for controlled, retryable issued artifacts.
- `deliver_report_version` and `revoke_report_delivery` for organisation-scoped publication and revocation.
- `authorize_report_artifact_download` and `record_report_artifact_download` for expiring downloads and audit history.

Direct client writes that bypass these controls should be treated as defects.

## GitHub Workflow

Implementation tranches are developed on `codex/*` branches, validated locally, opened as focused pull requests, and merged to `main` only after required remote checks pass. Use the GitHub pull-request history as the authoritative release record rather than maintaining a duplicated latest-PR pointer here.

## Development Notes

- Keep UI changes consistent with the existing internal workbench style.
- Prefer server-enforced workflow rules over client-only button hiding.
- Preserve explicit `unknown` states instead of converting missing diligence into certainty.
- Treat every issued report as reproducible from assessment data, methodology version, evidence snapshots, review state, and report version.
- Keep broad portfolio workflows secondary until the single-site pilot path is secure and repeatable.
