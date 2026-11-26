# Figma Designs — Optional, Best-Effort

How to treat linked Figma designs. Shared by the `create-tc`, `analyze-tc`, and
`add-knowledge` skills.

**Figma is a bonus input, never a prerequisite.** When it is readable it is an
authoritative source and should be used to sharpen cases. When it is not, the run
proceeds on the written acceptance criteria and finishes normally. A run is
**never** blocked, paused, retried later, or reported as failed because a design
could not be read.

---

## 1. Prefer MCP once — do not burn View-seat quota

When the source contains a Figma URL, make **one** MCP read attempt for that file
(`get_design_context`, or `get_screenshot` when you only need to look at it).

If that MCP attempt fails, **stop all further MCP Figma calls for the whole run**.
Do not:

- retry the same MCP call,
- try a different Figma MCP tool on the same file,
- try other nodes or other Figma URLs via MCP in the same source.

Retrying MCP is actively harmful: a **View** seat is capped at **~6 MCP tool
calls per month**, so each failed attempt burns quota that a later run may need.

`whoami` is **exempt** from rate limits — always safe to call to confirm account
and seat.

## 2. Headed Playwright recovery (when MCP is blocked)

MCP and the browser are **separate sessions**. Cursor Simple Browser login does
**not** feed Figma MCP, and MCP cookies do not feed Playwright.

When MCP fails for **View-seat entitlement** or **rate limit / quota**, and a
human can log into Figma in a headed window, read the file with
**playwright-cli** instead. This path does **not** consume Figma MCP quota.

### When to use it

- MCP returned the edit-access / View-seat error, or a rate-limit message, **and**
- the user (or you, with the user present) can complete a normal Figma web login
  in a headed Chromium window.

### When not to use it

- Unattended `/run-it` or queue runs with no human to log in — skip Figma and
  follow §4 / §5.
- Anonymous / headless / no-session opens of `figma.com/design/...` — CloudFront
  returns **403**; that only wastes time. Never treat a cold browser as a
  fallback.

### How

Profile lives under the repo (already gitignored via `.playwright-cli/`):

```bash
mkdir -p .playwright-cli/figma-profile
playwright-cli open --headed --persistent \
  --profile "$(pwd)/.playwright-cli/figma-profile" \
  "https://www.figma.com/design/<fileKey>/<name>?node-id=<node>"
```

1. If the window shows Figma login (`/email_only` or similar), **ask the user to
   log in** in that window and reply when the file title is visible.
2. Reuse the same session for every node: `playwright-cli goto` with
   `?node-id=14-9346` style URLs (hyphens in the query; Figma accepts them).
3. Fit / zoom with Figma shortcuts (`Shift+1` zoom to fit, `Shift+2` zoom to
   selection), then `playwright-cli screenshot` into
   `knowledge/evidence/<KEY>/...`.
4. Read the PNG with the Read tool (vision) to extract labels, empty-state copy,
   chips, and flow notes. Pan / re-zoom and re-screenshot when the first capture
   is too small to read.
5. Keep the persistent profile for later runs. Do not `delete-data` unless the
   user asks to clear the session.

One login per machine/profile is enough; later runs should open already
authenticated if the profile cookie jar is intact.

### After a successful Playwright read

Treat the screenshots like a successful MCP read: update the vault
`## Figma Design Summary`, set `figma: true` with a `figma_note` that names the
path (**Playwright headed + persistent profile**, not MCP), evidence paths, and
which nodes were captured. Count Figma-derived case updates normally.

## 3. Recognising the failure modes

| What you see | What it means | Recoverable? |
|---|---|---|
| `plugin-figma-figma` absent from the MCP catalog | Server not connected | MCP: no. Playwright §2 if user can log in |
| "Looks like you don't have edit access to this file" | **Seat entitlement.** MCP read tools need a **Dev** or **Full** seat; a **View** or **Collab** seat cannot use MCP reads | MCP: no until seat upgrade. Playwright §2: yes with web View access + login |
| Rate limit / quota message | Monthly or daily MCP cap reached | MCP: no until reset. Playwright §2: yes |
| 403 / 404 / "cannot access" on the file in a **logged-in** session | Not shared with this account, or a dead link | No |
| Headless / no-cookie 403 from CloudFront | No Figma session | Do not retry cold; use §2 or skip |
| No Figma URL in the source | Nothing to fetch | N/A — not a failure |

> **Session expired 2026-10-15 (PLAT-60351).** The persistent profile
> redirected to `/email_only`, so the §2 "when not to use it" rule applies
> again for unattended runs. Finish the run AC-driven, then offer the user a
> headed login. After one manual login it worked with zero MCP calls.
> - **Zoom with the keyboard.** `-` / `+` zoom around the viewport centre and
>   never drifted.
> - **Ctrl+wheel only at moderate zoom.** At 6% it threw the view onto blank
>   canvas. At 50% it zoomed cleanly around the cursor.
> - **Search one page with the find box.** Cmd+F works in view-only mode.
>   "No results on this page" is a quick way to show a state was never drawn
>   on that page (desktop "See all").
> - **Comment threads can't be opened from the list.** Clicking a row in the
>   Comments list did not open the thread, so replies could not be read. Root
>   comments are still extractable.
>
> **Confirmed again 2026-08-21 (PLAT-58525):** profile still valid on a fourth
> file, `-SSoT- tiket Mission Page` (`2BMu8KJz2qBgdfSx1NU4fO`), with **no user
> interaction and zero MCP calls** — so this path now works unattended inside
> `/run-it`, which §2's "when not to use it" no longer needs to rule out. Two
> zoom facts worth keeping:
> - **Clicking a frame's *title* label is the reliable selector.** It selects the
>   frame, updates `location.href` with its node id, and Figma fits it — legible
>   in one shot. Clicking the frame *body* selects it but leaves the URL on the
>   parent, so you cannot then `goto` the node.
> - **`Shift+2` is unreliable from a canvas click** (it silently did nothing
>   several times and once zoomed back out to the whole page). Prefer
>   title-click → read `location.href` → `goto` that node URL. Budget ~15 s for
>   the reload a `goto` triggers, and re-screenshot rather than trusting the
>   first capture, which is often still the Figma splash.
> - The file's **linked node came from the Confluence PRD, not from Jira** — the
>   epic and all four child stories had no Figma link at all. Check the PRD's
>   header table before concluding `figma: false`.
>
> **Confirmed again 2026-08-20 (PLAT-58520, PLAT-57210):** the profile still
> works across files with **no user interaction and zero MCP calls** — it opened
> `-SSoT- tiket x blibli affiliate` (`zu24XCaY3RLWRsXx9KnS1V`) and
> `-SSoT- Passenger Data` (`pmjLVou57fGZ0FJLPOmPLt`) in one session. Three
> techniques that made the read cheap:
> - **`goto` a node URL is the reliable zoom.** Figma fits the node on load, so
>   navigating to a small frame gives a legible capture. Manual `Ctrl+wheel`
>   zooming drifts badly and repeatedly landed on blank canvas at 1300%+ — don't
>   bother with it. To find child node ids, expand the frame's row in the Layers
>   panel, click each child, and read `location.href` via `eval`.
> - **Comment threads are ordinary DOM, not canvas.** Extract them with
>   `playwright-cli eval` over `[class*=comment]` and dedupe — far cheaper and
>   more accurate than screenshotting the panel, and it yields the comment
>   numbers, authors and relative dates. On an epic whose Jira body is thin, this
>   is where the actual decisions and open questions live.
> - **`snapshot --filename=x.yaml` writes to the repo root**, not
>   `.playwright-cli/`. Delete the file afterwards.
>
> **Confirmed again 2026-08-12 (PLAT-57176):** the persistent profile
> `.playwright-cli/figma-profile` still held a valid session **and works across
> files** — it opened `-SSoT- Loyalty Dashboard` (`csU8ZwfVQWxyAbu8Ea6ynQ`), a
> different file from the one it was logged in against, with no user interaction
> and **zero MCP calls**. Two operational notes that cost a cycle: **omitting
> `--headed` gives the CloudFront "The request could not be satisfied" 403** even
> with a good profile, and **`Shift+2` (zoom to selection) does nothing while
> focus is in the Layers panel** — send it via
> `playwright-cli run-code "async page => page.keyboard.press('Shift+2')"` after
> clicking the layer row, then screenshot. Resize the viewport (e.g.
> `resize 2560 1600`) before capturing so text is legible.
>
> **Known failure mode:** when the connected MCP account only holds **View**
> seats on the org, **MCP** reads fail or exhaust quickly. The same account
> **can** open shared files in the Figma web app. Confirmed recovery: headed
> `playwright-cli` with persistent profile
> `.playwright-cli/figma-profile` after a one-time user login (Mission List
> file `Q5xJP0JDjj1CpWbG8NcD3B`). Prefer Playwright for multi-node reads while
> MCP stays on View / low quota; do not burn remaining MCP calls to re-check.

## 4. Carry on without it

If neither MCP nor Playwright §2 can read the design, draft from the acceptance
criteria, the PRD text, and prior vault knowledge.

**Do not invent UI detail to fill the gap.** No guessed button labels, toast copy,
empty-state wording, or screen transitions. Cases must stay traceable to written
requirements. Where a design would normally have settled a UI question, either
leave it out or flag the open question in the case, exactly as you would for any
other undefined term.

## 5. Record it in the vault note

- **Figma URL present but unread** → `figma: true`, and `figma_note` gives the URL
  plus the concrete reason and date. Keep the `## Figma Design Summary` section,
  and use it to state that the design was not read, why, and that the cases are
  AC-driven.
- **Figma read via Playwright** → same as a successful read; say so in
  `figma_note` (path, profile, evidence paths, date).
- **No Figma URL at all** → `figma: false`, omit `## Figma Design Summary`.
- Unread only: set `Figma-derived: 0` in the counts.

Name the real cause. "Rate-limited", "no edit access (View seat)", and
"Playwright headed recovery" lead to different next steps; a wrong label in the
vault sends the next run down the wrong path.

## 6. Tell the user

Mention it in the **chat summary at the end of the run** — one or two sentences,
not buried in the vault note. Cover:

1. which design was not read (or how it was read), and the specific reason,
2. that the cases are AC-driven and complete regardless when unread,
3. briefly, what the design might have added (component states, empty states,
   copy), so they can judge whether it is worth unblocking.

Report a skipped design as a known limitation, not an apology or a failure. If
the cause is fixable on their side — a seat upgrade, file share, or a one-time
Playwright login — say so once and offer to re-run the Figma pass afterwards.
