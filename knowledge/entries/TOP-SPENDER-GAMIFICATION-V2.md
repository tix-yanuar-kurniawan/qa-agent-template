---
kind: confluence
key: "TOP-SPENDER-GAMIFICATION-V2"
title: "[PRD] Top Spender Program \"Travel Agent\" Gamification 2.0"
source: "Confluence"
action: knowledge
date: 2026-06-24
figma: true
figma_note: "Top Spender Gamification 2.0 — https://www.figma.com/design/2sTZIQ34cYjTXDWRSCQd1Q/Top-Spender-Gamification-2.0?node-id=2-652 · Mission Page (SSoT) — https://www.figma.com/design/2BMu8KJz2qBgdfSx1NU4fO/-SSoT--tiket-Mission-Page?node-id=2424-393"
tags: [top-spender, gamification, travel-agent, leaderboard, top-spender-coins, earn-rate, multiplier, missions, challenges, retroactive, refund, special-partner, welcome-bonus, campaign, tiket-points, gift-voucher, admin-panel, gbv]
keywords: ["top spender", "gamification", "travel agent", "leaderboard", "Top Spender Coins", "earn rate", "multiplier", "missions", "challenges", "retroactive", "refund", "special partner", "welcome bonus", "campaign", "Tiket Points", "gift voucher", "admin panel", "GBV"]
related: ["[[PLAT-52179]]", "[[PLAT-52848]]", "[[PLAT-54035]]", "[[TOP-SPENDER-TRACKER]]"]
url: "https://borobudur.atlassian.net/wiki/spaces/AE/pages/4355555360/PRD+Top+Spender+Program+Travel+Agent+Gamification+2.0"
---

# TOP-SPENDER-GAMIFICATION-V2 — [PRD] Top Spender Program "Travel Agent" Gamification 2.0
> **Source:** Confluence PRD · **Status:** IN REVIEW · **Target:** Q1 2026
> **Work tracker:** [[PLAT-52179]] · **Related:** [[PLAT-52848]] · [[PLAT-54035]] · [[TOP-SPENDER-TRACKER]]
> **Confluence:** https://borobudur.atlassian.net/wiki/spaces/AE/pages/4355555360

## Summary

Top Spender Gamification 2.0 revamps tiket.com's Top Spender Program into a sticky, high-engagement platform that drives daily active usage and spending consolidation among informal travel agents. It introduces real-time leaderboards, tier visibility, personalized missions/challenges, a configurable coin economy (earn rate × multiplier per vertical), a retroactive "Join" flow, refund-aware coin revocation, multi-channel comms, and an admin CMS so the growth team can run campaigns without engineering. The goal is to make tiket.com the agents' primary OTA by capturing share-of-wallet currently split with other platforms.

## Key Points

- **Coin formula:** `Top Spender Coins = GBV × EarnRate% × Multiplier%`. Earn rate & multiplier are configurable per vertical and may change mid-campaign; the rate applied is the one in effect on the **journey end / checkout date**, so historical rates must be stored for correct retroactive calculation.
- **Coin timing & rounding:** coins are ingested at **12:00 PM on the checkout date** (12:01 PM the user sees them); rounded to nearest integer using BigQuery ROUND (half away from zero).
- **Eligibility:** both **order issuance date AND journey/travel date** must fall inside the campaign period. Orders issued before campaign start (even with in-period travel) are excluded; non-IDR transactions are excluded.
- **In-scope verticals:** Flight, Hotel (Native), Hotel (3rd Party), To Do/TTD, Train & Railink, Car Rental, Bus & Shuttle, Airport Transfer. **Excluded:** Events, Insurance, Gift Cards, Ferry.
- **User scope:** all B2C registered users. **Out:** B2B Corporate, B2B Affiliate API, B2B Affiliate Non-API (Shopback), Pay At Hotel (with/without CC).
- **Retroactive Join:** users must manually Join (accept T&C) to unlock dashboard/Mission Hub/Leaderboard; joining grants a one-time configurable **Welcome Bonus (10,000 coins)** and retroactively calculates coins for eligible bookings since campaign start. A daily 10:00 AM push invites non-enrolled users with eligible purchases in the last 24h (once per user).
- **Refund/cancellation:** REFUNDED/CANCELLED orders immediately **revoke** coins and recalc the leaderboard; manual CS refunds can't be auto-tracked.
- **Leaderboard:** real-time; rank-state arrow (🔼/🔻/➖) compares current rank vs the **last-day 00:00 snapshot**; shows 5 above + 5 below; names masked (e.g. Novita Olivera → Novita O.).
- **Special Partner rates:** registerable Partner IDs (e.g. Emirates, OVO) with own start/end dates and Percentage or Fixed-Amount rewards, identified via paymentMethod / airlineNames / inventoryId; always **added on top of** the normal calculation and labeled separately in activity history.
- **Challenges/Missions:** multiple can run simultaneously, each with its own dates, auto-active; reward types Fixed Amount or EarnRate+Multiplier; retroactive challenge coins only if the user joined within the challenge window.
- **Rewards & close-out:** automated freeze at 11:59:59 PM on **Jul 28, 2026**; audit pending/refunded; Game Master "verify winners" toggle; Gift Voucher codes injected to "My Voucher"; Tiket Points injected via a "Gamification" reward type; non-Top-200 get consolation GV + a raffle.
- **Admin CMS:** campaign config, per-vertical rate management, special-partner setup, mission management (All Users or CSV upload), and user management (status, manual fraud ban).

## Figma Design Summary

> The summary below is derived from the design references embedded per-requirement in the PRD; open the linked files for pixel detail.

- **Files:** "Top Spender Gamification 2.0" (`node-id=2-652`) and the SSoT "tiket Mission Page" (`node-id=2424-393`, the configurable mission page).
- **Game Master / admin (dashboard):** campaign date-time picker and status (Active/Inactive), per-vertical earn-rate & multiplier inputs, Special Partner rate config, mission management, and user management screens (4.1–4.3, 4.11).
- **Participant app:** Join / Register CTA with T&C consent + How-to-Play, personalized dashboard with total coins, leaderboard (rank arrows, "5 above / 5 below", catch-up nudge copy), Recent Activity list with per-source coin labels (e.g. "Emirates Bonus"), mission cards with progress bars, purchase-history summary, and social-share of rank (4.5–4.7).
- **Reward / close-out:** winner announcement, prize list, claim form, and consolation/raffle states (4.9).

## Details

**Objective.** Make tiket.com the primary booking platform for informal agents by turning the Top Spender Program into a daily-engagement gamification platform (real-time leaderboards, tier visibility, personalized missions) that consolidates spend currently split across OTAs.

**Success metrics.** Primary goal is GBV increment per joined user. Targets (whole period): GBV IDR 389 bio (▲ +16.0%), Net Revenue IDR 12.8 bio (▲ +22.8%); excluding OTW the growth is higher (GBV +32.3%, Net Revenue +53.0%). Prior campaign achieved GBV IDR 405 bio (+27.7% YoY) and ~IDR 10.2 bio net revenue (~6× program cost), with Flight ~81% of GBV and Accommodation/TTD lifted by the 10× multiplier.

**In / out of scope.** Eligible verticals: Flight, Hotel (Native & 3rd Party), TTD, Train & Railink, Car Rental, Bus & Shuttle, Airport Transfer. Excluded verticals: Events, Insurance, Gift Cards, Ferry. In scope: all B2C registered users. Out of scope: B2B Corporate, B2B Affiliate API, B2B Affiliate Non-API (Shopback), Pay At Hotel (with/without CC). Non-IDR transactions are excluded from coin earning.

**Core requirements.**

- **4.1 Campaign setup.** Date-time picker for official start/end. `Active` activates the coin engine, interactive real-time leaderboard, and Mission Hub; `Inactive` hides the campaign with no tracking. PM can edit all parameters. Configurable one-time "Top Spender Coins welcome onboard rate" (adjustable in admin; not dynamic per user).
- **4.2 Coin calculation.** `Coins = GBV × EarnRate% × Multiplier%`; rate/multiplier configurable per vertical, changeable mid-campaign with historical storage; applied rate keyed to journey end/checkout date. Coins ingested 12:00 PM checkout date. BigQuery ROUND (integer). Eligibility requires both issuance and journey dates within the period.
- **4.3 Special Partner calculation.** Register Partner IDs (e.g. Emirates flights, OVO payments) in the Game Master dashboard with independent Start/End dates; reward type `Percentage` (decimals) or `Fixed Amount` (integers). Identify via paymentMethod, airlineNames, inventoryId/public hotel ID. Tag every transaction with `Partner_ID`; normal calculation always applies and special partner/payment amounts are added on top and shown distinctly (e.g. "Emirates Bonus" label) in the user's activity and total-coin breakdown.
- **4.4 Refund & cancellation.** On status → `REFUNDED`/`CANCELLED`, immediately revoke coins and recalc rank/tier. Full exclusion list: Events, Standalone Insurance, Gift Cards, Ferry; Pay At Hotel (+CC); B2B Corporate, B2B Affiliate API/Non-API, Shopback; non-IDR. Manual CS refunds bypassing the standard flow can't be auto-tracked. (System calc — no design.)
- **4.5 Onboarding & retroactive loop.** Prominent "Join Program / Register Now" CTA for non-enrolled users; must view + scroll + accept T&C to consent and join, moving status to `Enrolled` and unlocking dashboard/Mission Hub/Leaderboard. Only after joining are the 10,000-coin welcome bonus and How-to-Play triggered. Retroactive push every day at 10:00 AM to non-enrolled users with eligible purchases in the last 24h, sent once per user, enrolled users removed. T&C doc and prize info referenced.
- **4.6 Gameplay & personalized dashboard.** On Join, backend scans transaction history for eligible bookings where `Transaction_Date >= Campaign_Start_Date`, one-time calculates coins, and updates total/rank immediately; `Campaign_Start_Date` cannot be back-dated. Campaign period referenced as 20 April – 28 July. Leaderboard shows name, total coins, last purchase, and a rank-state indicator (🔼/🔻/➖) vs the last-day 00:00 snapshot, dynamic catch-up copy (e.g. "You are IDR 20,000,000 away from overtaking Novita O."), and only 5 above + 5 below the user. Full name fetched on first eligible order event and stored (not updated after); email masked. Purchase history: summary (orders, GBV, coins) + detailed recent activity (date, coin type/vertical/special source, GBV, coins). Social share of rank supported.
- **4.7 Top Spender League / Challenge.** A program can run multiple simultaneous challenges, each with its own Start/End, auto-active within range (no explicit start click). UI shows combined coins from challenges & special partners (no per-challenge icons); mission cards have spending targets + progress bars; completed missions auto-award and appear in history. Reward types (CMS-configurable): Fixed Amount or EarnRate+Multiplier on GBV. Priorities: (1) Total GBV threshold → fixed reward (CTA `Start`), (2) Order-ID count / booking streak (CTA `Book`), (3) Room nights (CTA `Book`); nice-to-have: (4) share link, (5) chooseProduct, plus searchLoaded / pageVisit / product review (needs Review BE). Challenge coins differentiated by source; retroactive challenge coins only if the user joined within the challenge's active window.
- **4.8 Comms (WhatsApp, Push, Email).** Success onboarding after consent; retroactive hook daily 10:00 AM (eligible non-enrolled, last 24h, dedup); rank-drop alerts (after 2 months activation): rank 1–20 immediate on overtaking, 21–200 daily at 9 AM, 200+ weekly Mondays 9 AM; new mission weekly; monthly checkpoint (time left); final winner announcement stating explicit rank and reward. All channels BE-controlled, auto-on at campaign start; frequency/RPM/scheduler to be aligned with the Message team.
- **4.9 Final announcement & reward distribution.** Automated freeze at 11:59:59 PM Jul 28 2026; stop new coin-earning; scan pending/refunded and deduct; Game Master "verify winners" toggle moves auditing → complete; auditing removes/recalcs per T&C and excludes ineligible users (e.g. tiket employees). Claim: winners get comms with a secure form for ID verification and prize delivery. Gift Voucher codes injected to "My Voucher" (code shown); Tiket Points injected to the Blibli Tiket Points page via a single "Gamification" reward type. Non-Top-200 receive a consolation notification + GV/promo code and a separate raffle. Data ingested to the DWH within 2 weeks (BI DWH dev needed).

**Notifications strategy (samples).** Daily update (all): "Your current rank is #[X]. Check your status!"; Rank drop (top 200): "Alert! You dropped from #[X] to #[Y]. Book now to reclaim your spot!"; Eligible purchase not joined (non-participants): "Your recent purchase earned points! Join Top Spender within 24h to claim them."

**Acceptance criteria (QA checklist from PRD).**
- Coin logic: Flight IDR 1,000,000 × 0.1% × 100 = 100,000 coins; Native Hotel IDR 1,000,000 × 1.75% × 10 = 175,000 coins; Event = 0.
- Refund: 500,000 − 100,000 → 400,000; rank recalcs immediately; tier may drop.
- Leaderboard state: Day1 EOD rank #2 → Day2 10:00 ➖ → overtaken #3 🔻 → big purchase #1 🔼.
- Retroactive join: buy 10:00 AM, join 09:00 next day (23h) → awarded; join 11:00 next day (25h) → NOT awarded.

**Appendix (nice-to-have / supporting).** Catch-up nudge (convert coin delta to "Book Flight ~IDR X" copy); spending analytics (line chart of daily coin/spend, total eligible bookings/GBV); missions & badges (achievement unlocks, CMS-customizable, targeting all or CSV); Admin Panel/CMS (campaign config, rate management, mission management, user management/fraud ban); tracking events: `top_spender_join`, `top_spender_view`, `top_spender_leaderboard_scroll`, `top_spender_mission_click`, `booking_attributed_coins` (props: `order_id`, `vertical`, `coins_earned`, `new_total_coins`).

**Key open-question resolutions (meeting notes).** Earn-rate changes use the journey/checkout date (save historical data). Special Partner data comes from the order team (remapped with vertical data). Welcome bonus is a one-time campaign-creation config (not dynamic). `Campaign_Start_Date` cannot be back-dated. "Exclusive offer" = Top Spender Challenge = Mission. Notifications are all BE-controlled and auto-on at campaign start (frequency discussed with Message team). Leaderboard shows Top 200 with a sticky label for the user. The historical page is deprioritized. Name is captured from the first eligible order event and not updated afterward.
