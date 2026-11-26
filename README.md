# TC Queue: QA test cases with Claude Code

A small local setup that turns PRDs (Jira epics and stories, Confluence pages, Figma designs,
files or plain notes) into TestRail-ready test cases. It has three parts:

1. **A queue UI** (`npm start`, then open http://localhost:4568). You file requests here. The server only
   stores them on disk and shows the results. It never generates anything itself.
2. **Claude Code skills** (`.claude/skills/`). When you type `/run-it`, Claude reads the queue and
   does the work: it reads the PRD, drafts the cases, checks them and saves a CSV.
3. **A knowledge vault** (`knowledge/`, an Obsidian vault). Each run reads it before drafting and
   adds to it afterwards, so the cases get better the more your team uses it.

The vault starts empty. It fills up with your team's features, flows and lessons as you use the tool.

```
 you ──► /new (queue UI) ──► queue/<id>_request.json
                                     │
               Claude Code: /run-it ─┤ reads Jira/Confluence/Figma + knowledge/
                                     ▼
            output/tc-<KEY>.csv ──► /cases (review, edit) ──► TestRail CSV or direct upload
                                     │
                                     └─► knowledge/entries/<KEY>.md  (the vault grows)
```

---

## 1. Prerequisites

| Tool | Why |
| --- | --- |
| **Node.js 20+** | Runs the queue UI and the vault scripts |
| **Claude Code** (CLI, desktop app or IDE extension) | Runs the skills |
| **Atlassian plugin** for Claude Code | Reads Jira issues and Confluence pages |
| **Figma plugin** for Claude Code (optional) | Reads designs that the PRD links to |
| **Obsidian** (optional) | Lets you browse the vault, with the Dataview and Front Matter Title plugins. The skills work without it |

To install the plugins, run `/plugin` inside Claude Code, add **atlassian** and **figma**, then
run `/mcp` to sign in to each one.

## 2. Set up your copy

```bash
git clone <this-repo-url> my-team-qa
```

```bash
cd my-team-qa && npm install
```

```bash
npm start
```

Open http://localhost:4568. You should see an empty queue. Set `PORT` to use a different port, and `HOST` to listen beyond this machine (it binds 127.0.0.1 by default).

Start Claude Code **from this folder**, so it picks up `CLAUDE.md`, the skills and the rules.

### Optional: TestRail upload

The **Upload to TestRail** button on the `/cases` page syncs a sheet straight into TestRail.

```bash
cp testrail.example.json testrail.local.json
```

Fill in your TestRail URL, username, **API key** (TestRail → My Settings → API Keys), your
**projectId** and the **suites** you upload to. This file is gitignored. You can use the
`TESTRAIL_URL`, `TESTRAIL_USERNAME` and `TESTRAIL_API_KEY` env vars instead.

> The custom field option IDs (case type, automation status, platform and so on) are set near the
> top of `testrail-upload.js` and were read from project 184. If your project uses different
> options, change them there. The dialog always shows a preview before it writes anything.

Without this file you can still download a TestRail-format CSV from any finished request and
import it by hand.

### Optional: Share P0

**Share P0** creates a Google Sheet with the P0 cases of the sheets you select, to hand to developers.
See `google.example.json` and `scripts/p0-share.gs`. Without any setup it falls back to a CSV
download.

## 3. Daily use

1. **File a request** at `/new`. Pick a type:
   - **Create**: paste a Jira or Confluence link, or free text, and attach files if you have them.
     Claude generates the cases.
   - **Analyze**: upload an existing CSV and give the PRD link. Claude checks each case against
     the PRD (correct, duplicate, made up, out of scope) and then adds the cases that are missing.
   - **Knowledge**: capture a source into the vault without writing any test cases. Use this
     to teach the vault about a feature ahead of time.
2. **Run the queue** in Claude Code:
   ```
   /run-it
   ```
   Or run one request with `/run-it <first-8-chars-of-id>`. The badge in the UI turns
   *Processing*, then *Done*.
3. **Review** in `/cases`: filter, edit cells inline and set P0 to P3. Your edits are saved
   back to the source CSV.
4. **Ship**: download the TestRail CSV, or use **Upload to TestRail**.

You can also run the skills without the queue, by asking Claude directly:

| Skill | What it does |
| --- | --- |
| `/create-tc` | Generate cases from a Jira, Confluence or file PRD |
| `/analyze-tc` | Check an existing CSV against a PRD, then add missing cases |
| `/create-api-tc` | Generate API cases from a curl command. It runs the curl first to see real responses |
| `/add-knowledge` | Capture a source into the vault, with no test cases |
| `/run-it` | Process every pending queue request |

## 4. How the vault learns

- `knowledge/entries/<KEY>.md`: one note per issue or PRD, with YAML frontmatter and wikilinks to
  related work. The skills write these, so don't hand-edit their structure. Adding notes in the
  body is fine.
- `knowledge/test-cases/`: a searchable copy of every `output/*.csv`, generated by
  `node scripts/migrate-vault.js`. Never hand-edit it.
- `knowledge/index.json`: the machine lookup the skills read before each run.
- `.claude/rules/qa-heuristics.md`: lessons from past runs, such as patterns of invalid cases,
  coverage gaps across flows, and priority rules. Claude loads it whenever it touches `output/` or
  `knowledge/`. **This file is the most valuable part to grow.** When a review catches something
  the cases missed, add a heuristic here.

Open `knowledge/` as a vault in Obsidian and install two community plugins (Obsidian will offer
them when you open the vault, because they are listed in `.obsidian/community-plugins.json`):

- **Dataview** — powers the dashboards in `Home.md`.
- **Front Matter Title** — shows each note's `title` instead of its file name. Notes are named
  by Jira key (`PLAT-123.md`), so without it the graph and file list are a wall of ticket
  numbers. After enabling it, open its settings and turn on the **Graph** and **Explorer**
  features (these settings are per machine and not shared through git).

Other useful commands:

```bash
node scripts/find-unresolved.js
```

```bash
node --test
```

## 5. The CSV format

Skills write 9 columns:

`id, case, preconditions, steps, expected result, type, priority, criticality, platform`

Preconditions are
`key: value` clauses (`account:`, `config:`, `data:`, `state:`). When the PRD doesn't say how to
reach a state, the skill writes `UNKNOWN: …` instead of guessing. The full rules are in
`.claude/skills/shared/csv-format.md` and `.claude/skills/create-tc/SKILL.md`.

On export, the TestRail CSV keeps only the columns TestRail understands. TestRail **priority comes
from criticality** (critical/high/medium/low). P0 to P3 is your own triage mark and is never uploaded.

## 6. Where things live

| Path | What | In git? |
| --- | --- | --- |
| `server.js`, `public/` | Queue UI (Express plus vanilla ES modules, no build step) | yes |
| `.claude/skills/`, `.claude/rules/` | The skills and heuristics | yes |
| `knowledge/` | The vault | yes: it's your team's shared memory |
| `output/` | Generated CSVs | yes |
| `original/` | Input CSVs copied in before analyze runs | yes |
| `queue/` | Runtime state: requests, uploads, result copies | **no** |
| `*.local.json` | Your credentials | **no** |

`CLAUDE.md` describes the architecture in more detail. Read it before you change `server.js`.

## 7. Tips

- Jira and Confluence fetching only works in Claude's **main** agent. Subagents can't reach the
  Atlassian plugin. The skills already account for this.
- Run Claude Code from the repo root. Rules and skills are loaded relative to it.
- If a run produces a bad case, fix the CSV in `/cases`, then write down **why** it was wrong in
  `qa-heuristics.md`. That is how the next run avoids the same mistake.
