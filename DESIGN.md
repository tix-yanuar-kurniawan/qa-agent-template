---
name: TC Queue
description: A daylight work ledger for QA requests — white panels on a cool grey ground, one tiket-blue rail, colour that only ever means something.
colors:
  bg: "#f3f5f9"
  surface: "#ffffff"
  surface-2: "#eef2f8"
  row-hover: "#f5f8fd"
  head-bg: "#f7f9fc"
  border: "#e3e8ef"
  border-strong: "#cfd7e3"
  text: "#182132"
  text-muted: "#566275"
  text-faint: "#8a95a6"
  accent: "#0064d2"
  accent-hover: "#0052ad"
  on-accent: "#ffffff"
  accent-bg: "rgba(0, 100, 210, 0.08)"
  rail-bg: "#0058b9"
  rail-fg: "#ffffff"
  rail-muted: "rgba(255, 255, 255, 0.9)"
  rail-hover: "rgba(255, 255, 255, 0.12)"
  rail-active: "rgba(255, 255, 255, 0.16)"
  cta-bg: "#ffd400"
  cta-hover: "#ffe14d"
  cta-fg: "#182132"
  blue: "#0064d2"
  blue-bg: "#e3efff"
  green: "#16702f"
  green-bg: "#dcf5e3"
  amber: "#8a5d00"
  amber-bg: "#fff3c4"
  orange: "#a04100"
  orange-bg: "#ffe6d3"
  red: "#c9252d"
  red-bg: "#ffe2e2"
  purple: "#7a3fd6"
  purple-bg: "#efe6ff"
  neutral: "#566275"
  neutral-bg: "#eaeef3"
typography:
  label-micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  label-chip:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.03em"
  small:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  field-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.5
  lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  stat:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Noto Sans\", Helvetica, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.3
    fontFeature: "\"tnum\""
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "999px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "20px"
  sp-6: "24px"
  sp-8: "32px"
  sp-10: "40px"
  sp-12: "48px"
  sp-16: "64px"
components:
  rail:
    backgroundColor: "{colors.rail-bg}"
    textColor: "{colors.rail-fg}"
    width: "232px"
    padding: "16px 12px"
  rail-item:
    textColor: "{colors.rail-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 8px"
  rail-item-hover:
    backgroundColor: "{colors.rail-hover}"
    textColor: "{colors.rail-fg}"
  rail-item-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.rail-fg}"
  rail-new:
    backgroundColor: "{colors.cta-bg}"
    textColor: "{colors.cta-fg}"
    rounded: "{rounded.md}"
    height: "36px"
  rail-new-hover:
    backgroundColor: "{colors.cta-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    height: "32px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
  button-sm:
    typography: "{typography.small}"
    height: "28px"
    padding: "0 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "7px 10px"
  chip:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-chip}"
    rounded: "{rounded.sm}"
    height: "20px"
    padding: "0 7px"
  chip-create:
    backgroundColor: "{colors.blue-bg}"
    textColor: "{colors.blue}"
  chip-analyze:
    backgroundColor: "{colors.purple-bg}"
    textColor: "{colors.purple}"
  chip-knowledge:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
  status-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px 0 12px"
  filter-facet:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.small}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  ledger-head:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label-micro}"
    height: "36px"
    padding: "0 12px"
  ledger-row:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "40px"
    padding: "0 12px"
  ledger-row-hover:
    backgroundColor: "{colors.row-hover}"
  ledger-row-open:
    backgroundColor: "{colors.surface-2}"
  mode-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 48px 12px 40px"
  mode-tile-selected:
    backgroundColor: "{colors.accent-bg}"
  tab:
    textColor: "{colors.text-muted}"
    padding: "8px 12px"
  tab-active:
    textColor: "{colors.text}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    width: "min(640px, calc(100vw - 32px))"
  drawer:
    backgroundColor: "{colors.surface}"
    width: "min(540px, 100vw)"
  toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
---

# Design System: TC Queue

## Overview

**Creative North Star: "The Daylight Ledger"**

TC Queue is a working ledger read in daylight. A cool grey ground (`bg`) carries white panels, and every list — queue, test cases — is one ruled table inside one of those panels. A single tiket-blue rail down the left edge is the only saturated mass on screen; its yellow **New request** button is the only call to action that shouts. Everything else is quiet grey type on white, so the colour that does appear is read as information: a request's type, its status, a case's priority.

The density is that of a tool used all day: 14px body, 40px rows, 32px controls, tabular figures wherever numbers stack. Depth is tonal, not shadowed — white on grey, grey-blue on white — and shadows exist only on things that float over the page (popovers, dialogs, the drawer, toasts). Motion is nearly absent: a slow pulse says "Claude is working", a progress bar moves while TestRail syncs, and nothing else animates for decoration.

The world rejects the AI-generated look named in PRODUCT.md: no cream or warm-neutral grounds, no identical card grids, no gradients, glow, blur or emoji, no hero metrics.

**Key Characteristics:**
- Cool grey ground (`bg`), white panels with a 1px border, tonal depth.
- One brand moment: the tiket-blue rail with the yellow New request button.
- One accent (`accent`) for actions, links, focus, selection and active state.
- Seven semantic hues, each with a tint, mapped once to types, statuses and priorities.
- System font stack, a compact 11–20px ramp, tabular numerals in every table.
- 40px ledger rows that never reflow; a status change swaps in place.
- One focus ring everywhere: 2px accent outline, 2px offset.

## Colors

A cool, near-neutral daylight palette with one blue that is both brand and accent, one yellow kept for the single call to action, and a semantic set whose every hue carries a meaning.

### Primary
- **tiket Blue** (`accent`, also `blue`; the rail uses `rail-bg` `#0058b9`, one shade deeper so its muted labels clear AA): primary buttons, links, the focus ring, text selection, the active tab underline, the selected mode tile's border, the ledger's row marker and the TestRail progress fill. On the rail it is the brand field. White ink (`on-accent`) sits on it.
- **Pressed Blue** (`accent-hover`): hover and active state of primary buttons and links only.
- **Blue Wash** (`accent-bg`): selection fill — the selected mode tile, the selected case row, the row the composer just handed back, a drop area under a dragged file, a pressed run filter.

### Secondary
- **Call Yellow** (`cta-bg`, hover `cta-hover`, ink `cta-fg`): the rail's **New request** button, the rail mark's glyph, the live dot when Claude is working, and the focus ring inside the rail (blue on blue would vanish). Nowhere outside the rail.

### Tertiary (semantic set)
Each hue is a dark foreground paired with its own pale tint (`*-bg`); chips, pills, alerts and filter states draw both from a `--tone` / `--tone-bg` pair.
- **Blue** (`blue` / `blue-bg`): request type *Create*, status *Processing*, priority P2 / criticality *medium*, info.
- **Purple** (`purple` / `purple-bg`): request type *Analyze* only.
- **Green** (`green` / `green-bg`): request type *Knowledge*, status *Done*, success, the "Copied" flash.
- **Amber** (`amber` / `amber-bg`): status *Pending*, warnings.
- **Orange** (`orange` / `orange-bg`): P1 / *high*.
- **Red** (`red` / `red-bg`): status *Error*, P0 / *critical*, invalid fields, destructive hover.
- **Slate** (`neutral` / `neutral-bg`): P3 / *low*, any value outside the known vocabularies.

### Neutral
- **Daylight Grey** (`bg`): the page ground, and the sticky composer foot.
- **Paper White** (`surface`): panels, inputs, buttons, dialogs, drawer, popovers, toasts.
- **Mist** (`surface-2`): hover fill for buttons and menu items, an open ledger row and its detail, the pressed segment, skeletons, disabled inputs.
- **Row Haze** (`row-hover`): hover fill of ledger, case and run-list rows.
- **Head Haze** (`head-bg`): month-divider rows in the ledger.
- **Hairline** (`border`): row rules, panel borders, section dividers. **Edge** (`border-strong`): control borders, popovers, dialogs.
- **Ink** (`text`), **Slate Ink** (`text-muted`) for meta, column heads and secondary copy, **Faint** (`text-faint`) for placeholders and disabled text only (3.0:1 on white; never prose).
- **Rail text** (`rail-fg`, `rail-muted`) with `rail-hover` / `rail-active` white veils for rail states.

### Named Rules
**The Colour-Means-Something Rule.** Every saturated pixel outside the rail maps to a type, status, priority or the accent. If a colour cannot be named by what it means, it does not ship.

**The One Map Rule.** Types, statuses and priorities each have exactly one tone, defined once in the shared stylesheet and reused by ledger, composer and case editor. A surface never restates or reinvents a tone.

**The Yellow Is For Starting Rule.** Call Yellow marks the one way to start new work and the signal that work is running. It is never a highlight, a warning or a decoration.

**The Never-Colour-Alone Rule.** Status is a dot plus a word; types are chips with text; the phone-width ledger keeps the word in the DOM for screen readers and as a title.

## Typography

**Display Font:** none — the system UI stack carries every role.
**Body Font:** -apple-system / Segoe UI / Noto Sans (with Helvetica, Arial, sans-serif)
**Label/Mono Font:** ui-monospace / SF Mono (with Menlo, Consolas, monospace)

**Character:** Native, neutral and dense; the font disappears so the data reads. Mono is reserved for things you might type or paste: request IDs, file paths, keys, sheet cells.

### Hierarchy
- **Title** (`title`, 600, 20px, -0.01em): the page title in every page head.
- **Lead** (`lead`, 600, 16px): dialog and drawer titles, empty-state titles, the run overview's lead line.
- **Field label** (`field-label`, 600, 15px): composer field heads and the rail wordmark.
- **Body** (`body`, 400, 14px, 1.5): rows, controls, menus, prose. Detail text holds to 74ch.
- **Small** (`small`, 400, 12px): meta lines, dates, tallies, breadcrumbs, filter facets, status words.
- **Label micro** (`label-micro`, 600, 11px, 0.06em, uppercase): ledger column heads, month dividers, rail band heads, composer section heads.
- **Label chip** (`label-chip`, 600, 11px, 0.03em, uppercase): chip text.
- **Mono** (`mono`, 12px; 13px in the case sheet): request IDs, paths, code.

### Named Rules
**The Tabular Rule.** Tables, `<time>`, counts, tallies and progress values use tabular numerals, so columns of figures align.

**The No Display Face Rule.** There is no display font and no type size above 28px. A heading earns emphasis from weight (600) and position, not size.

## Layout

The frame is a fixed left rail (232px) and a main column. Every surface opens with the same page head — breadcrumb, title, one meta line, actions right — then an optional toolbar (filters left, tally and view controls right), then content. Content is capped at 1440px with 32px gutters. The composer holds a narrower 720px measure; the case list caps at 1376px.

Spacing follows a 4px base (`sp-1` 4 → `sp-16` 64). Controls are 32px (28px small), inputs 36px, rail items 34px, ledger heads 36px, ledger rows 40px with 12px cell padding. Empty states sit in 64px of vertical air with a 46ch measure.

**Rail, three states.** Full rail (232px, labels, counts and the live card) above 1119px. At **≤1119px** it becomes a 60px icon strip: labels, band heads, counts and the live card hide, and each item shows its label as a tooltip on hover or focus; page gutters tighten to 20px. At **≤719px** it becomes a 52px top bar with the items in a row and New request pushed to the right with its label; main content gets a matching top offset, and sticky table heads stick below it.

**Ledger columns.** Fixed table layout with set widths (status 116, type 148, ID 96, date 100, artifacts 200). At **≤860px** date and ID collapse to zero width (not `display:none`, which would steal width from the label) and the label's meta line drops below the name. At **≤560px** status becomes its dot, type becomes a two-letter code (CR / AN / KN / MT) with no icon, verdict becomes an 8px dot in its tone, and artifact actions take short labels; the words stay in the DOM for assistive tech.

**Other breakpoints.** At ≤860px page heads stack and search goes full width. At ≤719px the composer's mode grid and field pairs become single-column and the keyboard hint hides; the case editor scrolls as a page with the sheet capped at 70vh.

## Elevation & Depth

Flat by default. Depth comes from tone: white `surface` panels on the grey `bg`, `surface-2` for open or hovered states, a 1px `border` around every panel. Only elements that float above the page carry a shadow, and they all share one.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 28px -8px rgba(16, 24, 40, 0.22)`): popovers and menus, dialogs, the drawer, toasts, the inline cell editor and the icon-strip rail tooltip.
- **Row marker** (`box-shadow: inset 3px 0 0 #0064d2`): not elevation but a state mark — the first cell of a hovered or open ledger row and its detail row.

### Named Rules
**The Only-Floats-Cast Rule.** A shadow means "this is above the page and will go away". Panels, cards, tiles and buttons at rest are never shadowed.

## Shapes

Small, consistent radii: 4px (`sm`) for chips, menu items, segments and the progress track; 6px (`md`) for buttons, inputs, facets, mode tiles, file rows and alerts; 8px (`lg`) for panels, popovers, dialogs, toasts and the rail's live card. Only two things are fully round: the status pills on the Queue (`pill`) and status dots. Borders are 1px; facet buttons and drop areas use a dashed 1px border until they hold a value. The ledger keeps its rounded panel corners by rounding the corner cells themselves, so a row's menu can hang past the panel edge.

## Components

### Buttons
Compact and plain; weight and fill, not size, separate the primary.
- **Shape:** gently rounded (6px), 32px tall, 12px side padding; small variant 28px.
- **Primary:** `accent` fill, white ink, weight 600. Hover and active darken to `accent-hover`.
- **Secondary (default):** white fill, `border-strong` outline, `text` ink, weight 500; hover `surface-2`, active `border`.
- **Quiet:** no fill or border, `text-muted`; hover fills `surface-2`.
- **Danger:** a secondary that turns red outline and red tint on hover only.
- **Icon button:** 28px square, no border, muted icon; hover `surface-2`.
- **Link button:** muted underlined 12px text for inline recoveries ("Clear filters").
- **Disabled:** 50% opacity, not-allowed cursor. Loading: 70% opacity, pointer events off, label switches to "Saving…" / "Adding…".

### Rail
The brand field: `rail-bg` blue, white mark with a yellow glyph, the yellow 36px **New request** button, then a band of two views (Queue, Test cases) with counts. Items are 34px with a 16px stroke icon; hover lays a 12% white veil, the current page a 20% veil and weight 600. Focus rings inside the rail are yellow. At the bottom, the **live card** (8px radius, white veil) says *Claude is working*, *Waiting for /run-it* or *Idle*, with processing and pending counts; its dot turns yellow and pulses only while something is processing.

### Chips
- **Style:** 20px tall, 4px radius, 11px uppercase 600 text, tone ink on tone tint, no border.
- **Type chips** carry a 12px stroke icon: Create (document-plus, blue), Analyze (magnifier-check, purple), Knowledge (open book, green). The same icon and tone appear on the composer's mode tile.

### Status
- **Status badge:** a 7px dot plus the word, 12px muted; Processing in `text` 500, Error in red. Pending amber, Processing blue (pulsing), Done green, Error red.
- **Status pills (Queue):** 32px fully round pills that count and filter at once — dot, bold count in the tone, word. Hover shows the tone border; pressed fills the tone tint.

### Filter bar and popovers
Facets are dashed 32px buttons ("Type", "Platform"…) that open a popover menu; a facet with a value turns solid and shows the value in accent 600. Popovers are white, 8px radius, `border-strong`, Float shadow, 4px inner padding, options with right-aligned counts. They close on outside click and Escape. The case editor's priority toggles (P0–P3 with counts) are 28px buttons that fill with their priority's tone tint when pressed.

### Inputs / Fields
- **Style:** white, 1px `border-strong`, 6px radius, 36px min height, 7px 10px padding; selects draw their own caret.
- **Focus:** the border turns accent with a 1px accent halo (no outline). Search inputs are 32px with a leading icon.
- **Error / Disabled:** red border and a 12px red message below; disabled fills `surface-2` with muted text.
- **Drop areas:** dashed border, centred icon and copy, accent "browse" word; on hover or drag the border goes accent over the blue wash; the focus ring is drawn on the area.

### Panels and the Ledger
The signature component. One ruled table shared by Queue and Test cases, inside a white panel. Sticky 36px heads in micro uppercase; sortable heads show a drawn caret, not a glyph. Rows are a fixed 40px and never reflow; hover fills `row-hover` and adds the accent row marker; an open row turns `surface-2` and its detail hangs off the label's column. Under the date sort, month divider rows group the list. Request IDs are mono and **click to copy**: the button flashes green "Copied" for 1.2s, the copy is announced to screen readers, and a failure becomes a toast. A row's secondary actions sit behind a three-dot icon button.

### Composer (New request)
Four mode tiles in a 2×2 grid, each a radio with a name, a one-line note and a 32px icon square in the type's tone. The selected tile takes an accent border over the blue wash; keyboard focus rings the whole tile. Sections (Target, Access, Run) are divided by a hairline and a micro uppercase head. The submit row is sticky at the bottom of the viewport on the grey ground with a keyboard hint.

### Test cases editor
A list view of case rows — a plain centred case number set in title colour and weight 500, the title, a meta line, a priority chip and a menu — and a sheet view in mono with accent-ringed cell selection. Selecting a case opens a right-hand `<dialog>` drawer (540px, Float shadow, dimmed backdrop). **Sync to TestRail** is a modal dialog (640px) that previews, then shows a stage title, a 6px linear progress bar (accent, green when done, red on error; a sliding segment before the first case lands) and a step list whose dots spin while active and fill green when done.

### Feedback
Toasts rise from the bottom centre (white, 8px radius, Float shadow, optional action, close button, 5s timeout). Every toast and copy is mirrored to a polite screen-reader announcer. Alerts are tone-tinted boxes with a 45% tone border; an alert without a tone is an error. Skeletons are `surface-2` bars that pulse.

### Motion
State transitions are 0.1–0.15s ease-out colour changes. Animation is limited to status: the processing dot and live dot pulse (1.4–1.6s), skeletons pulse while loading, toasts rise 6px over 0.18s, and the TestRail sync dialog runs its progress fill, sliding segment and step spinner. `prefers-reduced-motion: reduce` collapses every animation and transition to near zero.

### Focus
One treatment everywhere: `outline: 2px solid` accent, `outline-offset: 2px`. Rows and table heads inset it (offset -2px) so it stays inside the panel; inside the rail it turns yellow.

## Do's and Don'ts

### Do:
- **Do** put every list, table and sheet inside one white panel (1px `border`, 8px radius) on the grey ground.
- **Do** take tones from the one shared map: Create blue, Analyze purple, Knowledge green.
- **Do** pair every colour signal with a word or an icon; keep the word in the DOM when a narrow layout reduces it to a dot.
- **Do** keep ledger rows at 40px and let state changes swap content in place.
- **Do** use the single focus ring (2px accent outline, 2px offset; yellow inside the rail).
- **Do** use tabular numerals for every count, date and table.
- **Do** keep the rail's three states: full above 1119px, icon strip at ≤1119px, top bar at ≤719px.
- **Do** honour `prefers-reduced-motion`.
- **Do** hold text to WCAG AA (4.5:1). Checked pairs: rail-muted on rail-bg 5.8:1, live-card text 4.5:1, white on the active veil 4.8:1, every chip foreground on its own tint ≥4.5:1 (green 5.4, orange 5.4, red 4.6, blue 4.8, purple 5.0, amber 5.2). `text-faint` is the one deliberate exception — placeholders and disabled text only.

### Don't:
- **Don't** use gradients, glow, blur, text shadows or emoji.
- **Don't** use a warm, cream or dark ground; the ground is cool grey `bg`.
- **Don't** use Call Yellow anywhere outside the rail.
- **Don't** introduce a second accent or a decorative hue; a colour must name a type, status or priority.
- **Don't** shadow panels, tiles, cards or buttons at rest; only floating layers cast the Float shadow.
- **Don't** add hero metrics, KPI cards or identical card grids.
- **Don't** add a display typeface or type above 28px.
- **Don't** animate for decoration; motion only reports that something is running or loading.
- **Don't** draw icons with text glyphs; icons are inline 16px stroke SVGs.
