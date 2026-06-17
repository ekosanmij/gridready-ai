# GridReady AI Service Portal UX Audit and Redesign To-Do Specification

Date: 2026-06-16

Status: Draft for redesign implementation

Owner: GridReady AI product/design/engineering

Legacy/completed docs consulted for historical context only:

- `docs/product/GridReady AI UX Modernization To-Do Specification.md`
- `docs/product/GridReady AI UX Modernization Implementation Prompts.md`
- `docs/product/Next 3 MVP Slices Todo Specification.md`

Important: the documents above are not active requirements for this redesign. They describe earlier UX modernization work that has already been implemented or superseded. This document is the new source of truth for the next redesign cycle and is based on the current live application and code as of 2026-06-16.

## Purpose

This document audits the current GridReady AI intake experience and defines a comprehensive redesign specification for moving from a functional internal console to a modern service portal and analyst workspace.

The current UI has improved from a raw long form, but the product still feels convoluted, long, custom, and not smart. It does not yet feel like a modern ServiceNow, Jira Service Management, or Atlassian-style portal. The core issue is not only visual polish. The core issue is product model: GridReady currently presents a dense assessment database and wizard, while the target should feel like a guided service portal backed by an intelligent analyst workbench.

This specification supersedes the completed modernization roadmap and the incremental "make the wizard nicer" direction where there is conflict. The new goal is to redesign the intake journey around request types, progressive disclosure, smart defaults, status clarity, and role-specific workspaces.

## Source-of-Truth Hierarchy

Use this order when implementing the next redesign:

1. Current live app behavior on `/intake` and related routes.
2. Current code in `web/src`.
3. This service portal audit and redesign specification.
4. Legacy/completed docs only when they explain existing behavior or historical intent.

Do not re-implement old roadmap items just because they appear in completed documents. If an old item conflicts with this document, follow this document.

## External Reference Model

The redesign should not copy ServiceNow or Atlassian styling directly. It should adopt the interaction patterns that make those products feel mature:

- Atlassian Design System layout guidance: page structure should clearly separate navigation, content, and contextual regions. Reference: https://atlassian.design/components/navigation-system/layout
- Atlassian empty states: an empty state should explain what happened and what to do next. Reference: https://atlassian.design/components/empty-state
- Atlassian lozenges: compact status indicators should support quick recognition. Reference: https://atlassian.design/components/lozenge
- Jira Service Management portal model: request types are configured and grouped so users can find the correct request on the customer portal. Reference: https://confluence.atlassian.com/spaces/SERVICEDESKSERVER/pages/939926357/Setting%2Bup%2Brequest%2Btypes
- Jira Service Management help center model: users can raise requests and track requests through a portal. Reference: https://confluence.atlassian.com/spaces/SERVICEDESKSERVER/pages/939926277/Configuring%2Bthe%2Bcustomer%2Bportal
- ServiceNow Workspace model: workspaces present records, data, and actionable insights tailored to roles and workflows. Reference: https://horizon.servicenow.com/workspace/overview
- ServiceNow form sections model: form sections use headers and disclosure patterns to organize related fields. Reference: https://horizon.servicenow.com/workspace/components/now-record-form-section-connected

## Audit Scope

Live route audited:

- `http://localhost:3000/intake`

Implementation areas reviewed:

- `web/src/components/intake-workspace.tsx`
- `web/src/components/ui-primitives.tsx`
- `web/src/components/address-autocomplete-field.tsx`
- `web/src/components/site-map-panel.tsx`
- `web/src/lib/intake.ts`
- `web/src/lib/intake-steps.ts`
- `web/src/lib/checklists.ts`
- `web/src/lib/checklist-automation.ts`
- `web/src/lib/evidence.ts`
- `web/src/lib/scorecard.ts`
- `web/src/lib/report-builder.ts`
- `web/src/app/globals.css`

Observed current state:

- The main workspace component is roughly 7,900 lines.
- The current intake flow has seven wizard steps.
- The queue can show empty data without a strong next-best action.
- The form has a smart rail and stepper, but the experience is still fundamentally a long internal data entry workflow.
- The detail workspace is a large command-center page with many panels and many responsibilities.

## Executive Diagnosis

GridReady AI does not yet feel like a modern service portal because it lacks five product-level ingredients:

1. A request catalog.
   Users should start by choosing what they are trying to do, not by entering a generic "new assessment."

2. A native portal shell.
   The app needs persistent navigation, search, request status, recently worked items, and contextual work areas.

3. Progressive smart intake.
   The form should reveal questions based on request type, project stage, site certainty, and available evidence.

4. A task-based analyst workspace.
   Analysts should see "what needs doing next," not a wall of panels.

5. A real design system.
   The UI needs fewer ad hoc panels, fewer bespoke controls, more reusable primitives, and more predictable hierarchy.

The current product is an internal assessment console. The target product is a service management portal for power feasibility diligence.

## Severity Scale

- P0: Blocks modern portal quality. Must be fixed for the redesign to be credible.
- P1: Required for the first polished internal release.
- P2: Important for strong product feel, can follow after P0/P1.
- P3: Future maturity or customer-facing expansion.

## Audit Findings

### A1. The entry point is a queue, not a portal

Severity: P0

Current behavior:

- `/intake` opens to "Assessment portal," but the page is still a record queue.
- Empty state can show "No assessments match the current filters" without explaining how to start.
- The global primary action is "New assessment," not a catalog of request types.
- There is no "What do you need?" search-first or request-first experience.

Why it feels wrong:

- ServiceNow and Atlassian portals orient users around services, requests, and next actions.
- GridReady starts users in an internal table/list mental model.

Target behavior:

- The first screen should be a service portal home with:
  - Global search
  - Request type cards
  - My active assessments
  - Work queue
  - Recent items
  - Helpful empty state
  - Clear "Start site screening" action

### A2. "New assessment" is too generic

Severity: P0

Current behavior:

- All new work starts through one generic assessment flow.
- The same seven-step flow covers developer intake, investor underwriting, site screening, evidence collection, and analyst review.

Why it feels wrong:

- A modern portal starts with intent: "Screen a single site," "Underwrite a portfolio," "Upload a data room," "Request investor memo," "Update an existing assessment."
- Generic intake creates unnecessary fields and increases cognitive load.

Target behavior:

- Add a request catalog with request types:
  - Single-site power feasibility screen
  - Portfolio / multi-site triage
  - Investor underwriting review
  - Existing site reassessment
  - Evidence/data-room upload
  - Report package request

Each request type should define:

- Primary user
- Required fields
- Optional fields
- Conditional branches
- Expected output
- SLA/report-cycle expectation
- Default workflow status
- Recommended next action after submission

### A3. The intake is still a wizard, not a smart request form

Severity: P0

Current behavior:

- Seven linear steps: Customer, Location, Load, Grid, Risk, Evidence, Review.
- Users can jump steps, but the model still suggests a long process.
- The smart rail displays blockers, but it does not reduce work.
- Optional and unknown states are not prominent enough.

Why it feels wrong:

- Modern service portals make common requests feel short and specific.
- The form should branch, prefill, validate, and summarize.
- A "smart" product should ask fewer questions when it has enough context.

Target behavior:

- Replace the wizard-first model with request-type-specific forms.
- Use progressive sections:
  - Essential
  - Site
  - Power need
  - Evidence
  - Advanced assumptions
  - Review
- Show only essential fields first.
- Let users mark fields as:
  - Unknown
  - To be confirmed
  - Provided in attachment
  - Not applicable
- Autosave drafts.
- Show "enough to submit" versus "ideal for analysis."

### A4. The form asks for data before proving value

Severity: P0

Current behavior:

- The user immediately sees fields for organisation, contact, project, site, load, utility, TSP, assumptions, evidence.
- The app does not first produce a useful preview, suitability signal, or intake confidence.

Why it feels wrong:

- The user gets effort before insight.
- Service portals often give search, categorization, request type selection, and expectation setting before heavy forms.

Target behavior:

- Start with:
  - Site name or address
  - Target load
  - Desired energization window
  - Request objective
- Then show a live "assessment readiness" preview:
  - Can start assessment
  - Needs location
  - Needs load/timing
  - Evidence recommended
  - Likely report type

### A5. Empty states are not useful enough

Severity: P0

Current behavior:

- Empty queue says no assessments match filters.
- There is no differentiated state for:
  - No data yet
  - Loading failure
  - Filters removed all records
  - Supabase connected but no records
  - Demo data unavailable

Target behavior:

- Empty states must state:
  - What happened
  - Why it matters
  - Primary next action
  - Secondary action
  - Optional setup/debug context

Example:

Title: "No assessments yet"

Body: "Start with a single-site power feasibility request. You can save a draft with only site, load, and target energization."

Actions:

- Start site screen
- Import existing site
- View sample assessment

### A6. The visual language still reads as custom admin UI

Severity: P0

Current behavior:

- Many bordered panels and nested surfaces.
- Repeated compact cards.
- Heavy reliance on navy, muted green, and status colors.
- Controls are mostly custom Tailwind arrangements rather than a coherent component system.

Why it feels wrong:

- Modern portals feel systematic. They use consistent layout rails, sections, spacing, empty states, request cards, status pills, menus, and command bars.
- The current surface still feels assembled screen by screen.

Target behavior:

- Build a portal design system:
  - AppShell
  - PageHeader
  - CommandBar
  - RequestCard
  - QueueList
  - StatusLozenge
  - FormSection
  - FieldGroup
  - SmartSuggestion
  - EmptyState
  - Drawer
  - ActivityTimeline
  - WorkItemPanel
  - SplitPane

### A7. The app lacks a native application shell

Severity: P0

Current behavior:

- Header contains logo, title, Site, theme, Refresh, New Assessment.
- There is no persistent left navigation, product navigation, or workspace rail.

Why it feels wrong:

- ServiceNow/Atlassian-style apps feel like systems with places:
  - Home
  - Requests
  - Assessments
  - Work queue
  - Evidence
  - Reports
  - Settings

Target behavior:

- Add a responsive app shell:
  - Desktop: left navigation rail + top command/search bar
  - Tablet: compact rail
  - Mobile: top bar + bottom navigation or drawer

### A8. The dashboard metrics are not decision-oriented

Severity: P1

Current behavior:

- Metrics: Total, Intake, Review, Gaps, Drafts.
- They are compact but not yet actionable.

Target behavior:

- Metrics should answer:
  - What needs my attention today?
  - What is blocked?
  - Which sites are time-sensitive?
  - Which requests are waiting on customer evidence?
  - Which reports are ready for review?

Recommended metrics:

- Needs customer input
- Missing site coordinates
- High-risk evidence gaps
- Target energization within 12 months
- Reports ready for review
- My assigned tasks

### A9. Search is basic, not portal-grade

Severity: P1

Current behavior:

- Search filters records by known strings.

Target behavior:

- Global search should support:
  - Assessment name
  - Site
  - Customer
  - County/state
  - Utility/TSP
  - Status
  - Request ID
  - Report section
  - Evidence title
  - Finding title

P2 smart search:

- Natural language queries:
  - "280 MW Oncor sites"
  - "missing coordinates"
  - "reports ready for final review"
  - "high-risk evidence gaps"

### A10. The detail workspace is too monolithic

Severity: P0

Current behavior:

- `AssessmentDetailPanel` receives a very large prop surface.
- The workspace includes map, checklist, evidence, findings, scorecard, verdict, delivery gates, report builder, notes, files.
- It is technically powerful but hard to understand as an app.

Why it feels wrong:

- It is a long vertical workbench, not a native workspace.
- Role-based tasks are mixed together.
- The user has to scroll and decode rather than work from a task list.

Target behavior:

- Split the assessment workspace into:
  - Overview
  - Intake
  - Site & Grid
  - Evidence
  - Findings
  - Scorecard
  - Report
  - Activity
- Use a master-detail layout:
  - Left: task/sidebar navigation
  - Center: active module
  - Right: context panel or activity/insights

### A11. Smartness is mostly computed status, not assisted workflow

Severity: P0

Current behavior:

- Completeness, blockers, warnings, next action, checklist auto-fill, and evidence readiness exist.
- But they mostly summarize after the user enters data.

Target behavior:

- Add proactive assistance:
  - Suggest next field based on request type.
  - Detect duplicates by site/customer/load.
  - Suggest market region from state/county.
  - Suggest utility/TSP from address or known service territory where data exists.
  - Interpret uploaded evidence titles into source types.
  - Generate initial checklist draft after minimal intake.
  - Show confidence level for inferred values.

### A12. There is no request lifecycle UX

Severity: P0

Current behavior:

- Assessment status exists, but the user does not experience the work as a request lifecycle.

Target behavior:

- Add lifecycle states:
  - Draft request
  - Submitted
  - Needs customer input
  - Intake complete
  - Analyst review
  - Expert review
  - Report drafting
  - Final review
  - Delivered
  - Archived

Each state should have:

- Owner
- Next action
- SLA/target date
- Required inputs
- Activity log
- Customer-visible label where relevant

### A13. Data density is not the issue. Unstructured density is.

Severity: P0

Current behavior:

- The product is dense, which is appropriate for analysts.
- But density is not arranged around jobs-to-be-done.

Target behavior:

- Keep density for analyst surfaces.
- Reduce density for request intake.
- Use tiered disclosure:
  - First screen: 3 to 5 core fields.
  - Expandable sections: additional facts.
  - Analyst-only fields: hidden from customer/requester mode.

### A14. The component architecture will resist a true portal redesign

Severity: P0

Current behavior:

- `intake-workspace.tsx` is roughly 7,900 lines.
- It contains data fetching, routing state, dashboard, wizard, detail workspace, checklist, report builder, notes/files, toasts, theme behavior, and many helper components.

Why it matters:

- It is hard to create a polished product while every surface shares one giant component file.
- A real portal needs route-level separation and focused components.

Target behavior:

- Split into feature modules:
  - `components/app-shell`
  - `components/portal-home`
  - `components/request-catalog`
  - `components/smart-intake`
  - `components/assessment-workspace`
  - `components/queue`
  - `components/evidence`
  - `components/report-builder`
  - `lib/intake-request-types`
  - `lib/workflow-next-actions`

### A15. Current routes do not support a native app model

Severity: P0

Current behavior:

- `/intake` is a mode-driven single page.
- Form/detail/dashboard are local state modes.

Target behavior:

- Use route-level app structure:
  - `/intake` - portal home
  - `/intake/requests/new` - request catalog
  - `/intake/requests/new/[requestType]` - smart intake request
  - `/intake/requests/[requestId]` - request status/tracking
  - `/intake/assessments` - analyst queue
  - `/intake/assessments/[assessmentId]` - analyst workspace
  - `/intake/reports/[assessmentId]` - existing report preview

Route-level structure makes the app feel more native and makes browser back/forward behavior meaningful.

### A16. Mobile still feels like a compressed desktop flow

Severity: P1

Current behavior:

- Mobile now reaches fields faster than before, but the page still shows header, status, stepper, section heading, fields, actions, and rail content.

Target behavior:

- Mobile request intake should use:
  - One primary question group at a time
  - Sticky bottom action bar
  - Collapsed progress
  - Optional "Review missing items" drawer
  - No right rail content until review or summary

### A17. The app does not yet communicate "trust"

Severity: P1

Current behavior:

- The UI captures diligence data, but does not consistently show source confidence, assumptions, limitations, or provenance at the moment of entry.

Target behavior:

- Every inferred or analyst-entered item can show:
  - Source
  - Confidence
  - Last updated
  - Owner
  - Needs confirmation

## Target Product Model

The target product should have two linked experiences:

### 1. Service Portal

Audience:

- Internal operator
- Future external customer/investor

Jobs:

- Start a request
- Upload site/evidence
- Track status
- Respond to missing information
- View delivered report

Key screens:

- Portal home
- Request catalog
- Smart request form
- Request status page
- My requests

### 2. Analyst Workspace

Audience:

- GridReady analyst
- Reviewer
- Expert reviewer

Jobs:

- Triage queue
- Complete analysis tasks
- Review evidence
- Resolve findings
- Score risk
- Generate report
- Clear delivery gates

Key screens:

- Analyst work queue
- Assessment workspace
- Evidence workbench
- Report workbench
- Activity timeline

## Target Information Architecture

### Portal Home

Desktop layout:

- Left app navigation
- Top global search/command bar
- Main content:
  - Welcome/context header
  - Request type cards
  - Active requests
  - Work queue summary
  - Recent assessments
- Right context column:
  - SLA/report cycle
  - Help/FAQ
  - Data needed checklist

Mobile layout:

- Top app bar
- Search
- Request type cards
- Active requests
- Bottom nav/drawer

### Request Catalog

Cards:

- Single-site power feasibility screen
- Portfolio triage
- Investor underwriting review
- Evidence upload / data room review
- Update existing assessment
- Report package request

Each card:

- Title
- Short description
- Typical time to complete
- Required inputs
- Output
- Start button

### Smart Request Form

The request form should not start as a seven-step wizard. It should use a short, adaptive structure:

1. Request intent
2. Site identity
3. Power need
4. Evidence and assumptions
5. Review and submit

Sections can be opened inline as needed, but the page should always communicate:

- Required to submit
- Helpful for better analysis
- Can be completed later

### Request Status Page

Shows:

- Request ID
- Status
- Owner
- Target report date
- Missing inputs
- Activity timeline
- Submitted data
- Linked assessment
- Linked report

### Analyst Assessment Workspace

Default view:

- Header with site/load/status
- Next best action
- Health summary
- Task list
- Active module
- Context panel

Modules:

- Overview
- Intake
- Site & Grid
- Checklist
- Evidence
- Findings
- Scorecard
- Report
- Activity

## Design System Specification

### Foundational Tokens

Add or normalize tokens:

- `--color-app-bg`
- `--color-sidebar`
- `--color-header`
- `--color-surface`
- `--color-surface-raised`
- `--color-surface-muted`
- `--color-border-subtle`
- `--color-border-strong`
- `--color-text`
- `--color-text-muted`
- `--color-text-subtle`
- `--color-action`
- `--color-action-hover`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--color-info`
- `--color-neutral`

### Component Primitives

P0 components:

- `AppShell`
- `SideNav`
- `TopBar`
- `CommandSearch`
- `PageHeader`
- `EmptyState`
- `StatusLozenge`
- `RequestTypeCard`
- `QueueItem`
- `FormSection`
- `SmartField`
- `InlineValidation`
- `AutosaveIndicator`
- `ActionBar`
- `ActivityTimeline`
- `ContextPanel`

P1 components:

- `SplitPane`
- `InsightPanel`
- `SuggestionCard`
- `EvidenceDropzone`
- `RequestStatusTracker`
- `TaskList`
- `Drawer`
- `KeyboardCommandMenu`

### Visual Rules

- Do not place cards inside cards unless the inner item is a repeated record.
- Use page sections and panels instead of nested boxes.
- Use compact status lozenges for workflow state.
- Use left aligned forms with clear labels and inline help.
- Use disclosure sections for optional fields.
- Use one primary action per screen.
- Avoid decorative gradients/orbs/blobs.
- Keep operational density, but organize it by task.

## Smart Intake Specification

### Required Concepts

Introduce request type definitions:

```ts
type IntakeRequestType = {
  id: string;
  title: string;
  description: string;
  primaryOutcome: string;
  requiredFields: Array<keyof AssessmentFormState>;
  optionalFields: Array<keyof AssessmentFormState>;
  conditionalSections: IntakeConditionalSection[];
  defaultStatus: AssessmentStatus;
};
```

Introduce field states:

```ts
type IntakeFieldState = "provided" | "missing" | "unknown" | "to_confirm" | "not_applicable" | "provided_in_attachment";
```

Introduce smart suggestions:

```ts
type IntakeSuggestion = {
  id: string;
  field: keyof AssessmentFormState;
  value?: string;
  source: "user" | "address_lookup" | "prior_assessment" | "uploaded_evidence" | "system_rule";
  confidence: "low" | "medium" | "high";
  reason: string;
};
```

### Form Behavior

P0 behavior:

- Autosave draft every 2 to 5 seconds after changes.
- Show "Saved", "Saving", "Unsaved changes", and "Save failed" states.
- Allow submit when minimum required fields for request type are complete.
- Separate "required to submit" from "required for final report."
- Provide "unknown" and "provided in attachment" options where appropriate.
- Use a review screen that groups missing information by impact.

P1 behavior:

- Detect duplicate site/assessment candidates.
- Infer assessment name from site/project.
- Infer market region from state.
- If address lookup fills coordinates, mark fields as system-filled with confidence.
- If evidence text mentions utility/TSP, suggest values.
- If target load is under product threshold, show fit warning.

### Minimum Field Sets

Single-site screen:

- Site name or address
- Target load MW
- Desired energization window
- Customer/project name
- Contact email or internal owner

Investor underwriting review:

- Sponsor/customer
- Candidate site or portfolio description
- Target load range
- Investment decision deadline
- Existing materials/upload

Evidence upload request:

- Linked assessment or new site name
- File/reference title
- Source type
- Summary

## Prioritized To-Do Specification

### Epic SPR-001: Portal App Shell

Priority: P0

Goal:

Make GridReady feel like a native product with stable navigation and workspace regions.

To-do:

- Add `components/app-shell/AppShell.tsx`.
- Add `components/app-shell/SideNav.tsx`.
- Add `components/app-shell/TopBar.tsx`.
- Add `components/app-shell/MobileNav.tsx`.
- Move logo, theme, refresh, and primary actions into shell.
- Add navigation entries:
  - Home
  - Requests
  - Assessments
  - Evidence
  - Reports
  - Settings
- Add global search placeholder with future command menu support.
- Make shell responsive.

Acceptance criteria:

- `/intake` no longer looks like a single standalone page.
- Browser back/forward behavior maps to routes, not hidden local modes.
- Mobile has a drawer or bottom nav.
- There is one primary action per page.

### Epic SPR-002: Route-Level Information Architecture

Priority: P0

Goal:

Replace local `mode` state with route-level screens.

To-do:

- Create `/intake` as portal home.
- Create `/intake/requests/new` as request catalog.
- Create `/intake/requests/new/[requestType]` as smart request intake.
- Create `/intake/assessments` as analyst queue.
- Create `/intake/assessments/[assessmentId]` as assessment workspace.
- Preserve `/intake/reports/[assessmentId]`.
- Add route guards/fallbacks for missing records.

Acceptance criteria:

- Direct links work for home, request creation, queue, and assessment detail.
- Refresh does not lose the current screen.
- Local `mode` state is removed or reduced to local tab/panel state.

### Epic SPR-003: Request Catalog

Priority: P0

Goal:

Replace generic "New assessment" with request type selection.

To-do:

- Add request type definitions in `web/src/lib/intake-request-types.ts`.
- Build `RequestCatalog` component.
- Add cards for:
  - Single-site power feasibility screen
  - Portfolio triage
  - Investor underwriting review
  - Existing assessment update
  - Evidence/data-room upload
  - Report package request
- Each card shows required inputs and output.
- Add search/filter for request types if list grows.

Acceptance criteria:

- User chooses intent before seeing fields.
- Request type controls required fields and conditional sections.
- Empty queue points users to catalog.

### Epic SPR-004: Portal Home and Empty States

Priority: P0

Goal:

Make the first screen useful even when there are zero records.

To-do:

- Build `PortalHome`.
- Add primary empty state for no assessments.
- Add separate empty state for filters returning no results.
- Add sample/demo assessment CTA if sample data exists.
- Add "Start site screen" primary CTA.
- Add "Import existing site" secondary CTA.
- Add "What data do I need?" help panel.

Acceptance criteria:

- Empty state always explains next action.
- Empty state does not look like a dead table.
- First-time user can start the right flow in under 5 seconds.

### Epic SPR-005: Smart Intake Form

Priority: P0

Goal:

Replace the generic seven-step wizard with request-type-specific smart intake.

To-do:

- Create `components/smart-intake/SmartIntakeForm.tsx`.
- Create `SmartIntakeSection`.
- Create `SmartField`.
- Create `MinimumSubmissionChecklist`.
- Create `IntakeReview`.
- Support field states:
  - Provided
  - Missing
  - Unknown
  - To confirm
  - Provided in attachment
  - Not applicable
- Show only request-type relevant sections.
- Collapse optional sections by default.
- Use sticky bottom action bar on mobile.
- Remove right rail on mobile until review/summary.

Acceptance criteria:

- Single-site request can be submitted with minimum fields.
- Advanced fields are optional and discoverable.
- User sees "required to submit" versus "recommended for better analysis."
- Form feels shorter than the current wizard.

### Epic SPR-006: Autosave and Draft Lifecycle

Priority: P0

Goal:

Make intake feel native and resilient.

To-do:

- Add draft state to local component and persistence path.
- Add autosave after changes.
- Add save status indicator.
- Add recovery for failed saves.
- Add explicit "Submit request" separate from "Save draft."
- Add draft request ID before full assessment creation if schema supports it.

Acceptance criteria:

- User can leave and return to draft.
- Save state is visible near actions.
- Submit is not the same concept as save.

### Epic SPR-007: Request Lifecycle and Activity Timeline

Priority: P0

Goal:

Make assessments feel like managed service requests.

To-do:

- Add lifecycle tracker component.
- Add request/assessment activity timeline.
- Track:
  - Created
  - Draft saved
  - Submitted
  - Intake completed
  - Status changed
  - Evidence added
  - Report generated
  - Delivered
- Add owner/assignee display.
- Add target date/SLA display.

Acceptance criteria:

- User can tell where the request is in the workflow.
- Status changes have visible history.
- Next action is always paired with owner.

### Epic SPR-008: Analyst Work Queue

Priority: P0

Goal:

Turn the dashboard queue into a task-oriented work queue.

To-do:

- Split portal home from analyst queue.
- Queue tabs:
  - My work
  - Needs intake
  - Waiting on customer
  - Analyst review
  - Expert review
  - Report drafting
  - Blocked
  - Delivered
- Add saved filters.
- Add row actions.
- Add assignment/owner field if available.
- Add priority derived from blockers, target date, and status.

Acceptance criteria:

- Analyst sees what to work next.
- Queue works on mobile without horizontal table dependency.
- Empty tabs have useful next action.

### Epic SPR-009: Assessment Workspace Redesign

Priority: P0

Goal:

Replace long panel stack with a role-based workbench.

To-do:

- Create `components/assessment-workspace/AssessmentWorkspace.tsx`.
- Add workspace tabs or side navigation:
  - Overview
  - Intake
  - Site & Grid
  - Evidence
  - Findings
  - Scorecard
  - Report
  - Activity
- Add task list panel.
- Add context panel.
- Move current `PanelShell` modules into focused route/tab modules.
- Use master-detail layout where possible.

Acceptance criteria:

- A user can complete checklist/evidence/report work without scrolling through unrelated modules.
- Overview shows health, blockers, next actions, and timeline.
- Workspace remains dense but organized by task.

### Epic SPR-010: Visual System Rebuild

Priority: P0

Goal:

Make the product feel sleek, native, and coherent.

To-do:

- Build shared component primitives listed in this spec.
- Replace ad hoc Tailwind strings in primary workflows.
- Standardize spacing, radius, and typography.
- Standardize status lozenges.
- Standardize empty states.
- Standardize loading states.
- Standardize page headers and command bars.
- Reduce nested panels.
- Add focus states and keyboard states to all controls.

Acceptance criteria:

- Portal home, request catalog, intake, queue, and workspace feel like one product.
- No primary page reads as a custom admin form.
- UI stays polished at 375px, 768px, 1280px, and 1440px widths.

### Epic SPR-011: Smart Suggestions and Confidence

Priority: P1

Goal:

Make the app feel intelligent.

To-do:

- Add suggestion model.
- Add confidence badges for inferred fields.
- Suggest market from site state.
- Suggest assessment name from site/project.
- Suggest next missing field based on workflow status.
- Detect possible duplicates.
- Add "apply suggestion" and "dismiss" actions.
- Log dismissed suggestions for future tuning.

Acceptance criteria:

- User sees at least three useful suggestions in common flows.
- Inferred values are never silently applied without source/confidence.
- Suggestions reduce manual typing.

### Epic SPR-012: Address, Map, and Site Intelligence

Priority: P1

Goal:

Make site entry feel spatial and smart.

To-do:

- Use address search as the primary site entry interaction.
- Show map preview immediately after address selection.
- Show confidence for coordinates.
- Show "address only," "coordinates ready," and "needs confirmation" states.
- Add "draw/pin site" future placeholder.
- Add nearby grid asset preview when data exists.

Acceptance criteria:

- User understands whether the site can be mapped.
- Address lookup visibly reduces manual fields.
- Location section is not just a list of text inputs.

### Epic SPR-013: Evidence Upload and Data-Room Intake

Priority: P1

Goal:

Make evidence a first-class intake path.

To-do:

- Add evidence upload request type.
- Add evidence dropzone component.
- Support file reference metadata.
- Allow evidence to satisfy fields as "provided in attachment."
- Add evidence extraction/manual tagging queue.
- Connect notes/files/evidence/finding relationships in UI.

Acceptance criteria:

- User can start a request by uploading source material.
- Analyst can turn uploaded source into evidence/finding records.
- Missing fields can point to attached documents.

### Epic SPR-014: Report Request and Delivery UX

Priority: P1

Goal:

Make report work feel like a managed deliverable.

To-do:

- Add report package request type.
- Add report readiness tracker.
- Separate report editor from intake/workspace panels.
- Add section status list.
- Add final review checklist.
- Add delivered state with link to report preview.

Acceptance criteria:

- Report drafting is visibly separate from intake.
- User can see what blocks delivery.
- Report preview is reachable from request/assessment status.

### Epic SPR-015: Mobile Portal Experience

Priority: P1

Goal:

Make mobile feel intentional, not compressed desktop.

To-do:

- Add mobile app nav.
- Use sticky bottom actions on intake.
- Collapse progress into compact header.
- Use one question group per screen where needed.
- Move smart rail into review drawer.
- Replace wide tables with list cards.

Acceptance criteria:

- No horizontal scrolling at 375px.
- Primary action is visible without scrolling.
- Request creation can be completed on mobile.

### Epic SPR-016: Accessibility and Keyboard Workflow

Priority: P1

Goal:

Make the portal usable for keyboard and assistive tech users.

To-do:

- Audit heading order.
- Add skip links.
- Ensure form errors are announced.
- Ensure accordions disclose state.
- Ensure command/search is keyboard reachable.
- Ensure focus moves predictably after route/step changes.
- Ensure disabled actions explain why.

Acceptance criteria:

- Keyboard user can create request and move through workspace.
- Screen reader user receives useful status and validation feedback.
- No focus traps.

### Epic SPR-017: Product Analytics and UX Measurement

Priority: P2

Goal:

Measure whether the redesign reduces friction.

To-do:

- Track request type selected.
- Track draft created.
- Track form abandoned.
- Track field unknown/provided-in-attachment usage.
- Track autosave failure.
- Track time to submit.
- Track blockers at submission.
- Track next-action clicks.
- Track queue filter/search usage.

Acceptance criteria:

- Product team can compare old wizard versus new smart intake.
- Top friction points are visible.

## Recommended Implementation Phases

### Phase 0: Stop digging

Purpose:

Avoid adding more UI to the monolith.

Tasks:

- Freeze non-critical additions to `intake-workspace.tsx`.
- Create portal architecture folder structure.
- Agree request types.
- Agree route map.

### Phase 1: Portal shell and request catalog

Epics:

- SPR-001
- SPR-002
- SPR-003
- SPR-004

Outcome:

- `/intake` feels like a real portal home.
- "New assessment" becomes "Start request."
- Empty states are useful.

### Phase 2: Smart intake

Epics:

- SPR-005
- SPR-006
- SPR-011 partial
- SPR-012 partial

Outcome:

- Single-site request flow feels short, guided, and intelligent.
- Draft/save/submit are distinct.

### Phase 3: Analyst workspace

Epics:

- SPR-007
- SPR-008
- SPR-009

Outcome:

- Analysts work from tasks and modules, not a long scroll stack.

### Phase 4: Evidence/report polish

Epics:

- SPR-013
- SPR-014

Outcome:

- Evidence and report workflows feel like product features, not appended panels.

### Phase 5: Mobile, accessibility, analytics

Epics:

- SPR-015
- SPR-016
- SPR-017

Outcome:

- The experience is robust, measurable, and usable across devices.

## Engineering Refactor Targets

### New suggested structure

```txt
web/src/app/intake/page.tsx
web/src/app/intake/requests/new/page.tsx
web/src/app/intake/requests/new/[requestType]/page.tsx
web/src/app/intake/requests/[requestId]/page.tsx
web/src/app/intake/assessments/page.tsx
web/src/app/intake/assessments/[assessmentId]/page.tsx

web/src/components/app-shell/
web/src/components/portal-home/
web/src/components/request-catalog/
web/src/components/smart-intake/
web/src/components/assessment-workspace/
web/src/components/work-queue/
web/src/components/evidence-workbench/
web/src/components/report-workbench/
web/src/components/ui/

web/src/lib/intake-request-types.ts
web/src/lib/intake-field-states.ts
web/src/lib/workflow-next-actions.ts
web/src/lib/request-lifecycle.ts
web/src/lib/suggestions.ts
```

### Monolith reduction target

Current:

- `web/src/components/intake-workspace.tsx`: roughly 7,900 lines

Target:

- No production component file over 700 lines.
- No route container over 350 lines.
- Feature components own their own helper subcomponents.
- Data fetching separated from presentation where practical.

## Acceptance Criteria for "Modern Portal" Quality

The redesign is not complete until all P0 criteria below pass:

- First-time empty state has a useful next action.
- New work starts from request type selection.
- Single-site request can be submitted without touching all advanced fields.
- User can save draft and return later.
- User can track request lifecycle.
- Analyst can find next work item from task-oriented queue.
- Assessment workspace is route-addressable and module-based.
- Primary workflows have no horizontal overflow at 375px.
- Visual system uses shared primitives and tokens.
- No primary workflow depends on nested card stacks.
- Lint and build pass.

## Non-Goals

Do not do these in the first redesign release:

- Do not build a public customer portal with authentication unless the internal portal model is stable.
- Do not introduce a heavy third-party design system.
- Do not rebuild the backend schema from scratch.
- Do not remove analyst capabilities just to simplify UI.
- Do not make the product look like a marketing site.
- Do not add decorative visual effects that do not support workflow clarity.

## Immediate Next Implementation Tickets

### Ticket 1: Create portal shell and route skeleton

Priority: P0

Files:

- `web/src/app/intake/page.tsx`
- `web/src/app/intake/requests/new/page.tsx`
- `web/src/app/intake/assessments/page.tsx`
- `web/src/components/app-shell/*`

Done when:

- `/intake` is a portal home.
- Request catalog and assessment queue have routes.
- Existing functionality remains reachable.

### Ticket 2: Define request types

Priority: P0

Files:

- `web/src/lib/intake-request-types.ts`

Done when:

- Request type definitions exist.
- Request catalog renders from config.
- Each request type maps to fields and minimum submission requirements.

### Ticket 3: Build smart single-site request

Priority: P0

Files:

- `web/src/components/smart-intake/*`
- `web/src/lib/intake-field-states.ts`

Done when:

- Single-site screen can save draft and submit minimum request.
- Unknown/provided-in-attachment states exist.
- Review summarizes missing information by impact.

### Ticket 4: Build modern empty states

Priority: P0

Files:

- `web/src/components/ui/empty-state.tsx`
- Portal home and queue components

Done when:

- Empty queue, no search results, load failure, and first-use states are distinct.

### Ticket 5: Split analyst workspace from intake creation

Priority: P0

Files:

- `web/src/app/intake/assessments/[assessmentId]/page.tsx`
- `web/src/components/assessment-workspace/*`

Done when:

- Workspace modules are route/tab based.
- Long vertical panel stack is no longer the primary navigation model.

## Design Review Checklist

Use this checklist before merging any redesign slice:

- Does the screen answer "what can I do here?" in under 5 seconds?
- Is there one obvious primary action?
- Are advanced fields hidden until needed?
- Does the empty state help the user move forward?
- Does the page feel like part of a product shell?
- Does the UI use shared primitives?
- Does the mobile view feel intentionally designed?
- Does every status have a clear label and owner?
- Does the system reduce work, or only summarize work?
- Would this still feel credible beside ServiceNow/Jira Service Management portal patterns?
