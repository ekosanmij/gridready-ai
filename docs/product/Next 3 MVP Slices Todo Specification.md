# GridReady AI - Next 3 MVP Slices To-Do Specification

## Purpose

This document defines the next three MVP build slices for moving GridReady AI from an internal intake/checklist console toward the MVP V1 deliverable:

GridReady AI Site Power Feasibility & Interconnection Readiness Report

The current product already has the foundation for:

- Assessment dashboard
- Site intake create/edit flow
- Intake completeness scoring
- Workflow status updates
- Analyst notes
- Document references
- ERCOT analyst checklist templates and responses
- Intake-based checklist auto-fill
- GIS map view with radius rings
- Manual grid asset and candidate POI capture

The next slices should convert captured diligence into structured evidence, findings, scores, review gates, and a report-ready output.

## Guiding Principle

Build only what helps GridReady produce a credible paid report faster, with clearer evidence, fewer unsupported claims, and a repeatable analyst workflow.

Do not build a broad SaaS platform yet.

---

## Slice 1: Evidence Library, Findings, and Source Linking

### Objective

Create a structured evidence and findings layer so every major conclusion in an assessment can be tied to a source, customer claim, analyst assumption, or expert judgement.

This slice closes the biggest trust gap in the current MVP: the app can capture notes and document references, but it cannot yet prove why a recommendation is credible.

### User Story

As a GridReady analyst, I need to record sources, claims, assumptions, and findings for each site assessment so that report conclusions are traceable and unsupported claims are visible before delivery.

### In Scope

- Evidence source library per assessment
- Structured findings per assessment
- Evidence-to-finding linking
- Finding risk/severity classification
- Finding confidence classification
- Evidence source metadata
- Basic evidence completeness indicators
- Migration coverage for new tables
- UI panels inside the existing assessment detail page

### Out of Scope

- Automatic data ingestion from utility, ISO, or GIS APIs
- Full document upload and private file storage
- PDF generation
- Advanced source licensing workflows
- AI-generated conclusions without analyst review

### Database To-Dos

- Add `evidence_sources` table:
  - `id`
  - `site_assessment_id`
  - `title`
  - `source_type`
  - `publisher`
  - `url`
  - `file_reference`
  - `accessed_at`
  - `published_at`
  - `confidence_level`
  - `license_notes`
  - `limitation_notes`
  - `summary`
  - `created_at`
  - `updated_at`

- Add `assessment_findings` table:
  - `id`
  - `site_assessment_id`
  - `module_key`
  - `title`
  - `finding_type`
  - `risk_level`
  - `confidence_level`
  - `statement`
  - `assumption_note`
  - `recommendation`
  - `status`
  - `created_at`
  - `updated_at`

- Add `finding_evidence_links` table:
  - `id`
  - `finding_id`
  - `evidence_source_id`
  - `link_note`
  - `created_at`

- Add constraints for:
  - Source type
  - Risk level
  - Confidence level
  - Finding status
  - Module key

- Add indexes for:
  - `site_assessment_id`
  - `module_key`
  - `risk_level`
  - `finding_id`
  - `evidence_source_id`

### UI To-Dos

- Add an Evidence Library panel to assessment detail.
- Add source create/edit form.
- Add source list grouped by source type or confidence.
- Add a Findings panel grouped by MVP module:
  - Power feasibility
  - Interconnection readiness
  - Reliability risk
  - Energy economics
  - Flexibility
  - Site/non-power risks
  - Evidence and assumptions
  - Expert review

- Add finding create/edit form with:
  - Module
  - Title
  - Type
  - Risk level
  - Confidence
  - Statement
  - Assumption note
  - Recommendation
  - Linked evidence

- Add visual flags:
  - Findings with no evidence
  - High-risk findings with no recommendation
  - Low-confidence sources
  - Findings relying only on assumptions

### Logic To-Dos

- Calculate assessment-level evidence readiness:
  - Total evidence sources
  - Total findings
  - Findings with evidence
  - High-risk findings without evidence
  - Findings using assumptions only

- Preserve the distinction between:
  - Official evidence
  - Customer-provided claim
  - Analyst-derived estimate
  - Expert judgement
  - Unverified web source

- Add helper functions for:
  - Source labels
  - Risk labels
  - Confidence labels
  - Evidence readiness summary

### Acceptance Criteria

- Analyst can add at least one evidence source to an assessment.
- Analyst can add at least one finding to each major MVP module.
- Analyst can link one or more evidence sources to a finding.
- Findings can be classified by risk level and confidence.
- The assessment detail page visibly flags high-risk findings without evidence.
- Evidence and findings survive page refresh and reload from Supabase.
- `npm run lint` passes.
- `npm run build` passes.

### Definition of Done

This slice is done when an analyst can answer: "What are we claiming, why do we believe it, what is the source, and how confident are we?"

---

## Slice 2: Scorecard, Verdict, and Delivery Gates

### Objective

Create a structured scoring and verdict workflow that converts intake, checklist responses, GIS assets, evidence, and findings into a repeatable analyst scorecard.

This slice gives the product its first real decision layer.

### User Story

As a GridReady analyst, I need to assign module scores, risk ratings, and a final recommendation so every assessment has a consistent go/no-go decision framework.

### In Scope

- Assessment scorecard model
- Manual score entry with calculated summary
- Module-level score guidance
- Final verdict selection
- Delivery readiness checks
- Expert review trigger indicators
- Scorecard UI on assessment detail
- Basic status gating before "Delivered"

### Out of Scope

- Fully automated scoring engine
- Machine-learning recommendations
- Multi-site ranking
- PDF export
- Customer-facing delivery portal

### Database To-Dos

- Add `assessment_scores` table:
  - `id`
  - `site_assessment_id`
  - `module_key`
  - `score`
  - `risk_level`
  - `confidence_level`
  - `rationale`
  - `override_note`
  - `created_at`
  - `updated_at`

- Add `assessment_verdicts` table:
  - `id`
  - `site_assessment_id`
  - `verdict`
  - `summary`
  - `key_strengths`
  - `key_risks`
  - `recommended_next_steps`
  - `limitations_note`
  - `approved_by_analyst`
  - `approved_at`
  - `created_at`
  - `updated_at`

- Add `expert_reviews` table:
  - `id`
  - `site_assessment_id`
  - `review_type`
  - `reviewer_name`
  - `status`
  - `trigger_reason`
  - `comments`
  - `required_changes`
  - `approved_at`
  - `created_at`
  - `updated_at`

- Add constraints for:
  - Score range 0 to 100
  - Verdict enum
  - Review status enum
  - Module key enum

### Score Modules

- Power feasibility
- Interconnection readiness
- Reliability risk
- Energy economics
- Flexibility potential
- Site/non-power risk
- Evidence quality
- Overall readiness

### Verdict Options

- Proceed
- Proceed with conditions
- Escalate to deeper diligence
- Pause
- Reject
- Insufficient information

### UI To-Dos

- Add Scorecard panel to assessment detail.
- Show module score cards with:
  - Score
  - Risk level
  - Confidence
  - Rationale
  - Override note

- Add score summary:
  - Average score
  - Lowest-scoring module
  - Critical risk count
  - Evidence gap count
  - Expert review required flag

- Add Final Verdict panel:
  - Verdict selector
  - Executive summary
  - Key strengths
  - Key risks
  - Recommended next steps
  - Limitations note

- Add Delivery Gates panel:
  - Intake minimum complete
  - Checklist required items answered
  - High-risk findings have evidence or assumption notes
  - Scorecard complete
  - Verdict selected
  - Expert review complete if triggered
  - Limitations language present

### Logic To-Dos

- Calculate scorecard completeness.
- Detect expert review triggers:
  - Target load >= 75 MW
  - Reliability score below 70
  - Interconnection readiness score below 70
  - Unknown ride-through assumptions
  - Backup generation or storage strategy present
  - Investor underwriting project type
  - Critical risk finding present

- Prevent or warn before marking an assessment `delivered` if delivery gates are incomplete.
- Keep analyst override notes wherever a score conflicts with checklist/finding risk.

### Acceptance Criteria

- Analyst can enter and save scores for all score modules.
- Analyst can select and save a final verdict.
- Assessment detail shows scorecard completion percentage.
- Expert review requirement is automatically flagged from load, scores, findings, and project type.
- Delivery gates show clear pass/risk/blocked status.
- Attempting to mark an assessment delivered warns when gates are incomplete.
- Scorecard data reloads from Supabase after refresh.
- `npm run lint` passes.
- `npm run build` passes.

### Definition of Done

This slice is done when every assessment can produce a structured scorecard and final recommendation that an analyst can defend.

---

## Slice 3: Report Builder and Exportable Draft Package

### Objective

Generate a report-ready draft from structured assessment data so GridReady can move from internal analysis to a customer deliverable.

This slice creates the bridge from the platform to the paid MVP report.

### User Story

As a GridReady analyst, I need to generate an editable draft report from assessment data so I can produce a consistent customer-ready report faster.

### In Scope

- Report section model
- Draft report generation from structured data
- Editable report sections
- Evidence appendix generation
- Scorecard insert
- Grid asset/POI insert
- Investor/utility memo draft
- HTML report preview
- Export-ready print view

### Out of Scope

- Fully polished automated PDF styling
- Customer portal delivery
- External e-signature or approval workflow
- Multi-site report generation
- Automated map image export from MapLibre

### Database To-Dos

- Add `report_templates` table:
  - `id`
  - `name`
  - `market_region`
  - `report_type`
  - `version`
  - `is_active`
  - `created_at`
  - `updated_at`

- Add `report_template_sections` table:
  - `id`
  - `template_id`
  - `section_key`
  - `section_title`
  - `sort_order`
  - `default_prompt`
  - `required`
  - `created_at`
  - `updated_at`

- Add `assessment_report_sections` table:
  - `id`
  - `site_assessment_id`
  - `template_section_id`
  - `section_key`
  - `section_title`
  - `draft_body`
  - `edited_body`
  - `status`
  - `created_at`
  - `updated_at`

- Add `assessment_report_exports` table:
  - `id`
  - `site_assessment_id`
  - `export_type`
  - `status`
  - `storage_path`
  - `generated_at`
  - `created_at`

### Required Report Sections

- Executive Verdict
- Site Overview
- Project Assumptions
- Power Feasibility Score
- Nearby Grid Infrastructure
- Utility / TSP / DSP / Market Context
- Likely Interconnection Pathway
- Required Information and Missing Diligence
- Grid Reliability Risk Assessment
- Energy Economics and Congestion View
- Nearby Generation and Power Procurement Options
- Flexibility and Demand-Response Potential
- Permitting, Water, Cooling, and Community Risk Flags
- Key Risks and Mitigants
- Recommended Next Steps
- Investor/Utility-Ready Memo
- Evidence Appendix
- Assumptions and Limitations

### UI To-Dos

- Add Report Builder view or tab from assessment detail.
- Add "Generate draft report" action.
- Add editable sections with:
  - Section title
  - Draft body
  - Edited body
  - Status
  - Save action

- Add report preview page:
  - Cover/header
  - Assessment metadata
  - Scorecard
  - Verdict
  - Key findings
  - Grid assets and candidate POIs table
  - Checklist summary
  - Evidence appendix
  - Assumptions and limitations

- Add investor/utility memo preview:
  - One-page summary
  - Site facts
  - Strengths
  - Risks
  - Open diligence questions
  - Recommended next steps

- Add export controls:
  - Print preview
  - Save report draft
  - Mark report draft ready for review

### Draft Generation Logic

- Generate section drafts from:
  - Intake fields
  - GIS assets and POIs
  - Checklist module progress
  - Evidence sources
  - Findings
  - Scores
  - Verdict
  - Expert review status

- Keep draft text transparent:
  - Do not invent unsupported claims.
  - Insert "Evidence pending" where evidence is missing.
  - Insert "Assumption" labels where the source is analyst judgement.
  - Insert limitations language by default.

- Allow analyst edits without overwriting them on regeneration unless explicitly confirmed.

### Acceptance Criteria

- Analyst can generate draft report sections for a single assessment.
- Report builder includes all required MVP report sections.
- Each section can be edited and saved.
- Preview includes scorecard, verdict, findings, grid assets, checklist summary, evidence appendix, and limitations.
- Missing evidence appears as an explicit gap in the generated draft.
- A print-friendly report preview is available.
- Report can be marked ready for review.
- `npm run lint` passes.
- `npm run build` passes.

### Definition of Done

This slice is done when GridReady can generate a structured, editable, evidence-backed draft report from the internal analyst console.

---

## Recommended Sequence

1. Slice 1: Evidence Library, Findings, and Source Linking
2. Slice 2: Scorecard, Verdict, and Delivery Gates
3. Slice 3: Report Builder and Exportable Draft Package

This order keeps the report honest. Evidence and findings should exist before scoring, and scoring should exist before report generation.

## Combined MVP Outcome After These 3 Slices

After completing these slices, GridReady should be able to:

- Capture a candidate site assessment.
- Track analyst checklist progress.
- Capture grid assets and candidate POIs.
- Record structured evidence.
- Record structured findings.
- Produce a scorecard.
- Select a defensible verdict.
- Trigger expert review where needed.
- Generate an editable draft report.
- Generate an investor/utility-ready memo draft.
- Produce a print-ready report preview.

At that point, the product should be close to MVP V1 for services-led pilot delivery, even if customer portal, full PDF automation, private file storage, and multi-site ranking remain future slices.

## Non-Negotiables Across All 3 Slices

- No unsupported final claims.
- Every high-risk finding needs evidence, assumption notes, or expert judgement.
- No guarantee language around power availability or interconnection approval.
- ERCOT/Texas remains the default market.
- Analyst edits must be preserved.
- The app must remain useful for manual expert workflow, not just automation demos.
- `npm run lint` and `npm run build` must pass after each slice.
