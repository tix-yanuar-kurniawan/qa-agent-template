---
kind: api
key: "UNMV1EntityRegistrationSubmitPOST"
title: "POST UNM v1 Entity Registration Submit API"
source: "Curl command (API)"
action: create-api
date: 2026-08-12
figma: false
tags: [unm, entity-registration, registration-submit, user-management, api, post, x-client-id, tiket-partner, phone-validation, email-validation]
keywords: ["UNM", "entity registration", "registration submit", "user management", "API", "POST", "X-Client-Id", "TIKET_PARTNER", "phone validation", "email validation", "isNewUser"]
related: []
---

# UNMV1EntityRegistrationSubmitPOST — POST UNM v1 Entity Registration Submit API

## PRD Summary
`POST /gks-unm-go-be/api/v1/entity/registration/submit` on
`https://service.bliblitiket.tools` registers a user into the Unified User
Management (UNM) service on behalf of a calling entity. The caller identifies
itself with the `X-Client-Id` header; the JSON body carries `email`, `name`,
`phoneCountryCode`, `phoneNationalNumber` and `type`.

On success the API returns the resolved user profile — `userId`, name, email,
normalised phone, `preferredLanguage`, verification flags, `fdsId`, an
`entityId` map (`tiket` / `blibli` / `ranch`) and `isNewUser`. When the email
already exists the same account is returned with `isNewUser=false`; a new email
creates the account and returns `isNewUser=true`.

## Key Learnings
- `X-Client-Id` is the only auth-ish header. Missing, empty, or unregistered
  all return HTTP 400 `CLIENT_NOT_FOUND`, and client validation runs **before**
  payload validation.
- All five body fields are mandatory. Empty string is treated the same as
  missing (`"Email is required"`, `"Name is required"`, etc.) — an empty value
  never reaches format validation.
- Validation is **sequential, not aggregated**: an empty `{}` body reports only
  `"Type is required"`, so callers cannot rely on getting every error at once.
- Invalid email format is the odd one out — it returns
  `{"code":"BAD_REQUEST","message":"invalid email","errors":null}`, using
  `message` instead of the `errors` array that the required-field checks use.
- `phoneCountryCode` accepts both `+62` and `62`; the leading `+` is stripped
  before the max-length check and the response always echoes the code without
  the `+`. `+9999` is rejected with "must be less than 4 characters".
- `phoneNationalNumber` needs at least 5 characters and must be numeric —
  letters give "must be in the correct format", short values give
  "must be at least 5 characters".
- `type` is a strict, case-sensitive enum. The error message enumerates the
  accepted values: `TIKET_PARTNER`, `MOLA`, `DEKORUMA_PARTNER`,
  `BLIBLIPOCKET_PARTNER`, `PARTNER_VERIFICATION`, `BLIBLI_COBRAND_PARTNER`,
  `TIKET_AFF_PARTNER`, `BCA_COBRAND_PARTNER`.
- **Potential defect:** a malformed JSON body returns HTTP 500
  `INTERNAL_SERVER_ERROR` rather than a 400 — an unparseable payload is a
  client error and should not surface as a server error.
- The endpoint is stateful: the "new email" happy path only reproduces with a
  fresh email, and `userId` differs on every run.
