---
kind: api
key: "LoyaltyMissionSlugProgressGET"
title: "GET Mission Slug Progress API"
source: "Curl command (API test case)"
action: create-api
date: 2026-06-10
figma: false
tags: [mission, slug, progress, loyalty, api, get, account-id, headers]
keywords: ["mission", "slug", "progress", "loyalty", "API", "GET", "account ID", "headers"]
related: []
---

# LoyaltyMissionSlugProgressGET — GET Mission Slug Progress API

## PRD Summary
API endpoint to fetch a user's mission progress for a specific mission slug.
The endpoint is GET /tix-mission/api/mission/{slug}/progress. It returns
mission details, user progress stamps, reward info, nudge data, and a CTA
that varies based on user state (MISSION_JOINED, JOIN_MISSION, or LOGIN).

## Key Learnings
- Missing/empty/non-numeric X-Account-Id causes API to return cta.type=LOGIN
  with a login URL — the API degrades gracefully to unauthenticated state
- Invalid slug returns NOT_FOUND with descriptive error message
- Empty slug (double slash) triggers a 307 redirect
- Mandatory headers (X-Channel-Id, X-Service-Id, X-Store-Id, X-Username) are
  NOT strictly enforced — missing them still returns SUCCESS
- Non-existent but numeric account IDs return SUCCESS with cta.type=JOIN_MISSION
- Wrong HTTP method returns 405 Method Not Allowed
- Special characters in slug return 404 (handled at routing level)
