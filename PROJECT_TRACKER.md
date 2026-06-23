# Future News App Project Tracker

Last updated: 2026-06-23

This is the active product tracker for the Future News / Ensemble app. It should **not** be archived. Keep this file current whenever the product goal, version status, roadmap, data pipeline, or quality bar changes.

## 1. Product Vision

The goal is to build a **future news app**.

Instead of showing only normal news about what already happened, the app should show important possible future events and explain how likely they are, how those odds are changing, and why the signal is trustworthy.

At its core:

```text
Future News = prediction-market data + source quality + event synthesis + readable news-style presentation
```

The final app should answer questions like:

- What important future events are markets pricing right now?
- What changed since yesterday, last week, or last month?
- Which sources moved the forecast?
- Is the forecast built on strong liquid markets or weak noisy markets?
- What is the plain-English future-news headline?
- What would make this forecast change?

The product should feel like a news terminal for the future:

```text
"Fed cut odds rise after inflation print"
"Markets now price Democrats as favorites for House control"
"Bitcoin $100k odds fall as crypto liquidity thins"
"OpenAI frontier model release odds jump before September deadline"
```

## 2. Final Goal Definition

The final goal is not just a table of prediction-market prices. The final goal is a synthesized future-news system.

### Final Product Requirements

| Area | Final requirement |
| --- | --- |
| Data coverage | Multiple prediction-market sources, including Polymarket, Kalshi, and later other markets if useful. |
| Event discovery | Automatically discover important future events, not only hand-seeded clusters. |
| Event clustering | Group many related source markets into one coherent future event. |
| Source quality | Score each market by liquidity, spread, volume, recency, age, status, and anomalies. |
| Probability normalization | Convert all source prices into the same semantic direction before combining them. |
| Composite math | Use correct math per event type: binary, ladder, mutually exclusive winner, threshold, date bucket, etc. |
| Change detection | Show 24h, 7d, 30d movement and explain which source caused movement. |
| News synthesis | Generate readable future-news headlines and summaries from market movement and source context. |
| Auditability | Every composite must show its source markets, weights, quality, exclusions, and orientation. |
| UI | Dashboard, event detail pages, source audit trail, movement chart, explanation cards, filters, and search. |
| Reliability | Repeatable ingestion, durable run logs, tests, schema migrations, and clear QA checks. |
| Trust | The user should know exactly why a number is shown and when not to trust it. |

## 3. Current Status Summary

Current version: **V1.2 - Deterministic Five-Event Forecast Terminal**

Milestone state:

```text
V0 is archived.
V1.2 is the current active baseline.
V1.3 is in progress.
```

Current estimated progress toward final product: **roughly 24% achieved**

This percentage is a rough planning signal, not a mathematical truth. It should help answer "what state are we in?" but should not become a target to optimize directly.

```text
Current system has a real working pipeline and audited composites,
but it is still narrow, deterministic, and not yet a full future-news synthesis app.
```

Tracking convention:

```text
Use achieved percent as a directional product-health estimate.
Do not treat it as a precise KPI.
Do not chase the number at the expense of product coherence.
```

### Progress Score Breakdown

| Area | Weight toward final | Current completion | Weighted progress |
| --- | ---: | ---: | ---: |
| Data ingestion | 15% | 45% | 6.75% |
| Event matching/clustering | 15% | 30% | 4.50% |
| Source quality engine | 15% | 70% | 10.50% |
| Composite math | 15% | 45% | 6.75% |
| Change detection | 10% | 5% | 0.50% |
| News synthesis | 15% | 0% | 0.00% |
| UI/product experience | 10% | 30% | 3.00% |
| Operations/reliability | 5% | 35% | 1.75% |

Weighted total: roughly **24% to 34%**, depending on how much credit is given to the existing backend. For tracking discipline, use the conservative label:

```text
Official current progress band: about 24%
```

## 4. Version History

### Version Management Rule

Use this rule for all future versions:

```text
archive/ = old abandoned architectures or major historical snapshots
git commits = normal daily progress
git tags = completed milestone versions
PROJECT_TRACKER.md = human-readable product memory
```

Do not copy the full app into `archive/` for V1.1, V1.2, V1.3, etc. Those versions should live in the active codebase and be recorded through commits, tags, tests, and tracker updates.

When starting a new version:

1. Keep working in the current codebase.
2. Change the roadmap status from `Next` to `In progress`.
3. Work until the version acceptance criteria pass.
4. Then mark the old version as superseded and the new version as current.
5. Optionally add a git tag for the completed milestone.

Current convention:

```text
V0 = archived prototype in archive/ensemble-v1
V1.2 = current active baseline in repo root
V1.3 = next milestone to start after this baseline
```

### V0 - Prototype / Archived Root Version

Date range: before 2026-06-23

Status: Archived under `archive/ensemble-v1`.

What it achieved:

- Proved a forecast-market dashboard idea could work.
- Had early connector, forecast, and chart concepts.
- Helped identify the need for better source filtering and clearer workflow boundaries.

Limitations:

- Not the active architecture.
- Too broad and less auditable.
- Kept for reference only.

Approx final-goal progress at the time: **8%**

### V1.0 - Clean Root App Reset

Date: 2026-06-22 to 2026-06-23

Status: Superseded by V1.1/V1.2

What it achieved:

- Moved Ensemble 2 into the repo root.
- Established the current Next.js app, Prisma schema, and worker structure.
- Created basic ingestion, matching, quality scoring, composite computation, and dashboard rendering.
- Focused the app on a limited set of seed clusters instead of uncontrolled dynamic event creation.

Limitations:

- Some local DB schema drift existed.
- Some source matching was too broad or too narrow.
- Some composites mixed related-but-different markets.

Approx final-goal progress: **15%**

### V1.1 - Quality, Matching, And Composite Corrections

Date: 2026-06-23

Status: Superseded by V1.2

What it achieved:

- Added durable inversion metadata with `ClusterMarket.requiresInversion`.
- Moved inversion away from hardcoded composite logic.
- Improved Fed ladder math so the no-cut binary headline controls the Fed composite when available.
- Replaced dangerous presidential `max()` logic with mutually exclusive side aggregation.
- Added tests for composite math, matching behavior, and persistence metadata.

Limitations:

- Some event definitions were still too broad.
- Polymarket topic discovery was initially using an unreliable search path.
- Some dashboard rows still had bad or missing sources until live QA was performed.

Approx final-goal progress: **20%**

### V1.2 - Five-Event Source-Audited Terminal

Date: 2026-06-23

Status: Current active baseline. This is the version to preserve as the reference point before starting V1.3.

What it achieved:

- Fixed Polymarket discovery to use `/public-search` for topic discovery.
- Pruned dashboard to exactly five current seed events.
- Fixed seed cleanup so stale clusters do not remain in the active app.
- Tightened the five event definitions so one row means one clear question.
- Fixed crypto category false-positive matching such as `Netherlands` containing `eth`.
- Added working source inclusion for all five events.
- Added live QA loop: ingest, inspect source questions, inspect composite values, fix bad math/rules, rerun.
- Expanded `WORKFLOWV2.md` into a detailed operating guide.

Current event state after live ingestion:

| Event | Current headline | Sources | Current composite |
| --- | --- | ---: | ---: |
| US House Control 2026 | Democrats control House after 2026 midterms | 4 | about 81% |
| US Presidential Election 2028 | Leading broad side for 2028 winner markets | 33 | about 45% |
| Federal Reserve Rate Cut Odds | At least one Fed cut in 2026 | 13 | about 20% |
| Bitcoin $100k by Dec. 31, 2026 | Bitcoin reaches $100k by Dec. 31, 2026 | 1 | about 14% |
| OpenAI Frontier Model by Sep. 30, 2026 | OpenAI releases frontier model by Sep. 30, 2026 | 1 | about 97% |

Approx final-goal progress: **24%**

V1.2 baseline criteria:

- App is in the repo root, not copied to `archive/`.
- V0 remains archived under `archive/ensemble-v1`.
- Dashboard is scoped to exactly five active seed events.
- Ingestion can produce five updated composites.
- Each of the five current events has at least one included source.
- Current source/composite math has been manually QA'd against the dashboard.
- Tests and typecheck had passed at the time this baseline was recorded.

## 5. Current Architecture

Current pipeline:

```text
Polymarket / future source APIs
  -> connector fetches and normalizes source markets
  -> deterministic matcher maps source markets to one of five seed events
  -> ingestion persists market snapshots, quality scores, warnings, and match decisions
  -> composite engine computes one current probability per event
  -> ForecastCurrent cache stores the latest forecast
  -> Next.js dashboard renders event rows and source counts
```

Main code areas:

| Area | Files |
| --- | --- |
| App UI | `app/`, `components/` |
| Serving/read models | `ensemble/serving/` |
| Connectors | `ensemble/connectors/` |
| Matching | `ensemble/matching/`, `ensemble/config/clusters.ts` |
| Quality scoring | `ensemble/quality/` |
| Composite math | `ensemble/composite/` |
| Ingestion | `ensemble/ingestion/`, `worker/` |
| Database | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` |
| Tests | `tests/unit/` |
| Operating guide | `WORKFLOWV2.md` |

## 6. Current Strengths

- Real live ingestion exists.
- Polymarket integration works.
- Current app has five clear seed events.
- Source quality score is mathematically sensible.
- Matching is deterministic and auditable.
- Inversion is stored on the cluster-market join table.
- Composite math handles important special cases:
  - Fed no-cut binary vs cut-count ladder.
  - House direct binary vs balance-of-power buckets.
  - Presidential mutually exclusive candidate/party grouping.
- UI shows current forecast rows.
- Tests exist for quality, matching, composite math, anomalies, charts, and persistence.

## 7. Current Weaknesses

- The app is not yet a true future-news synthesis product.
- It has only five seed events.
- No automatic event discovery.
- Lightweight deterministic future-news headlines exist, but no LLM summarization or deeper narrative synthesis exists yet.
- No real cross-market synthesis beyond Polymarket.
- Kalshi is present as a connector boundary but is currently parked. It should not be treated as an active signal until it either produces useful equivalent markets or is explicitly removed from the enabled source path.
- Basic movement display exists, but true 24h/7d/30d values require enough comparable future runs.
- Source-level movement exists on detail pages, but driver explanations are still basic.
- Polymarket has basic retry/backoff and query-level diagnostic logging; production monitoring is still missing.
- Some local DB schema drift required manual catch-up during development.
- The dashboard is functional but still more terminal/table than polished news product.
- No production deployment or monitoring.

## 8. Roadmap Overview

### Version Roadmap

| Version | Target | Status | Rough target progress |
| --- | --- | --- | ---: |
| V1.2 | Five-event source-audited terminal | Current baseline | 24% |
| V1.3 | Movement tracking, connector reliability, and first headline MVP | In progress | 32% |
| V1.4 | Event detail pages, source audit UI, and lightweight story cards | Planned | 38% |
| V2.0 | Multi-source prediction-market ingestion and Kalshi decision | Planned | 48% |
| V2.5 | Dynamic event discovery and clustering | Planned | 60% |
| V3.0 | Full future-news synthesis layer | Planned | 72% |
| V3.5 | Personalized future-news dashboard | Planned | 80% |
| V4.0 | Production-grade reliability and public beta | Planned | 90% |
| V5.0 | Full future-news intelligence platform | Final goal | 100% |

## 9. Step-By-Step Plan From Current To Final

### Step 1 - Stabilize The Current Five Events

Target version: V1.3

Goal:

```text
Make the current five rows reliable enough that each can be trusted daily.
```

Tasks:

- Keep exactly five active seed events.
- Make seed cleanup part of normal seed/migration flow.
- Ensure `npm run worker:ingest` returns `SUCCEEDED`.
- Ensure all five events have nonzero source counts.
- Add a repeatable DB reset/dev bootstrap script.
- Add tests for each seed event source family.
- Add tests for each seed event composite rule.
- Add an audit command that prints event, sources, quality, and composite.
- Add a simple health endpoint or worker status card.
- Add basic Polymarket connector retry/backoff.
- Log per-query connector failures so partial ingestion does not look fully healthy.

Acceptance criteria:

- `compositesUpdated = 5`.
- Dashboard shows five rows.
- No row has `0 included` after successful ingestion.
- Each included source answers the exact headline question or is clearly supporting fallback detail.

Current progress: **85% of this step**

### Step 2 - Add Change Tracking

Target version: V1.3

Goal:

```text
Show how future-news odds changed over time.
```

Needed additions:

- Store enough snapshots to compute movement reliably.
- Compute:
  - 24h change.
  - 7d change.
  - 30d change.
  - source-level movement.
- Add movement fields to `ForecastCurrent` or a derived read model.
- Show movement on dashboard.
- Show movement chart on detail page.

Basic formulas:

```text
move24h = currentComposite - compositeClosestTo(now - 24h)
move7d  = currentComposite - compositeClosestTo(now - 7d)
move30d = currentComposite - compositeClosestTo(now - 30d)
```

For source contribution:

```text
sourceMove = currentSourceProbability - previousSourceProbability
weightedImpact = sourceMove * sourceWeight
```

Acceptance criteria:

- Each event shows current probability and at least 24h movement.
- Detail page shows historical composite chart.
- User can see which source moved most.

Current progress: **45% of this step**

### Step 3 - Add Lightweight Future-News Headlines

Target version: V1.3/V1.4

Goal:

```text
Show what the product wants to become before the full synthesis engine exists.
```

This is not the full V3.0 synthesis layer. It is a narrow, source-backed headline pass for the five current events.

Needed additions:

- Generate one short future-news headline per current event.
- Use deterministic templates first, based on:
  - current composite probability.
  - 24h/7d movement when available.
  - event type.
  - strongest source or source family.
  - composite quality/confidence.
- Cache generated headline text so the UI is stable between requests.
- Label headline text as market-implied, not factual news.
- Avoid external causal claims unless there is a source-backed reason.

Example template logic:

```text
if abs(move24h) >= significantMoveThreshold:
  "{Event label} odds {rise/fall} to {probability}%"
else:
  "{Event label} holds near {probability}%"
```

Example outputs:

```text
"Fed cut odds hold near 20% as the no-cut contract remains the main signal"
"Markets price Democrats as favorites for 2026 House control"
"OpenAI frontier-model odds remain high before the September deadline"
```

Acceptance criteria:

- Each of the five current events has one headline.
- Each headline can be traced to composite probability and source basis.
- The headline does not claim real-world causality that the app has not verified.
- Full LLM synthesis remains deferred until V3.0.

Current progress: **60% of this step**

### Step 4 - Improve The Event Detail Page

Target version: V1.4

Goal:

```text
Each event page should explain what the number means and why it moved.
```

Needed additions:

- Clear event headline question.
- Composite chart.
- Source list with:
  - raw probability.
  - normalized probability.
  - quality score.
  - weight.
  - inversion flag.
  - source URL.
  - inclusion/exclusion reason.
- Outcome breakdown for winner markets.
- Detail explanations for special math:
  - Fed binary priority.
  - House binary priority.
  - Presidential side aggregation.

Acceptance criteria:

- A new user can understand why the event says 20%, 81%, etc.
- Every source row answers: "why is this included?"
- Excluded sources are visible or at least countable.

Current progress: **25% of this step**

### Step 5 - Add More Prediction Market Sources

Target version: V2.0

Goal:

```text
Synthesize across multiple prediction-market venues, not only Polymarket.
```

Needed additions:

- Decide whether Kalshi should be reactivated or removed from the active connector path.
- If reactivated, make Kalshi minimally useful for equivalent seed-event markets.
- If not reactivated, keep Kalshi clearly parked in code and docs so it does not confuse ingestion QA.
- Normalize Kalshi equivalent markets.
- Create source-platform-specific quote handling.
- Compare same-event prices across venues.
- Avoid double counting duplicate books from different platforms.
- Add platform diversity to quality scoring.

Possible source weighting idea:

```text
platformAdjustedWeight =
  qualityWeight
  * recencyWeight
  * platformReliabilityWeight
  * duplicateBookAdjustment
```

Acceptance criteria:

- At least two platforms contribute to at least two seed events.
- Source audit shows platform-by-platform differences.
- Composite handles duplicate event books safely.

Current progress: **10% of this step**

### Step 6 - Dynamic Event Discovery

Target version: V2.5

Goal:

```text
The app should discover important future events instead of relying only on five seed rows.
```

Needed additions:

- Candidate event discovery from high-volume/high-liquidity markets.
- Event clustering from related questions.
- Embedding or LLM-assisted semantic matching.
- Human-review queue for new clusters.
- Guardrails to prevent noisy/low-value event creation.

Possible cluster creation rule:

```text
create candidate cluster if:
  sourceCount >= 3
  AND totalLiquidity >= threshold
  AND topicImportanceScore >= threshold
  AND not blocked by noise rules
```

Important design gap:

```text
topicImportanceScore is not defined yet.
Do not build dynamic discovery until this scoring method is explicit.
```

Possible inputs for topic importance:

- total liquidity and volume.
- number of independent source markets.
- platform diversity.
- category priority, such as macro, politics, AI, crypto, world events.
- user demand or watchlist interest.
- event deadline proximity.
- whether the question is broad public-interest news or narrow market trivia.
- exclusion rules for low-value noise.

Acceptance criteria:

- New relevant events appear in a review queue.
- App does not flood the dashboard with random sports/celebrity/noise events.
- Every dynamic cluster has a clear headline question.

Current progress: **5% of this step**

### Step 7 - Full Future-News Synthesis

Target version: V3.0

Goal:

```text
Turn market changes into readable future-news stories beyond the lightweight headline MVP.
```

Needed additions:

- Generate concise headlines.
- Generate event summaries.
- Explain probability movement.
- Identify likely drivers from source movement and external context.
- Separate factual market movement from model interpretation.
- Add citations/source links.
- Build on the V1.3/V1.4 headline MVP instead of starting from scratch.

Example future-news output:

```text
Headline:
Fed cut odds edge higher as no-cut market weakens.

Summary:
Prediction markets now imply roughly a 20% chance of at least one Fed cut in 2026.
The main signal comes from the no-cut contract, whose price fell from 84% to 80%.

Source basis:
- Polymarket no-cut binary, high quality, inverted into at-least-one-cut odds.
- Cut-count ladder used as supporting detail only.
```

Acceptance criteria:

- Every event has a generated future-news headline.
- Every headline includes a source-backed reason.
- UI clearly labels generated interpretation vs raw market data.

Current progress: **0% of this step**

### Step 8 - User Experience And Personalization

Target version: V3.5

Goal:

```text
Let users track the future events they care about.
```

Needed additions:

- Category filters.
- Watchlist.
- Alerts for probability changes.
- Saved topics.
- "Why changed?" cards.
- Search across events and source markets.

Acceptance criteria:

- User can follow events.
- User can see the biggest movers.
- User can filter by politics, macro, crypto, AI, world, etc.

Current progress: **10% of this step**

### Step 9 - Production Reliability

Target version: V4.0

Goal:

```text
Make the system reliable enough for regular external users.
```

Near-term note:

```text
Do not wait until V4.0 for the minimum reliability needed by today's app.
Basic connector retry/backoff and failure logging belong in V1.3.
V4.0 is for production-grade operations, scheduling, monitoring, and recovery.
```

Needed additions:

- Deployment environment.
- Scheduled worker.
- Database backups.
- Migration discipline.
- Error monitoring.
- Connector rate-limit handling.
- Source API fallback behavior.
- Admin/debug page for ingestion runs.
- Reproducible local bootstrap.

Acceptance criteria:

- Ingestion runs on a schedule without manual intervention.
- Failed connector requests do not break the full app.
- Schema migrations work from scratch.
- App has a clear operational dashboard.

Current progress: **15% of this step**

## 10. Quality Standards

This project should use strict quality standards because bad composite math can create fake confidence.

### Source Quality Standard

A source is strong when:

- It is open.
- It has current probability.
- It has strong liquidity.
- It has real trading volume.
- It has tight spread.
- It was updated recently.
- It answers the exact headline question.

### Composite Quality Standard

A composite is strong when:

- Every included source answers the same semantic question.
- Inverted markets are explicitly marked.
- Related sub-buckets are not averaged into headline binaries unless used as fallback.
- Winner/candidate markets are treated as mutually exclusive books.
- Duplicate books are normalized before aggregation.
- The UI can explain the result.

### App Quality Standard

The app is healthy when:

- Five current events render.
- Every event has nonzero sources after ingestion.
- Source count and source audit match database state.
- The headline percentage is plausible from sources.
- Tests pass.
- Typecheck passes.
- `npm run worker:ingest` succeeds.

## 11. Budget And Cost Planning

Current estimated operating cost for local development:

| Cost area | Current status | Notes |
| --- | --- | --- |
| Database | Local Docker Postgres | No cloud cost yet. |
| Hosting | Local only | No production hosting yet. |
| Prediction market APIs | Free/public for now | May need rate-limit handling later. |
| LLM synthesis | Not active | Future cost once summarization/classification starts. |
| Monitoring | Not active | Future cost for production. |

Future monthly cost estimate:

| Stage | Expected monthly range | Why |
| --- | ---: | --- |
| Local MVP | $0-$20 | Mostly local dev. |
| Private hosted beta | $25-$150 | App host, managed Postgres, scheduled worker. |
| LLM synthesis beta | $100-$500 | Event summaries, classification, embedding/matching. |
| Public product | $500+ | Higher ingestion frequency, monitoring, backups, traffic, LLM usage. |

Budget decisions needed later:

- How often should ingestion run?
- How many events should be tracked?
- Should LLM synthesis run every ingest or only on significant changes?
- Should summaries be cached?
- Should premium APIs be used?

## 12. Progress Update Template

Use this section format when updating the project.

```markdown
## Progress Update - YYYY-MM-DD

Version:

Achieved percent:

What changed:
- ...

What now works:
- ...

What is still broken:
- ...

Source/composite QA:
- Event:
- Sources:
- Composite:
- Verdict:

Tests run:
- ...

Next step:
- ...
```

## 13. Current Next Actions

Highest-priority next actions:

1. Add dashboard movement fields: 24h and 7d change.
2. Add basic Polymarket retry/backoff and per-query failure logging.
3. Add first future-news headline generation for the five current events.
4. Improve detail pages so every source can be inspected clearly.
5. Add an ingestion audit command/script that prints the five-event source table.
6. Make database migrations clean from an empty database.
7. Turn current manual QA SQL into a repeatable test or script.
8. Explicitly park/disable Kalshi in code/docs or schedule a minimal Kalshi reactivation spike.
9. Define `topicImportanceScore` before building dynamic discovery.

## 14. Definition Of Done For Final Product

Final product is done when:

- The app discovers and tracks important future events automatically.
- It synthesizes multiple prediction markets into clear future-news items.
- It explains probability changes over time.
- It shows source quality and confidence clearly.
- It produces readable headlines and summaries.
- It is reliable enough to run continuously.
- It is useful to a user who wants to understand what markets believe about the future.

Until then, every version should make one of these things more true.
