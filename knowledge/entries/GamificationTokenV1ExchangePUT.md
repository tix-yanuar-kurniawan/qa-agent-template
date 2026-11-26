---
kind: api
key: "GamificationTokenV1ExchangePUT"
title: "PUT Gamification Token V1 Exchange API"
source: "Curl command (QAAUT-36272)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, token, exchange, tixpoints, redeem, account-id, ggwp]
keywords: ["gamification", "harta karun", "token", "exchange", "tixpoints", "redeem", "account ID", "ggwp"]
related: ["[[GamificationHartaKarunTokenV1RateGET]]", "[[GamificationHartaKarunPlayerConsentPUT]]"]
---

# GamificationTokenV1ExchangePUT — PUT Gamification Token V1 Exchange API
> **Related:** [[GamificationHartaKarunTokenV1RateGET]] · [[GamificationHartaKarunPlayerConsentPUT]]

## PRD Summary
API to exchange tixpoints for game tokens in Harta Karun. Rate is 8 tixpoints = 1 token. Requires X-Account-ID, X-Username (mandatory but value flexible), and Content-Type headers. Player must have consented. Body requires `tixpoints` as string.

## Key Learnings
- Generic 500 for multiple failure types (missing X-Username, non-consented account)
- Non-numeric account ID returns 500 with "invalid accountID", not 400
- Happy path is stateful — each exchange deducts tixpoints; tokenAmount is cumulative balance
- `tixpoints` must be a string type in JSON, not numeric
- No max tixpoints limit per the notes
