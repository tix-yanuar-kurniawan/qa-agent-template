---
kind: api
key: "GamificationAdminProductTokenIdGET"
title: "GET Gamification Admin Product Token By ID API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [gamification, harta-karun, admin, product-token, override-token, objectid, path-parameter, ggwp, gatotkaca, ms-gateway, admin-access-token, aat, get]
keywords: ["gamification", "harta karun", "admin", "product token", "overrideToken", "ObjectId", "path parameter", "ggwp-server", "gatotkaca", "ms-gateway", "admin access token", "aat", "GET"]
related: ["[[GamificationAdminProductTokenGET]]", "[[GamificationAdminProductTokenPOST]]", "[[GamificationAdminProductTokenIdPUT]]", "[[GamificationAdminProductTokenIdDELETE]]", "[[GamificationAdminProductsIdGET]]"]
---

# GamificationAdminProductTokenIdGET — GET Gamification Admin Product Token By ID API
> **Related:** [[GamificationAdminProductTokenGET]] · [[GamificationAdminProductTokenPOST]] · [[GamificationAdminProductTokenIdPUT]] · [[GamificationAdminProductTokenIdDELETE]] · [[GamificationAdminProductsIdGET]]

## PRD Summary
Admin API that retrieves a single Harta Karun product token override by its MongoDB
ObjectId: `GET /ggwp-server/harta-karun/admin/product-token/{id}` through the
`gatotkaca` gateway, with an `Authorization: Bearer <aat>` header.

## Key Learnings
- Happy path returns HTTP 200 `code=SUCCESS` with a single
  `producttoken.v1.ProductToken` object (not an array as on the list endpoint)
- Path parameter validation is a two-stage funnel and the error split matters:
  - **HTTP 400** `invalid product token ID format: <value>` when the id is not a
    24-character hex ObjectId — covers 23-char, 25-char, numeric-only, non-hex
    character and arbitrary strings. The rejected value is echoed back
  - **HTTP 404** `product token with id '<value>' not found` when the format is valid
    but no record exists
- ObjectId lookup is **case-insensitive** — an uppercase id resolves the same record
  and the response echoes the id back in lowercase
- Percent-encoded path segments never reach the service: the gateway returns HTTP 400
  with the plain-text body `error: encoded url params`
- Error message wording differs from the older direct-cluster admin endpoint in
  [[GamificationAdminProductsIdGET]] (`invalid product ID format` / `product not
  found`)
- Auth behaviour is identical to the rest of this endpoint family — gateway 401 with
  `Authn: Empty token ` for absent/unparseable tokens and `Authn: Unauthorized` for a
  well-formed JWT with a bad signature
