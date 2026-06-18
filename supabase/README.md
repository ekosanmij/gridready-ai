# Supabase schema

Apply files in `migrations/` in timestamp order. The deployed project's pre-existing core tables (`organisations`, `contacts`, `projects`, `sites`, `site_assessments`, `assessment_notes`, `uploaded_files`, and `status_history`) remain a prerequisite.

The production-readiness migration adds Supabase Auth profiles, server-enforced role policies, persistent assignment/SLA history, a private evidence bucket, PostGIS utility territories, analyst-resolved inference suggestions, and one GIN-backed portal search index.

New auth users default to `customer`. Promote invited staff and set customer organisation membership through an administrator-controlled update to `profiles`. Populate `utility_service_territories` from authoritative provider polygons before treating geospatial inference as more than a suggestion.
