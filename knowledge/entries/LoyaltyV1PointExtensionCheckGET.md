---
kind: api
key: "LoyaltyV1PointExtensionCheckGET"
title: "GET Point Extension Check API"
source: "Curl command (API test case)"
action: create-api
date: 2026-06-10
figma: false
tags: [point-extension, check, eligibility, loyalty, api, get, account-id, ctaurl]
keywords: ["point extension", "check", "eligibility", "loyalty", "API", "GET", "account ID", "ctaUrl"]
related: ["[[LoyaltyV1PointExtensionDetailGET]]"]
---

# LoyaltyV1PointExtensionCheckGET — GET Point Extension Check API
> **Related:** [[LoyaltyV1PointExtensionDetailGET]]

## PRD Summary
API endpoint to check if a user is eligible for point extension. Returns a
simplified response compared to the Detail API: only extendablePointAmount,
expiredAt, and ctaUrl for eligible users. Shares the same error handling
patterns as the Detail API for invalid/missing accounts and headers.

## Key Learnings
- Eligible user (accId: 11249) returns SUCCESS with simplified data: extendablePointAmount, expiredAt, ctaUrl
- The Check API response is simpler than Detail API — no fee info, no deals, no infoTabs for eligible users
- Ineligible user (accId: 70717) returns DATA_NOT_FOUND but with the FULL Detail API response structure (including infoTabs) — potential inconsistency worth flagging
- Error responses (RUNTIME_ERROR, USER_PHONE_NUMBER_UNVERIFIED, SYSTEM_ERROR) are identical to the Detail API
- Missing/empty/non-numeric X-Account-Id returns RUNTIME_ERROR
- All mandatory headers cause RUNTIME_ERROR when missing
- Wrong HTTP method returns SYSTEM_ERROR with "Contact our team"
