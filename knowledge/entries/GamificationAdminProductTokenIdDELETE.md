---
kind: api
key: "GamificationAdminProductTokenIdDELETE"
title: "DELETE Gamification Admin Product Token Override API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [gamification, harta-karun, admin, product-token, override-token, objectid, idempotency, ggwp, gatotkaca, ms-gateway, admin-access-token, aat, delete]
keywords: ["gamification", "harta karun", "admin", "product token", "overrideToken", "ObjectId", "idempotency", "ggwp-server", "gatotkaca", "ms-gateway", "admin access token", "aat", "DELETE"]
related: ["[[GamificationAdminProductTokenGET]]", "[[GamificationAdminProductTokenPOST]]", "[[GamificationAdminProductTokenIdGET]]", "[[GamificationAdminProductTokenIdPUT]]", "[[GamificationAdminProductsIdGET]]"]
---

# GamificationAdminProductTokenIdDELETE — DELETE Gamification Admin Product Token Override API
> **Related:** [[GamificationAdminProductTokenGET]] · [[GamificationAdminProductTokenPOST]] · [[GamificationAdminProductTokenIdGET]] · [[GamificationAdminProductTokenIdPUT]] · [[GamificationAdminProductsIdGET]]

## PRD Summary
Admin API that removes a Harta Karun product token override:
`DELETE /ggwp-server/harta-karun/admin/product-token/{id}` through the `gatotkaca`
gateway with an `Authorization: Bearer <aat>` header. No request body. Records to
delete are created via [[GamificationAdminProductTokenPOST]].

## Key Learnings
- Happy path returns HTTP 200 `code=SUCCESS` with
  `data.@type = producttoken.v1.DeleteProductTokenData` and `data.status = true` —
  a different data shape from the read/write endpoints, which return a `ProductToken`
- **Delete is not idempotent.** A second delete of the same id returns HTTP 404
  `product token with id '<value>' not found` rather than a repeat success
- After deletion the record disappears from both the list endpoint and
  [[GamificationAdminProductTokenIdGET]] (404), so it is not exposed as a soft-deleted
  row — but the create endpoint's "active ... already exists" wording still suggests
  the row is retained internally
- Path id validation matches the rest of the family: HTTP 400
  `invalid product token ID format: <value>` for anything that is not a 24-character
  hex ObjectId, HTTP 404 for a valid format that does not exist
- ObjectId lookup is case-insensitive, so an uppercase id deletes the same record
- Percent-encoded path segments are blocked at the gateway with plain-text
  `error: encoded url params` (HTTP 400)
- `DELETE` against the **collection** path (no id) returns plain-text
  `405 method not allowed`
- Auth is checked before the id is resolved, so an unauthenticated delete never
  touches data — gateway 401 with `Authn: Empty token ` or `Authn: Unauthorized`
