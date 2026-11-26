---
kind: api
key: "LoyaltyAdminMissionListBannerPUT"
title: "PUT Mission List Banner Config API (admin)"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [mission, mission-center, mission-list-page-configuration, admin-api, banner-config, header-image, desktop-banner, mobile-banner, tix-mission, gatotkaca, loyalty, api, put, validation, url-validation, bad-request, internal-server-error]
keywords: ["mission list banner", "Mission Center", "header image", "desktopBanner", "mobileBanner", "desktopBanner and mobileBanner are required", "admin API", "tix-mission", "gatotkaca", "PUT /tix-mission/api/admin/mission-list/banner", "SaveMissionListBannerReq", "handler: decode request body", "no URL validation", "no domain allowlist"]
related: ["[[PLAT-57176]]", "[[PLAT-56247]]", "[[LoyaltyAdminMissionListBannerGET]]", "[[LoyaltyMissionAdminMissionPriorityGET]]", "[[LoyaltyMissionAdminMissionPriorityPATCH]]", "[[PLAT-57174]]", "[[PLAT-57175]]"]
---

# LoyaltyAdminMissionListBannerPUT — PUT Mission List Banner Config API (admin)
> **Related:** [[PLAT-57176]] · [[PLAT-56247]] · [[LoyaltyAdminMissionListBannerGET]] · [[LoyaltyMissionAdminMissionPriorityGET]] · [[LoyaltyMissionAdminMissionPriorityPATCH]] · [[PLAT-57174]] · [[PLAT-57175]]

## PRD Summary
`PUT /ms-gateway/tix-mission/api/admin/mission-list/banner` on
`https://gatotkaca.tiket.com` is the **update** verb for the Mission Center
header image. Body:

```
{ "desktopBanner": "<url>", "mobileBanner": "<url>" }
```

Success is a bare `data: true`. Per [[PLAT-57176]] the sibling `POST` is
**create-once** and silently no-ops on a second call, so `PUT` is the only verb
an operator's edit may use.

## Key Learnings
- **Both slots are required together, and three different "absent" spellings all
  hit the same wall.** Omitting a field, sending `""`, and sending `null` all
  return `400 BAD_REQUEST` with
  `["desktopBanner and mobileBanner are required"]`. This confirms the
  Confluence contract and sharpens the tension [[PLAT-57176]] flagged against
  the story text: the slots are independent *fields*, never independent
  *submissions*. A panel that PUTs only the slot the operator touched will fail
  every time.
- **There is no way to clear a slot.** [[PLAT-57176]] guessed that "returning a
  slot to empty may be impossible" — confirmed. No delete endpoint exists and
  `""` is rejected, so once a banner is configured the never-configured state is
  unreachable on this environment. The never-configured state needs a fresh
  environment.
- **No URL validation and no domain allowlist.** `{"desktopBanner":"not-a-url"}`
  returns `200 SUCCESS`, and so does `https://example.com/desktop.jpg`. The
  value is stored verbatim and served straight to the public Mission List Page.
  Two consequences worth raising: an operator typo silently breaks the header
  image with a success toast, and an arbitrary third-party host can be made to
  serve an image on a tiket.com consumer page. The design's constraints
  (838x240 / 1440x484, 1 MB, PNG or JPG) are enforced **only in the panel** —
  nothing server-side backs them.
- **The two slots are interchangeable free text.** PUTting the mobile URL into
  `desktopBanner` and vice versa returns `200` and the GET echoes the swap.
  There is no dimension check to catch a mis-assigned upload.
- **Malformed input returns 500, not 400, and leaks internals.** No body,
  malformed JSON and a numeric value all produce
  `INTERNAL_SERVER_ERROR` with the raw Go decoder text in `errors` — including
  the internal struct name `SaveMissionListBannerReq`. The service validates
  business rules properly (clean 400s) but has no guard around the decode step.
  Same pattern on [[LoyaltyMissionAdminMissionPriorityPATCH]], so it is a
  service-wide handler idiom rather than a one-off.
- **`Content-Type` is not enforced and unknown fields are ignored.** The body is
  decoded as JSON with no content type header, and an extra `tabletBanner` key
  is silently dropped rather than rejected.
- **Auth behaves exactly as on the GET** — see
  [[LoyaltyAdminMissionListBannerGET]] for the `Authn: Empty token` vs
  `Authn: Unauthorized` split. Nothing is written on a 401.
- **This endpoint mutates shared state.** Every PUT overwrites the live banner on
  `gatotkaca`, and there is no undo.
