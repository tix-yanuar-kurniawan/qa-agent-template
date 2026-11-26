---
kind: api
key: "GamificationCampaignsProductsIdGET"
title: "GET Gamification Campaigns Products By ID API"
source: "Curl command (Queue UI)"
action: create-api
date: 2026-06-16
figma: false
tags: [gamification, harta-karun, campaigns, products, productid, objectid, ggwp, get, public-endpoint]
keywords: ["gamification", "harta karun", "campaigns", "products", "productId", "ObjectId", "ggwp", "GET", "public endpoint"]
related: ["[[GamificationAdminProductsIdGET]]", "[[GamificationCampaignsGET]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationCampaignsProductsIdGET — GET Gamification Campaigns Products By ID API
> **Related:** [[GamificationAdminProductsIdGET]] · [[GamificationCampaignsGET]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
Public API endpoint to retrieve a specific product campaign by its productId. Returns product details including roomId, sessionId, productType, title, subtitle, token cost, image URL, priceSettings, countDown timer, viewsCount, and isEnabled status. No authentication required.

## Key Learnings
- Endpoint is fully public — no headers required at all (accept header is optional)
- productId is a MongoDB ObjectId (24 hex characters) but the API gracefully handles any format
- Invalid/nonexistent productId returns `{"status":"FAILED","code":"FAILED","error":"Product campaign not found"}`
- Empty productId (trailing slash) returns 404 page not found (resolves to different route)
- Each successful request increments viewsCount
