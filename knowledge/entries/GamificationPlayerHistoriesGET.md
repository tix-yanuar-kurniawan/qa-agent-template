---
kind: api
key: "GamificationPlayerHistoriesGET"
title: "GET Gamification Player Histories API"
source: "Curl command (QAAUT-36267)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, player, histories, playsession, account-id, ggwp]
keywords: ["gamification", "harta karun", "player", "histories", "playSession", "account ID", "ggwp"]
related: ["[[GamificationHartaKarunPlayerConsentPUT]]", "[[GamificationPlayerStateGET]]"]
---

# GamificationPlayerHistoriesGET — GET Gamification Player Histories API
> **Related:** [[GamificationHartaKarunPlayerConsentPUT]] · [[GamificationPlayerStateGET]]

## PRD Summary
API to retrieve player play session histories for the Harta Karun gamification feature. Requires X-Account-ID header and a mandatory `type=playSession` query parameter. Player must have consented first.

## Key Learnings
- `type=playSession` is the only accepted value; missing/invalid/empty returns 400
- Missing/empty X-Account-ID returns 500 ("request context not found"), not 400
- Non-existent player (no consent) returns 404 ("player not found")
- Account with no history returns 200 with empty data object (distinguishable from 404)
- Non-numeric account ID returns 404 (player not found), same as non-existent
