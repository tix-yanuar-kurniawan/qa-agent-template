---
description: "QA heuristics learned from past test case analyses. Automatically loaded to improve future analyze-tc and create-tc tasks."
paths:
  - "output/**"
  - "knowledge/**"
---
# QA Heuristics

Accumulated patterns from past analyses. Apply these when analyzing or creating
test cases.

## Invalid Case Patterns

- Infrastructure/security tests (DDOS, failover, rate limiting, unauthorized
  access) are almost always out-of-scope for feature-level PRDs unless
  explicitly mentioned.
- AI-generated test cases frequently hallucinate user notifications, automated
  emails, and point-transfer features that are not in the PRD.
- Browser/OS/device compatibility tests are out-of-scope for backend-focused
  stories unless the PRD explicitly includes frontend work.
- "System outage" and "server downtime" resilience tests are infrastructure
  concerns, not feature-level test cases.
- Duplicate cases often rephrase the same intent with slightly different
  wording (e.g., "only affects specified partners" vs "does not affect
  non-specified partners"). Read all cases before marking to catch these.
- AI-generated cases heavily over-test version compatibility (backward/forward
  compatibility across app versions, dashboard versions, etc.) when the PRD
  makes no mention of versioning.
- Watch for cases that contradict the PRD's core mechanism (e.g., assuming
  whitelist requires removal from blacklist first, when the whitelist is
  designed to override blacklisting).
- **Unobservable assertions.** A case is untestable when the system cannot
  expose the state it asserts. "One account can be mapped to multiple cards" is
  unverifiable when the partner passes no card identifier and the system stores
  only a boolean holder flag — there is nothing to count. Every expected result
  must name a surface: screen, response field, DB column, log entry, or email.
- **Rows the PRD itself marks unreachable.** Matrix and decision tables often
  carry per-row notes like "case is not possible to happen" or "TBC". Don't
  mechanically convert those rows into cases — drop them, or flag the
  precondition as unbuildable so nobody burns a day trying to construct it.
- **Assertions owned by a downstream system.** When a PRD describes an
  end-to-end program, only part of it belongs to the epic under test. Reward
  injection, partner-side billing, and another squad's eligibility rules are
  context, not cases — raise them against the ticket that owns them.
- **Hedging pairs.** Writing both "verify X is shown" and "verify X is not shown
  (beyond Y)" means a contradiction in the source was never resolved. At least
  one is wrong; go back to the change log and the Q&A table.
- **Terms the PRD never defines.** A case that inherits an undefined domain word
  inherits its ambiguity, and two testers will build two different setups.
  Flag the term instead of propagating it — undefined vocabulary is where
  redundant and unbuildable cases hide.
- **A later AC can be made unreachable by an earlier one in the same story.**
  When a story tightens an eligibility gate, re-check every downstream AC's
  precondition against the new gate. "The user passes the challenge *after* the
  end date" is unbuildable once the same story stops counting anything completed
  after the end date. The clause reads as a live requirement, but no tester can
  construct it — drop the case and record why, rather than leaving someone to
  discover it at execution time.

## Valid Case Patterns

- Always check for special user segments (cobrand, premium, etc.) when the PRD
  involves points or loyalty — these often have exception rules.
- For a GET-by-id API, keep four outcomes as separate cases: missing/empty
  param (400 generic), malformed param (400 invalid), unknown id (404), and
  known id with an empty collection (200 `[]`). Collapsing "no data" into
  "not found" is the consumer-facing contract bug. Mapped vs registered (or
  any action/status enum the fixtures distinguish) is the same kind of split
  — one happy-path row cannot cover both.
- When a PRD mentions a config key (e.g., `tag_aff_id`), always add a case
  verifying the config-based behavior and a case for invalid/null config values.
- When a feature disables something, always test both the disabled state AND
  that the non-disabled path still works (positive + negative).
- Tooltip/message copy specified in the PRD (especially in multiple languages)
  should each get their own test case.
- When a PRD specifies confirmation popups/dialogs, always test the cancel
  path (user dismisses the popup and the state should remain unchanged).
- When a PRD introduces a new privilege/access, always test: (1) user with
  privilege can use the feature, (2) user without privilege cannot see/use it,
  (3) the privilege is correctly assigned to the specified role.
- When a side-effect (whitelist, enrollment, eligibility, tracking) is tied to a
  UI lifecycle event, test each trigger point explicitly: on *screen load* vs.
  on *button click*, the *dismiss / no-click* path (side-effect should still
  persist if it fired on load), and the *guest → login round-trip* where the
  screen is NOT reloaded on return (so a load-time side-effect will NOT re-fire
  and must instead happen on the next click). Logged-in and logged-out users
  often follow different trigger paths for the same outcome.
- For a bug-fix ticket, always add an explicit regression case asserting the
  original faulty behavior no longer occurs (e.g., "not redirected to a
  non-eligible page"), separate from the positive happy-path case.
- When a feature adds a **provisional/pending state** that fills *visual*
  progress but must NOT unlock the reward/action until it converts to a real
  state, always test the gating split explicitly: (1) all-pending progress
  looks complete but claim/action stays blocked, (2) after conversion the
  action unlocks, and (3) display prioritization (real states shown before
  provisional ones, excess provisional hidden when visible slots are full).
- When progress items are tied to a **time window** (e.g., mission period),
  editing the window boundary should revalidate existing items — test both
  directions: widening the window adds newly-eligible items, narrowing it
  removes now-ineligible items.
- For order/transaction-driven progress, always cover the lifecycle side
  effects as pairs: refund/cancel removes the item; reschedule that moves the
  completion date *outside* the valid window removes it, while a reschedule
  that stays *inside* the window retains it. **But confirm the state machine
  first** — see the next entry, which overrides this whenever completion and
  refund are mutually exclusive terminal states.
- **Get the entity's state machine before writing any "X after it was counted"
  case.** "The booking was counted, then it is refunded, so the total is
  deducted and the leaderboard recalculated" is the most natural case to draft
  and is *unbuildable* whenever accrual happens at a terminal state that refund
  cannot follow. The tiket order flow is `waiting for payment → processing
  e-ticket → e-ticket issued → finished | refund | reschedule`, with the last
  three mutually exclusive, so a finished order can never be refunded. Ask for
  the lifecycle when the PRD assumes it, then re-express every reversal case as
  the state it actually branches from ("refunded *from e-ticket issued*, so it
  never contributes at all").
- **When a rule keys off a completion event, the highest-value case is which
  status accrues the value.** A PRD that says "only completed bookings count"
  exists precisely because something is currently credited earlier. Pin the
  transition in one case — nothing at the pre-completion status, the amount
  appearing only on completion — and add the gating twin: pre-completion value
  must not push a user over a target and unlock a claim or reward.
- **A reversal that replaces rather than voids needs a successor case.** A
  reschedule usually produces a replacement order, so excluding the original is
  only half the rule; the replacement's own dates decide what counts. Whether it
  inherits the original order date or takes the reversal date is almost never
  written down, and it changes eligibility at every period boundary.
- **A deterministic string/data transform needs far more than the PRD's worked
  examples.** For a documented algorithm (sanitize an email into a name, derive
  a code, normalize a phone), the two or three examples in the PRD are the happy
  path. Add cases for **step-order dependency** (an earlier step changing what a
  later step matches — stripping digits can make a separator newly "between
  letters"), **consecutive or adjacent special inputs**, whether inserted
  characters **count toward a length threshold**, **case normalization** on
  already-uppercase input, the **empty result** after transformation, and the
  **undefined character set** (which characters even count as "special"?).
- **Two date keys against one window produce a straddle case; several concurrent
  windows make it a gap.** When eligibility requires *both* a start event (order
  date) and an end event (completion date) inside the same period, the sharp case
  is the record that straddles two consecutive periods — in-window for the first
  on one key, in-window for the second on the other key, and therefore eligible
  for **neither**. Test the four corners (both in, each one out, both out) plus
  the straddle, and confirm the comparison runs at timestamp rather than calendar
  granularity when the source says "timestamp".
- **A bi-directional state toggle needs a no-op case.** Setting a status to the
  value it already holds is unreachable through the toggle UI but reachable via
  the API, a double-submit inside a confirm modal, or two admins acting on stale
  state. Assert what it writes: history text reading "changed from Connected to
  Connected", an audit record with `oldStatus == newStatus`, and an ambiguous
  success/fail result.
- **A create-once endpoint that reports success without writing is silent data
  loss — test the second write.** An admin `POST` documented as "saves only one
  config and returns success in subsequent requests without saving its value"
  gives every caller a `SUCCESS` response for a change that never landed. The
  case is: write once, write again with different values, then **read back** and
  assert the first values are still stored. Score it `critical` even though
  nothing is deleted — the operator believes the config changed and the consumer
  surface disagrees. Any UI that switches an update from `PUT` to `POST` fails
  this invisibly, which is precisely why the UI test cannot catch it.
- **An admin control mirroring a system-driven status needs an origin case.**
  When status normally originates from an external event (a partner approval),
  test whether an admin can manufacture it from nothing. Usually they must not —
  and the real defect is then that the control is *enabled* on records where it
  can only ever fail.
- **An item excluded from a list can still consume its sequence number.**
  "Free stamps should not be displayed" reads as a pure filter, but PLAT-58525's
  API flow computes the stamp sequence *including* free stamps and only then
  omits them from the items — so a mission with one free stamp shows its first
  real order as `Stamp 2 to 3`, never `Stamp 1 to 2`. Whenever a source says
  something is hidden, ask separately whether it still affects numbering,
  totals, or progress; the case that catches this is a count reconciliation
  (visible rows + hidden items = the progress shown elsewhere), and getting it
  wrong makes every label on the screen off by one.
- **A conditional field is often gated by the parent's type, not by the row's
  own type.** "Room nights: for Hotel missions" invites a per-vertical case; the
  real gate on PLAT-58525 was the *mission* type (`ROOM_NIGHT`), so an
  `ORDER_ID` mission with a multi-night hotel order shows no room nights at all
  and earns one stamp. Write both halves — the row that has the field in the
  right parent, and the same vertical in the wrong parent — because the wording
  of the requirement points at the wrong one.
- **Compare how the PRD treats comparable consequences.** If deleting an account
  warns the user about losing a benefit but unverifying their phone silently
  breaks that same benefit, the asymmetry deserves a question even when both
  behaviours are "as specified". Consistency gaps almost never appear as
  requirements.
- **A server-side experiment has two fail modes, and they are not the same
  case.** Evaluation timeout must fail-open to the default variant and still
  return 200 (high if the sheet would otherwise break). Tracking after a
  successful write must be fire-and-forget so Mixpanel ingest cannot roll back a
  claim (critical when the write is money or entitlement). Exposure and
  conversion events stay medium — they are secondary trackers. PLAT-59111.
- **Immutable first-visit persist plus "no exposure from cache" makes an empty
  first render unrecoverable.** When homepage binds `campaignId` on first visit
  and later visits skip Mixpanel *and* skip exposure from cache, an empty first
  sheet can lock the user into a campaign that is never exposed. Write one case
  that records whether the empty render persisted, rather than asserting both
  persist and not-persist. PLAT-59111 TC16.
- **A backfill story is its own test target, and its AC names the cases.**
  "Idempotent", "auditable", "dry-run", "no unintended overwrite" and "define
  rules for unknown/empty values" each become one case: run twice and diff; a
  dry run that changes nothing; an explicitly-set value that conflicts with the
  derived one survives; rows with empty or out-of-set input do not abort the
  run and never receive a value outside the field's allowed set. The derivation
  rule itself is usually undefined when the story is written — assert that the
  result matches the rule, never invent the rule (no "Mr = male"), and raise it.
  Running the script mutates shared data — say so in the preconditions. PLAT-60403.
- **Twin client stories can differ in subtasks while the description is
  identical.** Four identical field stories hid that only iOS/Android had a
  "default selection from salutation" subtask. Read subtask titles per platform
  and write the platform-specific behaviour as its own case, with the other
  platform's initial state as `UNKNOWN`. PLAT-60403.
- **An integration-test story with no links is a pointer; search for the system it
  tests.** PLAT-60525 ("Integration Testing: Trip View ... via Rewards Hub") had
  three bullets, no parent, no issue links and an unstated "defined rule
  configuration". The spec lived in the Rewards Service epic (PLAT-55753), its
  stories and the consumer's epic (GRA-7322). Search by the consumer name plus the
  provider name, read the provider's PRD, and write rule values and disbursement
  mode as `UNKNOWN` rather than inventing them. A later fix to the provider can
  also rename a status (PLAT-58532: cancelled pending record `DONE` -> `CANCELLED`),
  so check dated follow-ups before asserting a status string.

## Cross-Flow Coverage

- **A new control on a shared form must be tested in every flow that loads that
  form.** Create, edit, view-only, duplicate, draft resume and import all render
  the same form with different state. PLAT-59098 added a "Configure reward
  manually" toggle to the Mission reward form; the Duplicate flow was never
  named in the epic and came up with the toggle disabled (PLAT-60919).
- **A copy flow copies whatever it is not told to exclude.** Duplicate copies
  every config except a fixed field list (PLAT-56233: Slug, Start Date, End
  Date), so every field added later is copied by default. Ask of each new field:
  is it copied, cleared, or reset — and does copying it break a rule?
- **A uniqueness or ownership rule needs a case per path that can create a
  second owner.** "One campaign, one mission/milestone reward" is enforced on
  admin create/update; duplicate, draft resume, import and the API twin each
  create a second owner by a different route and must be tried separately.
- **A closed feature is not a covered feature.** When a vault note describes an
  older flow on the same surface, its rules are test inputs for the new epic.
  "No future development" means no one will re-test it, not that it still works.
- **Records that predate the feature have no value for the new field.** Check
  what an existing record shows for a new toggle or mode (default ON or OFF,
  empty, migrated), separately from what a brand-new record shows. Sources can
  disagree here (Figma vs the Panel solution doc on the toggle default).
- **A cap raised to "the number of available items" is unreachable on live
  data.** The fallback source and the stale client are where it bites.
  PLAT-60351 lifted the 5 frequent flyer cap to "number of available
  airlines", about 1159 on live data, so nobody can test the new limit there.
  Three cases do the work instead:
  - a client that still stops at the old cap (add the 6th item);
  - a small fallback source that makes the cap reachable (5 airlines from
    properties when flight-master-discovery fails);
  - saved records whose item is missing from that fallback list.
  Removing a validation to widen accepted values ("remove airline code
  validation") can also remove the only BE guard for a uniqueness rule the
  stories now place on the FE. Test the API twin.
- **Context stored at account level makes every login a cross-device write.**
  When a switch (entity, traveller, profile) updates data shared by all of an
  account's sessions, and signs out the other devices, re-login on one of those
  devices resets the shared data to its login default. The device that made the
  switch can then quietly flip back. Walk the session lifecycle around a switch:
  reload, second tab, other device, re-login on the signed-out device, token
  refresh, logout→login. If the source does not say what the switching device
  should show after someone else logs in, record what you observe instead of
  asserting a value. PLAT-60913 TC12–TC16.
- **A refresh must re-read story comments and the contract pages, not just the
  PRD diff.** A month after PLAT-61138's cases were drafted, the PRD had moved
  two versions, but most scope changes were elsewhere. Two-line FE story
  comments ("no mWeb/dWeb entry point this phase") moved 18 cases to apps
  only, while the descriptions still said "FE: mobile only". A dev comment
  carried the webview URLs. A BE contract page, newer than every story, held
  the endpoints and business error codes the API cases had marked `UNKNOWN`.
  The design's comment threads changed the edit page's behaviour. On a
  refresh, list each child story's comments and the Confluence pages its
  subtasks and comments link to, and diff the PRD by version number.
  Keep TC ids stable: remove and append, never renumber.
- **A late desktop story can turn a mobile-only capability into a handoff, and
  that splits "Responsive" in two.** PLAT-61029 made the passport scanner's
  entry points show a QR code on desktop instead of opening the scanner, so
  every existing Responsive scan case became ambiguous. Pin the viewport in each
  existing case's preconditions instead of renumbering. Test the handoff as its
  own matrix: app installed vs browser fallback × logged in vs logged out, plus
  "every entry point shows the same link". Whether the link opens the app
  depends on URL registration rather than app code, so record it per
  environment as `UNKNOWN`.
- **A minimum-size rule on a group turns every way of losing a member into a
  way of deleting the group.** PLAT-61138 families need 2+ members, so a
  family can disappear in three ways: unticking in edit, deleting the profile,
  and system removal. The PRD covers the first two; the third is the existing
  "passengers unused for 18 months are removed automatically" rule, which no
  story mentions. List every path that removes a member, including system and
  retention jobs. Ask whether each one cascades. The same goes for a
  composition rule ("at least one adult"): editing a member's DOB can break it
  from outside the group form.
- **A "create anyway" bypass flag must be sent by every flow that asks the
  user.** PLAT-61024 kept the create API's silent merge and added an opt-in
  `allowDuplicateName: true` for when the user confirms a duplicate. Only the
  My Account story was told to send it. Family Group ([[PLAT-61138]]) has its
  own "No, it's different" dialog, and if it calls the same API without the
  flag, the "different" person is merged into the existing one. When a fix is
  "pre-check endpoint + opt-in bypass", list every UI that creates the record
  and ask whether its confirm path sends the bypass.
- **A silent merge must be checked against the fields the merging form never
  collects.** PLAT-61024's TC23/TC25 checked only the returned id and the profile
  count, and both passed on DWEB. Meanwhile the flight checkout posted a blank phone
  and the account's email, and the backend wrote both over the saved passenger. For
  any "auto-merge / upsert into the latest match" path, add an expected result that
  diffs the target's other fields before and after: what the caller does not send
  must survive.
- **Re-issuing points into a new bucket re-opens every flow that reads the old
  bucket.** Point extension revokes an order's IPC and re-injects the net as
  `points_extended`; the refund of that order still claws back the *original*
  award (50,000, not the 45,000 left after the fee), through a lock API that now
  serves every refund. For any revoke-and-reinject, expiry reset or migration of
  points, list the flows keyed on the original bucket (refund clawback, refund
  lock, partial redemption, a second extension) and give each a case, plus one
  regression case for the untouched path that shares the changed API. Ask what
  happens when the clawback exceeds the balance. PLAT-62376.
- **Read-only or disabled state derived from a record's status can leak onto
  its copy.** A live, ended or locked source record may hand its disabled
  controls to a duplicate that should be fully editable.

## Source Reconciliation

- **A PRD contradicts itself; reconcile before drafting.** The change log, the
  Q&A / open-questions table, and per-row notes in matrices outrank the
  requirement body — that is where decisions land after the body was written.
  A change-log line like "remove warning in account deletion" means some
  requirement above it is dead. Find it before you write cases from it.
- **PDF extraction silently drops strikethrough.** A removed requirement reads
  as a live one with no marker at all. On any PDF-sourced PRD, treat the change
  log and decision table as the authority on current scope and reconcile every
  requirement they contradict. When it stays ambiguous, ask or view the rendered
  document — never write cases covering both readings.
- **"User end" vs "internal admin end" is a scope boundary, not a synonym.** A
  decision that removes behaviour from one surface usually leaves the other
  intact, so check which surface each case targets before dropping it. The
  platform column is a useful tell: the customer path and the dashboard path
  rarely share one.
- **Jira stories can be newer than the PDF, and a newer API can exist than
  either.** Verify the child stories even when PDFs are supplied, and record the
  actual endpoint or environment exercised — the epic may reference an
  integration that has already been superseded.
- **In a `[BE]` + `[FE]` mirror pair, only one half gets the late edit.** Epics
  that split every behaviour into twin stories with near-identical ACs drift
  silently: the PM amends one description and the twin keeps the original text,
  so the two now specify different behaviour with nothing marking which is live.
  When a pair disagrees, compare the **description-edit timestamps in each
  story's changelog** — that changelog *is* the change log when the epic has no
  PRD change-log section — and treat the later edit as current scope. A PM
  comment on the same story usually states the decision in words. Never write
  cases covering both halves of the pair.
- **A worked example can contradict the rule it illustrates.** Multi-row example
  tables get hand-written per row, so row 1 can follow one reading of a
  definition and row 2 the opposite. When the example is the only thing
  disambiguating a term, it has not disambiguated anything — flag the term.
- **A mirror pair can agree with each other and still both be stale.** The
  drift heuristic above assumes the twins disagree, so a matching `[BE]` +
  `[Panel]` pair reads as confirmation. It is not: when the PM amends the
  decision somewhere *else*, both twins keep the original text and now agree on
  dead scope. Comparing the pair proves nothing — the check has to reach outside
  it, to the **subtasks, the API contracts, and the story comments**, each of
  which carries its own date. On PLAT-57176 two byte-identical descriptions and
  the PRD all specified `banner_image_en` / `banner_image_id` while a subtask,
  three API docs, a story comment and the design had already moved to
  mobile/desktop slots.
- **Subtasks are a change log, and their titles are the entry.** A subtask
  called "Adjust X with the **new** Y" is a dated supersession signal even when
  its description is "same as title" — the title alone says a decision changed
  and roughly when. Read the subtask list of every child story before drafting;
  it is the cheapest place to find the amendment that never made it into a
  description.
- **When the source is stale, write the case that disproves it.** Silently
  dropping the dead requirement leaves the next reader to rediscover the
  conflict. Assert the *current* rule in a form that fails if the old one shipped
  — "the same banner URL is served in EN and ID" fails loudly if
  language-specific slots were built — and record the supersession chain with
  dates in `## Key Learnings`.
- **A late-added child story can re-gate every story above it, and its title is
  the entry.** The subtask heuristic scales up: a *whole* child story added after
  the others is a dated supersession signal, and one named for a rule
  ("Country Issuance Logic", "Eligibility Logic") is announcing that it narrows
  the population its siblings describe. On PLAT-57210 four Profile List stories
  in the `839xxx`–`842xxx` id range said "at least 1 profile which passport is
  going to be expired"; `PLAT-57790` at id `844398` said "…which **Indonesian**
  passport" and added a matrix making foreign issuance a hard no. Sort the
  children by issue id before drafting — the newest one is where the current
  gate lives, and drafting from the older siblings yields a set that passes on
  behaviour that is now a bug.
- **Mirror drift happens across surfaces, not just across platforms.** The
  `[BE]`+`[FE]` twin-drift check assumes the pair describes one behaviour on two
  layers. The same drift splits *Profile List* from *Edit Profile*, or *list*
  from *detail*: one surface gets the late gate and the other keeps the original
  ungated wording, with nothing marking which is live. Compare the ACs of every
  surface the epic touches, not just the platform twins, and write the case that
  forces the question instead of covering both readings.
- **A FE epic scoped to "additional profile" can still share the account-owner
  form component.** Stories that say the new control is additional-only read as
  a hard no on Pemilik Akun. The design may still draw it on `Section 1 -
  Account Owner Info` with a Passenger state — one component, two actors. Write
  the case that forces which surface is live (PLAT-59157 TC06). Primary-account
  mononym via a different app (UNM FE) is a third surface and usually belongs
  on the sibling write-contract ticket, not this epic.
- **Force-fill / persistence may live on a sibling story with no Epic Link.**
  An FE-only epic whose background mentions today's `lastName = firstName`
  copy does not own the booking form, UNM primary edit, or admin search just
  because those are how force-fill used to fire. Search the mechanism name
  (`force-fill`, `mononym`) before concluding there is no write contract —
  then keep those callers on the sibling (PLAT-59126) and only assert the
  empty last name the tester can see on this form.
- **A TDD's match rule can quietly narrow the PRD's.** PLAT-61024's PRD says a
  duplicate-name check ignores first/last placement ("Jane Doe" + empty =
  "Jane" + "Doe"). The FE subtask normalises for that, but the BE design and
  endpoint subtask "keep exact first AND last name matches only". When the FE
  and BE each own half of a matching rule, compare the two definitions word
  for word. A flow with no FE layer (the booking form's auto-merge) inherits
  only the BE reading. Write the PRD-rule case so it fails loudly, and carry
  the conflict as `UNKNOWN`. Also check the endpoint path in the TDD against
  the newer subtask, because they drifted here too (`tix-profile-core/v2` vs
  `tix-member-core/v3`).
- **Design comment threads are the change log when the epic has no PRD.** An
  epic whose body is three bullet lists and a Figma link has its decisions in
  the file's comments, each one dated. Sort them into *settled* (a copy decision
  stated as an answer — treat as current scope, outranking the mock), *open* (a
  question with no accepted reply — these become `UNKNOWN`, not assertions), and
  *requested but not committed* (an addition nobody turned into a story — no
  cases). On PLAT-58520 this settled the EN/ID header pair, exposed the unresolved
  CTA destination, and showed the incentive figures were still moving — none of
  which was visible in Jira.
- **A two-step reversal gets collapsed into one state, and every mirror twin
  copies the collapsed version.** When a domain has both a *request* event and a
  *completion* event, a story bullet reading "Refunded order: keep it visible and
  show 'Refund requested…'" has merged them — the copy it quotes is the
  *requested* state while the label on the bullet is the *completed* one. On
  PLAT-58525 all four child stories carried that merge while the PRD and the API
  doc both split it: refund-**requested** stays listed with a warning and keeps
  its stamp label; an already-**`REFUNDED`** order is not returned at all and the
  survivors re-sequence onto the freed numbers. Drafting from the stories alone
  produces exactly the hedging pair this file warns about. Ask of every
  reversal: *is there a pending state and a settled state, and does the source
  name both?*
- **An API doc contradicts itself across its own tables and examples.** Treat a
  contract page as several sources, not one: the field table, the mapping table,
  the JSON examples, and the DB enum in the implementing subtask each drift
  separately. PLAT-58525's doc listed `REFUND_REQUESTED` in its item-fields table
  while its note-mapping table and all four response examples said
  `PROCESS_REFUND`, and the Kafka subtask wrote the former to the database —
  most likely a DB enum and an API enum that legitimately differ, with the field
  table quoting the wrong one. Count the places each spelling appears (the
  worked examples usually win) and pin the vocabulary as a contract case rather
  than picking one silently.
- **A later API contract page outranks the story AC for response shape.**
  Implementing subtasks often copy an earlier field list (`sessionUpdated`,
  `deactivatedSessionCount`) while a dated contract page — written by the same
  PIC, after the ticket — ships a narrower body (`data.success: true`,
  `SESSION_NOT_FOUND` on HTTP 200). Assert the later contract so a stale AC
  fails loudly, and record the dates. PLAT-57795: Task 2b AC vs the 2026-08-26
  Session Sync page; the same spec's field table vs its 2026-08-20 login
  to-be example (`loginRedirection` only, `accessRoleName` removed).
- **Header and parameter notes get copy-pasted between sibling endpoint docs.**
  A note describing fields the response schema does not contain is a leak from
  the neighbouring endpoint, which means that behaviour is **undefined, not
  documented**. PLAT-58525's `X-Account-Id` row promised a guest gets
  `summary: null` and "only the `available` tab" — neither exists on
  `/order-history`. Check every referenced field against the schema on the same
  page before treating a note as a requirement.
- **A `Dropped` story in a mirror pair is not automatically a descope.** When the
  `[BE]` twin is `Dropped` and the `[FE]` twin is still live, look for the
  endpoint that absorbed both halves before deleting the coverage. On PLAT-58525
  `[BE] GBV` was dropped because one `/order-history` API serves all three
  mission types with GBV as a field-suppression branch — the story was redundant,
  not cancelled, and GBV kept full coverage.
- **A design sticky note can contradict the requirement it annotates.** The note
  on PLAT-58525's Order ID chevron read *"Directed to Order Detail Page"* while
  the PRD and both FE stories specified the order **list** URL. A sticky is the
  designer's intent, not a decision — assert the written requirement and flag the
  conflict rather than reconciling it yourself.
- **A design carrying a status header tells you whether its copy is an oracle.**
  Frames labelled *Design status: In progress* with *Copywriting: Hold* mean the
  strings are drafts. Assert structure, locale behaviour and formatting rules;
  quote a string only as design copy, and never build a case whose sole
  assertion is unapproved wording.

- **An epic body can belong to a different epic.** PLAT-59738 "Passport
  Scanner" carried the Welcome Rewards background word for word. When the epic
  text does not match its title, draft from the child stories and the PRD they
  link to, and say so in `## Key Learnings`.
- **A scanned/auto-filled field list must be checked against the target form.**
  A list of fields that a scan, import or prefill "should fill" is written once and
  copied to every profile type, then struck through unevenly. On PLAT-59738, PRD v7,
  FE, Android and iOS disagreed on Date of Birth and Issue Date for the main
  profile. The Account Details design had no DOB field at all. Compare each list to
  the fields the target form actually has, and take the newest story where they
  differ. Also check any threshold rule ("8 fields = complete") against the
  smaller form, where the rule may never be reachable.

## Strict Validation Principles

- A case is valid ONLY if it traces to a specific, identifiable PRD
  requirement. "Reasonable" or "good practice" is not sufficient.
- Generic system-quality tests (performance, load, resilience, concurrency,
  data integrity, error handling) are invalid unless the PRD explicitly
  includes non-functional requirements.
- Vague phrasing like "handles gracefully", "works seamlessly", "no errors
  occur", or "performs well" makes a case ambiguous / untestable.
- If a PRD references a previous similar feature (e.g., "extend TikTok logic
  to affiliates"), add a regression case for the original feature.
- PRD background/goal sections describe business intent, not testable features.
  Don't generate cases for metrics, cost reduction, or analytics unless
  implementation stories explicitly cover them.
- Negative tests are valid only when the PRD defines a specific constraint
  (e.g., "only users with X privilege can do Y" implies a negative test for
  users without X). Generic negatives like "invalid data" or "null fields"
  are invalid unless the PRD specifies that input validation.

## Coverage & Priority Discipline

- **Write cases from the frontend point of view; no journey-first quota.** Draft
  per requirement as usual — a case may be a full flow or a single rule. When a BE
  check can be verified during an FE case's run (the API response the page
  triggers, the record it saves), merge it into that FE case as an extra
  expected-result item, not a separate `Backend` row.
  Merge only into the case whose action triggers it — "…then, separately, check
  that…" is still two cases.
- **`e2e - regression` marks durability, not impact.** `P0` already means "must
  test before any release" and `P1` "every regression cycle", so mirroring `P0`
  into the regression flag makes it redundant. Mark regression when the case
  exercises a mechanism other features can break (login round-trips, account
  binding, entitlement gates), guards money/entitlement/cross-user exposure,
  catches collateral damage from unrelated work (homepage section ordering is the
  classic, which is why a presentation case earns a slot even at `P1`), and can
  be re-run on a rebuildable fixture. Leave it plain `e2e` when it is a variant of
  one already in the set, consumes a scarce fixture each run (a fresh registerable
  identity), or waits on multi-day timers that cannot be seeded. Expect half to
  three-quarters of `e2e` cases to qualify — if nearly all do, the durability
  question was skipped.
- **Test through the frontend first (FE-first coverage).** When an epic spans FE (App, Responsive,
  mWeb, dWeb, Panel) and BE, a behaviour visible in any UI gets **one** FE case,
  not an FE case plus a matching API case. The Jira `[BE]`/`[FE]` story split is
  how the work was divided, not how the testing should be.
- **The assertion decides the platform, not where the code runs.** If the
  expected result is a number, message, state, or list a user can see, it's an FE
  case even though a server computed it. Use `"Responsive, Backend"` when a BE or
  Panel precondition (config, whitelist, flag, seeded data) is needed but the
  result shows in the UI.
- **Legitimately backend-only:** response schema/contract, status codes for
  API-only consumers, cron and scheduled jobs, queue/message consumption, retry
  and backoff, idempotency and duplicate suppression, concurrency and race
  windows, logging/metrics/alerting, DB state with no UI representation.
- **An AC naming an admin surface is not evidence this epic builds it.** ACs
  routinely open with "Operator configures X in the Dashboard" as *context* for a
  consumer-side behaviour, which reads exactly like Panel scope. Before assigning
  `Panel - dWeb`, confirm the epic actually has a `[Panel]` child story. If every
  child is `[BE]`/`[FE]`, the admin action is either an existing capability or a
  sibling epic's work — drive the precondition through the API the BE stories
  expose and platform it `"Responsive, Backend"`. Searching the project for the
  feature name plus the surface (`summary ~ "mission" AND cf[platform] = "Panel -
  dWeb"`) finds the epic that really owns it, which is also where those UI cases
  belong.
- **`P0` = written down AND criticality ≥ `high`.** Two tests, both required.
  Traceability (does the epic, a story, or the PRD state this explicitly?) decides
  membership — committed scope cannot ship unverified. Criticality does the
  ranking. Cases you extended, combined, or inferred start at `P1`/`P2`. Target
  **25–30%** `P0`, 30% as a ceiling.
- **When `P0` is too big, the criticality column is the suspect, not the rule.** A
  "criticality ≥ high" gate cannot produce a small tier from a set that is half
  `high`. Expect a pyramid — `medium` largest, `critical` and `high` each under
  ~20%. `high` means *a whole capability is unusable with no way around it*; if the
  user reaches the same outcome with one extra tap, it is `medium`. Two invariants:
  **no `critical` outside `P0`, no `medium` inside it.**
- **Prominence is not impact, and a variant is not the mechanism.** A branding or
  layout refresh can be the entire point of a release and still be `medium`.
  Once the mechanism is scored, its spec'd data points (three price→token amounts,
  the second locale, the third badge) sit below it.
- **A regression guardrail inherits the criticality of what breaks if it fails** —
  "core gameplay mechanics unchanged after the refresh" is scored on the mechanics,
  not on the refresh.
- **A scope gate is not a sorter.** "Is it written down?" is a yes/no that ~60% of
  specific cases pass, so on its own it flattens the tier — it cannot tell "the
  product grid renders" apart from "the third badge renders". Always pair it with
  a criticality threshold.
- **Promote without a written AC** only for money/token/point/data loss or
  misallocation, a shared mechanism other features depend on regressing, a primary
  end-to-end journey that chains committed requirements, or an ineligible actor
  performing a restricted action.
- **Demote despite a written AC** to `medium` for repeat variants of a covered
  pattern (second badge, second locale, one more asset), position/spacing/timing/
  ordering detail, configurability where the default already works, secondary
  notifications and trackers and sounds, and robustness internals unless the
  failure is silent data loss.
- **Price a guard below its consequence.** When a rule has both a guard (button
  disabled, field greyed) and a consequence (no charge, no deduction, no write),
  the consequence is `critical` and the guard `high` — a guard failing is cosmetic
  if the consequence still holds.
- **Count `P0` per story, not just in aggregate.** A criticality threshold
  inherits every criticality misjudgement, so it can silently leave a whole story
  with zero `P0` — that story then ships unverified in any smoke run.
- **Fix the criticality, don't carve out a priority exception.** When a case
  obviously belongs in `P0` but the threshold excludes it, the score is the error.
  Re-scoring keeps the rule honest and the column reusable — TestRail and run
  planning read criticality independently of priority.
- **A new source feeding an existing combinatorial surface multiplies cases.**
  Adding one new input (a new token source, a new payment method, a new channel)
  re-opens every enumerated combination downstream of it, not just the happy
  path.
- **Redesigning a screen re-opens every rule that screen enforced** — disabled
  states, ownership/permission checks, masking, and toggles the redesign story
  never mentions.
- **An improvement epic read in isolation encodes stale values.** Figures changed
  late in the predecessor release (rates, windows, thresholds) are rarely
  restated in follow-up stories. Capture the baseline release before writing
  regression assertions that quote a number.
- **An epic with no `[BE]` child story has no fixture path, and `UNKNOWN`
  dominating the preconditions is the finding — not a drafting error.** When every child is
  `[FE]`, nothing in the epic says how to seed the data the UI renders, where the
  displayed timestamp comes from, or how to move an account into the segment
  under test. PLAT-58520 produced 13 cases whose setup the epic never said how
  to reach: correct output, and the most useful thing the run said. Record it in
  `## Key Learnings` and resist inventing setup to make the preconditions look
  complete.
- **The seedable fixture is often the feature under test.** Before writing
  `UNKNOWN` for a data precondition, check whether another story in the same epic
  is the setup path. On PLAT-57210 the Edit Profile flow under test is also how a
  tester sets a passport expiry date and issuing country, which gave 10 of 12
  cases concrete preconditions. The vault may supply the other half —
  owned paths and a real account role — so check `knowledge/entries/` before
  declaring a gap.
- **A read-only presentation surface legitimately has no `critical` case.** When
  nothing on the screen moves money, tokens, points or saved data, an all-`high`
  ceiling is the honest shape, and forcing a `critical` to fill the tier corrupts
  the column. Look instead for where the money risk actually sits — usually a
  gate or an assignment rule feeding the display — and score that.
- **A URL query param that fires a side-effect on page load is a load-time
  trigger with an exact value.** Cover four things, not just the happy URL:
  (1) the documented value fires (`auto_enroll=true`); (2) missing or any other
  value does not; (3) refresh after the state has changed does not fire again
  (no duplicate enroll / no second success sheet); (4) a guest does not fire,
  and after login it only fires if the page actually reloads with the param
  still present — do not assume the login return keeps the query string.
  The param must not bypass the existing eligibility gates (segment, ended,
  quota, already ACTIVE/COMPLETED/CLAIMED). PLAT-57973.
- **A "keep existing URL params" requirement is a merge rule, not a pass-through.**
  The happy URL is one case; the bugs live in the merge. Cover a same-key
  collision (which value wins), encoded values (no double-encoding, no `&` or `+`
  splitting a value), no params at all (no empty keys or dangling `?`), a
  destination that already has its own query string (one `?`), reload (an
  appended param must not repeat), and per-visitor isolation when the response
  that builds the URL is cached. Read every client story for an exclusion list:
  on PLAT-61694 only the app stories said `token` must not be carried, because
  the gateway reads it for auth.
