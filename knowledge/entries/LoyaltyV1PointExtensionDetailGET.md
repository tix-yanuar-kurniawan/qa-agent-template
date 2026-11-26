---
kind: api
key: "LoyaltyV1PointExtensionDetailGET"
title: "GET Point Extension Detail API"
source: "Curl command (API test case)"
action: create-api
date: 2026-06-10
figma: false
tags: [point-extension, extend-points, loyalty, api, get, account-id, fee, eligible, ineligible, faq, tnc]
keywords: ["point extension", "extend points", "loyalty", "API", "GET", "account ID", "fee", "eligible", "ineligible", "FAQ", "TNC"]
related: []
---

# LoyaltyV1PointExtensionDetailGET — GET Point Extension Detail API

## PRD Summary
API endpoint to fetch point extension detail for a user. Returns extendable
point amount, fee percentage/amount, extended point amount, expiry timestamp,
deals (redeemable items), and info tabs (FAQ + TNC). Behavior varies based on
user eligibility: eligible users get full data, ineligible users get
DATA_NOT_FOUND with null values but still receive FAQ/TNC, guest/unverified
users get USER_PHONE_NUMBER_UNVERIFIED.

## Key Learnings
- Eligible user (accId: 11249) returns SUCCESS with full data including deals and infoTabs
- Ineligible user (accId: 70717) returns DATA_NOT_FOUND but still includes infoTabs (FAQ/TNC)
- Guest user (accId: 0) returns USER_PHONE_NUMBER_UNVERIFIED with null data
- Non-existent/invalid numeric accId (99999999) returns USER_PHONE_NUMBER_UNVERIFIED
- Negative accId (-1) returns USER_PHONE_NUMBER_UNVERIFIED
- Missing/empty/non-numeric X-Account-Id returns RUNTIME_ERROR
- All mandatory headers (X-Channel-Id, X-Store-Id, X-Service-Id, X-Username) cause RUNTIME_ERROR when missing
- Wrong HTTP method (POST/DELETE) returns SYSTEM_ERROR with "Contact our team"
- Fee calculation: feeAmount = extendablePointAmount * feePercentage / 100
- The DATA_NOT_FOUND response still returns feePercentage=0 (not null like other fields)
