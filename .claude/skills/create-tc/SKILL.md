---
name: create-tc
description: >-
  Generate test cases from a PRD as a QA lead. Reads requirements from Jira
  Epic, Jira Story, Confluence page, or a standalone file, then produces a CSV
  of test cases. Use when the user asks to create test cases, generate TC,
  write test cases, or build test cases from a PRD.
---

# Create Test Cases

Act as a **QA Lead**. Given a PRD, generate a comprehensive set of test cases
and produce a CSV file in the `output/` folder.

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Requirements | Jira Epic, Jira Story, Confluence page, or standalone file | The source of truth for what to test |
| Figma designs (optional) | Figma links found in Jira issue descriptions | Visual reference for UI flows, components, states, and layout |
| Attached files (optional) | Uploaded via Queue UI — stored in `queue/` | Additional reference material: PRD documents, spreadsheets, screenshots, etc. |

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

1. Fetch the epic:
   - `getJiraIssue` with `issueIdOrKey`, `responseContentFormat: "markdown"`.
2. Fetch all stories under the epic:
   - `searchJiraIssuesUsingJql` with
     `jql: "\"Epic Link\" = PROJ-123 OR parent = PROJ-123"`,
     `fields: ["summary", "description", "status", "issuetype", "priority"]`,
     `maxResults: 100`,
     `responseContentFormat: "markdown"`.
3. Compile the epic description + all story descriptions into a single
   requirements document.
4. **Extract platform information.** Look at the child stories' summaries
   for platform prefixes like `[BE]`, `[FE]`, `[Panel]`, `[QA]`, or check
   for a `Platforms` custom field (e.g., `customfield_10885`). Common
   platform values: `Backend`, `Responsive` (FE web), `Panel - dWeb`
   (admin dashboard), `Multi-Platform`. Map each test case to the platform
   it belongs to based on which child story it traces back to.

#### 2. Jira Story link

1. Fetch the story:
   - `getJiraIssue` with `issueIdOrKey`, `responseContentFormat: "markdown"`.
2. Use the story description as the requirements.

#### 3. Confluence link

Extract the page ID or tiny link ID from the URL.

- Full URL: `https://site.atlassian.net/wiki/spaces/SPACE/pages/123456/Title` → pageId = `123456`
- Tiny link: `https://site.atlassian.net/wiki/x/Fc1bBw` → pageId = `Fc1bBw`

1. Fetch the page:
   - `getConfluencePage` with `pageId`, `contentFormat: "markdown"`.
2. Use the page body as the PRD.

#### 4. Standalone file

Read the file directly from disk (md, pdf, docx, txt, or pasted text).

#### 5. Attached reference files (from Queue UI)

When processing a queue request, the request JSON may include an `attachments`
array. Each entry has `filename`, `originalName`, and `size`. The files are
stored at `queue/<filename>` (e.g., `queue/<id>_attach_0.pdf`).

Read each attached file using the appropriate method:
- **PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX** — read with the Read tool
  (the tool supports PDF and common document formats).
- **Images (JPG, PNG, GIF, WebP, BMP)** — read with the Read tool (it
  supports image files) and analyze visually for UI flows, requirements
  diagrams, or screenshots.

Use attachment content as **supplementary context** alongside the primary
requirements from the `description` field. Attachments can serve as:
- The primary source of truth when no Jira link is provided
- Additional PRD documents that expand on the Jira description
- Screenshots or mockups that inform UI-specific test cases
- Spreadsheets with business rules, data tables, or acceptance criteria

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
   supplement the written PRD — use them to generate more concrete test steps
   and to catch scenarios the PRD text may not explicitly mention but the
   design clearly shows.

If **no Figma URLs** are found in the Jira issue, skip this step and proceed
with the text-based requirements only.

If a Figma URL **is** present but the design cannot be read — the MCP server is
not connected, the account lacks a Dev/Full seat, the quota is exhausted, or the
file is not shared — make a single attempt, then stop and continue AC-driven.
Record the real reason in the vault note and surface it in the chat summary. See
`.claude/skills/shared/figma-designs.md`.

### Reconcile the source before drafting

A PRD is not internally consistent. Requirements get struck through, superseded
by a later decision, or answered away in a Q&A table while the original text
stays on the page. Drafting straight off the requirement body reliably produces
cases for scope that was removed months ago.

Before drafting, read these three places and reconcile them **against** the
requirement body:

1. **The change log / revision history.** Every dated entry is a supersession
   signal. A line like "remove warning in account deletion" means a requirement
   above it is now dead — find it and mark it.
2. **The Q&A, open-questions, or decision table.** The *answer* column outranks
   the requirement body; it is where "we discussed this and changed our mind"
   gets recorded. An answer reading "there will be no warning on user end" kills
   the requirement that describes the warning.
3. **Notes attached to individual rows** of a matrix or enumerated table — "case
   is not possible to happen", "TBC", "not included", "existing flow, no change
   needed".

**PDF sources lose strikethrough.** Text extraction returns struck-through text
as ordinary text, so a removed requirement reads as a live one and nothing in
the extracted output marks it. When the source is a PDF, treat the change log
and the decision table as **the** authority on current scope, and reconcile
every requirement they contradict before writing a single case. If it stays
ambiguous, ask — or view the rendered document — rather than guess.

**A hedging pair means you never resolved the contradiction.** If you are
writing both "verify the warning is shown" and "verify no additional warning is
shown", stop. Two cases that hedge against each other are the signature of an
unresolved conflict, and at least one of them is wrong.

**Check which surface a decision applies to.** "User end" and "internal admin
end" are a scope boundary, not synonyms — removing behaviour from the customer
path usually leaves the dashboard path intact. The platform column is a useful
tell, since the two rarely share one.

Record what you reconciled in the entry's `## Key Learnings`, including which
requirements you dropped and why. The next person reading the same PDF hits the
same trap otherwise.

## Map the changed surface — existing flows the source never names

A PRD describes the new behaviour. It rarely lists the *older* flows that reuse
the same form, object or endpoint, and those are where a new field, toggle or
mode breaks. Example: an epic added a "Configure reward manually" toggle and a
Campaign ID to the Mission reward form; no case covered **Duplicate mission**,
an older feature that copies the whole form, and it shipped a defect (the toggle
came up disabled on a duplicate, PLAT-60919). A flow whose own project is
closed is not a covered flow — it just means nobody will re-test it.

Do this after reconciling the source and **before** drafting cases:

1. **Name the surface.** The screen/form, config object, API field or state the
   epic adds to or changes. Write it as a noun ("Mission Config reward form"),
   not as the feature title.
2. **Enumerate every flow that touches it.** Walk this checklist and keep only
   the ones that exist for this product:
   create · edit · view-only / read-only · duplicate / clone / copy-from ·
   draft save and resume · import / bulk upload · records created *before* this
   feature (migration, default value) · records in each lifecycle state
   (scheduled, live, ended) · other roles · other entry points (list row
   action, deep link) · the API twin of each.
3. **Find older features on the same surface.** Search the vault by the
   *surface name* and by row-action names (Duplicate, Edit, Import), not only by
   the new feature's terms — the old note will not share your feature's
   vocabulary. Read what you find and treat its rules ("duplicate copies
   everything except Slug, Start Date, End Date") as test inputs.
4. **Give each flow at least one case**
   covering, for the new field or mode: its default state, enabled vs disabled,
   what is copied, cleared or reset, validation, and any uniqueness or limit
   rule the new field is subject to — *in that flow*.
5. **Do not invent the expected result.** Assert only what a source states. If
   the behaviour is unspecified (does Duplicate copy or clear the new field?),
   write `UNKNOWN` in `preconditions`, assert the parts that are documented, and
   raise the question in the run summary.
6. **Record it.** List the flows under a `## Surface Map` section of the entry
   note (flow → covered by which case → named in the source: yes/no). For a
   recurring surface, keep one entry note for the surface itself so the next
   epic on it loads the whole map.

## Output Format

Produce a CSV with **nine columns**:

```
id,case,preconditions,steps,expected result,type,priority,criticality,platform
```

| Column | Format | Description |
|--------|--------|-------------|
| `id` | `TC01`, `TC02`, … | Stable per-row reference, sequential in file order |
| `case` | `"Verify that ..."` sentence | What is being tested |
| `preconditions` | `key: value` clauses, `;`-separated | What must already be true before step 1 — account, config/flag state, seed data |
| `steps` | Numbered steps | How to perform the test |
| `expected result` | Free text | What should happen if the feature works correctly |
| `type` | `e2e - regression` / `e2e` / `specific` | Classification of the test case — a multi-step user flow is `e2e`, a single rule/state/contract is `specific` |
| `priority` | `P0` / `P1` / `P2` / `P3` | Execution priority |
| `criticality` | `critical` / `high` / `medium` / `low` | Business impact if the case fails |
| `platform` | Platform name(s) | Which platform(s) the test case targets |

The output is test cases for a human tester and for TestRail — nothing in the
row is there to drive automated execution.

> **The TestRail exporter resolves every field by name.** `id` and
> `preconditions` do not appear in the `_testrail.csv` download; preconditions
> reach TestRail through the direct upload instead. Do **not** smuggle
> precondition text into `steps` to make it survive the export — that corrupts
> the step list for every other reader.

### Priority & Criticality Guide

**Priority** — how urgently the case should be executed:

| Level | When to use |
|-------|-------------|
| `P0` | Must test before any release. Blocks go-live. |
| `P1` | Should test in every regression cycle. |
| `P2` | Test when time permits. Important but not blocking. |
| `P3` | Nice-to-have. Low-frequency or exploratory. |

#### Calibrating P0

`P0` means **committed scope that also carries real impact**. A case is `P0`
when **both** tests pass:

1. **Traceability** — the case restates something written explicitly in the
   epic, a child story, or the linked PRD / Confluence page. Someone promised
   it, so it cannot ship unverified.
2. **Criticality ≥ `high`** — the case's own `criticality` column is `high` or
   `critical`.

Both halves are load-bearing. Traceability decides **membership**: is this
committed scope, or a combination I invented? Criticality decides **rank**:
traceability alone cannot sort, because in a well-written epic ~60% of specific
cases restate something, and the rule cannot tell "the product grid renders"
apart from "the *More Affordable* badge renders" — both are written down.
Anything you extended, combined, or inferred beyond the written text starts at
`P1`/`P2` no matter how clever it is.

Target **25–30%** `P0`, and treat 30% as a ceiling. Below ~20% you are probably
leaving whole stories ungated.

**If `P0` comes out too big, the criticality column is the suspect — not this
rule.** A "criticality ≥ high" gate cannot produce a small tier from a set where
half the cases are scored `high`. Re-score `high` against its actual definition
before touching the threshold; see *Calibrating criticality* below. Two
invariants tell you the columns are healthy: **no `critical` case outside `P0`,
and no `medium` case inside it.**

**Promote to `P0` even with no written AC** when failure would:

- **Lose or misallocate money, tokens, points, or user data** — charged without
  receiving, wrong amount credited, deducted when it shouldn't be, the wrong
  balance pool consumed, saved data lost.
- **Break a shared or backward-compatible mechanism other features rely on** — a
  regression here is an incident beyond the feature under test.
- **Break a primary end-to-end journey**, when that journey chains committed
  requirements. Ranking it below its own parts is incoherent.
- **Let an ineligible actor perform a restricted action, or expose another
  user's data.**

**Demoted by the criticality half** — written down, but `medium` at most:

- Individual variants of a pattern already covered — the second and third badge,
  the second locale of the same copy, one more asset in the same swap.
- Position, spacing, timing, ordering, and animation detail.
- A configurability check where the default already works.
- A secondary notification, tracker, log, or sound.
- An internal robustness detail (retry, backoff, monitoring), unless the failure
  is silent data loss.

When a rule has both a **guard** (button disabled, field greyed out) and a
**consequence** (no charge, no deduction, no write), the *consequence* carries
`critical` and the guard carries `high`. Both may land in `P0`, but price them
differently — the guard failing is cosmetic if the consequence still holds.

**Three mandatory checks before you ship the tier:**

- **Count the tiers.** `P0` in 25–30%; `critical` and `high` each under ~20%;
  `medium` the largest tier. No `critical` outside `P0`, no `medium` inside it.
- **Per story, not just in aggregate.** Count `P0` per child story. If any
  committed story has **zero**, the threshold overreached — a story with no `P0`
  ships unverified in any smoke run.
- **Re-score, don't except.** When a case obviously belongs in `P0` but its
  criticality keeps it out, the criticality is the error, not the rule. Fix the
  criticality so the case is promoted *by* the rule — that keeps the column
  trustworthy for TestRail and run planning, which read it independently. Reserve
  outright exceptions for the loss, exposure, and journey triggers listed above.

**Criticality** — business impact if the tested scenario fails in production:

| Level | When to use |
|-------|-------------|
| `critical` | Core business flow broken. Revenue or data loss. |
| `high` | Major feature degraded. Significant user impact. No workaround. |
| `medium` | Noticeable issue but workarounds exist. |
| `low` | Minor or cosmetic. Minimal user impact. |

#### Calibrating criticality

`high` is the tier that quietly absorbs everything you are unsure about, and an
inflated `high` silently inflates `P0`. **Expect a pyramid: `medium` should be the
largest tier, with `critical` and `high` each well under ~20% of the set.** If
`high` is approaching half, it is being used to mean "this matters" rather than
what it says.

Score criticality by **what the failure costs**, not by how much attention the
change is getting:

- `critical` — the user loses money, tokens, points, purchased value, or saved
  data; a core flow cannot complete; another user's data is exposed; an
  ineligible actor gets through.
- `high` — a whole capability of the feature is unusable or materially wrong and
  the user has **no way around it**. If they can reach the same outcome with one
  extra tap, it is `medium`.
- `medium` — visible and worth fixing, but the feature still works: copy,
  ordering, layout, asset swaps, position, timing, badges, default selections,
  configurability where the default already works, secondary notifications.
- `low` — cosmetic only.

Two traps that produce a 50%-`high` column:

- **Prominence is not impact.** A branding refresh or a layout change can be the
  entire point of the release and still be `medium` — nothing is lost or
  unreachable if it regresses.
- **A variant is not the mechanism.** When the mechanism is already covered, the
  individual spec'd data points (three price→token amounts, the second locale,
  the third badge) are `medium`. Score the mechanism honestly and let the
  variants sit below it.

For a **regression guardrail** ("X is unchanged after the refresh"), score what
breaks if the guardrail fails — "core gameplay mechanics unchanged" inherits the
criticality of the mechanics, not of the refresh.

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

### FE-first coverage — never test the same behaviour twice

When an epic spans **frontend** (App, Responsive, mWeb, dWeb, Panel) **and
backend**, cover each behaviour **through the frontend first**. Write a separate
`Backend` case **only when the behaviour cannot be observed from any UI**.

The child-story split in Jira is how the *work* was divided, not how the
*testing* should be. A `[BE]` story and a `[FE]` story describing two halves of
one user-visible behaviour produce **one** test case, not two.

Decide with this ladder:

1. **A tester can confirm it from a UI** → one **FE** case. Write the steps
   through the UI and set the platform to the FE platform.
2. **It needs a BE or Panel precondition** (config, feature flag, seeded data,
   whitelist entry) **but the result shows in a UI** → still **one** case, with
   the precondition as step 1 and platform `"Responsive, Backend"` /
   `"Panel - dWeb, Responsive"` (frontend last in the observation, but listed
   FE-first for the primary surface).
3. **It is invisible in the UI, but an FE action triggers it** (the request the
   page sends, the record it saves) → still **one** FE case; add the BE check as
   an extra expected-result item.
4. **No FE action reaches it at all** → a `Backend` case.

**Example.** An epic has a register API and a register page:

- ✅ `"Verify successful registration"` — one case, platform `Responsive`, steps
  go through the form. **Do not** also write "Verify `POST /register` returns
  201".
- ✅ `"Verify registration with an already-used email"` — one FE case; the
  validation message is the observable proof of the BE rule.
- ✅ `"Verify duplicate registration is rejected when the same email is
  submitted twice concurrently"` — genuinely `Backend`; no UI can express a race
  window.

**Signals a case is legitimately `Backend`-only:** response schema / contract
shape, HTTP status codes for API-only consumers, scheduled jobs and cron,
message/queue consumption, retry and backoff, idempotency and duplicate
suppression, concurrency and race conditions, logging / metrics / alerting, and
database state with no UI representation.

**Signals a drafted `Backend` case is really an FE case:** its expected result is
a number, a message, a state, or a list that a user can see. Computation
happening server-side does not make it a backend *test* — the assertion is
whatever the tester can observe.

Before writing the CSV, scan for pairs where an FE case and a BE case assert the
**same observable outcome**. Fold each pair into the FE case and drop the BE
duplicate.

### Write from the frontend point of view — merge BE checks into the FE case

Draft cases the usual way: walk the requirements (and the Figma flows), and
write one case per behaviour, state, or rule worth checking. There is **no
journey-first quota** — a case can be a full flow or a single rule, whatever the
requirement calls for.

What changes is the **point of view**: write every case as a tester sitting in
front of the frontend. When a BE behaviour can be checked **in the same run** as
an FE case — the tester performs the UI action and, alongside it, confirms the
API response, the saved record, or the emitted event — it does **not** get its
own `Backend` row. Merge it into that FE case:

- Add the BE check as an extra numbered item in the FE case's `expected result`
  (e.g. "3. `POST /mission` response returns `campaignId` = the entered value").
- List both platforms in `platform`, frontend first (`"Responsive, Backend"`).
- Put any BE-only setup (flag, seeded data, whitelist) in `preconditions`.

A standalone `Backend` case remains only when **no FE action can trigger or
reach it** — see the signals list above (contracts for API-only consumers,
cron/jobs, queues, retries, idempotency, races, logging, DB state with no UI
path).

Do not cram to shrink the count: merge a BE check only into the FE case whose
action actually triggers it. If you would write "…then, separately, check
that…", it is two cases.

### Marking the regression set

Split the `e2e` cases into `e2e - regression` and `e2e` by **durability** — does
this case still earn its slot once the epic has shipped and the team has moved
on?

Mark `e2e - regression` when the case:

- exercises a mechanism **other features can break** — login round-trips,
  account binding, entitlement and segmentation gates, config resolution;
- guards **money, entitlement, or cross-user exposure**, where a silent
  regression is an incident;
- catches **collateral damage from unrelated work** — homepage section ordering
  and placement are the classic example, which is why a presentation case can
  earn a regression slot even at `P1`;
- can be **re-run on a rebuildable fixture** within a normal cycle.

Leave it as plain `e2e` when the case:

- is a **variant of one already in the set** (registration alongside login) and
  adds no new mechanism;
- **consumes a scarce fixture** each run, such as a fresh registerable identity;
- depends on **multi-day timers** that cannot be seeded — expiry windows,
  "X days after" delays. These are release-acceptance checks, not cycle checks.

This is **not** a restatement of `priority`. In this repo `P0` already means
*must test before any release* and `P1` *should test in every regression cycle*,
so mirroring `P0` into the regression flag would make the column redundant.
Priority ranks by **impact if it fails now**; the regression flag ranks by
**value over time**. They cross: a `P0` whose fixture cannot be rebuilt stays
plain `e2e`, and a `P1` presentation case that breaks every time the homepage
is reshuffled earns `e2e - regression`.

Expect roughly **half to three-quarters** of the `e2e` cases to be regression. If
nearly all of them qualify, the flag is not discriminating and you have skipped
the durability question.

### Column Details

**id** — `TC01`, `TC02`, … in file order, zero-padded to two digits (`TC100`
onward once past 99). Assign after the final ordering is settled, so the numbers
are contiguous. The id is what reviews and bug reports cite — if
you regenerate a CSV and the ids shift, every prior reference silently points at
the wrong case. Never renumber an existing set
to insert a case; append it instead.

**preconditions** — What a tester must have in place before step 1. Write `key: value`
clauses separated by `;`. Cover only what applies:

| Key | Holds | Example |
|-----|-------|---------|
| `account` | Which actor, named concretely | `account: role=cobrand-holder` |
| `config` | Flag or setting state, **and where it is set** | `config: ff-country-settings=OFF via Panel > Feature Flags` |
| `data` | Seeded records the case depends on | `data: one mission with reward quota fully consumed` |
| `state` | Prior user state the case assumes | `state: enrolled in mission, 2 of 5 stamps` |

Leave the field empty only when the case genuinely needs nothing — a guest
opening a public page.

**Be concrete or say `UNKNOWN`. Never write a plausible-sounding guess.** A
precondition is a promise that a tester can reach this state. Two ways
to keep that promise honest:

- **Concrete** — name the account role your team's test accounts actually
  use, name the flag by its actual identifier,
  name the admin path that sets it.
- **`UNKNOWN: <what is needed>`** — when the PRD describes a required state but
  never says how to reach it. Example:
  `UNKNOWN: needs an account eligible for a generic mission — no seeding path in the PRD`.

The `UNKNOWN` form is not a failure, it is the deliverable. Prose like
*"Log in as a user who is eligible for at least one generic mission"* reads as
ready and then stalls the tester halfway through, once they find nobody knows how
to get such an account. The same fact written as `UNKNOWN` becomes a question for
the PM during review, before anyone starts testing. **When in doubt,
`UNKNOWN` — an invented admin URL is far more expensive than an admitted gap.**

**case** — Always use the sentence format: `"Verify that <something observable happens>"`.
Keep titles **short and action-focused**. Describe the *scenario* being tested,
not the expected outcome. Do NOT embed expected response values, status codes,
or detailed results in the title.

- **Bad:** `"Verify that hitting API without accountId returns 400 BAD_REQUEST with message 'accountId is required'"`
- **Good:** `"Verify hit API without accountId"`
- **Bad:** `"Verify that submitting form with empty email shows error 'Email is required'"`
- **Good:** `"Verify submit form with empty email"`

The detailed expected behavior belongs in the `expected result` column, not the
title.

**steps** — Write numbered steps, one action per actual line inside the
same quoted CSV cell (see `.claude/skills/shared/csv-format.md`). If the PRD does not provide enough detail to
write meaningful steps, leave the field empty. Do not invent UI flows that
aren't implied by the requirements.

Steps start **after** the preconditions are met, so they do not carry setup.
Step 1 is usually where the tester goes (`Open /mission`, `Go to Panel >
Missions > Priority Order`) — use a path the source gives, never an invented one.
A step reading *"1. Configure a banner image in the BE mission banner config"*
belongs in `preconditions` as `config: mission banner image set via <path>` —
not as step 1. What is left in `steps` is the interaction actually under test.

**expected result** — Describe the observable outcome the tester should confirm.
Keep this column to the **assertion only**.

Notes to the reviewer or PM do not belong here. Past runs have shipped expected
results carrying *"confirm the expected B2B rendering with the PM before
executing"* and `NOTE -` asides about which Figma node a label came from. A
tester reading this column then has to guess which half is the assertion. Route those
elsewhere:

- An open question the PM must settle → `preconditions` as `UNKNOWN: ...`, or
  the entry note's `## Key Learnings`.
- Provenance (which Figma node, which AC, which decision superseded what) →
  the entry note's `## Key Learnings`.
- A genuinely required exact string (error copy, empty-state copy) → keep it,
  quoted. That *is* the assertion.

If many cases end up with `UNKNOWN` preconditions, that is a real finding about
the feature's testability and belongs in the entry note's `## Key Learnings`.

**type** — Classify each case:

| Type | When to use |
|------|-------------|
| `e2e - regression` | A user flow worth re-running every cycle after this epic ships — see *Marking the regression set* |
| `e2e` | A multi-step user flow that matters for this release's acceptance but does not earn a permanent slot |
| `specific` | A single rule, state, validation, or contract |

The value passes through to TestRail's **Case Type** column verbatim, so
`e2e - regression` shows up there as written. Keep the spelling exact —
lowercase, spaced hyphen — or the suite filter stops matching.

## Workflow

### Before Creation — Load Knowledge

1. **Pull relevant prior knowledge from the vault** (by feature terms *and* by the changed surface — see "Map the changed surface") — see
   `.claude/skills/shared/vault-notes.md` §0. Prefer the `obsidian` MCP server
   (`search` with the feature's terms, then `read_note` / `get_backlinks`);
   fall back to `knowledge/index.json` + `knowledge/entries/*.md` if it isn't
   connected.
2. **Apply what you find** — known edge cases for similar features, patterns
   previously missed, and the heuristics in `.claude/rules/qa-heuristics.md`.

### Core Creation

3. **Fetch the requirements.** Determine the source type and retrieve content
   using the appropriate method above.
3b. **Read attached files.** If the request includes attachments (from the
   Queue UI), read each file at `queue/<filename>` and incorporate the content
   as additional requirements context. Images should be visually analyzed for
   UI details, mockups, or diagrams.
4. **Extract and inspect Figma designs (optional).** If the source is a Jira
   Epic or Story, scan for Figma URLs and fetch design context as described in
   "Extracting Figma Designs from Jira Issues". This step runs in parallel
   with reading the text requirements. If the MCP fetch fails, follow
   `.claude/skills/shared/figma-designs.md` (including headed Playwright
   recovery when a human can log in) and keep going — the run completes on
   the acceptance criteria alone when neither path can read the file.
5. **Read the requirements thoroughly.** Combine the PRD text **and** Figma
   design insights. Identify all features, acceptance criteria, business
   rules, edge cases, and explicit exclusions. Pay special attention to:
   - UI flows and screen transitions visible in the Figma designs
   - Component states (disabled, error, loading, empty) shown in the mockups
   - Visual details the PRD may not spell out (e.g., toast messages, inline
     validation, conditional button states)
5b. **Reconcile the source.** Run *"Reconcile the source before drafting"* above
   before writing anything: check the change log, the Q&A / decision table, and
   per-row notes against the requirement body, and list the requirements they
   supersede. Do this even when the PRD looks clean — on PDF sources a removed
   requirement is indistinguishable from a live one in the extracted text.
5c. **Map the changed surface.** Run *"Map the changed surface"* above: name
   the surface, enumerate every flow that creates, copies, loads or edits it,
   and search the vault by surface name. Every flow found gets a case, even when
   the source never mentions it. Do this even when the PRD looks complete.
6. **Draft the cases.** Walk the requirements and Figma flows and write a case
   per behaviour — happy paths, negative and error paths, boundary values,
   permission and role variations, state transitions, and the **UI-specific
   scenarios** derived from Figma (validation messages, disabled states, empty
   states). Write each from the frontend point of view (see *Write from the
   frontend point of view*).
7. **Merge BE into FE.** For every drafted BE check, ask: can a tester verify
   this during an FE case's run? If yes, fold it into that FE case as an extra
   expected-result item. Keep a `Backend`
   row only when no FE action reaches it.
7a. **Classify and mark the regression set.** Set `type` (`e2e` for multi-step
   flows, `specific` for single rules), then split the `e2e` cases into
   `e2e - regression` and `e2e` on durability, per *Marking the regression set*.
7b. **Assign platform** to each case based on which child story or PRD section
   it traces to. Use the platform prefixes from Jira story summaries (e.g.,
   `[BE]` → `Backend`, `[FE]` → `Responsive`, `[Panel]` → `Panel - dWeb`)
   or the `Platforms` custom field. Then apply **FE-first coverage** (see the
   Platform Guide): for every behaviour visible in a UI, keep one FE case and
   drop the `Backend` duplicate; reserve `Backend` cases for behaviour no UI can
   show.
7c. **Calibrate priority.** Re-read the `P0` set against "would I hold the
   release for this?" and confirm it is a small minority (~10–15%) of the total.
8. **Add steps** where the PRD or Figma designs provide enough context. When
   Figma designs show a clear user flow, use them to write more detailed steps
   (e.g., specific button labels, field names, navigation paths).
8a. **Fill the preconditions.** For each case, lift setup out of the steps into
   `preconditions`. Check the vault before writing `UNKNOWN`:
   `knowledge/entries/*.md` may already record paths, login flows, account roles
   and flag locations earlier work discovered. This is precisely the tribal
   knowledge the vault exists to hold — use it rather than guessing.
   Then assign `id` last, once the ordering is final.
8b. **Run the pre-ship checks.** Walk the drafted set once for each of these and
   fix what you find. Every one has produced dead cases in past runs:

   - **Observable?** Each `expected result` must name something a tester can
     actually see — a screen, an API response field, a DB column, a log entry,
     an email. If the system has no way to expose the state you are asserting,
     the case is not testable; drop it or rewrite it against what *is* exposed.
   - **Self-contained?** Read each row as the tester who will pick it up: do
     `preconditions` + `steps` tell you enough to start, without consulting the
     PRD? Setup must be in `preconditions`, not step 1. If you would have to ask
     a question before starting, that question belongs in the row as `UNKNOWN`.
   - **Honest?** Scan every `preconditions` value for invented specifics — an
     admin path, flag name, or account role that sounds right but appears nowhere
     in the source. It is worse than vagueness: a wrong path sends a tester down
     a dead end while looking authoritative. If the source does not give it,
     write `UNKNOWN`.
   - **In scope?** The assertion must be verifiable in the system this epic
     builds. Behaviour owned by a downstream system goes on that team's ticket,
     even when this PRD describes it as context.
   - **Reachable?** Drop or explicitly flag any case whose precondition the PRD
     itself marks impossible, TBC, or out of scope.
   - **Distinct?** Two cases sharing the same trigger *and* the same expected
     result are one case, however differently the source phrased them. Re-check
     this after resolving any undefined term — clarifying vocabulary often
     collapses two table rows into one.
   - **Defined?** If the PRD uses a domain term it never defines and you carried
     it into a case, flag it rather than leaving the ambiguity for the tester.

9. **Write the output CSV** to `output/` with the filename the user specifies
   (or a sensible default like `tc-<issue-key>.csv` or `tc-<page-title>.csv`).
   Read and follow `.claude/skills/shared/csv-format.md`, including its saved-file
   round-trip check, before generating the vault mirror or marking completion.

### After Creation — Save Knowledge

Persist the run into the Obsidian knowledge vault. **Follow
`.claude/skills/shared/vault-notes.md` for the exact note format.** In summary:

10. **Write `knowledge/entries/<KEY>.md`** as an Obsidian note: YAML frontmatter
    (`kind`, `key`, `title`, `source`, `action: create`, `date`, `figma`,
    `tags` = sanitized keywords, `keywords` = verbatim phrases, `related` as
    `[[wikilinks]]`, `cases_total` / `cases_e2e` / `cases_specific`, and
    `test_cases`) followed by the body (`# <KEY> — <title>`, the Related and
    Test-cases callout lines, then `## PRD Summary`, `## Figma Design Summary`
    (omit if no Figma), `## Key Learnings`, `## Cases Created`). Use
    `knowledge/templates/Entry.md` as the shape.
11. **Update `knowledge/index.json`** — add or update the entry with issue key,
    title, keywords, related issues, date, and `type: "create"`.
12. **Generate the test-case mirror** — run `node scripts/migrate-vault.js` to
    build `knowledge/test-cases/<KEY> — Test Cases.md` from the output CSV, then
    confirm the report lists your `<KEY>` (see vault-notes.md §2 if it doesn't).
13. **Update `.claude/rules/qa-heuristics.md`** if a new reusable QA pattern was
    discovered (not every creation will produce one).

## Project Structure

```
create-analyze-cases/
├── original/              # Input CSVs (used by analyze-tc)
├── output/                # Generated test cases (write here)
├── scripts/
│   └── migrate-vault.js   # Rebuilds test-case mirror notes from output CSVs
├── knowledge/             # Obsidian vault
│   ├── Home.md            # Dataview dashboards
│   ├── index.json         # Machine-readable lookup index for past tasks
│   ├── entries/           # One note per issue/PRD (frontmatter + wikilinks)
│   ├── test-cases/        # Per-issue case tables mirrored from output/ CSVs
│   └── templates/         # Entry + Test Cases note templates
└── .claude/
    ├── rules/qa-heuristics.md       # Accumulated QA patterns
    └── skills/                      # Skill definitions
        └── shared/vault-notes.md    # Vault note-format conventions
```

## Guidelines

- Every case must start with `"Verify ..."` (with or without "that").
- Keep case titles **short** — describe the scenario, not the expected result.
  Put expected values, status codes, and response details in the `expected
  result` column only.
- Do not generate cases for features not mentioned in the PRD **or shown in
  the Figma designs**. Figma designs linked from the Jira issue are considered
  part of the requirements.
- Prefer actionable, testable cases over vague ones.
- Group related cases together in the CSV (e.g., all login cases, then all
  payment cases).
- Wrap CSV values in double quotes if they contain commas, quotes, or newlines. `preconditions`
  separates its clauses with `;` partly for this reason, but quote it anyway —
  values inside a clause often contain commas.
- In `steps` and `expected result`, put each numbered item on its own actual
  line inside the same quoted CSV cell. Follow the shared CSV formatting rules.
- `UNKNOWN` in `preconditions` is a legitimate, expected output. A set with a
  few honest `UNKNOWN`s is more useful than one where every precondition looks
  confident and a third of them are fiction.
- Setup belongs in `preconditions`, never as step 1. Provenance and open
  questions belong in the entry note, never in `expected result`.
- Group related cases together **before** assigning `id`, so ids stay contiguous
  within a group.
- When Figma designs are available, use actual component names, labels, and
  field names visible in the mockups to write more precise steps and expected
  results.
- Aim for completeness — it's better to have a few extra cases than to miss a
  requirement.
- If the Figma design shows states or flows not described in the PRD text,
  generate test cases for them — the design is an authoritative source **when it
  is readable**. When it is not, never invent UI detail to compensate: no guessed
  labels, copy, or transitions. Draft from the acceptance criteria and flag the
  UI questions the design would have settled.
