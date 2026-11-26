---
kind: api
key: "GamificationHartaKarunPlayerConsentPUT"
title: "PUT Gamification Harta Karun Player Consent API"
source: "Curl command (API)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, player, consent, game-registration, account-id, ggwp]
keywords: ["gamification", "harta karun", "player", "consent", "game registration", "account ID", "ggwp"]
related: ["[[GamificationTokenV1UserGET]]", "[[TOP-SPENDER-TRACKER]]", "[[PLAT-54035]]"]
---

# GamificationHartaKarunPlayerConsentPUT — PUT Gamification Harta Karun Player Consent API
> **Related:** [[GamificationTokenV1UserGET]] · [[TOP-SPENDER-TRACKER]] · [[PLAT-54035]]

## PRD Summary
API endpoint to register user consent to join the Harta Karun game. Uses PUT method with X-Account-ID header. Returns success with status:true for valid accounts. This is a prerequisite for the token/v1/user endpoint.

## Key Learnings
- Missing/empty X-Account-ID returns HTTP 500 "request context not found" (not a clean 400)
- Invalid/non-existent account IDs return HTTP 500 "failed get user profile due to server error"
- The endpoint is idempotent — calling consent multiple times for the same valid account returns success each time
- Request body is ignored — adding JSON body doesn't affect behavior
- Duplicate X-Account-ID headers: server uses the first value (valid one), so still returns 200
- GET method returns 405 Method Not Allowed
- Invalid path returns 404 page not found (plain text, not JSON)
