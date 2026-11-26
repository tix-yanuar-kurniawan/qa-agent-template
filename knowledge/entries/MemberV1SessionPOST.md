---
kind: api
key: "MemberV1SessionPOST"
title: "POST Member v1 Session API"
source: "Curl command (API)"
action: create-api
date: 2026-09-08
figma: false
tags: [member, session, tix-member-session, access-token, refresh-token, cookie, x-audience, request-context, api, post]
keywords: ["member session", "tix-member-session", "accessToken", "refreshToken", "session_access_token", "session_refresh_token", "X-Audience", "RequestContext", "storeId", "channelId", "Cookie"]
related: ["[[PLAT-57795]]"]
---

# MemberV1SessionPOST — POST Member v1 Session API
> **Related:** [[PLAT-57795]]

## PRD Summary
`POST /tix-member-session/v1/session` on `https://lb1-ms.preprod.tiket.com`
creates or returns a member session. Cookie is optional: with no
`session_access_token` / `session_refresh_token` the API mints a new JWT pair;
when **both** cookie names are present, `data.accessToken` and
`data.refreshToken` echo the cookie values as-is. Mandatory headers are
`X-Audience`, `storeId`, `channelId`, `serviceId`, and `username`.
`X-Account-Id` is optional and ignored. `accept` and `requestId` are out of
scope.

## Key Learnings
- Echo requires **both** cookie names. Either cookie omitted (or an unrelated
  cookie) mints a new pair; the leftover cookie is not returned as-is.
- Echo does **not** validate JWT shape. Garbage values (`invalid`) and empty
  strings are passed through into `data.accessToken` / `data.refreshToken`.
- `X-Audience` missing/empty is a dedicated Spring error ("Required request
  header 'X-Audience'..."). `storeId`, `channelId`, `serviceId`, and `username`
  share one RequestContext error ("Missing request attribute 'mandatory' of
  type RequestContext"); empty equals missing for all of them.
- `X-Account-Id` is unused: missing, empty, non-numeric, and `0` all succeed
  and do not change the echoed or minted tokens.
- Newly minted tokens (no-cookie / single-cookie paths) change on every call.
