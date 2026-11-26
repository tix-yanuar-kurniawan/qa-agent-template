---
name: add-knowledge
description: >-
  Capture knowledge into the Obsidian vault from Jira Epics/Stories, Confluence
  pages, Figma designs, curl/API commands, files, or free-text notes — WITHOUT
  generating or analyzing any test cases. Processes pending "knowledge" requests
  from the TC Queue UI in a batch: fetches each source, reads the description and
  attachments, and writes a vault entry note. Use when the user asks to add
  knowledge, capture knowledge, run the knowledge queue, or types /add-knowledge.
---

# Add Knowledge

Distil a source into a single Obsidian vault note so the team's knowledge base
grows. **This skill never creates or analyzes test cases** — no CSV, no
`output/` file, no TestRail export, no `scripts/migrate-vault.js` run. It only
fetches the source(s), reads them, and writes one `knowledge/entries/<KEY>.md`
note plus an `index.json` entry.

Knowledge requests are submitted through the **"Add Knowledge"** mode of the
Queue UI and stored as `type: "knowledge"` records in the `queue/` folder.

## When to use

- The user types `/add-knowledge`, or asks to "add/capture knowledge", "run the
  knowledge queue", or "process knowledge requests".
- A queue request has `"type": "knowledge"`.

If the user instead wants test cases, use `create-tc`, `create-api-tc`, or
`analyze-tc`. If they want to process the **whole** mixed queue, use `run-it`
(which routes knowledge requests here).

## Batch Workflow

### 1. Scan for pending knowledge requests

Read every `*_request.json` file in the `queue/` folder. Keep only entries where
`"type": "knowledge"` **and** `"status": "pending"`. If none are found, tell the
user "No pending knowledge requests in the queue." and stop.

### 2. Process each request, in `createdAt` order

> **IMPORTANT:** Do NOT delegate Jira/Confluence/Figma fetching to subagents
> (Task tool). The Atlassian (`plugin-atlassian-atlassian`) and Figma
> (`plugin-figma-figma`) MCP servers are only available in the main agent
> context. Subagents fall back to a browser and fail on auth. Fetch everything
> yourself in the main agent.

For each request:

#### a. Mark as processing

Set `"status": "processing"` in the request JSON and write it back. The UI shows
a pulsing "Processing…" badge.

#### b. Identify the source(s)

The `description` field is free text that may contain **one or more** of: a Jira
Epic/Story link or key, a Confluence link, Figma link(s), a curl command, and/or
plain notes. The request may also have an `attachments` array (files at
`queue/<attachment.filename>`). Treat **all** of these as sources to read.

#### c. Fetch and read every source

Use the same fetching techniques as `create-tc`
(`.claude/skills/create-tc/SKILL.md` → "Obtaining Requirements" and "Extracting
Figma Designs from Jira Issues"). In short:

- **Jira Epic** — `getJiraIssue` (markdown), then `searchJiraIssuesUsingJql`
  with `jql: "\"Epic Link\" = <KEY> OR parent = <KEY>"` to pull child stories.
- **Jira Story / Task / Bug** — `getJiraIssue` (markdown).
- **Confluence** — extract the pageId (or tiny-link id) and call
  `getConfluencePage` (markdown).
- **Figma (optional)** — scan the Jira/Confluence text **and** the request
  description for Figma URLs. For each, extract `fileKey` + `nodeId` (convert
  `-`→`:` in `node-id`; default `0:1`) and call `get_design_context` (and
  `get_screenshot` for extra nodes). Summarize flows, components, states, and
  copy. If the MCP read fails — MCP not connected, no Dev/Full seat, quota
  exhausted, file not shared — make **one** MCP attempt, then try headed
  Playwright recovery per `.claude/skills/shared/figma-designs.md` §2 when a
  human can log in. If still unread, capture the source from its text alone,
  record the real reason in `figma_note`, and mention it in the chat summary.
  A Figma-only request whose design cannot be read is the one case to mark
  `error`, since there is no other source to capture.
- **Curl / API** — note the method, endpoint, headers, and body. You may run the
  curl to capture the real response shape, but do **not** produce test cases.
- **Attachments / files** — read each with the Read tool (PDF, DOC, DOCX, TXT,
  MD, CSV, XLS/XLSX, and images all supported). Analyze images visually.
- **Free-text notes** — use verbatim as part of the knowledge.

Before writing, optionally pull related prior knowledge from the vault (see
`.claude/skills/shared/vault-notes.md` §0) so `related` wikilinks resolve and
duplicate topics are caught — prefer the `obsidian` MCP server, fall back to
`knowledge/index.json`.

#### d. Determine the `<KEY>`

- A Jira issue key is present (in label or description) → use it (e.g.
  `PLAT-54052`).
- An API/endpoint with no Jira key → use a PascalCase endpoint name (e.g.
  `LoyaltyMissionSlugProgressGET`), matching the `label` when sensible.
- Otherwise (Confluence/notes/topic) → a concise PascalCase identifier derived
  from the title/label (e.g. `UnifiedMessagingPlatformOverview`).

The key must be filename-safe (`[A-Za-z0-9._-]` only) and unique within
`knowledge/entries/`. If a note with that key already exists, update it in place
rather than creating a duplicate.

#### e. Write the knowledge note

Write `knowledge/entries/<KEY>.md` following the **knowledge variant** in
`.claude/skills/shared/vault-notes.md` §1. Key differences from a test-case run:

- Frontmatter `action: knowledge`.
- **No** `test_cases` field and **no** `cases_*` counts.
- `figma: true` (+ `figma_note`) when a Figma design was read, **and also** when
  a Figma URL was present but unreadable — in that case `figma_note` carries the
  URL, the concrete reason, and the date. `figma: false` only when the source has
  no Figma link at all.
- Body sections: `## Summary`, `## Key Points`, `## Figma Design Summary`
  (omit when `figma: false`), and `## Details` (the cleaned source content and
  any user notes). No "Cases Created"/"Valid Case Count" section.

Frontmatter shape:

```yaml
---
kind: epic | story | confluence | api | doc
key: "PLAT-54052"
title: "Short feature/topic title"
source: "Jira Story" | "Confluence" | "Figma" | "Curl command (API)" | "Notes" | "File (PDF)"
action: knowledge
date: 2026-06-24
figma: false
tags: [tag-a, tag-b]
keywords: ["verbatim phrase", "another phrase"]
related: ["[[PLAT-54053]]"]
url: "https://borobudur.atlassian.net/browse/PLAT-54052"   # if Jira/Confluence
---
```

Body shape:

```
# <KEY> — <title>
> **Source:** <source> · **Jira:** <url>        (drop the Jira part if none)
> **Related:** [[KEY-1]] · [[KEY-2]]            (omit if none)

## Summary
<2-4 sentence faithful summary>

## Key Points
- <concrete point drawn from the source>

## Figma Design Summary        (omit when figma: false)
- <flows / component states / copy observed>

## Details
<cleaned PRD / page body / curl notes / file content + user notes>
```

#### f. Update the machine index

Add or update the `knowledge/index.json` entry under `entries` with `title`,
`keywords` (array), `related` (array of bare keys, no brackets), `date`, and
`type: "knowledge"`.

#### g. Record the result on the request

Update the request JSON: set `"status": "done"`, `"completedAt": "<ISO>"`,
`"knowledgeKey": "<KEY>"`, and `"knowledgeFile": "knowledge/entries/<KEY>.md"`.
Write it back. The UI then shows a green **"Note"** button that downloads the
generated note. (Do **not** run `scripts/migrate-vault.js` — there is no CSV.)

#### h. Handle errors

If a request fails, set `"status": "error"` and `"error": "<message>"`, then
continue to the next request. One failure must not stop the batch.

### 3. Report

After all knowledge requests are processed, summarize: how many notes written,
their keys, how many failed (and why), and remind the user the new notes are in
`knowledge/entries/` (browsable in Obsidian) with "Note" download buttons in the
Queue UI.

## Knowledge Request JSON Schema

```json
{
  "id": "uuid",
  "type": "knowledge",
  "label": "optional user label (often the Jira key or topic)",
  "description": "Jira/Confluence/Figma link(s), curl, and/or free-text notes",
  "status": "pending | processing | done | error",
  "hasInputCsv": false,
  "attachments": [
    { "filename": "<id>_attach_0.pdf", "originalName": "spec.pdf", "size": 12345 }
  ],
  "createdAt": "ISO 8601",
  "completedAt": null,
  "knowledgeKey": null,
  "knowledgeFile": null,
  "error": null
}
```

## Guidelines

- Be faithful: summarize what the source actually says; do not invent scope.
- Prefer the `obsidian` MCP server for reading/linking prior notes; fall back to
  direct file reads of `knowledge/index.json` + `knowledge/entries/*.md`.
- Every related issue key becomes a `[[KEY]]` wikilink (unresolved links are
  fine — they resolve when that note is later added).
- Quote any YAML string containing `:`, `"`, `[`, or leading punctuation. Titles
  like `[BE] ...` MUST be quoted.
- Derive `tags` from `keywords`: lowercase, spaces/punctuation → `-`, drop
  purely-numeric tags. Keep the original phrases in `keywords`.
- Never write to `output/`, never produce a CSV, never run the test-case mirror
  step for a knowledge request.
