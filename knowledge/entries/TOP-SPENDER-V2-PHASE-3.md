---
kind: confluence
key: "TOP-SPENDER-V2-PHASE-3"
title: "Top Spender Program V2 Improvement Phase 3"
source: "Confluence"
action: knowledge
date: 2026-06-25
status: draft
figma: false
tags: [top-spender, phase-3, gamification, challenge-nudge, complete-all-challenges, blibli-tiket-points, top-spender-coins, gbv-mission-progress, quantity-based-rewards, insurance-calculation, domestic-vs-international, reward-types, draft]
keywords: ["Top Spender v2", "Phase 3", "challenge page nudge", "complete all challenges", "Blibli Tiket Points", "Top Spender Coins", "GBV mission progress bar", "quantity-based rewards", "insurance product calculation", "domestic vs international challenges", "reward types", "nudge copy", "gift voucher", "GBV uplift"]
related: ["[[TOP-SPENDER-GAMIFICATION-V2]]", "[[PLAT-54035]]", "[[PLAT-54037]]", "[[PLAT-54038]]", "[[TOP-SPENDER-TRACKER]]"]
url: "https://borobudur.atlassian.net/wiki/spaces/AE/pages/4813914187/Top+Spender+Program+V2+Improvement+Phase+3"
---

# TOP-SPENDER-V2-PHASE-3 — Top Spender Program V2 Improvement Phase 3
> **Source:** Confluence (id 4813914187) · **Status:** ⚠️ DRAFT (owner Novita Olivera; created 2026-06-09, last modified 2026-06-17) · **Target release:** July 2026
> **Related:** [[TOP-SPENDER-GAMIFICATION-V2]] (main PRD) · [[PLAT-54035]] (improvement epic) · [[PLAT-54037]] · [[PLAT-54038]] · [[TOP-SPENDER-TRACKER]]
> **Confluence:** https://borobudur.atlassian.net/wiki/spaces/AE/pages/4813914187

> [!warning] DRAFT — captured for reference only
> This page is a **draft** and will change. Re-fetch the live Confluence page before relying on any number or rule here. None of the requirements below have a linked Jira issue yet, so they are likely **future / Phase-3 scope** and may not be in the current [[PLAT-54035]] build.

## Summary

Phase 3 is a draft set of improvements layered on the Top Spender v2 gamification program. It refines the challenge experience and reward visibility rather than the core coin engine: a more general **challenge-page nudge** that surfaces the biggest rewards, a **GBV mission progress bar**, **quantity-based rewards** (in addition to value-based), bringing **insurance** into the Top Spender calculation, and **domestic vs international** challenge differentiation. The stated goal is to grow GBV (especially from travel agents) and improve fairness in prize distribution after v1 showed top contributors missing the top-20 prizes.

## Key Points

- **This is the source of the "Complete all challenges" bonus** behind [[PLAT-54035]] — it is NOT in the main PRD ([[TOP-SPENDER-GAMIFICATION-V2]]). It appears here as **recommended nudge (marketing) copy**, not a fixed reward: *"Complete all challenges to earn 3.4 million Blibli Tiket Points and 1 million Top Spender Coins."*
- **Challenge Page Nudge:** make the nudge more general and prioritize the reward types with the biggest rewards. Supported reward types to show in the nudge: **Top Spender Coin, Blibli Tiket Points, and GV**. When multiple reward types exist, **sort displayed rewards by highest user-perceived value first**. Today only 2 reward types (voucher / points) are configurable in the dashboard; proposal is to combine reward types per challenge and visualize the total per reward type.
- **GBV Mission Progress Bar:** show current amount, target amount, % completion, and remaining GBV needed; for completed missions show completed state + reward claim/earned status.
- **Quantity-Based Rewards:** support quantity rewards alongside value-based ones (e.g. complete N transactions, buy N tickets/room nights, or complete multiple eligible challenges). Config defines required quantity, eligible product scope, reward type, reward amount, and completion rules.
- **Insurance Product Calculation:** add insurance as a product considered in the Top Spender calculation. **Open decision:** whether insurance contributes to GBV, quantity-mission progress, points calculation, or is only an add-on attribution. DWH must validate insurance transaction value availability, linkage to parent booking, refund/cancellation status, and product-category mapping.
- **Domestic vs International Challenges:** challenge config gains a route/market type — **Domestic, International, or All** — and leaderboard, mission eligibility, and nudge copy must indicate which applies (especially Flights & Hotels).
- **Status caveats:** document is DRAFT; the body contains inconsistent campaign dates (mentions v1 "Dec 2023–Mar 2024" and v2 "Dec 2, 2024–Mar 12, 2025" while target release is July 2026) — treat dates as unreliable draft artifacts.

## Details

### Objective
Replicate and scale the success of the previous Top Spender program by driving incremental transactions and higher GBV from high-value users across Flights, Hotels, and other products, while refining program rules for fairness and better alignment with user value.

Top Spender v1 (stated Dec 2023 – Mar 2024) results cited:
- **Incremental Net Revenue:** IDR 4.2 Bn (Flights IDR 2.4 Bn, Hotels IDR 1.5 Bn, Others IDR 268 Mn).
- **ROI:** 7x, with only IDR 600 Mn total cost.
- **High contributor YoY GBV growth:** Rank 1 IDR 10 Mn → 1.4 Bn; Rank 2 IDR 24 Mn → 1.1 Bn; Rank 3 IDR 30 Mn → 867 Mn.
- **Insight:** top contributors did not win the top-20 prizes under existing rules → motivates optimizing leaderboard mechanics and reward distribution.

**Revision note (v2 scope additions):** updated challenge nudges, GBV mission progress visibility, quantity-based rewards, insurance consideration in calculations, and separate domestic vs international challenge treatment.

### Success metrics
- GBV uplift, especially for travel agents. Projected GBV uplift over the 3-month event: **IDR 201 bio** (monthly **IDR 67 bio**). Overall company GBV uplift **2.8%**; travel-agent GBV uplift **23.2%**.

### Requirements (each currently has NO linked Jira issue)
1. **Challenge Page Nudge** — generalize the nudge and prioritize the biggest-reward types. Recommended copy: *"Complete all challenges to earn 3.4 million Blibli Tiket Points and 1 million Top Spender Coins."* Show Top Spender Coin, Blibli Tiket Points, and GV; sort by highest user-perceived value. Current config exposes only voucher/points; proposal combines reward types per challenge and shows the total per type in the box.
2. **GBV Mission Progress Bar** — progress bar for GBV missions (current amount, target, % completion, remaining GBV); completed state + reward claim/earned status for completed missions.
3. **Quantity-Based Rewards** — quantity rewards in addition to value-based (complete N transactions, buy N tickets/room nights, complete multiple eligible challenges). Config: required quantity, eligible product scope, reward type, reward amount, completion rules.
4. **Insurance Product Calculation** — add insurance as a considered product. Open decision on whether it counts toward GBV / quantity progress / points / add-on only. DWH to validate transaction value availability, parent-booking linkage, refund/cancellation status, product-category mapping.
5. **Domestic vs International Challenges** — challenge config route/market type (Domestic / International / All); leaderboard, mission eligibility, and nudge copy indicate applicability (especially Flights & Hotels).

### Open Questions / Out of Scope
- Both sections are empty placeholders in the current draft.
