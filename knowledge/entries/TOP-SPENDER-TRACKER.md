---
kind: doc
key: "TOP-SPENDER-TRACKER"
title: "Top Spender Program - Event Tracking"
source: "File (PDF attachment)"
action: create
date: 2026-06-08
figma: false
tags: [top-spender, gamification, leaderboard, challenges, campaign, loyalty, tracking, pagevisit, gamecontent, participant, non-participant, bottom-nav, badge, claim, history, idr-currency]
keywords: ["top spender", "gamification", "leaderboard", "challenges", "campaign", "loyalty", "tracking", "pageVisit", "gameContent", "participant", "non-participant", "bottom nav", "badge", "claim", "history", "IDR currency"]
---

# TOP-SPENDER-TRACKER — Top Spender Program - Event Tracking

## PRD Summary
The Top Spender Program is a gamification campaign for tiket.com that tracks user engagement across multiple pages: landing page (with states for non-login, login/non-IDR, participant, and non-participant users), challenge page, leaderboard page, and history page. The document specifies event tracking requirements for all user interactions including page visits, button clicks, impressions, and CTA actions.

## Key Learnings
- The program has 4 distinct user states that determine page content: non-login, login with non-IDR currency, participant (joined), and non-participant
- All events share common parameters: vertical=loyalty, screenOwner=loyalty, campaignName=topSpender
- The bottom navigation bar has 4 tabs: Partner, Product, FAQ, T&C — available to both participants and non-participants
- Non-IDR currency users are blocked with a "change currency" prompt (gameError screen)
- Challenge page has both click events (CTAs) and impression events (completed challenges count, badge pop-ups)
- The History page tracks earning points via impression events
