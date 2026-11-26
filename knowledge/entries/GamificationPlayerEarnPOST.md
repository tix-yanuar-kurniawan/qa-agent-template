---
kind: api
key: "GamificationPlayerEarnPOST"
title: "POST Gamification Harta Karun Player Earn API"
source: "Curl command (API) — QAAUT-36264"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, player, earn, referral-code, tokenid, account-id, ggwp, post]
keywords: ["gamification", "harta karun", "player", "earn", "referral code", "tokenId", "account ID", "ggwp", "POST"]
related: ["[[GamificationHartaKarunPlayerConsentPUT]]", "[[GamificationHartaKarunTokenV1UserGET-v2]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationPlayerEarnPOST — POST Gamification Harta Karun Player Earn API
> **Related:** [[GamificationHartaKarunPlayerConsentPUT]] · [[GamificationHartaKarunTokenV1UserGET-v2]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
POST endpoint to earn/redeem a token using a sharer's referral code (`code` field = sharer's tokenId/playerId). Requires X-Account-ID for a consented player. Prerequisite: player consent via PUT /player/consent.

## Key Learnings
- Happy path returns HTTP 200 with code=SUCCESS and data.status=true
- Missing/empty X-Account-ID returns HTTP 500 "request context not found"
- Non-consented or invalid account IDs return HTTP 400 "failed to fetch redeemer account state"
- Invalid/missing/empty code returns HTTP 500 "the provided hex string is not a valid ObjectID"
- POST without body returns HTTP 405 "Method Not Allowed" (plain text)
- Invalid JSON body returns HTTP 400 with proto syntax error (note: error message contains non-breaking space after "proto:")
- Content-Type header is optional — request succeeds without it
- Self-referral (sharer account 11249 using own code 6a2f9880d90ea49745a9bb3a) is not blocked in preprod — still returns SUCCESS
- Endpoint appears idempotent — repeated calls with same account/code return SUCCESS
