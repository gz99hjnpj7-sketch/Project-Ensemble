# Ensemble 2 Workflow

Ensemble is a small forecast intelligence terminal. It does **not** try to show every prediction market. It fetches many markets, filters them into a small set of seed events, scores source quality, normalizes contract orientation, and writes one current forecast number per event.

The most important design rule is:

```text
One dashboard row = one clearly defined question.
```

If a source market is merely related but answers a different question, it should not be averaged into the headline. It can be shown as supporting detail only if the UI and composite logic are explicit about that.

## Current Seed Events

The active dashboard is intentionally limited to these five events:

| Slug | Display title | Headline question |
| --- | --- | --- |
| `fed-rate-path` | Federal Reserve Rate Cut Odds | Will there be at least one Fed rate cut in 2026? |
| `us-2026-midterms` | US House Control 2026 | Will Democrats control the House after the 2026 midterms? |
| `us-presidential-2028` | US Presidential Election 2028 | Which broad side is leading for the 2028 US presidential election? |
| `bitcoin-price` | Bitcoin $100k by Dec. 31, 2026 | Will Bitcoin reach $100,000 by December 31, 2026? |
| `frontier-ai-timeline` | OpenAI Frontier Model by Sep. 30, 2026 | Will OpenAI release a new frontier model on or before September 30, 2026? |

Old or experimental clusters must be pruned by seed. The seed script deletes clusters whose slug is not in `seedClusters`.

## System Layers

The system has four layers:

```text
External market APIs
  -> connectors normalize source data
  -> matcher maps source markets to seed events
  -> ingestion persists snapshots, quality, warnings, and match decisions
  -> composite engine computes current forecast values
  -> serving layer reads cached forecasts
  -> Next.js UI renders the dashboard and detail pages
```

Each layer has a narrow job. A later layer should not secretly redo the job of an earlier layer.

## 1. Raw Data And Connectors

Code:

- `ensemble/connectors/types.ts`
- `ensemble/connectors/polymarket/`
- `ensemble/connectors/kalshi/`

The connector layer fetches external market data and converts it into `NormalizedMarketInput`.

Important normalized fields:

| Field | Meaning |
| --- | --- |
| `sourcePlatform` | Source venue, currently mainly `POLYMARKET`. |
| `sourceMarketId` | Stable source ID used for upsert identity. |
| `sourceSlug` | Human-readable source slug when available. |
| `question` | Source market question. |
| `eventTitle` | Parent event title when available. |
| `category` | Coarse category: `POLITICS`, `MACRO`, `CRYPTO`, `WORLD`, `OTHER`. |
| `outcomes` | Outcome names and probabilities from the source. |
| `currentProbability` | Primary probability used by binary markets. |
| `bid`, `ask`, `midpoint` | Market quote fields when available. |
| `volume`, `liquidity` | Market depth/activity fields. |
| `resolutionStatus` | Whether the market is open, closed, resolved, etc. |
| `rawPayload` | Original source object for audit/debugging. |

### Polymarket Fetch Strategy

The Polymarket connector combines three discovery paths:

1. High-volume markets from `/markets`.
2. High-liquidity markets from `/markets`.
3. Topic discovery from `/public-search`.

Topic discovery matters because `/markets?search=...` is not reliable for text search. The connector uses `/public-search` and extracts nested event markets.

The connector currently searches only terms that support the five seed events:

```text
fed
fed rate cuts 2026
how many fed rate cuts in 2026
2026 midterms
balance of power 2026 midterms
house control 2026
presidential election winner 2028
bitcoin reach 100000 2026
openai release frontier model september 30 2026
```

### Connector Quality Rules

The connector should fetch broad enough source candidates, but it should not decide final inclusion. It may skip obvious low-value markets using basic liquidity/volume thresholds:

```text
keep market if:
  liquidity >= MIN_LIQUIDITY
  OR volume >= 100,000
  OR market came from a seed-topic search
```

The precise source inclusion decision happens later, after deterministic matching and quality scoring.

## 2. Matching

Code:

- `ensemble/config/clusters.ts`
- `ensemble/matching/deterministic.ts`
- `ensemble/matching/types.ts`

Matching answers:

```text
Does this source market belong to one of the five seed events?
```

It does **not** compute the final probability. It only maps a source market to a seed cluster and records whether the source contract needs inversion.

### Matching Inputs

The matcher builds one searchable string:

```text
haystack = question + " " + eventTitle + " " + sourceSlug
```

Then it compares the market against every seed cluster of the same category.

### Include And Exclude Rules

Each seed cluster has:

- `includePatterns`: regex patterns that identify valid source market families.
- `excludePatterns`: regex patterns that block noise or related-but-wrong markets.
- `targetMetric`: the exact metric the composite engine should compute.

Matching is conservative:

```text
if any exclude pattern matches:
  do not match this cluster
else:
  count include pattern hits
  match the cluster with the highest positive score
```

Confidence is deterministic:

```text
matchConfidence = min(0.95, 0.70 + 0.08 * includeHitCount)
```

### Inversion Metadata

Some contracts are phrased as the opposite of the target metric.

Examples:

| Target | Source question | Raw source price | Normalized price |
| --- | --- | ---: | ---: |
| At least one Fed cut | Will no Fed rate cuts happen in 2026? | 80% | 20% |
| Democratic House control | Will Republicans control the House? | 19.5% | 80.5% |

The matcher records this as:

```ts
requiresInversion: true
```

The composite engine then uses:

```text
normalizedProbability = 1 - rawProbability
```

This is important because orientation should be attached to the source/cluster relationship, not hardcoded deep inside the math loop.

## 3. Ingestion Process

Code:

- `worker/ingest.ts`
- `ensemble/ingestion/run.ts`
- `ensemble/ingestion/persist.ts`
- `ensemble/ingestion/ingestion-run-log.ts`

Run:

```bash
npm run worker:ingest
```

The ingestion worker is the main process pipeline.

### Full Ingestion Sequence

1. Create an `IngestionRun`.
2. Ensure the five seed clusters exist.
3. Delete stale seed clusters that are no longer active.
4. Clear current cluster memberships and current forecast cache.
5. Fetch markets from enabled connectors.
6. Normalize each source market.
7. Match each fetched market to a seed cluster or leave it unmatched.
8. Upsert the normalized market.
9. Write a market snapshot.
10. Compute and store a quality score.
11. Detect warnings such as large moves, stale markets, or wide spreads.
12. Store a match decision.
13. Store `ClusterMarket` membership for matched markets.
14. Rematch all stored open markets against current seed rules.
15. Recompute composites for affected clusters.
16. Write `CompositeForecast` history.
17. Upsert `ForecastCurrent`, the fast UI cache.
18. Finish the `IngestionRun` with counters and status.

### Why Rematching Exists

Live fetches can be narrow. A market may not appear in the latest fetch but may still be open and relevant.

The rematch step prevents this failure:

```text
latest fetch misses a relevant source
  -> source membership disappears
  -> composite changes only because discovery missed it
```

Instead, after fetching, ingestion rematches all stored open markets so the source set reflects the current seed rules, not only the latest fetch page.

### Ingestion Counters

The run reports:

| Counter | Meaning |
| --- | --- |
| `marketsFetched` | Source markets returned by connectors. |
| `marketsUpserted` | Normalized markets saved/updated. |
| `snapshotsWritten` | Snapshot rows created. |
| `matchDecisionsWritten` | Match audit rows written. |
| `compositesUpdated` | Seed composites recomputed. |
| `warningsWritten` | Signal warnings written. |

A healthy run has:

```text
status = SUCCEEDED
errors = []
compositesUpdated = 5
```

If `compositesUpdated < 5`, inspect which cluster has no memberships or no usable sources.

## 4. Persistence Model

Main database tables:

| Table | Purpose |
| --- | --- |
| `NormalizedMarket` | Latest normalized representation of each source market. |
| `MarketSnapshot` | Historical observed prices and market stats. |
| `MarketQualityScore` | Per-run quality score for a source market. |
| `SignalWarning` | Warnings such as stale or wide-spread source markets. |
| `ForecastCluster` | The five seed events. |
| `ClusterMarket` | Join table from seed event to source market, including `requiresInversion`. |
| `MatchDecision` | Audit trail of matched/unmatched decisions. |
| `CompositeForecast` | Historical composite outputs. |
| `ForecastCurrent` | Current cache used by the UI. |
| `IngestionRun` | Run-level counters and status. |

The UI should read `ForecastCurrent`. It should not recompute composites.

## 5. Quality Scoring

Code:

- `ensemble/quality/score.ts`
- `ensemble/quality/anomalies.ts`

Quality scoring answers:

```text
How trustworthy is this source market as a signal?
```

It is not a truth detector. It does not know whether traders are right. It measures whether the market is liquid, active, fresh, and not too expensive to trade.

### Final Quality Formula

Each source gets component scores from 0 to 100:

```text
liquidityScore
spreadScore
volumeScore
recencyScore
marketAgeScore
```

Then:

```text
rawQuality =
  0.28 * liquidityScore
  + 0.24 * spreadScore
  + 0.22 * volumeScore
  + 0.18 * recencyScore
  + 0.08 * marketAgeScore
  - resolvedPenalty

qualityScore = clamp(round(rawQuality), 0, 100)
```

Where:

```text
resolvedPenalty = 0  if market is OPEN
resolvedPenalty = 25 otherwise
```

Confidence label:

```text
HIGH   if qualityScore >= 75
MEDIUM if qualityScore >= 45 and < 75
LOW    if qualityScore < 45
```

### Liquidity Score

Liquidity uses logarithmic scaling:

```text
liquidityScore =
  clamp(
    round(
      (log10(liquidity) - log10(100))
      / (log10(100000) - log10(100))
      * 100
    ),
    0,
    100
  )
```

Plain English:

- Going from `$100` to `$1,000` liquidity matters a lot.
- Going from `$1,000,000` to `$2,000,000` matters much less.
- This matches prediction-market reality: tiny markets are fragile, but beyond a certain point extra depth is less meaningful.

Examples:

| Liquidity | Approx score | Interpretation |
| ---: | ---: | --- |
| 0 | 0 | No usable depth. |
| 100 | 0 | Bare minimum. |
| 1,000 | 33 | Some activity, still thin. |
| 10,000 | 67 | Usable source. |
| 100,000+ | 100 | Strong depth. |

### Volume Score

Volume also uses logarithmic scaling:

```text
volumeScore =
  logScale(volume, low = 100, high = 250000)
```

Plain English:

- Volume measures whether people are actually trading.
- It protects the system from quiet markets that have a displayed price but little recent conviction.

### Spread Score

Spread is:

```text
spread = max(ask - bid, 0)
```

Score table:

| Spread | Spread score |
| ---: | ---: |
| missing bid/ask | 45 |
| <= 0.01 | 100 |
| <= 0.03 | 85 |
| <= 0.06 | 65 |
| <= 0.10 | 40 |
| > 0.10 | 15 |

Plain English:

- Tight spread means buyers and sellers agree.
- Wide spread means the displayed price may be expensive to trade or unreliable.
- Missing quotes are not fatal, but they get a neutral-low score of 45.

### Recency Score

Recency is based on `lastUpdated`.

| Age of last update | Recency score |
| ---: | ---: |
| <= 1 hour | 100 |
| <= 6 hours | 85 |
| <= 24 hours | 65 |
| <= 72 hours | 35 |
| > 72 hours | 10 |

Plain English:

- A price seen minutes ago is more useful than one not touched for days.
- Stale markets can still be shown, but their weight falls.

### Market Age Score

Very new markets are treated cautiously.

| Market age | Market age score |
| ---: | ---: |
| unknown created time | 70 |
| < 2 hours | 45 |
| < 24 hours | 70 |
| >= 24 hours | 90 |

Plain English:

- Brand-new markets can have unstable prices.
- Mature open markets get a better age score.

### Quality Flags

Flags are short audit labels:

| Flag | Trigger |
| --- | --- |
| `tight spread` | `spreadScore >= 85` |
| `high liquidity` | `liquidityScore >= 70` |
| `low liquidity` | `liquidityScore <= 30` |
| `active volume` | `volumeScore >= 70` |
| `stale market` | `recencyScore <= 35` |
| `not open` | `resolutionStatus !== OPEN` |

Flags are explanatory. They do not directly include or exclude a source.

## 6. Source Inclusion Policy

Code:

- `ensemble/composite/policy.ts`

Policy answers:

```text
Should this source be included in the composite?
```

Current rules:

```text
exclude if probability is missing
exclude if market is not OPEN
exclude if qualityScore < 30
include otherwise
```

Warnings are shown but not used for filtering right now.

Policy output:

```ts
{
  includedMarketIds: string[],
  excludedSources: Array<{ marketId, reason }>,
  confidenceBand: "tight" | "normal" | "wide",
  flags: string[]
}
```

Confidence band is simple:

```text
tight  if 0 sources excluded
normal if 1 source excluded
wide   if 2+ sources excluded
```

This band is not the same as quality confidence. It describes how clean the source set is.

## 7. Composite Math

Code:

- `ensemble/composite/compute.ts`
- `ensemble/composite/persist.ts`

Composite math answers:

```text
Given usable source markets, what is the headline probability?
```

### Step 1: Normalize Source Orientation

For each source:

```text
rawProbability = source.currentProbability

if ClusterMarket.requiresInversion:
  probability = 1 - rawProbability
else:
  probability = rawProbability
```

The source breakdown keeps both:

```text
rawProbability       = original source price
probability          = normalized target probability
orientation          = "Raw contract price" or "Inverted from matched source metadata"
displayQuestion      = source question or source family label
```

### Step 2: Compute Source Weight

For ordinary weighted composites:

```text
weight =
  max(qualityScore / 100, 0.05)
  * max(recencyScore / 100, 0.05)
  * (weightOverride ?? 1)
```

Plain English:

- Higher quality means more weight.
- Fresher markets mean more weight.
- A source never gets exactly zero weight from quality/recency alone; the floor is 0.05.
- Manual overrides can later boost or reduce a source.

### Step 3: Use Target-Specific Composite Rules

Not every seed event should use the same math. Some source families are nested, duplicated, or mutually exclusive.

#### Fed Rate Path

Target:

```text
P(at least one Fed rate cut in 2026)
```

Priority order:

1. If a no-cut binary exists, use its inverted probability.
2. Else if a direct at-least-one-cut binary exists, use it.
3. Else sum the cut-count bucket probabilities.

Mathematically:

```text
if noCutMarket exists:
  composite = 1 - P(no cuts)
else if directCutMarket exists:
  composite = weightedAverage(P(direct cut markets))
else:
  composite = min(1, sum(P(each cut bucket)))
```

Reason:

- The no-cut binary is the clean headline contract.
- Cut-count buckets are useful detail, but they can be less liquid and should not drag down the headline by being averaged with the binary.

#### US House Control 2026

Target:

```text
P(Democrats control the House after the 2026 midterms)
```

Priority order:

1. If direct House-control binaries exist, use their weighted average.
2. Else sum balance-of-power buckets whose outcome has Democratic House.

Mathematically:

```text
if directHouseMarkets exist:
  composite = weightedAverage(P(Democratic House), 1 - P(Republican House))
else:
  composite = min(1, P(D Senate, D House) + P(R Senate, D House))
```

Reason:

- Direct House markets answer the headline question.
- Balance-of-power buckets are useful, but they are sub-buckets and should be fallback/detail, not averaged into the direct headline.

#### Presidential Winner 2028

Target:

```text
Leading broad side probability for the 2028 US presidential election
```

Broad sides:

```text
Democratic
Republican
Other
```

The source market shape matters:

1. Multiple-choice book:
   - Normalize each outcome by the total book percentage.
   - Group outcomes into Democratic, Republican, Other.

2. Separate binary candidate contracts:
   - Treat all candidate Yes prices as one synthetic mutually exclusive book.
   - Group candidate probabilities by side.
   - Normalize by total candidate Yes probability.

For separate binary candidate contracts:

```text
sideProbability(side) =
  sum(P(candidate wins) for candidates in side)
  / sum(P(candidate wins) for all candidate contracts in this source set)
```

Then:

```text
composite = max(sideProbability(Democratic), sideProbability(Republican), sideProbability(Other))
```

The result includes `outcomeBreakdown`, for example:

```json
[
  { "name": "Republican", "probability": 0.447 },
  { "name": "Democratic", "probability": 0.333 },
  { "name": "Other", "probability": 0.220 }
]
```

Reason:

- `max(candidate price)` is wrong because candidates within a party are mutually exclusive but collectively represent party strength.
- Blindly summing duplicate books is also wrong.
- The system normalizes each book first, then aggregates.

#### Bitcoin $100k By Dec. 31, 2026

Target:

```text
P(Bitcoin reaches $100,000 by December 31, 2026)
```

Only the exact $100k-by-Dec-31-2026 market should drive this row. Other Bitcoin thresholds, dips, all-time-high markets, and `$150k` markets are different questions.

#### OpenAI Frontier Model By Sep. 30, 2026

Target:

```text
P(OpenAI releases a new frontier model on or before September 30, 2026)
```

Only the exact OpenAI frontier-model timing market should drive this row. Model leaderboard markets, AGI markets, Claude markets, Gemini markets, and GPT-6 timing markets are different questions.

### Generic Weighted Average Fallback

If no target-specific rule applies:

```text
composite =
  sum(probability_i * weight_i)
  / sum(weight_i)
```

This is safe only when all included markets answer the same headline question.

## 8. Serving And UI

Code:

- `ensemble/serving/read-models.ts`
- `app/page.tsx`
- `app/forecasts/[id]/page.tsx`
- `components/ForecastChart.tsx`

The serving layer reads `ForecastCurrent` and shapes it for the UI.

The dashboard shows:

| Field | Source |
| --- | --- |
| Event title | `ForecastCluster.title` |
| Composite percentage | `ForecastCurrent.compositeProbability` |
| Confidence | `ForecastCurrent.confidence` |
| Quality | `ForecastCurrent.qualityScore` |
| Sources | `ForecastCurrent.sourceCount` |
| Updated | `ForecastCurrent.computedAt` |

The dashboard should explain the number. It should not silently hide source problems.

The source breakdown should answer:

```text
Which markets were included?
What probability did each source contribute after orientation?
What was the source quality?
What weight did it receive?
Were any sources excluded?
```

## 9. Human QA Process

After backend changes, do not stop at tests. Run and inspect the real app.

### Required Commands

```bash
docker compose up -d
npm run prisma:generate
npm run prisma:seed
npm run worker:ingest
npm run dev
```

Verification commands:

```bash
npm test
npm run typecheck
curl -I http://localhost:3000
```

### Database Audit Queries

Check all five rows:

```sql
SELECT
  c.slug,
  c.title,
  COUNT(cm.*) AS memberships,
  fc."sourceCount",
  ROUND((fc."compositeProbability"::numeric) * 100, 1) AS composite_pct,
  fc.confidence,
  fc."qualityScore",
  fc."warningCount"
FROM "ForecastCluster" c
LEFT JOIN "ClusterMarket" cm ON cm."clusterId" = c.id
LEFT JOIN "ForecastCurrent" fc ON fc."clusterId" = c.id
GROUP BY
  c.slug,
  c.title,
  fc."sourceCount",
  fc."compositeProbability",
  fc.confidence,
  fc."qualityScore",
  fc."warningCount"
ORDER BY c.slug;
```

Check actual source questions:

```sql
SELECT
  c.slug,
  nm.question,
  ROUND((nm."currentProbability"::numeric) * 100, 1) AS prob_pct,
  ROUND((mqs.score::numeric), 0) AS quality,
  ROUND((nm.liquidity::numeric), 0) AS liquidity,
  ROUND((nm.volume::numeric), 0) AS volume,
  cm."requiresInversion"
FROM "ClusterMarket" cm
JOIN "ForecastCluster" c ON c.id = cm."clusterId"
JOIN "NormalizedMarket" nm ON nm.id = cm."marketId"
LEFT JOIN LATERAL (
  SELECT score
  FROM "MarketQualityScore"
  WHERE "marketId" = nm.id
  ORDER BY "computedAt" DESC
  LIMIT 1
) mqs ON true
ORDER BY c.slug, nm.question;
```

### QA Questions For Every Event

For each of the five events, ask:

1. Does every included source answer the same headline question?
2. If a source is inverted, is `requiresInversion = true` correct?
3. Is the composite using the right priority rule?
4. Are sub-bucket markets being used only as fallback/detail when a direct binary exists?
5. Is the source count nonzero?
6. Is the composite plausible relative to included source prices?
7. Are there noisy sources from another topic, threshold, date, or category?

If any answer is bad, fix matching rules or composite rules, rerun ingestion, and inspect again.

## 10. Current Healthy Output Shape

A healthy local run should look like this shape, though exact percentages move with live markets:

| Event | Expected source shape |
| --- | --- |
| Fed Rate Path | No-cut binary plus cut-count ladder; headline follows no-cut inversion when present. |
| US House Control 2026 | Democratic/Republican House binaries plus Democratic-House balance buckets; headline follows direct House binaries when present. |
| US Presidential Election 2028 | Candidate winner markets grouped into Democratic, Republican, Other. |
| Bitcoin $100k | One exact $100k-by-Dec-31-2026 market. |
| OpenAI Frontier Model | One exact OpenAI frontier-model-by-Sep-30-2026 market. |

Bad signs:

- More than five events on the dashboard.
- Any event shows `0 included` after successful ingestion.
- Bitcoin row includes `$150k`, `$200k`, dip, or all-time-high markets.
- House row includes standalone Senate-control markets.
- Fed headline averages no-cut binary with low-liquidity ladder buckets.
- Presidential row shows `100%` because `No` outcomes were treated as candidates.
- Category inference classifies `Netherlands` as crypto due to the substring `eth`.

## 11. Development Rules

When changing this system:

1. Write/update tests first for math or matching behavior.
2. Run focused tests.
3. Run ingestion.
4. Audit source questions and composite outputs.
5. Inspect the rendered dashboard.
6. Run full tests and typecheck.

Recommended verification loop:

```bash
npm test -- tests/unit/composite.test.ts tests/unit/matching.test.ts tests/unit/cluster-coverage.test.ts tests/unit/polymarket.test.ts
npm run worker:ingest
npm test
npm run typecheck
curl -I http://localhost:3000
```

The final answer should report:

- Which events have sources.
- Source count per event.
- Composite percentage per event.
- Any source families rejected as noise.
- Test and typecheck results.

## Temporarily Disabled Or Future Work

These are intentionally not active yet:

- Dynamic cluster creation.
- LLM cluster classification.
- LLM synthesis.
- Semantic embedding matching.
- Warning-based source filtering.
- 24-hour move calculations.
- Kalshi production ingestion.

The schema keeps embedding fields and semantic boundaries so these can be added later, but the current MVP should remain deterministic and auditable.
