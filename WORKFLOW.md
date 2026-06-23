# Ensemble 2 Workflow

Ensemble turns prediction-market prices into a small set of readable forecast pages. For now, it intentionally focuses on a few important seed clusters instead of trying to classify everything.

## The Four Layers

### 1. Raw Data

This layer collects market data from external sources.

- Code: `ensemble/connectors/`
- Today: Polymarket is the useful source; Kalshi is still a placeholder boundary.
- Output: normalized market records with question text, price, liquidity, volume, close date, and raw source payload.

No composites are calculated here. This layer only fetches and cleans source data.

### 2. Matching

This layer decides whether a market belongs to one of the active seed clusters.

- Code: `ensemble/matching/`
- Active seed clusters:
  - US Presidential Election 2028
  - Federal Reserve Rate Path
  - US 2026 Midterms
  - Frontier AI Timeline
  - Bitcoin Price Milestones
- Matching is deterministic only. A market must hit explicit seed hints.

Temporarily disabled:

- Dynamic cluster creation
- LLM classification
- LLM synthesis
- Generic fallback matching from cluster title words

Embedding fields remain in the schema so semantic matching can be added later behind a clear boundary.

### 3. Processing

This layer turns matched source markets into composites.

- Code: `ensemble/quality/`, `ensemble/composite/`, `ensemble/ingestion/`
- Quality scores consider liquidity, spread, volume, recency, and market age.
- Composite percentages are weighted by quality and recency.
- Closed markets, missing prices, and very low quality sources are excluded.

Temporarily disabled:

- Warning-based filtering
- 24-hour move calculations

Warnings may still be stored and shown as context, but they do not decide which sources count in the composite right now.

### 4. Frontend

This layer shows the current forecast cache. It should explain the number, not recompute it.

- Code: `app/`, `components/`, `ensemble/serving/`
- Main view: event name, composite percentage, confidence, quality, source count.
- Each event includes an expandable source breakdown explaining which markets contributed to the number.
- Detail pages show the chart and source audit trail.

## Ingestion Path

Run:

```bash
npm run worker:ingest
```

The worker does this:

1. Ensure only the active seed clusters exist.
2. Fetch source markets.
3. Match each market to an explicit seed cluster or leave it unclustered.
4. Save market snapshots and match decisions.
5. Recompute composites for affected seed clusters.
6. Update `ForecastCurrent`, the fast cache used by the UI.

## What Good Looks Like

The MVP is healthy when:

- `npm run worker:ingest` finishes without errors.
- The five seed clusters show either sensible composites or clearly say no usable source markets exist yet.
- The dashboard makes it obvious what each percentage means.
- Unmatched low-value markets do not create new clusters or pollute the main forecast list.
