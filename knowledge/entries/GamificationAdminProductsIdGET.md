---
kind: api
key: "GamificationAdminProductsIdGET"
title: "GET Gamification Admin Product By ID API"
source: "Curl command (API) — QAAUT-36260"
action: create-api
date: 2026-06-15
figma: false
tags: [gamification, harta-karun, admin, product, productid, objectid, ggwp, get]
keywords: ["gamification", "harta karun", "admin", "product", "productId", "ObjectId", "ggwp", "GET"]
related: ["[[GamificationHartaKarunTokenV1RateGET]]", "[[GamificationHartaKarunPlayerConsentPUT]]", "[[TOP-SPENDER-TRACKER]]"]
---

# GamificationAdminProductsIdGET — GET Gamification Admin Product By ID API
> **Related:** [[GamificationHartaKarunTokenV1RateGET]] · [[GamificationHartaKarunPlayerConsentPUT]] · [[TOP-SPENDER-TRACKER]]

## PRD Summary
Admin API endpoint to retrieve a single Harta Karun product by its MongoDB ObjectId. No mandatory auth headers in the base curl. Path parameter `productId` must be a valid 24-character hex ObjectId.

## Key Learnings
- Valid productId returns HTTP 200 with `code=SUCCESS` and `AdminProduct` data
- Invalid format (wrong length, non-hex, special chars, numeric-only, very long) returns HTTP 400 with `invalid product ID format`
- Valid ObjectId format but non-existent product returns HTTP 404 with `product not found`
- Missing productId (trailing slash only) returns HTTP 404 plain text `404 page not found`
- Uppercase hex ObjectId is accepted and returns the same product (case-insensitive lookup)
- No auth headers required in preprod for this endpoint
