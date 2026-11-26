---
kind: api
key: "GamificationAdminProductTokenGET"
title: "GET Gamification Admin Product Token List API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [gamification, harta-karun, admin, product-token, override-token, ggwp, gatotkaca, ms-gateway, admin-access-token, aat, bearer, get]
keywords: ["gamification", "harta karun", "admin", "product token", "overrideToken", "ggwp-server", "gatotkaca", "ms-gateway", "admin access token", "aat", "Bearer", "GET"]
related: ["[[GamificationAdminProductTokenPOST]]", "[[GamificationAdminProductTokenIdGET]]", "[[GamificationAdminProductTokenIdPUT]]", "[[GamificationAdminProductTokenIdDELETE]]", "[[GamificationAdminProductsIdGET]]"]
---

# GamificationAdminProductTokenGET — GET Gamification Admin Product Token List API
> **Related:** [[GamificationAdminProductTokenPOST]] · [[GamificationAdminProductTokenIdGET]] · [[GamificationAdminProductTokenIdPUT]] · [[GamificationAdminProductTokenIdDELETE]] · [[GamificationAdminProductsIdGET]]

## PRD Summary
Admin API that lists every Harta Karun product token override. Called through the
`gatotkaca.tiket.com/ms-gateway` gateway at
`/ggwp-server/harta-karun/admin/product-token`. It takes no path parameters, no
query parameters and no body — the only request-side dimension is the
`Authorization: Bearer <aat>` header.

Per the requester's note, admin login issues two tokens: a `session_access_token`
that acts as the B2C token, and an `aat` (admin access token) that is the one this
API expects.

## Key Learnings
- Happy path returns HTTP 200 `code=SUCCESS` with `data` as an array of overrides,
  each carrying `id`, `productType`, `inventoryId`, `inventoryName`, `overrideToken`
- The gateway, not the service, enforces auth — every rejection is HTTP 401
  `code=UNAUTHORIZED` and the body shape differs from the service's `status/code/error`
  envelope
- Two distinct 401 messages, and the split is diagnostic:
  - `Authn: Empty token ` — no header, empty header, `Bearer ` with no value, a
    non-JWT string, a 2-segment JWT, a token without the `Bearer` prefix, and a
    lowercase `bearer` scheme
  - `Authn: Unauthorized` — a well-formed 3-segment JWT whose signature fails
    (tampered signature, edited `accountid` claim, characters appended)
- The `Bearer` scheme keyword is **case-sensitive**; the `Authorization` header
  **name** is case-insensitive as normal HTTP
- Query parameters are ignored — `?productType=TTD` returns the unfiltered list, so
  the endpoint has no filtering or pagination
- A trailing slash on the collection path falls through to the tiket.com homepage
  HTML rather than the API (gateway routing artifact)
- `DELETE` on the collection path returns plain-text `405 method not allowed`
- Percent-encoded path segments are blocked by the gateway with plain-text
  `error: encoded url params` (HTTP 400)

