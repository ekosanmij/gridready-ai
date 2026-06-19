# Supabase schema

Apply files in `migrations/` in timestamp order. The deployed project's pre-existing core tables (`organisations`, `contacts`, `projects`, `sites`, `site_assessments`, `assessment_notes`, `uploaded_files`, and `status_history`) remain a prerequisite.

The production-readiness migrations add Supabase Auth profiles, explicit organisation memberships, server-enforced role policies, persistent assignment/SLA history, a private evidence bucket, PostGIS utility territories, analyst-resolved inference suggestions, and one GIN-backed portal search index.

New auth users default to `customer`. Self-service customers are provisioned into one organisation through `provision_customer_account`; administrator invitations may supply trusted `organisation_id` and `role` values in Auth app metadata. Tenant authorisation uses `organisation_memberships`, while `profiles.organisation_id` remains a compatibility pointer to the active organisation. Populate `utility_service_territories` from authoritative provider polygons before treating geospatial inference as more than a suggestion.

Run `tests/customer_tenancy_rls.sql` against an isolated migrated Supabase database to exercise the allowed customer golden-path inserts and a denied cross-tenant insert. The fixture is transactional and rolls its records back.

Customer smart-intake drafts are stored in `customer_intake_drafts`. Pre-submission files use private `assessment-evidence` paths under `drafts/<user-id>/<draft-id>/`; `customer_intake_files` retains checksum, MIME, size, processing, malware-scan, and retention metadata before those files are linked to `uploaded_files` at submission.
