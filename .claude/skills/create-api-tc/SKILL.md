---
name: create-api-tc
description: >-
  Generate API test cases from a curl command. Reads the curl, executes it to
  discover actual responses, then produces a CSV of test cases with real
  expected results. Use when the user asks to create API test cases, the label
  has no Jira ID, or the description contains a curl command.
---

# Create API Test Cases

Act as a **QA Lead**. Given a curl command and optional notes, generate a
comprehensive set of API test cases and produce a CSV file in the `output/`
folder.

## How to Detect an API Request

An API test case request is identified by:

- The `description` field contains a **curl command**
- The `label` has **no Jira issue key** (e.g., no `PLAT-XXXXX` pattern)
- The label often describes an API endpoint name (e.g., `LoyaltyMissionSlugProgressGET`)

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Curl command | `description` field in the queue request | The base curl to test |
| Notes | Also in `description`, after the curl | Instructions about what's in/out of scope, which headers matter, which path params are variable |

## Scope Rules (from user notes)

The user's `description` often contains notes about what to test and what to
skip. **Always read and respect these notes.** Common patterns:

- **`accept` header** — typically NOT in scope for test cases
- **`X-Request-Id`** — typically NOT in scope (just a log identifier)
- **Mandatory headers with flexible values** — test presence vs. absence only
  (empty = not present). Do NOT test different valid values.
- **Path parameters (slugs, IDs)** — test valid, invalid, and empty/missing
- **Optional headers** — noted as "does not matter for this API" — skip unless
  the user says otherwise

## Before Creation — Load Knowledge

Pull relevant prior knowledge from the vault first — see
`.claude/skills/shared/vault-notes.md` §0. Prefer the `obsidian` MCP server
(`search` for the endpoint/feature, `get_backlinks` from related API entries);
fall back to `knowledge/index.json` + `knowledge/entries/*.md`. Related API
endpoints often share auth, headers, and error shapes worth reusing.

## Workflow

### 1. Parse the curl command

Extract from the curl:
- **HTTP method** (GET, POST, PUT, DELETE, PATCH)
- **Base URL and path** — identify path parameters (slugs, IDs)
- **Headers** — separate mandatory from optional based on user notes
- **Request body** (if present) — identify required/optional fields

### 2. Identify test dimensions

Based on the curl + notes, list the testable dimensions:

| Dimension | Example variations |
|-----------|-------------------|
| Mandatory headers | present, missing (empty = missing) |
| Account/user ID | valid (joined/not joined), invalid, empty, missing, non-numeric |
| Request body fields | valid, missing required, wrong type (for POST/PUT) |
| Path parameters | valid, invalid, empty, missing (only for variable path segments like slugs/IDs — NOT for fixed endpoint paths) |

### 3. Execute curls to get actual responses

**This is critical.** For each test scenario, execute the actual curl against
the preprod environment to discover the real API response. This ensures
expected results are based on actual behavior, not guesses.

Run curls for at minimum:
- Happy path (all valid)
- Invalid path parameter (slug/ID) — only if path has variable segments
- Missing key header (especially account/user ID)
- Empty key header
- Non-numeric ID (if ID is numeric)

### 4. Create test cases

Generate **minimum 10 test cases** (unless truly impossible — then as many as
you can). Keep to obvious, practical cases — no deep edge cases.

**All cases must be request-side variations.** Each case must modify the
*request* (header, parameter, body, account ID) to test a different scenario.
Do NOT create cases that simply assert different aspects of the same response
from the same request — those are validation points within a single case, not
separate cases.

Categories to cover:
- **Happy path** — valid request with expected response
- **Path parameter variations** — invalid slug, empty, missing (only for
  variable segments like `/mission/{slug}` — NOT for fixed endpoint paths)
- **Header presence** — each mandatory header missing/empty
- **Account ID variations** — valid joined, valid not-joined, missing, empty,
  non-numeric

### 5. Do NOT test

- `accept` header variations (unless user explicitly says otherwise)
- `X-Request-Id` presence/absence
- Different valid values for non-strict headers (only test present vs. absent)
- **Wrong HTTP method** (e.g., POST instead of GET) — not in scope
- **Invalid endpoint path / typos in URL** — not in scope (this tests routing,
  not the API itself). Only test path *parameter* variations when the path
  contains a variable segment (e.g., slug or ID).
- **Query parameters** — do NOT generate cases with query parameters unless the
  original curl already uses them. If the base curl has no query params, the
  endpoint does not support them — do not invent `?foo=bar` variations.
- **Duplicate headers** — do NOT create cases with duplicate/repeated headers
  (e.g., sending `X-Account-ID` twice). The automation framework wraps headers
  in a map, so duplicate keys are impossible in practice.
- **Response-only assertions** — do NOT create separate cases that re-send the
  same request just to verify different fields in the response (e.g., "Verify
  response has code field", "Verify token is string type", "Verify no auth
  required", "Verify response contains chips array", "Verify active campaigns
  have countDown field"). These are validation points within the happy path
  case, not standalone test cases.
- **Prerequisite documentation cases** — do NOT create a case just to state
  that a prerequisite exists (e.g., "Verify user must consent first"). If a
  prerequisite matters, note it in the happy-path case's expected result.
- **Headers not in the original curl** — do NOT invent headers that are not
  present in the base curl command. If the original curl has no `X-Account-ID`,
  do NOT create cases with `X-Account-ID`. Only test headers that are already
  in the curl (test their presence vs. absence). Exception: headers explicitly
  mentioned in the user's notes as mandatory.
- **`accept` and `content-type` header variations** — ALWAYS out of scope.
  Never create cases testing presence/absence/value of `accept` or
  `content-type` headers. These are framework-level concerns, not API logic.
- **"Public endpoint" / "no auth required" cases** — if the base curl has no
  auth headers and works, that is proven by the happy path case. Do NOT create
  a separate case just to state the endpoint is public.
- Security/penetration edge cases (SQL injection, XSS) unless very obvious
- Performance/load scenarios

## Output Format

Same CSV format as `create-tc`:

```
case,steps,expected result,type,priority,criticality,platform
```

| Column | Format | Description |
|--------|--------|-------------|
| `case` | `"Verify ..."` sentence (short, action-focused) | What scenario is being tested — do NOT include expected response values, status codes, or messages in the title |
| `steps` | **Full curl command** | The exact curl to execute for this test case, modified from the base curl as needed (e.g., removed header, changed slug, changed HTTP method) |
| `expected result` | **Explanation + `---` separator + full JSON response** | A short human-readable explanation of what happens, then a `---` line, then the complete raw response body from executing the curl |
| `type` | `e2e` or `specific` | Almost always `specific` for API cases |
| `priority` | `P0` / `P1` / `P2` / `P3` | Execution priority |
| `criticality` | `critical` / `high` / `medium` / `low` | Business impact |
| `platform` | Platform name | Always `API` for API test cases |

### Key differences from UI test cases

**Steps column = full executable curl command.** Keep the complete command
that the tester can copy-paste and run directly, modified for each scenario.
A single command may remain one line; do not insert arbitrary line breaks that
change shell syntax or quoted payloads.

**Expected result = explanation, separator, and full response on separate lines.**
Put the human-readable explanation first, then `---` on its own line, then the
complete observed response body. Pretty-print JSON without altering its values;
retain the full text for non-JSON responses. Keep everything in one quoted CSV
cell with actual newline characters.

Example cell content (before CSV escaping):

```text
API returns HTTP 200 with code=NOT_FOUND. The mission slug does not exist.
---
{
  "code": "NOT_FOUND",
  "message": "The mission with the provided Id does not exist",
  "errors": ["mission with slug invalid-slug-here not found"],
  "data": null,
  "serverTime": 1781058702746
}
```

Read and follow `.claude/skills/shared/csv-format.md` when writing the output,
including its saved-file round-trip check before generating the vault mirror
or marking completion. Properly quoted CSV cells support real newlines.

**Why full curl + full JSON?** This makes API test cases self-contained and
directly executable — the tester doesn't need to reconstruct the curl from
abbreviated steps, and can compare the actual response against the recorded
expected JSON.

### Case Title Formatting

Keep case titles **short and action-focused**. Describe the *scenario* being
tested, not the expected response. Do NOT embed status codes, error messages,
or response values in the title.

- **Bad:** `"Verify that hitting API without accountId returns 400 BAD_REQUEST with message 'accountId is required'"`
- **Good:** `"Verify hit API without accountId"`
- **Bad:** `"Verify that API returns 200 SUCCESS with token data when valid user"`
- **Good:** `"Verify hit API with valid user"`
- **Bad:** `"Verify that invalid slug returns NOT_FOUND error"`
- **Good:** `"Verify hit API with invalid slug"`

All expected response details (status codes, error messages, JSON bodies)
belong in the `expected result` column.

### Priority & Criticality for API cases

| Priority | When to use |
|----------|-------------|
| `P0` | Happy path, core path parameter validation, account ID handling |
| `P1` | Header presence checks, wrong HTTP method, secondary validations |
| `P2` | Optional header checks, cosmetic response differences |
| `P3` | Nice-to-have edge cases |

## Filename Convention

`tc-api-<endpoint-name>.csv`

Example: `tc-api-loyalty-mission-slug-progress-get.csv`

## After Creation — Save Knowledge

Persist the run into the Obsidian knowledge vault. **Follow
`.claude/skills/shared/vault-notes.md` for the exact note format.** In summary:

1. **Write `knowledge/entries/<ENDPOINT>.md`** as an Obsidian note with YAML
   frontmatter (`kind: api`, `key`, `title`, `source: "Curl command (API)"`,
   `action: create-api`, `date`, `figma: false`, `tags`, `keywords`, `related`
   as `[[wikilinks]]`, `cases_total` / `cases_e2e` / `cases_specific`, and
   `test_cases`) plus the usual body sections. Use the label or endpoint name
   as the `<ENDPOINT>` key (there is no Jira issue key).
2. **Update `knowledge/index.json`** — add/update the entry with the endpoint
   key, title, keywords, related, date, and `type: "create-api"`.
3. **Generate the test-case mirror** — run `node scripts/migrate-vault.js` to
   build `knowledge/test-cases/<ENDPOINT> — Test Cases.md` from the
   `tc-api-<endpoint>.csv` file, then confirm the report lists your endpoint.
