---
kind: api
key: "GamificationAdminProductTokenPOST"
title: "POST Gamification Admin Create Product Token Override API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [gamification, harta-karun, admin, product-token, override-token, producttype, inventoryid, ggwp, gatotkaca, ms-gateway, admin-access-token, aat, post]
keywords: ["gamification", "harta karun", "admin", "product token", "overrideToken", "productType", "inventoryId", "ggwp-server", "gatotkaca", "ms-gateway", "admin access token", "aat", "POST"]
related: ["[[GamificationAdminProductTokenGET]]", "[[GamificationAdminProductTokenIdGET]]", "[[GamificationAdminProductTokenIdPUT]]", "[[GamificationAdminProductTokenIdDELETE]]", "[[GamificationAdminProductsIdGET]]"]
---

# GamificationAdminProductTokenPOST — POST Gamification Admin Create Product Token Override API
> **Related:** [[GamificationAdminProductTokenGET]] · [[GamificationAdminProductTokenIdGET]] · [[GamificationAdminProductTokenIdPUT]] · [[GamificationAdminProductTokenIdDELETE]] · [[GamificationAdminProductsIdGET]]

## PRD Summary
Admin API that creates a Harta Karun product token override. `POST` to
`/ggwp-server/harta-karun/admin/product-token` through the `gatotkaca` gateway with
a JSON body of `productType`, `inventoryId`, `inventoryName`, `overrideToken` and an
`Authorization: Bearer <aat>` header. The service returns the created
`producttoken.v1.ProductToken` including its generated MongoDB ObjectId.

## Key Learnings
- Happy path returns HTTP 200 `code=SUCCESS` with the created record and a fresh
  24-character hex `id`
- **Uniqueness rule:** only one *active* override may exist per `productType` +
  `inventoryId` pair. A repeat create returns HTTP 400 with
  `active product token override already exists for productType '<x>' and inventoryId '<y>'`.
  This makes the happy path non-repeatable unless the record is deleted first — the
  wording "active" suggests deleted rows are retained but excluded
- Field rules discovered by execution:
  - `productType` — **required**, validated against an enum. `TTD` and `HOTEL` both
    accepted; anything else returns `invalid productType: <value>`
  - `inventoryId` — **required**; an empty string is treated as missing
  - `inventoryName` — **optional**. Omitting it still returns 200 and the response
    simply has no `inventoryName` key
  - `overrideToken` — must be **greater than 0**. Missing, `0` and negative all fail
    with the same `overrideToken must be greater than 0`, because a missing value
    defaults to 0
- **Lenient type coercion:** `"overrideToken":"100"` (numeric string) is accepted and
  stored as the number `100` rather than rejected — worth flagging with the team
- Validation short-circuits at the first failure in the order
  `productType` → `inventoryId` → `overrideToken`, so an empty `{}` body reports only
  `productType is required`
- Malformed JSON and a completely absent body both return HTTP 400
  `invalid request payload` before field validation runs
- Auth behaves exactly as on [[GamificationAdminProductTokenGET]] — gateway-level 401
  with `Authn: Empty token ` vs `Authn: Unauthorized`
