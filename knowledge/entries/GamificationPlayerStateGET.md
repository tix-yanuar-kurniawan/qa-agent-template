---
kind: api
key: "GamificationPlayerStateGET"
title: "GET Gamification Player State API"
source: "Curl command (QAAUT-36265)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, player, state, consent, eligible, token, account-id, ggwp]
keywords: ["gamification", "harta karun", "player", "state", "consent", "eligible", "token", "account ID", "ggwp"]
related: ["[[GamificationHartaKarunPlayerConsentPUT]]", "[[GamificationPlayerHistoriesGET]]"]
---

# GamificationPlayerStateGET — GET Gamification Player State API
> **Related:** [[GamificationHartaKarunPlayerConsentPUT]] · [[GamificationPlayerHistoriesGET]]

## PRD Summary
API to retrieve the current state of a player in Harta Karun gamification. Returns consent status, eligibility, token balance, and player ID. Requires X-Account-ID header. Player consent is a prerequisite for meaningful data.

## Key Learnings
- Missing/empty X-Account-ID returns 500 ("request context not found"), not 400
- Invalid or non-consented accounts do NOT error — they return 200 with default empty state (isAcceptConsent=false, isEligible=false, token="0", playerId="000000000000000000000000")
- Consented accounts return isAcceptConsent=true, isEligible=true, non-zero token
- Token values are dynamic and change between runs
- Non-numeric, negative, zero, and decimal account IDs all return 200 with default state
