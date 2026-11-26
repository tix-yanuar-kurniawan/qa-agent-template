---
kind: api
key: "GamificationTokenV1UserGET"
title: "GET Gamification Token V1 User API"
source: "Curl command (API)"
action: create-api
date: 2026-06-12
figma: false
tags: [gamification, token, harta-karun, user, game, player-state, account-id]
keywords: ["gamification", "token", "harta karun", "user", "game", "player state", "account ID"]
related: ["[[TOP-SPENDER-TRACKER]]", "[[PLAT-54035]]"]
---

# GamificationTokenV1UserGET — GET Gamification Token V1 User API
> **Related:** [[TOP-SPENDER-TRACKER]] · [[PLAT-54035]]

## PRD Summary
API endpoint to retrieve gamification token count for a user in the Harta Karun game. Requires X-Account-ID header. Returns token count for joined users; returns error for non-joined users or invalid account IDs.

## Key Learnings
- Non-joined users return HTTP 500 with "failed to get player state" instead of a clean 4xx error
- Missing/empty X-Account-ID properly returns HTTP 400 with "accountID is required"
- Invalid account ID formats (non-numeric, special chars, negative, decimal) all return same 500 error as non-joined user
- Token value is returned as a string (e.g., "4"), not a number
