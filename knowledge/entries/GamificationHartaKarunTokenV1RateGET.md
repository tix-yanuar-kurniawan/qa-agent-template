---
kind: api
key: "GamificationHartaKarunTokenV1RateGET"
title: "GET Gamification Harta Karun Token V1 Rate API"
source: "Curl command (API)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, token, harta-karun, rate, exchange-rate, public-endpoint, ggwp, config]
keywords: ["gamification", "token", "harta karun", "rate", "exchange rate", "public endpoint", "ggwp", "config"]
related: ["[[GamificationHartaKarunPlayerConsentPUT]]", "[[GamificationTokenV1UserGET]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationHartaKarunTokenV1RateGET — GET Gamification Harta Karun Token V1 Rate API
> **Related:** [[GamificationHartaKarunPlayerConsentPUT]] · [[GamificationTokenV1UserGET]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
Public API endpoint to retrieve the token exchange rate for the Harta Karun game. Does not require authentication or X-Account-ID header. Returns the rate as a string value (e.g., "7").

## Key Learnings
- This is a public/config endpoint — no authentication needed
- X-Account-ID header is accepted but ignored (response is the same)
- Rate is returned as a string type (e.g., "7"), not a number
- Response structure: {"code":"SUCCESS","data":{"rate":"7"}}
- Wrong HTTP methods (POST, PUT, DELETE) all return 405 Method Not Allowed (plain text)
- Invalid/incomplete paths return 404 (plain text)
- Query parameters are ignored
