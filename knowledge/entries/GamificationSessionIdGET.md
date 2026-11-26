---
kind: api
key: "GamificationSessionIdGET"
title: "GET Gamification Session By ID API"
source: "Curl command (QAAUT-36261)"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, session, campaign, sessionid, ggwp]
keywords: ["gamification", "harta karun", "session", "campaign", "sessionId", "ggwp"]
related: ["[[GamificationAdminProductsIdGET]]"]
---

# GamificationSessionIdGET — GET Gamification Session By ID API
> **Related:** [[GamificationAdminProductsIdGET]]

## PRD Summary
API to retrieve a campaign session by its session ID in Harta Karun gamification. No authentication headers required. The sessionId is a path parameter. Returns full session/campaign details on success.

## Key Learnings
- Invalid/missing sessions return HTTP 500 with code=FAILED ("failed to get campaign session"), not 404
- Empty sessionId (/session/) returns plain-text 404, not JSON
- SessionId lookup is case-insensitive (uppercase hex works)
- No auth required — public endpoint
- All invalid format sessionIds return the same 500 FAILED response
