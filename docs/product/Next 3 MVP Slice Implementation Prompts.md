# GridReady AI - Implementation Prompts for Next 3 MVP Slices

Use each prompt in a fresh Codex thread when you are ready to implement that slice. Run them in order.

---

    ## Prompt 1: Evidence Library, Findings, and Source Linking

    ```text
    You are working in the GridReady AI repo at /Users/ekosanmi.j/Documents/GridReady AI.

    Implement MVP Slice 1: Evidence Library, Findings, and Source Linking.

    Before making changes, read:
    - docs/product/GridReady AI MVP Specification.docx
    - docs/product/Next 3 MVP Slices Todo Specification.md
    - web/README.md
    - existing Supabase migrations under supabase/migrations
    - current intake console code under web/src/components and web/src/lib

    Goal:
    Create a structured evidence and findings layer so every major conclusion in a site assessment can be tied to a source, customer claim, analyst assumption, or expert judgement.

    Scope:
    - Add Supabase migrations for evidence_sources, assessment_findings, and finding_evidence_links.
    - Include constraints, indexes, updated_at triggers, and MVP-safe RLS policies consistent with the current repo style.
    - Add TypeScript helpers for source types, finding modules, risk levels, confidence levels, labels, and evidence readiness calculations.
    - Add an Evidence Library panel to the assessment detail page.
    - Add a Findings panel to the assessment detail page.
    - Allow analysts to create, view, and link evidence sources to findings.
    - Flag high-risk findings with no evidence, findings with no recommendation, low-confidence sources, and assumption-only findings.
    - Preserve the existing intake, checklist, notes, document references, and GIS behavior.

    Implementation notes:
    - Follow the existing patterns in web/src/components/intake-workspace.tsx, web/src/lib/checklists.ts, and web/src/lib/gis.ts.
    - Keep the UI internal, dense, and analyst-focused.
    - Do not introduce a new design system.
    - Do not build PDF generation, file upload, customer portal, or external data ingestion in this slice.
    - If existing core Supabase tables are not represented in migrations, do not block the slice; note the dependency clearly in the final response.

    Acceptance criteria:
    - An analyst can add at least one evidence source to an assessment.
    - An analyst can add at least one finding to each major MVP module.
    - An analyst can link one or more evidence sources to a finding.
    - Findings can be classified by risk level and confidence.
    - The assessment detail page visibly flags high-risk findings without evidence.
    - Evidence and findings survive page refresh and reload from Supabase.
    - npm run lint passes.
    - npm run build passes.

    Verify:
    - Run npm run lint from web/
    - Run npm run build from web/
    - Summarize changed files, database migrations, and any remaining caveats.
    ```

    ---

## Prompt 2: Scorecard, Verdict, and Delivery Gates

```text
You are working in the GridReady AI repo at /Users/ekosanmi.j/Documents/GridReady AI.

Implement MVP Slice 2: Scorecard, Verdict, and Delivery Gates.

Before making changes, read:
- docs/product/GridReady AI MVP Specification.docx
- docs/product/Next 3 MVP Slices Todo Specification.md
- docs/product/Next 3 MVP Slice Implementation Prompts.md
- all work completed for Slice 1
- current intake console, checklist, GIS, evidence, and findings code

Goal:
Create a structured scoring and verdict workflow that converts intake, checklist responses, GIS assets, evidence, and findings into a repeatable analyst scorecard and final recommendation.

Scope:
- Add Supabase migrations for assessment_scores, assessment_verdicts, and expert_reviews.
- Include constraints for score range, module keys, verdict options, review status, risk level, and confidence level.
- Add TypeScript helpers for score modules, verdict labels, delivery gate calculations, expert review trigger detection, and scorecard completeness.
- Add a Scorecard panel to the assessment detail page.
- Add a Final Verdict panel to the assessment detail page.
- Add a Delivery Gates panel to the assessment detail page.
- Show module score, risk level, confidence, rationale, and override note.
- Show summary indicators: average score, lowest-scoring module, critical risk count, evidence gap count, expert review required flag.
- Warn before marking an assessment as delivered if delivery gates are incomplete.

Score modules:
- Power feasibility
- Interconnection readiness
- Reliability risk
- Energy economics
- Flexibility potential
- Site/non-power risk
- Evidence quality
- Overall readiness

Verdict options:
- Proceed
- Proceed with conditions
- Escalate to deeper diligence
- Pause
- Reject
- Insufficient information

Expert review triggers:
- Target load >= 75 MW
- Reliability score below 70
- Interconnection readiness score below 70
- Unknown ride-through assumptions
- Backup generation or storage strategy present
- Investor underwriting project type
- Critical risk finding present

Implementation notes:
- Build on the existing assessment detail page rather than creating a separate app.
- Keep scoring manual-first; do not build a black-box automated scoring engine.
- Preserve analyst override notes.
- Do not build PDF generation or customer portal in this slice.
- Keep current behavior for intake, notes, documents, checklist, GIS, evidence, and findings.

Acceptance criteria:
- Analyst can enter and save scores for all score modules.
- Analyst can select and save a final verdict.
- Assessment detail shows scorecard completion percentage.
- Expert review requirement is automatically flagged from load, scores, findings, and project type.
- Delivery gates show pass/risk/blocked status.
- Attempting to mark an assessment delivered warns when gates are incomplete.
- Scorecard, verdict, and review data reload from Supabase after refresh.
- npm run lint passes.
- npm run build passes.

Verify:
- Run npm run lint from web/
- Run npm run build from web/
- Summarize changed files, database migrations, delivery gate behavior, and any remaining caveats.
```

---

## Prompt 3: Report Builder and Exportable Draft Package

```text
You are working in the GridReady AI repo at /Users/ekosanmi.j/Documents/GridReady AI.

Implement MVP Slice 3: Report Builder and Exportable Draft Package.

Before making changes, read:
- docs/product/GridReady AI MVP Specification.docx
- docs/product/Next 3 MVP Slices Todo Specification.md
- docs/product/Next 3 MVP Slice Implementation Prompts.md
- all work completed for Slices 1 and 2
- current intake console, checklist, GIS, evidence, findings, scorecard, verdict, and expert review code

Goal:
Generate a report-ready draft from structured assessment data so GridReady can move from internal analysis to a customer deliverable.

Scope:
- Add Supabase migrations for report_templates, report_template_sections, assessment_report_sections, and assessment_report_exports.
- Seed an ERCOT v1 single-site report template with all required MVP report sections.
- Add report generation logic that creates draft sections from structured data.
- Add a Report Builder view or panel from assessment detail.
- Add editable report sections with save support.
- Add a report preview page or view.
- Add an investor/utility memo preview.
- Add export controls for print preview, save report draft, and mark report draft ready for review.

Required report sections:
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

Draft generation requirements:
- Use intake fields, GIS assets/POIs, checklist progress, evidence sources, findings, scores, verdict, and expert review status.
- Do not invent unsupported claims.
- Insert "Evidence pending" where evidence is missing.
- Label assumptions clearly.
- Include limitations language by default.
- Preserve analyst edits.
- Do not overwrite edited report sections on regeneration unless explicitly confirmed.

Implementation notes:
- A print-friendly HTML preview is enough for this slice; full polished PDF automation can come later.
- Do not build customer portal delivery.
- Do not build multi-site reporting.
- Keep the report builder useful for internal paid pilot delivery.
- Keep the UI consistent with the existing internal analyst console.

Acceptance criteria:
- Analyst can generate draft report sections for a single assessment.
- Report builder includes all required MVP report sections.
- Each section can be edited and saved.
- Preview includes scorecard, verdict, findings, grid assets, checklist summary, evidence appendix, and limitations.
- Missing evidence appears as an explicit gap in the generated draft.
- A print-friendly report preview is available.
- Report can be marked ready for review.
- npm run lint passes.
- npm run build passes.

Verify:
- Run npm run lint from web/
- Run npm run build from web/
- Summarize changed files, database migrations, report generation behavior, preview route/view, and any remaining caveats.
```
