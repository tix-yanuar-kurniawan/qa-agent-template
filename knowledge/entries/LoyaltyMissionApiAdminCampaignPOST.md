---
kind: api
key: "LoyaltyMissionApiAdminCampaignPOST"
title: "POST Create Rewards Hub Campaign API (admin)"
source: "Curl command (API)"
action: create-api
date: 2026-11-10
figma: false
tags: [rewards-hub, campaign, admin-api, tix-mission, lb1-testing, loyalty, api, post, gv, gift-voucher, points, reward-quota, validation, campaign-code, slug-collision]
keywords: ["create campaign", "POST /tix-mission/api/admin/campaign", "Rewards Hub Campaign", "rewardGv", "rewardPoint", "rewardQuota", "rewardLimiter", "GV key discount scheme must be INSTANT", "Discount scheme must match the GV key discount type", "Campaign name taken. Please choose a different one.", "Only alphanumeric and spaces are allowed.", "Exceed maximum characters.", "Active date must be in the future.", "You must fill in at least one field (Push Notification, Email, Points, or Gift Voucher)", "Limit by device ID is not allowed for campaign type", "campaign code slug", "lastEdited by 0", "GET /tix-mission/api/admin/campaign?page&limit", "GET /tix-mission/api/admin/campaigns/dropdown"]
related: ["[[PLAT-59098]]", "[[MissionConfigRewardForm]]", "[[PLAT-60525]]", "[[LoyaltyMissionAdminMissionPriorityPATCH]]"]
---

# LoyaltyMissionApiAdminCampaignPOST — POST Create Rewards Hub Campaign API (admin)
> **Related:** [[PLAT-59098]] · [[MissionConfigRewardForm]] · [[PLAT-60525]] · [[LoyaltyMissionAdminMissionPriorityPATCH]]

## PRD Summary
`POST https://lb1-testing.tiket.com/tix-mission/api/admin/campaign` creates a
Rewards Hub campaign: the record a Mission reward (or another trigger) points at
by campaign ID ([[PLAT-59098]], [[MissionConfigRewardForm]]). No PRD was given;
the contract comes from two curls the user supplied (one with a GV reward and one
with a point reward) and from live calls on 2026-11-10.

Body: `name`, `type` (`API` seen; `USER_SEGMENTS` and `BULK_UPLOAD` exist in the
list), `userSegments`, `bulkUploadFile`, `activeDate{isActive,activeAt,endAt}`,
`rewardPoint{isActive,pointType,amount}`,
`rewardGv{isActive,key,title{en,id},discountScheme,amount,percentage,maxDiscount,minTransaction,validityInDays,verticals,tnc{en,id}}`,
`rewardQuota`, `rewardLimiter{isEditable,oncePerAccount,oncePerDevice}`,
`crmPn{isActive,templateCode}`, `crmEmail{isActive,templateCode}`.
Success is `200 {code: SUCCESS, data: true}`, with no id returned. Every
validation failure is `400 BAD_REQUEST` with `errors: ["<field>: <message>"]`,
and several errors can come back at once.

User-supplied GV keys: INSTANT percentage
`4a5e6cdd…0926857c7` (works); CASHBACK `7890dc71…fa68430f` (rejected, as the
user expected).

## Key Learnings

### Validation map (observed)
| Field | Rule |
|---|---|
| `name` | required; letters, digits and spaces only (hyphen rejected); max **150** chars; unique (case- and space-sensitive, see below) |
| `type` | required; must be a known trigger type. An invalid type also triggers `rewardLimiter.oncePerDevice: Limit by device ID is not allowed for campaign type X`, so once-per-device is only allowed for some types |
| `activeDate.activeAt` | must be in the **future**; `endAt` must be after it |
| `activeDate.isActive=false` | accepted; campaign is listed as `Inactive` instead of `Scheduled` |
| rewards | at least one of PN, Email, Points or GV must be active (`snackbar:` error key) |
| `rewardGv.key` | required when GV is active; must exist; must be an **INSTANT** key |
| `rewardGv.discountScheme` | must match the key's own type (PERCENTAGE / AMOUNT) |
| `rewardGv.percentage` | 0 and 101 both return "Enter the percentage." |
| `rewardGv.maxDiscount`, `minTransaction`, `validityInDays` | 0 rejected |
| `rewardGv.title.en/.id` | each required, with one error per locale |
| `rewardGv.verticals` | at least one is required, but **values are not validated** |
| `rewardPoint.amount` | 0 and negative rejected |
| `rewardPoint.pointType` | required, but **values are not validated** |
| `crmPn.templateCode` | required when PN is active |
| `rewardQuota` | **not validated**: 0 and -1 are both accepted |
| headers | **none enforced**: missing X-Account-Id, X-Username, X-Store-Id, X-Channel-Id, X-Service-Id or Accept-Language all still return 200 |

### Findings worth raising
- **Campaign code collision.** The list `code` is a lowercase slug of the name,
  but the name-taken check is exact-match. `QA API point 101013`,
  `qa api point 101013` and ` QA API point 101013 ` were all accepted, and all
  three got the same code, `qa-api-point-101013`. If anything resolves a campaign
  by code (edit, Mission campaign search), it is ambiguous. `GET /campaign/{code}`
  returns 405, so the edit route probably keys on it.
- **Unvalidated enums reach storage.** `pointType: "INVALID"` and
  `verticals: ["NOTAVERTICAL"]` save successfully, so the failure only appears
  later at injection time.
- **Quota 0 and negative quota are accepted.** The list renders 0 as `-`, which
  might mean "unlimited", and -1 as `-1/-1`. This is undocumented. A quota of 0 may
  mean unlimited rather than exhausted, which matters for [[PLAT-59098]]'s
  quota-exhaustion behaviour.
- **Audit loses the editor without X-Account-Id.** `lastEdited` reads
  `by <X-Account-Id>`. When the header is missing or empty it reads `by 0`.
  X-Username is not what gets displayed.
- **The percentage upper bound has no message of its own.** 101% returns the
  same "Enter the percentage." as an empty value.
- **Error messages ignore Accept-Language.** `id` and `en` both return English.

### Practical notes
- **Read-back route:** `GET /tix-mission/api/admin/campaign?page=1&limit=100`
  (both params are required; without them you get 400 with an `strconv.Atoi`
  leak). It returns `code`, `name`, `type`, `period`, `quota` (as **HTML spans**),
  `status` and `lastEdited`. `GET /tix-mission/api/admin/campaigns/dropdown`
  is the Mission-form picker from [[MissionConfigRewardForm]].
