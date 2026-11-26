# Vault Note Format (Obsidian)

How to persist knowledge so the `knowledge/` Obsidian vault stays consistent.
Shared by the `create-tc`, `analyze-tc`, and `create-api-tc` skills.

Every run persists three things:

1. **Source note** → `knowledge/entries/<KEY>.md` — you write this.
2. **Test-case mirror** → `knowledge/test-cases/<KEY> — Test Cases.md` —
   generated from the CSV (see section 2). Do not hand-write it.
3. **Machine index** → `knowledge/index.json` — you update this, as before.

`<KEY>` is the Jira issue key (e.g. `PLAT-54052`) or, for API runs, the
endpoint label (e.g. `GamificationPlayerEarnPOST`).

---

## 0. Loading vault knowledge before a run

Before generating or analyzing, pull relevant prior knowledge from the vault so
past learnings sharpen the new output.

**Preferred — Obsidian MCP (`obsidian` server, Seekstone).** When the `obsidian`
MCP server is connected, use it — it's token-efficient (returns ranked excerpts,
not whole files):
- `search` with the feature's key terms and related issue keys to find prior entries.
- Also `search` by the **surface** the feature changes (the form, config object
  or API field) and by the names of row actions on it (Duplicate, Edit, Import).
  An older feature on the same surface will not share this feature's vocabulary,
  so a search on the feature's own terms will miss it.
- Read older notes on the same surface and treat their rules as test inputs.
- `read_note` to read the most relevant ones (supports heading/section slices).
- `get_backlinks` / `get_links` on a related issue to walk the graph of connected work.
- `list_tags` to reuse existing tag names instead of inventing near-duplicates.

**Fallback — direct file reads.** If the MCP isn't available, read
`knowledge/index.json` (match overlapping keywords / related keys), then open the
relevant `knowledge/entries/*.md` files.

Either way, also apply the patterns in `.claude/rules/qa-heuristics.md`.

---

## 1. Source note — `knowledge/entries/<KEY>.md`

Write YAML frontmatter, then the body. Use `knowledge/templates/Entry.md` as
the canonical shape.

### Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `kind` | yes | `epic` \| `story` \| `confluence` \| `api` \| `doc` |
| `key` | yes | the `<KEY>`, double-quoted |
| `title` | yes | feature title, double-quoted |
| `source` | yes | e.g. `Epic`, `Story`, `Confluence`, `Curl command (API)`, `File (PDF)` — double-quoted |
| `action` | yes | `create` \| `analyze` \| `create-api` \| `knowledge` |
| `date` | yes | `YYYY-MM-DD` (unquoted) |
| `figma` | yes | `true` when the source links a design — whether or not it could be read; `false` only when there is no Figma link at all |
| `figma_note` | if `figma: true` | the Figma URLs/notes, double-quoted. When the design was **not** readable, give the concrete reason and the date — see `.claude/skills/shared/figma-designs.md` |
| `tags` | yes | sanitized keywords as a flow list: `[tag-a, tag-b]` |
| `keywords` | yes | verbatim phrases, each double-quoted: `["welcome rewards", "loyalty"]` |
| `related` | if any | wikilinks: `["[[PLAT-54053]]", "[[PLAT-54054]]"]` |
| counts | yes | see below |
| `test_cases` | if a CSV exists | `"[[<KEY> — Test Cases]]"` |

**Counts** — use the set matching the action:
- `create` / `create-api`: `cases_total`, `cases_e2e`, `cases_specific`
- `analyze`: `cases_valid`, `cases_additional`, `cases_invalid`
- `knowledge`: **none** — knowledge notes have no counts and no `test_cases`.

**Knowledge variant** (`action: knowledge`, written by the `add-knowledge`
skill) captures a source into the vault **without** test cases. It omits the
counts and `test_cases` frontmatter, skips step 2 (no CSV, no
`migrate-vault.js`), and its body uses `## Summary`, `## Key Points`,
`## Figma Design Summary` (only if `figma: true`), and `## Details` instead of
the "Cases Created" / "Valid Case Count" section.

**Tag rules** — derive `tags` from the keywords: lowercase, replace spaces and
punctuation with `-`, collapse repeats, drop purely-numeric tags. Keep the
original phrases in `keywords`.

**Wikilink rule** — every related issue key becomes `[[KEY]]`. It's fine if the
target note doesn't exist yet — it shows as an unresolved link and resolves
once that note is created.

**YAML safety** — double-quote any string containing `:`, `"`, `[`, or that
starts with punctuation. Titles like `[BE] ...` MUST be quoted.

### Body

```
# <KEY> — <title>
> **Related:** [[KEY-1]] · [[KEY-2]]
> **Test cases:** [[<KEY> — Test Cases]]

## PRD Summary
...

## Figma Design Summary        (omit when figma: false)
...

## Key Learnings
- ...

## Cases Created               (analyze uses "## Valid Case Count")
- Total: N
- E2E: N
- Specific: N
```

---

## 2. Test-case mirror — generated from the CSV

The test-case note mirrors the output CSV — **do not hand-write the table.**
After writing the CSV to `output/`, the entry to `entries/`, and updating
`index.json`, run:

```
node scripts/migrate-vault.js
```

This (re)builds `knowledge/test-cases/<KEY> — Test Cases.md` from the CSV with a
header-driven table (so `create`, `analyze`, and API column shapes all work),
and leaves already-written entry prose untouched. Check the printed report:

- `<KEY>` under **"Test-case notes"** → done.
- `<KEY>` under **"Entries with no matching CSV"** → the CSV filename didn't
  match the key. Rename the output CSV to contain the key (`tc-<KEY>.csv`, or
  `<KEY>_<timestamp>.csv` for analyze), then re-run; or, as a fallback, create
  the note by hand from `knowledge/templates/Test Cases.md`.

To change a test-case note, edit the source CSV and re-run the script — never
edit the mirror directly.

---

## 3. Machine index — `knowledge/index.json`

Update as before: add/update the entry with `title`, `keywords` (array),
`related` (array of keys), `date`, and `type` (`create` / `analyze` /
`create-api` / `knowledge`). The skills read this for fast
pre-run lookup.
