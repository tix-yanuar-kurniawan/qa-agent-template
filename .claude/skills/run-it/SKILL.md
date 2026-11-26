---
name: run-it
description: >-
  Process all pending requests from the TC Queue UI, or run/rerun one specific
  request by ID. Scans the queue/ folder, processes each pending request (or
  only the named one) using the appropriate skill (create-tc, analyze-tc,
  or add-knowledge), saves results, and updates statuses so the
  web UI shows download links. Use when the user asks to run the queue, process
  the queue, rerun a request, or types /run-it or /run-it <id>.
---

# Run the TC Queue

Process test case requests submitted through the Queue UI
(`http://localhost:4568`).

## Modes

- **`/run-it`** (no argument) — process every request with `"status": "pending"`.
- **`/run-it <id>`** — process **only** that request, whatever its status. This
  is how a request is rerun. `<id>` is the short ID shown in the Queue list's
  **ID** column (the first 8 characters of the UUID), but any unique prefix of
  the UUID — or the full UUID — is accepted. Several IDs separated by spaces or
  commas run just those requests, in the order given.

## Workflow

### 1. Select the requests

**No argument:** read every `*_request.json` file inside the `queue/` folder at
the project root. Filter for entries where `"status": "pending"`. If none are
found, tell the user "No pending requests in the queue." and stop.

**With an ID:** match it case-insensitively against the start of each request's
filename (`queue/<uuid>_request.json`). Stop and tell the user if:

- nothing matches — "No request with ID `<id>` in the queue.";
- more than one request matches — list the matching IDs with their labels and
  ask for a longer prefix. Never guess between them.

Do not process any other pending request in this mode.

#### Rerunning a request that already ran

If the selected request is `done` or `error` (or stuck in `processing` from an
interrupted run), treat it as a fresh run of the same input:

1. Tell the user it is a rerun and what status it had.
2. Clear the previous outcome fields on the request JSON before starting:
   `error` → `null`, `completedAt` → `null`. Keep `id`, `type`, `label`,
   `description`, attachments, input CSV and every type-specific input field.
   Keep `testrailLinks` and `testrailUploads` — they tie the request to cases
   already in TestRail, and the next upload syncs against them.
3. If `casesEditedAt` is set, the user hand-edited the result in `/cases`.
   A rerun regenerates the CSV and overwrites those edits, so ask before
   proceeding and stop if they decline. On rerun, clear `casesEditedAt`.
4. Overwrite `output/` and `queue/<id>_result.csv` in place; do not create a
   second `output/` file for the same key.

### 2. Process each selected request

For **each** selected request — pending ones in chronological order
(`createdAt`), named ones in the order given:

#### a. Mark as processing

Set `"status": "processing"` in the request JSON and write it back to disk.
This makes the UI show a pulsing "Processing…" badge.

#### b. Route to the correct skill

> **IMPORTANT:** Do NOT delegate Jira/Confluence fetching or the entire
> request processing to subagents (Task tool). The Atlassian MCP server
> (`plugin-atlassian-atlassian`) is only available in the main agent context.
> Subagents cannot access it and will fall back to opening a browser, which
> fails due to authentication. Process each request directly in the main
> agent, calling `getJiraIssue`, `searchJiraIssuesUsingJql`, and
> `getConfluencePage` yourself.

- **`"type": "create"`** → follow the **create-tc** skill
  (`.claude/skills/create-tc/SKILL.md`).
  The `description` field contains either a Jira link or free-text
  requirements. Pass it as the PRD source.
  If the request has a non-empty `attachments` array, the files are at
  `queue/<attachment.filename>` (e.g., `queue/<id>_attach_0.pdf`).
  Pass these file paths to the create-tc skill as additional reference
  material — the agent should read them alongside the Jira/description
  content.

- **`"type": "analyze"`** → follow the **analyze-tc** skill
  (`.claude/skills/analyze-tc/SKILL.md`).
  The uploaded CSV is at `queue/<id>_input.csv`.
  Copy it to `original/` before processing (the analyze skill reads from
  there). The `description` field is the Jira link or requirements to match
  against.

- **`"type": "knowledge"`** → follow the **add-knowledge** skill
  (`.claude/skills/add-knowledge/SKILL.md`).
  Capture the source(s) into a `knowledge/entries/<KEY>.md` note **without**
  generating any test cases (no CSV, no `output/` file, no `migrate-vault.js`).
  Record `knowledgeKey` + `knowledgeFile` on the request when done.

#### c. Save the result

For **create** and **analyze** requests:

- Before copying, read and follow `.claude/skills/shared/csv-format.md`. Verify
  the saved `output/` CSV with a CSV parser: numbered steps and expected results
  must have real in-cell line breaks, with the intended logical row and column
  counts. Fix the source CSV first; do not rely on UI or download formatting.
- Copy the verified output CSV from `output/` to `queue/<id>_result.csv` and
  confirm both files are byte-identical before marking the request done.
- Update the request JSON: set `"status": "done"` and
  `"completedAt": "<ISO timestamp>"`. Write it back to disk.
- The UI polls every 3 seconds — once status is `"done"`, the TestRail CSV
  download button turns green automatically.

For **knowledge** requests, the add-knowledge skill saves its own result (no
CSV): it sets `"status": "done"`, `"completedAt"`, and records
`"knowledgeKey"` + `"knowledgeFile"`. The UI then shows a green "Note" button.

#### d. Handle errors

If processing fails for a request, set `"status": "error"` and
`"error": "<message>"` in the request JSON, then **continue** to the next
request. Do not stop the entire queue for one failure.

### 3. Report

After all selected requests are processed, summarize:

- How many processed successfully
- How many failed (and why)
- Remind the user to check the web UI for TestRail CSV download links

## Request JSON Schema

```json
{
  "id": "uuid",
  "type": "create | analyze | knowledge",
  "label": "optional user label",
  "description": "Jira link or free-text requirements",
  "status": "pending | processing | done | error",
  "hasInputCsv": true | false,
  "inputCsvOriginalName": "filename.csv",
  "attachments": [
    {
      "filename": "<id>_attach_0.pdf",
      "originalName": "requirements.pdf",
      "size": 123456
    }
  ],
  "createdAt": "ISO 8601",
  "completedAt": null | "ISO 8601",
  "knowledgeKey": null | "PLAT-54052",
  "knowledgeFile": null | "knowledge/entries/PLAT-54052.md",
  "error": null | "error message"
}
```
