---
kind: api
key: "GamificationHartaKarunTokenV1UserGET-v2"
title: "GET Gamification Harta Karun Token V1 User API (QAAUT-36274)"
source: "Curl command (API)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, token, harta-karun, user, game, player-state, account-id, ggwp, consent-prerequisite]
keywords: ["gamification", "token", "harta karun", "user", "game", "player state", "account ID", "ggwp", "consent prerequisite"]
related: ["[[GamificationHartaKarunPlayerConsentPUT]]", "[[GamificationTokenV1UserGET]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationHartaKarunTokenV1UserGET-v2 — GET Gamification Harta Karun Token V1 User API (QAAUT-36274)
> **Related:** [[GamificationHartaKarunPlayerConsentPUT]] · [[GamificationTokenV1UserGET]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
API endpoint to retrieve token count for a user in the Harta Karun game. Requires X-Account-ID header. User must have consented to the game first (via PlayerConsent endpoint). Returns token count as a string for joined users.

## Key Learnings
- Same endpoint as previous GamificationTokenV1UserGET knowledge entry but with explicit prerequisite context
- Missing/empty X-Account-ID properly returns HTTP 400 "accountID is required"
- Non-joined users, invalid IDs, zero, negative, decimal all return HTTP 500 "failed to get player state"
- Token value is returned as a string (e.g., "4"), not a number
- Response structure is simpler than consent endpoint: {"code":"...","data":{"token":"..."}}
- POST method returns 405 Method Not Allowed
