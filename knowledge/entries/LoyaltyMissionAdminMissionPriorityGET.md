---
kind: api
key: "LoyaltyMissionAdminMissionPriorityGET"
title: "GET Mission Priority Order API (admin)"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [mission, mission-center, mission-sequence, mission-priority-order, admin-api, tix-mission, gatotkaca, loyalty, api, get, ordering, priority-rank, bearer-token, authn]
keywords: ["mission priority", "mission sequence", "Mission Center", "Order", "priority_rank", "admin API", "tix-mission", "gatotkaca", "GET /tix-mission/api/admin/mission/priority", "The Order numbering should be handled by Front End", "Authn: Empty token", "Authn: Unauthorized"]
related: ["[[PLAT-57176]]", "[[PLAT-56247]]", "[[LoyaltyMissionAdminMissionPriorityPATCH]]", "[[LoyaltyAdminMissionListBannerGET]]", "[[LoyaltyAdminMissionListBannerPUT]]", "[[LoyaltyMissionApiMissionListGET]]", "[[PLAT-57060]]"]
---

# LoyaltyMissionAdminMissionPriorityGET — GET Mission Priority Order API (admin)
> **Related:** [[PLAT-57176]] · [[PLAT-56247]] · [[LoyaltyMissionAdminMissionPriorityPATCH]] · [[LoyaltyAdminMissionListBannerGET]] · [[LoyaltyAdminMissionListBannerPUT]] · [[LoyaltyMissionApiMissionListGET]] · [[PLAT-57060]]

## PRD Summary
`GET /ms-gateway/tix-mission/api/admin/mission/priority` on
`https://gatotkaca.tiket.com` backs the **Sequence** table of the Mission Center
screen ([[PLAT-57176]]). It returns a flat array — 29 missions on `gatotkaca` as
of 2026-08-12 — in display order, each entry carrying only:

```
{ id, banner, name, slug }
```

Array position *is* the order.

## Key Learnings
- **No rank field in the payload — confirmed.** The Confluence contract's note
  that "The Order numbering should be handled by Front End" holds: there is
  nothing server-side in this response to assert a rank against, so the panel's
  `Order` column is pure array index. Note the contrast with the PATCH response,
  which *does* return a `priorityRank` — the rank exists, it is just not exposed
  on the read.
- **No status field, which contradicts the design.** The Figma in
  [[PLAT-57176]] states *"You can only adjust the sequence of scheduled and live
  missions."* This endpoint returns the **entire** mission catalogue with no
  `status`, `startAt` or `endAt` to filter on — the 29 rows include obviously
  expired fixtures such as `xpired-cepet`. The panel therefore cannot honour
  that restriction from this payload alone; it would need a second call to the
  Mission Config list. Worth confirming with BE before treating a full,
  unfiltered Sequence table as a bug or as correct.
- **This is the only way to see a reorder.** The [[LoyaltyMissionAdminMissionPriorityPATCH]]
  response returns a rank, not a position, so the new order has to be read back
  from this endpoint by comparing array indices.
- **Reordering is visible immediately** — no cache between the PATCH and the
  next GET.
- **Auth behaves identically to the banner endpoints.** Every credential
  variation returns the same two gateway messages documented in
  [[LoyaltyAdminMissionListBannerGET]]: `Authn: Unauthorized` only for a
  well-formed JWT with a broken signature, `Authn: Empty token ` for everything
  else including a non-JWT string and a lowercase `bearer` scheme.
- **The response is ~8 KB and grows with the mission corpus.**
- **Mission ids are environment-specific.** Ids such as
  `6a5f314249e4bcc09345e831` (`milestone-two`) are only valid on `gatotkaca`.
