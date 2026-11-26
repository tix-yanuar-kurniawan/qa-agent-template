---
kind: api
key: "LoyaltyMissionAdminMissionPriorityPATCH"
title: "PATCH Mission Priority Reorder API (admin)"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [mission, mission-center, mission-sequence, mission-priority-order, reorder, drag-and-drop, admin-api, tix-mission, gatotkaca, loyalty, api, patch, priority-rank, sparse-rank, rebalanced, objectid, validation, undocumented-contract]
keywords: ["mission priority reorder", "PATCH /tix-mission/api/admin/mission/priority/reorder", "missionId", "beforeMissionId", "afterMissionId", "priorityRank", "rebalanced", "invalid neighbour mission id", "invalid neighbour ordering for reorder", "beforeMissionId must differ from missionId", "afterMissionId must differ from missionId", "the provided hex string is not a valid ObjectID", "mongo: no documents in result", "ReorderMissionPriorityReq", "gapless ordered list", "drag and move the rows"]
related: ["[[PLAT-57176]]", "[[PLAT-57060]]", "[[PLAT-56247]]", "[[LoyaltyMissionAdminMissionPriorityGET]]", "[[LoyaltyAdminMissionListBannerPUT]]", "[[LoyaltyAdminMissionListBannerGET]]", "[[LoyaltyMissionApiMissionListGET]]"]
---

# LoyaltyMissionAdminMissionPriorityPATCH — PATCH Mission Priority Reorder API (admin)
> **Related:** [[PLAT-57176]] · [[PLAT-57060]] · [[PLAT-56247]] · [[LoyaltyMissionAdminMissionPriorityGET]] · [[LoyaltyAdminMissionListBannerPUT]] · [[LoyaltyAdminMissionListBannerGET]] · [[LoyaltyMissionApiMissionListGET]]

## PRD Summary
`PATCH /ms-gateway/tix-mission/api/admin/mission/priority/reorder` on
`https://gatotkaca.tiket.com` is the write path behind the **drag-and-drop
Sequence table** in Mission Center. It is the endpoint [[PLAT-57176]] recorded
as having **no documented contract** — [[PLAT-57060]] is Done with a title-only
description and no Confluence page — so the shape below was reverse-engineered
from live calls.

Request:

```
{ "missionId": "<id>", "beforeMissionId": "<id>", "afterMissionId": "<id>" }
```

Response:

```
data: { missionId, priorityRank, rebalanced }
```

`missionId` is the mission being moved; `beforeMissionId` is the mission that
ends up **above** it and `afterMissionId` the one **below** it.

## Key Learnings

### The contract, since none is written down
| Payload | Result |
|---|---|
| all three ids, neighbours adjacent | mission lands between them |
| `afterMissionId` + `missionId`, no `beforeMissionId` | moves to the **top** |
| `beforeMissionId` + `missionId`, no `afterMissionId` | moves to the **bottom** |
| `missionId` only | moves to the **top** |
| any neighbour sent as `""` | `400 invalid neighbour mission id` |

- **Omitted and empty are not the same thing, and this is the sharpest trap in
  the set.** Leaving `beforeMissionId` out means "top of list"; sending it as
  `""` fails ObjectID parsing with `400`. A panel that always serialises all
  three keys will break on every drag to the first position while working
  everywhere else — a bug that only shows up at one specific drop target.
- **Ranks are sparse, not gapless.** `priorityRank` comes back as multiples of
  `4294967296` (2^32) — 4294967296, 12884901888, 21474836480 — and a move
  computes the **midpoint** of the two neighbour ranks. The response also
  carries `rebalanced: false`, implying a periodic renumbering pass when the gap
  between neighbours is exhausted. This qualifies [[PLAT-57176]]'s "gapless
  ordered list": gaplessness is a **frontend display** property of the `Order`
  column, while the server deliberately keeps gaps so a single move is one
  write instead of N.
- **Non-adjacent neighbours are accepted but do not do what the payload says.**
  Naming a `beforeMissionId` at index 0 and an `afterMissionId` at index 3
  returns `200`, but the mission lands at index 2 — the rank midpoint — not
  immediately after the named before-mission. The neighbours must be genuinely
  adjacent for the result to match the drop position the operator saw.
- **Neighbour ordering is validated.** Swapping the two neighbour ids returns
  `400 invalid neighbour ordering for reorder`, so a drag payload built with the
  ids the wrong way round is caught rather than corrupting the list. This is the
  one place the service is stricter than it needed to be, and it is worth
  keeping.
- **Self-reference is guarded on both sides**, with distinct messages:
  `beforeMissionId must differ from missionId` and
  `afterMissionId must differ from missionId`.

### Error-handling quality
- **404 is mislabelled and leaks the datastore.** An unknown `missionId` returns
  `code: NOT_FOUND` but `message: "An internal server error occurred."` with
  `errors: ["mongo: no documents in result"]`. The code and the message
  contradict each other, and the driver text should not reach a client.
- **An unknown neighbour and an unknown missionId are indistinguishable** — both
  produce that identical 404, so the caller cannot tell which of the three ids
  was wrong. Format errors *do* distinguish (`invalid missionId` vs
  `invalid neighbour mission id`); only the existence check collapses them.
- **A missing field is reported as a bad ObjectID.** Omitting `missionId`
  entirely returns `invalid missionId` / "the provided hex string is not a valid
  ObjectID" rather than a missing-required-field error.
- **Decode failures return 500 with Go internals**, including the struct name
  `ReorderMissionPriorityReq`. Identical idiom to
  [[LoyaltyAdminMissionListBannerPUT]], so this is service-wide.

### Practical notes
- **The `Cookie` header in the browser-copied curl is not required.** The Bearer
  token alone authorises the reorder; `session_access_token` is not needed.
- **Auth behaves as on the other three endpoints** — see
  [[LoyaltyAdminMissionListBannerGET]] for the `Empty token` vs `Unauthorized`
  split. Nothing moves on a 401.
- **Every successful call mutates shared state and there is no undo.** The current
  order is readable from [[LoyaltyMissionAdminMissionPriorityGET]]. A mission moved
  back gets a rank that differs from the original even when the position is
  identical, so "restored" can only be judged on order, not on rank.
- **The resulting order is only visible via the GET.** The PATCH response reports a rank, not
  a position.
