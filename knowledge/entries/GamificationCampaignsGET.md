---
kind: api
key: "GamificationCampaignsGET"
title: "GET Gamification Campaigns List API"
source: "Curl command (Queue UI)"
action: create-api
date: 2026-06-16
figma: false
tags: [gamification, harta-karun, campaigns, list, public-endpoint, chips, activecampaigns, inactivecampaigns, ggwp, get]
keywords: ["gamification", "harta karun", "campaigns", "list", "public endpoint", "chips", "activeCampaigns", "inactiveCampaigns", "ggwp", "GET"]
related: ["[[GamificationCampaignsProductsIdGET]]", "[[GamificationAdminProductsIdGET]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationCampaignsGET — GET Gamification Campaigns List API
> **Related:** [[GamificationCampaignsProductsIdGET]] · [[GamificationAdminProductsIdGET]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
Public API endpoint to retrieve all gamification campaigns. Returns a list categorized into chips (product type filters), activeCampaigns (ongoing with countDown and sessionId), and inactiveCampaigns (ended campaigns without countDown). No authentication required; X-Account-ID header does not affect the response.

## Key Learnings
- Endpoint is fully public — no authentication or mandatory headers
- Response separates campaigns into active (with countDown, isActive, sessionId) and inactive (without those fields)
- Chips array provides product type filter options (currently HOTEL and FLIGHT)
- No path parameters, no mandatory headers, no query parameters
