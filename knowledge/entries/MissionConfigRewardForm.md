---
kind: doc
key: "MissionConfigRewardForm"
title: "Mission Config — reward form (surface map)"
source: "Confluence + Jira"
action: knowledge
date: 2026-09-29
figma: true
figma_note: "https://www.figma.com/design/csU8ZwfVQWxyAbu8Ea6ynQ/-SSoT--Loyalty-Dashboard?node-id=6050-31355 — reward-config states; frame 'Reward manual off' (9125:56578) shows toggle OFF with Search campaign ID"
tags: [mission-dashboard, reward-form, surface-map, panel-dweb, rewards-hub, duplicate-mission, campaign-id]
keywords: ["Mission Config", "reward form", "Configure reward manually", "Search campaign ID", "Duplicate mission", "campaign uniqueness", "milestone reward", "draft"]
related: ["[[PLAT-59098]]", "[[PLAT-56234]]"]
---

# Mission Config — reward form (surface map)
> **Why this note exists:** Duplicate also renders this form, and after a change to it
> (PLAT-59098) Duplicate came up with the reward toggle disabled (PLAT-60919).
> Load this note whenever an epic touches the Mission reward form.

## Flows that render or write this form
| Flow | Where | What is known |
| --- | --- | --- |
| Create | `/mission-config/form`, Step 1 (Scheme → Rewards) | Reward Title EN/ID always required |
| Edit / view | `/mission-config/form?code={id}&status={status}` | Selected campaign must be displayed |
| **Duplicate** | Mission List row action ([[PLAT-56234]], PLAT-56233) | Copies every config except Slug, Start Date, End Date. Copy of the campaign / toggle state is **UNKNOWN**. Defect PLAT-60919: toggle disabled on a duplicate |
| Draft save / resume | `isDraft`, `lastStep` in the admin request body | Not documented for the reward toggle — UNKNOWN |
| Milestone reward blocks | One reward block per milestone | Each milestone needs its own campaign |
| Missions created before PLAT-59098 | Existing records | Toggle default for them UNKNOWN |

## Rules on the surface
- **Toggle default conflicts across sources.** Figma frame "Reward manual off" shows OFF
  (campaign search visible); the Panel solution doc says `configureRewardManually`
  defaults to `true` (ON). Check the environment before asserting either.
- **Toggle switching.** ON → OFF clears the manual reward fields and requires a
  `campaignId`; OFF → ON clears `campaignId` and requires Type, Points or Promo, and Quota.
  In campaign mode only `campaignId` is sent.
- **One campaign, one mission or milestone reward.** Enforced on admin create/update, not
  on claim. The dropdown (`GET /tix-mission/api/admin/campaigns/dropdown`) returns only
  campaigns of type `API` that are unused and not yet ended. Rewards Hub campaign records
  hold `used_by` with a unique index on `used_by.id`.
- **In the Mission context only**, an old Promo reward is an already-created GV shared by
  all claimers; under Rewards Hub the GV is generated per claim.

## Open questions
1. Does Duplicate copy or clear the campaign? A copied campaign would already belong to
   another mission.
2. Is a campaign released when its mission is deleted, ended or re-pointed?
3. Does a draft hold the campaign before it is published?
4. What toggle state do pre-existing missions open with?
