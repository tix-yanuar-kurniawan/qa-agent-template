# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# qa-agent-template

A local Express UI ("TC Queue") that collects QA requests, plus a set of skills that Claude runs
to fulfil them, plus an Obsidian vault (`knowledge/`) that accumulates what past runs learned.

**The server never generates anything.** It only stores requests on disk and renders results.
All test-case creation and analysis happens when Claude picks the queue up via
`/run-it`. Keep that split in mind before adding "processing" logic to `server.js`.

## Commands

```bash
npm start                              # queue UI on http://localhost:4568 (PORT overrides)
node --test                            # run all unit tests
node --test testrail-sheet.test.js     # one file
node --test --test-name-pattern="applyTestrailEdits"   # one test
node scripts/migrate-vault.js          # regenerate knowledge/test-cases/ from output/*.csv
node scripts/find-unresolved.js        # list issue keys referenced but not yet captured
```

There is no build, bundler, linter or type-checker. `public/` is vanilla ES modules served
statically — edit and reload.

## Architecture

### The queue is the filesystem

`queue/` is the database. One request is a set of sibling files keyed by UUID:

| File | Role |
| --- | --- |
| `<id>_request.json` | The record: `type`, `label`, `description`, `status`, attachments, type-specific fields |
| `<id>_input.csv` | Uploaded CSV (`analyze`) |
| `<id>_attach_N.<ext>` | Reference files to read alongside the description |
| `<id>_result.csv` | Result copy that the UI downloads |

`status` moves `pending` → `processing` → `done` (or `error`), written by *Claude*, not the server.
The UI polls every 3 s, so flipping the field on disk is what makes the badge change. `queue/` is
gitignored — it is runtime state.

Three request types, each routed by `/run-it` to a skill: `create` → create-tc, `analyze` →
analyze-tc, `knowledge` → add-knowledge.

### Two CSV shapes

- **Source (9 columns)** — what skills write to `output/`:
  `id,case,preconditions,steps,expected result,type,priority,criticality,platform`.
  The project only writes cases for human testers; there are no columns for executing them.
- **TestRail (15 columns)** — produced on download by `testrail-sheet.js`. It resolves fields by
  name and silently drops anything it does not recognise (`id`, `preconditions`). Never smuggle
  precondition text into `steps` to make it survive the conversion.

### Direct TestRail upload

`testrail-upload.js` is the one exception to "the server only stores": the `/cases` page's
**Upload to TestRail** dialog posts a request's saved result CSV straight to project 184 over the
REST API. It still generates nothing; it only reshapes cases that are already on disk. Credentials live in
`testrail.local.json` (gitignored; schema in `testrail.example.json`) or `TESTRAIL_*` env vars.
Mapping decisions the user made, and that should not be "fixed":

- TestRail **priority comes from criticality** (critical/high/medium/low → 4/3/2/1). P0–P3 is
  the user's private triage mark and is never uploaded.
- Layout is `suite › [STANDALONE STORY ›] <story folder> › <platform folder> › case`. A case that
  lists several platforms is **copied into each platform folder**. Folders are Responsive,
  Android, iOS, Panel, Backend and API (`PLATFORMS` in `testrail-upload.js`); Backend and API
  are separate folders that both carry TestRail platform 5, and Multi-Platform means
  Responsive + Android + iOS.
- Preconditions go into Precondition, **cleaned for humans** by
  `preconditionText`: `UNKNOWN:` clauses and `(TCnn)` references are dropped, the credential key
  in `account:` is reduced to the role (`User: member`), and each clause gets its own line. The
  source CSV keeps the `key: value` format; never strip it there. Case type is not uploaded,
  because project 184 has no field for it.
- Every upload is a **sync**, never a blind add. Folders are matched by name; cases are paired
  first by the link saved in `testrailLinks` (suite › platform folder › source id → case id), then
  by title among cases this tool made (`custom_case_created_by_ai` = Yes). Paired cases are
  updated only on the content fields (title, preconditions, steps, expected, priority, refs) —
  status, automation and PIC set in TestRail are left alone. Hand-written cases are never touched.
- The user **cannot delete** TestRail cases. A case of ours that left the CSV is offered as
  `custom_tcstatus` = Obsolete instead; a retired case that returns to the CSV goes back to Draft.
  The dialog previews all of this (`/testrail/preview`, read-only) before anything is written.
  Each run is logged on the request as `testrailUploads`.

`EDITABLE_COLUMNS` in `testrail-sheet.js` limits what the `/cases` editor may write back; edits
are applied to the source CSV, and `resolveOutputTwin` in `server.js` links a queue result back to
its `output/` original *before* the two diverge — that matching is content-based and only works
while the result is still unedited.

### Share P0

`p0-share.js` is the second outbound call. **Share P0** (Queue/Test-cases list checkboxes, a
sheet's toolbar, or a row's ⋯ menu) takes the P0 cases of one or more sheets and creates a Google
Sheet titled `P0 Devs - <d Mon yyyy>` with columns `Jira Title, Jira Link, Case, Platforms`,
rows grouped by platform (Responsive, Android, iOS, Panel, Backend, API, others, none). A
case on several platforms gets one row per platform (same `platformsFor` mapping as TestRail;
unknown platforms pass through by name). Preferred route: the user's Apps Script web app
(`scripts/p0-share.gs`, URL in `google.local.json`), opened by the browser in a new tab and
form-posted to — tiket.com only allows domain-signed-in callers, and blocks gcloud
from getting Sheets scopes. Without it, auth is the user's gcloud ADC
(`gcloud auth application-default print-access-token`), so the sheet lands in that account's
Drive and is then shared read-only with `shareDomain` (default tiket.com, see
`google.example.json`). ADC without a Sheets/Drive scope, or any Google failure, falls back to a
CSV download of the same rows.
A share is remembered per selection (sorted request IDs) in `queue/p0-shares.json`; the same
selection reopens that link instead of creating a second sheet, until the web app's `?check=`
(run in a hidden frame) reports it deleted, or the user picks **Create new**. A selection whose sheets are all
inside an earlier share made for a bigger selection opens that link too ("Already included");
partial overlap is listed above the create view.

### Artifacts live outside the queue

`output/` holds the canonical generated CSVs (`tc-<KEY>.csv`); `queue/<id>_result.csv` is a copy.
`original/` holds input CSVs copied in before an analyze run.

### The vault is part of the loop

`knowledge/` is an Obsidian vault, not documentation: skills read it before drafting and write to
it afterwards. `entries/<KEY>.md` is one note per issue/PRD (YAML frontmatter + wikilinks),
`test-cases/` mirrors `output/` CSVs as searchable tables (regenerated, never hand-edited —
run `scripts/migrate-vault.js`), and `index.json` is the machine-readable lookup. Format
conventions live in `.claude/skills/shared/vault-notes.md`.

### Front end

Three pages — `/` (queue), `/new`, `/cases` — sharing `shell.js`, which owns the view
predicates. Those predicates are the single source of truth for filtering; pages import them
rather than restating their own filters. `DESIGN.md` and `PRODUCT.md` define the design system and
the product's voice; follow them when touching `public/`.

## Gotchas

- The Atlassian MCP server is only reachable from the main agent. Do not delegate Jira/Confluence
  fetching to subagents — they fall back to a browser and fail on auth.
- `testrail.local.json` and `google.local.json` hold your own credentials and settings and are
  gitignored; the schemas live in the tracked `*.example.json` files.

## Standing rules

These live in `.claude/rules/` and load when Claude touches a matching file.

| Rule | Loads | What it covers |
| --- | --- | --- |
| `qa-heuristics.md` | when touching output/**, knowledge/** | QA heuristics learned from past test case analyses, to improve future analyze-tc and create-tc tasks. |

## Skills

Invoke by name as a slash command, or just describe the task and Claude will load the relevant one.

- `/add-knowledge` — capture a source into the vault, no test cases
- `/analyze-tc` — validate an existing CSV against a PRD, then extend it
- `/create-api-tc` — generate API cases from a curl command (executes it first)
- `/create-tc` — generate cases from a Jira/Confluence/file PRD
- `/run-it` — process every pending queue request
