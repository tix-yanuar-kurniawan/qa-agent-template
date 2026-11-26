---
kind: api
key: "LoyaltyAdminMissionListBannerGET"
title: "GET Mission List Banner Config API (admin)"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [mission, mission-center, mission-list-page-configuration, admin-api, banner-config, header-image, desktop-banner, mobile-banner, tix-mission, gatotkaca, loyalty, api, get, bearer-token, authn]
keywords: ["mission list banner", "Mission Center", "header image", "desktopBanner", "mobileBanner", "admin API", "tix-mission", "gatotkaca", "GET /tix-mission/api/admin/mission-list/banner", "Authn: Empty token", "Authn: Unauthorized", "Bearer token"]
related: ["[[PLAT-57176]]", "[[PLAT-56247]]", "[[LoyaltyAdminMissionListBannerPUT]]", "[[LoyaltyMissionAdminMissionPriorityGET]]", "[[LoyaltyMissionAdminMissionPriorityPATCH]]", "[[LoyaltyMissionApiMissionListGET]]"]
---

# LoyaltyAdminMissionListBannerGET — GET Mission List Banner Config API (admin)
> **Related:** [[PLAT-57176]] · [[PLAT-56247]] · [[LoyaltyAdminMissionListBannerPUT]] · [[LoyaltyMissionAdminMissionPriorityGET]] · [[LoyaltyMissionAdminMissionPriorityPATCH]] · [[LoyaltyMissionApiMissionListGET]]

## PRD Summary
`GET /ms-gateway/tix-mission/api/admin/mission-list/banner` on
`https://gatotkaca.tiket.com` is the read side of the **Mission Center** header
image configuration described in [[PLAT-57176]]. It returns the two configured
slots and nothing else:

```
data: { desktopBanner: <string>, mobileBanner: <string> }
```

Auth is a single `Authorization: Bearer <JWT>` header. There are no path
parameters, no query parameters and no request body, so the only inputs are the credential and the state left behind by
[[LoyaltyAdminMissionListBannerPUT]].

## Key Learnings
- **The admin API host is confirmed.** [[PLAT-57176]] recorded the
  `tix-mission` admin host as `UNKNOWN` because all four Confluence contracts
  document `{{HOST}}` only. It is
  `https://gatotkaca.tiket.com/ms-gateway/tix-mission/api/...`. 
- **The gateway returns two distinct 401 messages, and the split is not the
  obvious one.** `Authn: Unauthorized` appears only when a *well-formed* JWT
  fails signature verification. Everything else — no header, empty header, token
  without the `Bearer` prefix, lowercase `bearer`, `Bearer` alone, and a
  non-JWT string like `invalidtoken123` — returns `Authn: Empty token ` (note
  the trailing space). So "empty token" really means "no parseable credential",
  not "the header was absent". Same behaviour on all four admin endpoints in
  this batch, so it is gateway-level, not service-level.
- **The scheme match is case-sensitive.** `bearer <token>` is rejected. Worth
  knowing before writing an automation helper that lowercases headers.
- **No read cache.** A `PUT` is visible on the very next `GET`, so no wait is needed between them.
- **Garbage in, garbage out.** The endpoint has no validation on the way out
  either — after a `PUT` of the literal string `not-a-url`, the `GET` returns
  `not-a-url` verbatim rather than null or a fallback. Anything stored is
  served, which is what makes the missing write-side URL validation
  (see [[LoyaltyAdminMissionListBannerPUT]]) reach the consumer page.
