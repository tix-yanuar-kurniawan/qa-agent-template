---
kind: api
key: "GamificationAdminProductTokenIdPUT"
title: "PUT Gamification Admin Update Product Token Override API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [gamification, harta-karun, admin, product-token, override-token, objectid, full-replace, uniqueness, ggwp, gatotkaca, ms-gateway, admin-access-token, aat, put]
keywords: ["gamification", "harta karun", "admin", "product token", "overrideToken", "ObjectId", "full replace", "uniqueness", "ggwp-server", "gatotkaca", "ms-gateway", "admin access token", "aat", "PUT"]
related: ["[[GamificationAdminProductTokenGET]]", "[[GamificationAdminProductTokenPOST]]", "[[GamificationAdminProductTokenIdGET]]", "[[GamificationAdminProductTokenIdDELETE]]", "[[GamificationAdminProductsIdGET]]"]
---

# GamificationAdminProductTokenIdPUT — PUT Gamification Admin Update Product Token Override API
> **Related:** [[GamificationAdminProductTokenGET]] · [[GamificationAdminProductTokenPOST]] · [[GamificationAdminProductTokenIdGET]] · [[GamificationAdminProductTokenIdDELETE]] · [[GamificationAdminProductsIdGET]]

## PRD Summary
Admin API that updates an existing Harta Karun product token override:
`PUT /ggwp-server/harta-karun/admin/product-token/{id}` through the `gatotkaca`
gateway with the same JSON body shape as the create endpoint. This is the widest
endpoint of the family — it combines the path-parameter dimension of
[[GamificationAdminProductTokenIdGET]] with the body-validation dimension of
[[GamificationAdminProductTokenPOST]].

## Key Learnings
- Happy path returns HTTP 200 `code=SUCCESS` with the updated `ProductToken`
- **PUT is a full replace, not a partial patch.** Omitting the optional
  `inventoryName` still returns 200 but wipes the stored value — the response comes
  back without the field. This is the highest-value finding on this endpoint and the
  easiest way to lose data through the admin panel
- **The uniqueness rule is enforced on update too.** Repointing a record onto a
  `productType` + `inventoryId` pair that already has an active override returns
  HTTP 400 `active product token override already exists for productType '<x>' and
  inventoryId '<y>'` — the same guard as create
- PUT does **not** upsert: a well-formed but non-existent id returns HTTP 404
  `product token with id '<value>' not found` rather than creating the record
- Path id validation runs **before** body validation, so an invalid id returns the
  format error even when the body is also invalid
- Body rules are identical to create — `productType` required and enum-validated,
  `inventoryId` required, `inventoryName` optional, `overrideToken` must be greater
  than 0 — and the same lenient string-to-number coercion applies to `overrideToken`
- Malformed JSON returns HTTP 400 `invalid request payload`
- Auth behaves as elsewhere in the family: gateway 401, `Authn: Empty token ` vs
  `Authn: Unauthorized`
