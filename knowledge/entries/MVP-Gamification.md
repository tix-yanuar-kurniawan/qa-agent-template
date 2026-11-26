---
kind: epic
key: "MVP-Gamification"
title: "Top Spender Gamification — MVP / Initial Release (PLAT-52848)"
source: "Jira Epic (PLAT-52848) + TestRail suite 12196 (EIFFEL - GAMIFICATION) §Top Spender System Development"
action: knowledge
date: 2026-06-25
status: released
figma: false
tags: [top-spender, gamification, mvp, released, plat-52848, leaderboard, coins, campaign-lifecycle, finalization, winner-announcement, tiket-points, raffle, consolation, testrail, eiffel]
keywords: ["Top Spender", "gamification", "MVP", "PLAT-52848", "Top Spender System Development", "campaign lifecycle", "leaderboard", "coin calculation", "campaign finalization", "freeze", "final winner announcement", "Tiket Points injection", "raffle", "consolation", "welcome bonus", "retroactive join", "TestRail suite 12196", "EIFFEL - GAMIFICATION", "qa_78"]
related: ["[[TOP-SPENDER-GAMIFICATION-V2]]", "[[PLAT-54035]]", "[[TOP-SPENDER-V2-PHASE-3]]", "[[TOP-SPENDER-TRACKER]]"]
url: "https://borobudur.atlassian.net/browse/PLAT-52848"
---

# MVP-Gamification — Top Spender Gamification, MVP / Initial Release
> **Source:** Jira epic [[PLAT-52848]] *(Done)* (QA label `qa_78`).
> **Related:** [[TOP-SPENDER-GAMIFICATION-V2]] (shared PRD) · [[PLAT-54035]] (improvement layer) · [[TOP-SPENDER-V2-PHASE-3]] (future draft) · [[TOP-SPENDER-TRACKER]] (event tracking)
> **Jira:** https://borobudur.atlassian.net/browse/PLAT-52848

## Summary

This is the **already-released MVP** of Top Spender 2.0 — the base "Top Spender System Development" epic ([[PLAT-52848]], status **Done**) that [[PLAT-54035]] later improves on. It delivered the core gamification platform: campaign lifecycle, real-time leaderboard, the coin economy, join/onboarding + welcome bonus, refund-aware coin reversal, challenges/missions, special-partner rates, notifications, and end-of-campaign finalization (freeze → audit → winner announcement → reward distribution). This note exists so the team can tell **what was built in the MVP** apart from the current PLAT-54035 improvements and the future [[TOP-SPENDER-V2-PHASE-3]] draft.

> [!note] Why this note matters
> PLAT-52848 and PLAT-54035 **share the same PRD** ([[TOP-SPENDER-GAMIFICATION-V2]]) and their scopes **overlap heavily** — PLAT-54035 touches most MVP features again and adds new/deepened ones. The acceptance-criteria lists in the Jira stories are aspirational and over-claim what shipped in the MVP.

## Key Points

- **Epic:** [[PLAT-52848]] "[Gamification] Top Spender System Development" — **Done**. Children: PLAT-52873 ([BE]), PLAT-52875 & PLAT-52992 ([FE]), PLAT-53532 ([FE] CEH), PLAT-53548 ([TechSol] Panel API), PLAT-53551 ([TechSol] Improvement Features API — note: this one carries the §4.7/§4.8/§4.9 "[UPDATED]" scope that bleeds into PLAT-54035), PLAT-53894 ([QA]), PLAT-54161/54162 ([FE] P0 execution).
- **MVP BE acceptance criteria (PLAT-52873)** explicitly listed both *Core* and *Support* features — including raffle, tiered rank-drop, challenges with/without progression — so the MVP story text **over-claims** vs what PLAT-54035 calls "to be developed". Treat the Jira AC as aspirational.

## Details — MVP scope (feature areas)

- **Campaign lifecycle:** Draft/Upcoming/Active/Completed transitions; date-time picker; PM edit; rollover/reset between campaigns.
- **Leaderboard:** real-time updates when Active; relative ranking; name masking; 5-above/5-below; rank arrows (up/down/stable); tie handling.
- **Coin economy:** `GBV × EarnRate% × Multiplier%`; ingestion 12:01 PM after journey end; BigQuery rounding; historical rate retention; mid-campaign multiplier change.
- **Refund/cancellation:** immediate coin reversal on REFUNDED/CANCELLED; manual CS refunds bypass.
- **Exclusions:** Events, Insurance, Gift Cards, Ferry, non-IDR, B2B segments, Pay At Hotel.
- **Join / onboarding:** Join CTA + T&C consent + welcome bonus; retroactive coin calc on join; access gated until Enrolled; onboarding success notif; retroactive join nudge (eligible purchase, not sent to enrolled).
- **Challenges / missions:** multiple simultaneous; completion awards coins; progress bars; special-partner rates (percentage/fixed) + product-ID detection.
- **Notifications:** immediate comms (WA/Push/Email); daily/weekly/special event; segmentation scheduling.
- **End-of-campaign finalization:** freeze + auditing + prize distribution; coin calc stops on Completed; "Verify Winners" toggle; final winner announcement notif; Tiket Points injection on completion; non-Top-200 raffle + consolation info; DWH migration.
- **History / analytics / sharing:** coins history & activity; social-media rank share; tracking analytics.
