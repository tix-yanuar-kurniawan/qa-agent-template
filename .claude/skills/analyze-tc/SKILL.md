---
name: analyze-tc
description: >-
  Analyze test cases from a CSV against a PRD as a QA lead. Validates each case
  for correctness, detects duplicates, hallucinations, and out-of-scope items,
  then appends additional cases. Use when the user asks to analyze test cases,
  review TC, validate test cases, or check test cases against a PRD.
---

# Analyze Test Cases

Act as a **QA Lead**. Given a PRD and a CSV of test cases, analyze every case
for validity and produce an updated CSV with verdict columns.

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Requirements | Jira Epic, Jira Story, Confluence page, or standalone file | The source of truth for what is in scope |
| Figma designs (optional) | Figma links found in Jira issue descriptions | Visual reference for UI flows, components, states, and layout |
| Test Cases | CSV with a single column containing the test case description | The cases to analyze |

The CSV will have only **one column** — the test case text. The column header
may be named `case`, `test case`, `test_case`, or similar. Identify it
automatically.

### Obtaining Requirements

The user will provide **one** of the following. Use the Atlassian MCP server
(`plugin-atlassian-atlassian`) to fetch content.

> **IMPORTANT:** Do NOT delegate Jira or Confluence fetching to subagents
> (Task tool). The Atlassian MCP server is only available in the main agent
> context. Subagents cannot access it and will fall back to opening a browser,
> which fails due to authentication. Always call `getJiraIssue`,
> `searchJiraIssuesUsingJql`, and `getConfluencePage` directly.

#### 1. Jira Epic link

Extract the issue key (e.g., `PROJ-123`) from the URL. Use the site hostname
(e.g., `site.atlassian.net`) as `cloudId`.

1. Fetch the epic itself to get context:
   - `getJiraIssue` with `issueIdOrKey`, `responseContentFormat: "markdown"`.
2. Fetch all stories under the epic:
   - `searchJiraIssuesUsingJql` with
     `jql: "\"Epic Link\" = PROJ-123 OR parent = PROJ-123"`,
     `fields: ["summary", "description", "status", "issuetype", "priority"]`,
     `maxResults: 100`,
     `responseContentFormat: "markdown"`.
3. Compile the epic description + all story descriptions into a single
   requirements document. This combined text is the "PRD".
4. **Extract platform information.** Look at the child stories' summaries
   for platform prefixes like `[BE]`, `[FE]`, `[Panel]`, `[QA]`, or check
   for a `Platforms` custom field (e.g., `customfield_10885`). Common
   platform values: `Backend`, `Responsive` (FE web), `Panel - dWeb`
   (admin dashboard), `Multi-Platform`. Map each test case to the platform
   it belongs to based on which child story it traces back to.

#### 2. Jira Story link

Extract the issue key from the URL.

1. Fetch the story:
   - `getJiraIssue` with `issueIdOrKey`, `responseContentFormat: "markdown"`.
2. Use the story description as the requirements.

#### 3. Confluence link

Extract the page ID or tiny link ID from the URL.

- Full URL format: `https://site.atlassian.net/wiki/spaces/SPACE/pages/123456/Title` → pageId = `123456`
- Tiny link format: `https://site.atlassian.net/wiki/x/Fc1bBw` → pageId = `Fc1bBw`

1. Fetch the page:
   - `getConfluencePage` with `pageId`, `contentFormat: "markdown"`.
2. Use the page body as the PRD.

#### 4. Standalone file

Read the file directly from disk (md, pdf, docx, txt, or pasted text).

### Extracting Figma Designs from Jira Issues

**Figma is optional.** Read it when you can — it is authoritative when available
— but never block, retry, or fail a run because a design could not be read. The
availability rules (one attempt then stop, how to recognise each failure, what to
record, and what to tell the user) live in
`.claude/skills/shared/figma-designs.md`. Read that file the moment a Figma fetch
fails, and follow it instead of improvising.

After fetching a Jira Epic or Story, scan the issue description (and any child
story descriptions) for **Figma URLs**. Figma URLs match patterns like:

- `https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`
- `https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId`
- `https://figma.com/file/:fileKey/...`
- `https://www.figma.com/file/:fileKey/...`
- `https://figma.com/proto/:fileKey/...` (prototypes)

If one or more Figma URLs are found:

1. **Extract `fileKey` and `nodeId`** from each URL.
   - Convert `-` to `:` in the `node-id` query parameter (e.g., `1-2` → `1:2`).
   - If no `node-id` is present, use `0:1` (the first page).
   - For branch URLs (`/branch/:branchKey/`), use `branchKey` as the `fileKey`.
2. **Fetch design context** using the Figma MCP server (`plugin-figma-figma`):
   - Call `get_design_context` with `fileKey`, `nodeId`.
   - This returns a screenshot, code reference, and structural metadata.
3. **Fetch additional screenshots** for other linked nodes if multiple
   `node-id` values are present — call `get_screenshot` for each.
4. **Analyze the Figma designs** to extract:
   - **User flows**: Screen sequences, navigation paths, and transitions
     visible in the prototype or multi-frame layouts.
   - **UI components**: Buttons, forms, modals, dropdowns, tables, toasts,
     tabs, and other interactive elements present in the design.
   - **Visual states**: Default, hover, active, disabled, error, loading,
     empty, and filled states of components.
   - **Responsive / variant considerations**: Different screen sizes or
     component variants shown in the design.
   - **Content & copy**: Labels, placeholder text, error messages, and
     tooltips visible in the mockups.
   - **Edge-case hints**: Empty states, overflow scenarios, or boundary
     conditions depicted in the design.
5. **Merge design insights with PRD requirements.** The Figma designs
   supplement the written PRD — use them as additional source of truth when
   judging test case validity and identifying missing coverage.

If **no Figma URLs** are found in the Jira issue, skip this step and proceed
with the text-based requirements only.

If a Figma URL **is** present but the design cannot be read — the MCP server is
not connected, the account lacks a Dev/Full seat, the quota is exhausted, or the
file is not shared — make a single attempt, then stop and continue on the written
requirements. Record the real reason in the vault note and surface it in the chat
summary. See `.claude/skills/shared/figma-designs.md`.

**This changes how you judge cases.** The `contradicts Figma design` verdict and
any "valid because the mockup shows it" reasoning require a design you actually
read. With no design in hand, judge every case against the written requirements
only, and never mark a case `hallucinated` or `invalid` merely because you could
not confirm a UI detail — say the design was unavailable and leave the case for
the reviewer.

## Output Format

Produce the updated CSV with **six columns**:

```
case,validity,reason,priority,criticality,platform
```

| Column | Values | Description |
|--------|--------|-------------|
| `case` | Original test case text | Unchanged from input |
| `validity` | `valid` / `invalid` / `additional` | Verdict for each case |
| `reason` | Free-text explanation | Why the case is valid, invalid, or was added |
| `priority` | `P0` / `P1` / `P2` / `P3` | Execution priority |
| `criticality` | `critical` / `high` / `medium` / `low` | Business impact if the case fails |
| `platform` | Platform name(s) | Which platform(s) the test case targets |

- For original cases: mark `valid` or `invalid`.
- For cases you add at the end: mark `additional`.

### Priority & Criticality Guide

**Priority** — how urgently the case should be executed:

| Level | When to use |
|-------|-------------|
| `P0` | Must test before any release. Blocks go-live. |
| `P1` | Should test in every regression cycle. |
| `P2` | Test when time permits. Important but not blocking. |
| `P3` | Nice-to-have. Low-frequency or exploratory. |

**Criticality** — business impact if the tested scenario fails in production:

| Level | When to use |
|-------|-------------|
| `critical` | Core business flow broken. Revenue or data loss. |
| `high` | Major feature degraded. Significant user impact. |
| `medium` | Noticeable issue but workarounds exist. |
| `low` | Minor or cosmetic. Minimal user impact. |

Assign priority and criticality to **all** cases, including `invalid` and
`additional` ones. For `invalid` cases, assign what the priority/criticality
*would be* if the case were valid — this helps the user understand which
invalid cases to reconsider.

#### Calibrating P0

`P0` means **committed scope that also carries real impact**. A case is `P0`
when **both** tests pass:

1. **Traceability** — it restates something written explicitly in the epic, a
   child story, or the linked PRD / Confluence page.
2. **Criticality ≥ `high`** — its own `criticality` column is `high` or
   `critical`.

Traceability decides membership (committed scope vs. a combination someone
invented); criticality does the ranking. Traceability alone cannot sort, because
~60% of specific cases in a well-written epic restate something, and it cannot
tell "the product grid renders" apart from "the *More Affordable* badge
renders". Cases that extend, combine, or infer beyond the written text start at
`P1`/`P2`. Target **25–30%** `P0`, 30% as a ceiling.

**If `P0` comes out too big, audit the criticality column first.** A
"criticality ≥ high" gate cannot produce a small tier from a set where half the
cases are `high`, and an incoming CSV very often is — `high` is where writers put
everything they are unsure about. Re-scoring inflated `high` cases is part of the
analysis, exactly like re-prioritising. Two invariants tell you the columns are
healthy: **no `critical` case outside `P0`, and no `medium` case inside it.**

**Promote with no written AC** only when failure loses or misallocates money,
tokens, points, or user data; breaks a shared/backward-compatible mechanism
other features depend on; breaks a primary end-to-end journey that chains
committed requirements; or lets an ineligible actor perform a restricted action.

**Demote despite a written AC** — `medium` at most — for repeat variants of a
pattern already covered (second badge, second locale, one more asset), position
/ spacing / timing / ordering detail, configurability where the default already
works, secondary notifications and trackers and sounds, and internal robustness
detail unless the failure is silent data loss. When a rule has both a **guard**
(button disabled) and a **consequence** (no charge, no deduction), the
consequence carries `critical` and the guard `high`.

**Re-prioritising is part of the analysis.** When an incoming case is correct but
mis-prioritised, keep it `valid`, set the priority you judge right, and say so in
the `reason` column. Cite *which half of the rule* moved it — "not stated in any
story, so `P1`" reads very differently from "stated in PLAT-57195 but cosmetic,
so `P1`".

#### Calibrating criticality

Expect a pyramid: `medium` largest, `critical` and `high` each well under ~20%.
Score by **what the failure costs**, not by how prominent the change is.

- `critical` — money, tokens, points, purchased value or saved data lost; a core
  flow cannot complete; another user's data exposed; an ineligible actor gets
  through.
- `high` — a whole capability is unusable or materially wrong with **no way
  around it**. One extra tap to the same outcome makes it `medium`.
- `medium` — visible and worth fixing, feature still works: copy, ordering,
  layout, asset swaps, position, timing, badges, default selections,
  configurability where the default works, secondary notifications.
- `low` — cosmetic only.

Prominence is not impact — a branding refresh can be the point of the release and
still be `medium`. A variant is not the mechanism — once the mechanism is covered,
the spec'd data points (three price→token amounts, the second locale) are
`medium`. A regression guardrail inherits the criticality of **what breaks if it
fails**, not of the change that prompted it.

**Re-scoring criticality is part of the analysis.** When an incoming case is
correct but its criticality is inflated, keep it `valid`, set the score you judge
right, and say so in the `reason` column.

Before finishing, count `P0` **per story**. If a committed story has zero, the
criticality threshold overreached — re-score the criticality you underestimated
rather than carving out a priority exception. A story with no `P0` ships
unverified in any smoke run.

### Platform Guide

Determine the platform by inspecting the Jira child stories' summary prefixes
and/or the `Platforms` custom field (`customfield_10885`). Common values:

| Platform | When to use |
|----------|-------------|
| `Backend` | Server-side logic, API processing, scheduled jobs, calculations |
| `Responsive` | Frontend web (responsive/mobile web) |
| `Panel - dWeb` | Admin/internal dashboard (CMS, back-office panels) |
| `Multi-Platform` | Spans multiple platforms equally |

If a test case spans multiple platforms (e.g., a BE calculation displayed on
FE), list them separated by commas — **list the frontend first**:
`"Responsive, Backend"`.

When the source is **not** a Jira issue (e.g., Confluence page, standalone
file), determine platform from the PRD context — if the PRD describes backend
logic use `Backend`, if it describes a user-facing UI use `Responsive`, etc.
If platform cannot be determined, use `Multi-Platform`.

Assign platform to **all** cases, including `invalid` and `additional` ones.

### FE-first coverage — flag BE cases already covered by FE

When the epic spans **frontend** (App, Responsive, mWeb, dWeb, Panel) **and
backend**, each behaviour should be covered **through the frontend** and a
`Backend` case should exist **only when no UI can show the behaviour**. The
child-story split in Jira is how the *work* was divided, not how the *testing*
should be — a `[BE]` story and an `[FE]` story describing two halves of one
user-visible behaviour warrant **one** case.

Apply this when judging incoming cases:

1. **A tester can confirm it from a UI** → it belongs on the FE platform. If the
   incoming case is written as a backend/API check, keep it `valid` but
   re-platform it to the FE and rewrite the steps through the UI, noting the
   change in `reason`.
2. **It needs a BE or Panel precondition but the result shows in a UI** → one
   case, platform `"Responsive, Backend"`, precondition as the first step.
3. **It is invisible in the UI, but an FE case in the set triggers it** (the
   request the page sends, the record it saves) → mark the BE case `invalid` as
   merged into that FE case, and in the additional cases re-emit the FE case with
   the BE check as an extra expected-result item.
4. **No FE action reaches it at all** (response schema, status codes for API-only
   consumers, cron, queues, retry/backoff, idempotency, races, logging/metrics,
   DB-only state) → legitimately `Backend`.

**Mark a case `invalid` as a duplicate when an FE case in the same set already
asserts the same observable outcome** — e.g. "Verify successful registration" on
the register page and "Verify `POST /register` returns 201" are one behaviour.
Point the `reason` at the case that already covers it. A `Backend` case whose
expected result is a number, message, state, or list the user can see is the
usual offender.

### Surface coverage — flows the epic never names

Validating each case against the PRD only tells you whether the *existing* cases
are right; it cannot show what is missing outside the PRD. Before appending new
cases, name the surface the epic changes (a form, config object, API field) and
list every flow that creates, copies, loads or edits it — create, edit,
view-only, duplicate/clone, draft resume, import, pre-existing records,
lifecycle states, other roles and entry points, API twins. Search the vault by
the *surface name*, not only the feature's terms, and read older notes on the
same surface. Any flow with no case in the CSV gets an appended case (step 9)
and is called out in the run summary as "not named in the source". Same rules as
create-tc: assert only what a source states, use `UNKNOWN` otherwise.

## Analysis Criteria

Evaluate each test case against the PRD using the following checks (not
exhaustive — apply QA judgment):

### Grounds for `invalid`

| Reason label | Description |
|--------------|-------------|
| **duplicate** | Same intent as another case but different wording. Reference the case it duplicates. |
| **hallucinated** | Describes behavior or feature not mentioned or implied by the PRD or Figma designs. |
| **out-of-scope** | Tests something explicitly excluded or unrelated to the PRD/Figma scope. |
| **contradicts PRD** | The expected outcome conflicts with what the PRD specifies or the Figma design shows. |
| **contradicts Figma design** | The case assumes UI elements, flows, or states that contradict what the Figma mockups show. |
| **ambiguous / untestable** | Too vague to execute as a meaningful test. |
| **incorrect assumption** | Based on an assumption that the PRD does not support. |

Use the labels above in the `reason` column where applicable, followed by a
short explanation. You may combine labels or use a custom reason if none of the
above fit — the list is a guideline, not a constraint.

### Confirming `valid` — Strict Mode

A case is `valid` **only** when **all** of the following are true:

1. **Directly traceable**: Maps to a specific, identifiable requirement or
   acceptance criterion in the PRD **or to a UI behavior clearly depicted in
   the linked Figma designs**. You must be able to point to the exact PRD
   clause or Figma screen/state it covers.
2. **Testable outcome**: Has a clear, observable expected result — not just
   "works correctly" or "handles gracefully".
3. **Not duplicated**: No other case in the set tests the same scenario.
4. **Feature-scoped**: Tests the feature being built, not general system
   qualities (performance, resilience, backward compatibility, etc.) unless
   the PRD or Figma designs explicitly call them out.

**Strict interpretation rules:**

- "Reasonable regression test" is **not enough** — the case must tie to a
  specific PRD requirement or Figma design element. Generic regression belongs
  to a separate regression suite, not this feature's test set.
- Vague cases like "system handles X gracefully" or "no errors occur" are
  `invalid` (ambiguous / untestable) unless the PRD defines what "gracefully"
  or "no errors" means.
- Performance, load, and concurrency tests are `invalid` (out-of-scope)
  unless the PRD includes non-functional requirements.
- API contract/response tests are only valid if the PRD specifies the API
  behavior.
- **UI behavior tests** (e.g., button states, form validation messages, empty
  states) are `valid` if the Figma design explicitly shows them, even when the
  PRD text does not mention them.
- If a case is borderline, lean toward `invalid` and explain what would make
  it valid.

For valid cases, cite the specific PRD requirement (e.g., "Requirement 3 —
popup confirmation before toggling ON") **or** the Figma reference (e.g.,
"Figma — error state shown in the login form mockup").

## Workflow

### Before Analysis — Load Knowledge

1. **Pull relevant prior knowledge from the vault** — see
   `.claude/skills/shared/vault-notes.md` §0. Prefer the `obsidian` MCP server
   (`search` with the feature's terms, then `read_note` / `get_backlinks`);
   fall back to `knowledge/index.json` + `knowledge/entries/*.md` if it isn't
   connected.
2. **Apply what you find** — known patterns, recurring invalid case types,
   related features, and the heuristics in `.claude/rules/qa-heuristics.md`.

### Core Analysis

3. **Fetch the requirements.** Determine the source type (Epic, Story,
   Confluence, or file) and retrieve the content using the appropriate method
   from "Obtaining Requirements" above.
4. **Extract and inspect Figma designs (optional).** If the source is a Jira
   Epic or Story, scan for Figma URLs and fetch design context as described in
   "Extracting Figma Designs from Jira Issues". This step runs in parallel
   with reading the text requirements. If the MCP fetch fails, follow
   `.claude/skills/shared/figma-designs.md` (including headed Playwright
   recovery when a human can log in) and keep going — the analysis
   completes on the written requirements alone when neither path can read the file.
5. **Read the requirements thoroughly.** Combine the PRD text **and** Figma
   design insights. Build a mental model of all features, acceptance criteria,
   edge cases, and explicit exclusions. Pay special attention to:
   - UI flows and screen transitions visible in the Figma designs
   - Component states (disabled, error, loading, empty) shown in the mockups
   - Visual details the PRD may not spell out (e.g., toast messages, inline
     validation, conditional button states)
6. **Read all test cases first** before marking any, so you can detect
   duplicates across the full set.
6b. **Map the changed surface.** Run *"Surface coverage"* above and compare the
   flow list against the CSV. Missing flows become appended cases in step 9.
7. **Analyze each case** against the requirements (text + Figma) and apply
   the criteria above. When Figma designs are available:
   - A case testing a UI behavior shown in the Figma mockups is `valid` even
     if the PRD text doesn't explicitly describe it.
   - A case that contradicts what the Figma design shows (e.g., testing a
     button that doesn't exist in the mockup) should be flagged as
     `invalid` — `contradicts Figma design`.
8. **Write the output CSV** with `case`, `validity`, `reason`, `priority`,
   `criticality`, and `platform` columns. Assign the platform for each case
   based on which child story or PRD section it traces to.
9. **Append additional cases.** After all original cases are analyzed, add any
   missing end-to-end or edge-case scenarios that the requirements **or Figma
   designs** demand but the original set missed. Prioritize adding cases for:
   - UI states visible in Figma but not covered by any existing case
   - User flows shown in the prototype that lack test coverage
   - Component interactions (e.g., dropdown selections, modal confirmations)
     depicted in the design

   Mark these with `validity = additional`.
10. **Save the file.** Write the output CSV to the `output/` folder, using the
    same filename as the original. The original file in `original/` must remain
    untouched.

### After Analysis — Save Knowledge

Persist the run into the Obsidian knowledge vault. **Follow
`.claude/skills/shared/vault-notes.md` for the exact note format.** In summary:

11. **Write `knowledge/entries/<KEY>.md`** as an Obsidian note: YAML frontmatter
    (`kind`, `key`, `title`, `source`, `action: analyze`, `date`, `figma`,
    `tags` = sanitized keywords, `keywords` = verbatim phrases, `related` as
    `[[wikilinks]]`, `cases_valid` / `cases_additional` / `cases_invalid`, and
    `test_cases`) followed by the body (`# <KEY> — <title>`, the Related and
    Test-cases callout lines, then `## PRD Summary`, `## Figma Design Summary`
    (omit if no Figma), `## Key Learnings`, `## Valid Case Count`). Use
    `knowledge/templates/Entry.md` as the shape.
12. **Update `knowledge/index.json`** — add or update the entry with issue key,
    title, keywords, related issues, date, and `type: "analyze"`.
13. **Generate the test-case mirror** — run `node scripts/migrate-vault.js` to
    build `knowledge/test-cases/<KEY> — Test Cases.md` from the analyzed CSV,
    then confirm the report lists your `<KEY>` (see vault-notes.md §2 if it
    doesn't).
14. **Update `.claude/rules/qa-heuristics.md`** if a new reusable QA pattern
    was discovered (not every analysis will produce one).

## Project Structure

```
create-analyze-cases/
├── original/              # Input CSVs (read-only, never modify)
├── output/                # Analysis results (write here)
├── scripts/
│   └── migrate-vault.js   # Rebuilds test-case mirror notes from output CSVs
├── knowledge/             # Obsidian vault
│   ├── Home.md            # Dataview dashboards
│   ├── index.json         # Machine-readable lookup index for past analyses
│   ├── entries/           # One note per issue/PRD (frontmatter + wikilinks)
│   ├── test-cases/        # Per-issue case tables mirrored from output/ CSVs
│   └── templates/         # Entry + Test Cases note templates
└── .claude/
    ├── rules/qa-heuristics.md       # Accumulated QA patterns
    └── skills/                      # Skill definitions
        └── shared/vault-notes.md    # Vault note-format conventions
```

- The user will point to a CSV in `original/`.
- Always write the analyzed CSV to `output/<same-filename>.csv`.

## Guidelines

- Preserve the original case text verbatim — do not rewrite or fix wording.
- When flagging a duplicate, reference which other case it duplicates (by row
  number or case text snippet).
- Be strict: if a case is borderline, lean toward `invalid` and explain what
  would make it valid. Only mark `valid` when the case is directly traceable
  to a specific PRD requirement **or a UI behavior shown in the Figma
  designs**.
- For additional cases, write clear, actionable test case descriptions that
  follow the same style as the existing cases. When Figma designs are
  available, use actual component names, labels, and field names visible in
  the mockups to write more precise cases.
- Keep case titles **short and action-focused**. Describe the *scenario* being
  tested, not the expected outcome. Do NOT embed expected response values,
  status codes, or detailed results in the title.
  - **Bad:** `"Verify that hitting API without accountId returns 400 BAD_REQUEST with message 'accountId is required'"`
  - **Good:** `"Verify hit API without accountId"`
  - **Bad:** `"Verify that submitting form with empty email shows error 'Email is required'"`
  - **Good:** `"Verify submit form with empty email"`
  - The detailed expected behavior belongs in the `expected result` or
    `reason` column, not the title.
- If in doubt about PRD interpretation, flag it in the reason rather than
  guessing. When the Figma design and PRD text appear to conflict, note the
  discrepancy in the reason column.
- Read and follow `.claude/skills/shared/csv-format.md` when writing the output,
  including its saved-file round-trip check. If the requested output includes
  `steps` or `expected result`, put numbered items on separate actual lines in
  those cells. This does not add columns to the analysis schema or change the
  requirement to preserve original case text.
- Figma designs linked from the Jira issue are considered part of the
  requirements — a test case covering a UI state or flow visible in the
  design is `valid` even without explicit PRD text support. This applies only to
  a design you actually read; when the design was unavailable, fall back to the
  written requirements and say so rather than inferring what the mockup shows.
