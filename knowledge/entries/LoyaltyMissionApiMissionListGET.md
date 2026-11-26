---
kind: api
key: "LoyaltyMissionApiMissionListGET"
title: "GET Loyalty Mission List API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [mission, mission-list, loyalty, api, get, account-id, guest-user, tabs, joined, available, past, localization, accept-language]
keywords: ["mission list", "mission", "loyalty", "API", "GET", "X-Account-Id", "guest user", "tabs", "joined", "available", "past", "summary", "Accept-Language", "localization"]
related: ["[[PLAT-56247]]", "[[LoyaltyMissionSlugProgressGET]]"]
---

# LoyaltyMissionApiMissionListGET — GET Loyalty Mission List API
> **Related:** [[PLAT-56247]] · [[LoyaltyMissionSlugProgressGET]]

## PRD Summary
`GET /tix-mission/api/mission-list` on `https://lb1-testing.tiket.com` backs the
Mission List page. It returns `data.banner` (mobile + desktop image URLs),
`data.summary` (`missionsCompleted`, `rewardsEarned`) and `data.tabs` with three
arrays: `joined`, `available` and `past`.

Each mission carries `missionId`, `slug`, `missionName`, `missionStatus`,
`userStatus`, `reward`, `rewardQuota`, `startAt` / `endAt` /
`claimPeriodsEndAt`, `cta`, `milestoneEnable`, and a nested `pageModule` that
repeats the mission card payload (title, reward, nudge, milestone,
`userProgress`, `gbvProgress`, colours).

The user is identified by the `X-Account-Id` header — the request notes say
`0` is the guest/non-login user and `31116151` is the logged-in user.

## Key Learnings
- The endpoint never fails on bad input. Every variation — missing,
  empty, non-numeric, or negative `X-Account-Id`, and every mandatory header
  removed — still returns HTTP 200 `SUCCESS`. There is no 4xx path.
- **Three distinct user views**, and `summary` is the tell:
  - guest (`X-Account-Id: 0`), missing, empty, or non-numeric → `summary: null`,
    `joined: []`, all 13 missions in `available`, `cta.type=LOGIN`.
  - numeric but unknown account (`99999999`, `-1`) → `summary` **object** with
    `missionsCompleted: 0`, `rewardsEarned: 0` — not null. Distinguishing
    "unparseable" from "unknown user" only shows up in this field.
  - logged-in account → populated `summary`, missions split across
    `joined` / `available` / `past`.
- The `available` list is **user-specific, not a fixed catalogue** — the
  segmented mission `segmented-lah` appears only for the logged-in account, and
  `list-gbv` only for the guest view.
- `past` collects finished / `OUT_OF_QUOTA` missions (e.g. `milestone-two` with
  `missionStatus=OUT_OF_QUOTA`, `userStatus=ACTIVE`) and is empty for guests.
- `Accept-Language` is honoured for all user-facing copy: `en` gives "Unlock 3
  stamps for free", "Ends in 31 Aug", "Limited rewards", "1,000 Points"; `id`
  gives "Dapetin 3 stempel gratis", "Berakhir pada 31 Aug", "Reward terbatas",
  "1.000 Poin". Omitting the header falls back to Indonesian.
- Mandatory-looking headers (`X-Channel-Id`, `X-Service-Id`, `X-Store-Id`,
  `X-Username`, `X-Currency`) are **not enforced**, and `X-Store-Id` is not even
  validated — `INVALID_STORE` returns the full TIKETCOM mission set. Same
  finding as [[LoyaltyMissionSlugProgressGET]].
- **Response size:** the guest body is ~35 KB and the logged-in body ~52 KB.
- Mission timestamps (`endAt` on rolling test missions) drift between calls.
