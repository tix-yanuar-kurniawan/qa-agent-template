---
kind: home
title: QA Knowledge Vault
---

# QA Knowledge Vault

Living knowledge base for every Epic, Story, Confluence PRD, API, and the test
cases generated from them. Source notes live in `entries/`, their test cases are
mirrored as tables in `test-cases/`, and `index.json` remains the machine index
the skills read before each run.

> [!tip] First-time setup
> These dashboards use the **Dataview** community plugin. Enable it once:
> Settings → Community plugins → turn off Restricted mode → Browse → install
> **Dataview** → enable. Until then, the blocks below show as code.

## Recently added

```dataview
TABLE WITHOUT ID file.link AS "Entry", kind AS "Type", source AS "Source", default(cases_total, cases_valid) AS "Cases", date AS "Date"
FROM "entries"
WHERE !imported
SORT date DESC
LIMIT 25
```

## Library at a glance

```dataview
TABLE WITHOUT ID length(rows) AS "Entries"
FROM "entries"
GROUP BY kind AS "Type"
```

## Test-case coverage

Issues sorted by how many cases we have on record.

```dataview
TABLE WITHOUT ID source_issue AS "Issue", count AS "Cases", date AS "Date"
FROM "test-cases"
SORT count DESC
```

### Entries with no test-case note yet

```dataview
LIST
FROM "entries"
WHERE !test_cases AND !imported
```

## Knowledge notes (no test cases)

Sources captured into the vault on demand via the **Add Knowledge** queue —
Jira, Confluence, Figma, or notes distilled into a reference note without
generating any test cases.

```dataview
TABLE WITHOUT ID file.link AS "Entry", kind AS "Type", source AS "Source", date AS "Date"
FROM "entries"
WHERE action = "knowledge"
SORT date DESC
```

## Features missing a Figma reference

Non-API features where `figma: false` — candidates to revisit if a design exists.

```dataview
TABLE WITHOUT ID file.link AS "Entry", source AS "Source", date AS "Date"
FROM "entries"
WHERE figma = false AND kind != "api" AND !imported
SORT date DESC
```

## Possible related / duplicate work

Pairs of entries that share 4+ tags — useful for spotting overlapping features or
duplicate analyses. (Requires Dataview JS queries, on by default.)

```dataviewjs
const arr = dv.pages('"entries"').where(p => !p.imported).map(p => ({ link: p.file.link, tags: (p.file.tags ?? []) })).values;
const out = [];
for (let i = 0; i < arr.length; i++) {
  for (let j = i + 1; j < arr.length; j++) {
    const shared = arr[i].tags.filter(t => arr[j].tags.includes(t));
    if (shared.length >= 4) out.push([arr[i].link, arr[j].link, shared.length, shared.join(" ")]);
  }
}
out.sort((a, b) => b[2] - a[2]);
dv.table(["Entry A", "Entry B", "Shared", "Tags"], out.slice(0, 30));
```

## Reference notes (imported from Jira)

Context issues pulled straight from Jira so the related-links graph resolves.
These aren't QA runs — each mirrors its source Jira issue (summary, key points,
full description) and links back to the work that references it.

```dataview
TABLE WITHOUT ID file.link AS "Issue", kind AS "Type", status AS "Status", related AS "Referenced by"
FROM "entries"
WHERE imported
SORT key ASC
```
