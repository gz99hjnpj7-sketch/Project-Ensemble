# Ensemble: Future News Workflow

This document describes the current deterministic MVP architecture after the pipeline refactor.

## High-Level Data Flow

```mermaid
flowchart TD
    A[Trigger: npm run worker:ingest] --> B[lib/ingestion/run.ts]
    B --> C[lib/connectors/registry.ts]
    C --> D[PolymarketConnector]
    C --> E[KalshiConnector]
    D --> F[NormalizedMarketInput]
    E --> F
    F --> G[Persist NormalizedMarket + MarketSnapshot rawPayload]
    G --> H[lib/forecast/quality.ts]
    G --> I[lib/forecast/anomalies.ts]
    G --> J[lib/processing/matcher.ts deterministic seed matching]
    J --> K[ClusterMarket]
    B --> L[recomputeClusterForecasts]
    L --> M[lib/forecast/composite.ts]
    M --> N[CompositeForecast history]
    M --> O[ForecastCurrent cache]
    O --> P[lib/forecast/read-models.ts]
    P --> Q[app/page.tsx forecast terminal]
    P --> R[app/forecasts/[id]/page.tsx detail view]
```

## Layer Responsibilities

### Raw Data Layer

- `lib/connectors/` fetches source markets only.
- Connectors return `NormalizedMarketInput`.
- `lib/ingestion/run.ts` stores current market state in `NormalizedMarket`.
- Each observation writes a `MarketSnapshot` with the raw source payload for traceability.
- Each connector pass writes an `IngestionRun` with counts, status, errors, and timestamps.

### Processing And Cache Layer

- `lib/processing/matcher.ts` maps markets to seed clusters with deterministic rules.
- Unmatched markets remain unclustered; the MVP does not create dynamic AI clusters.
- `lib/forecast/quality.ts` scores liquidity, spread, volume, recency, and market age.
- `lib/forecast/anomalies.ts` creates warnings for large moves, low-liquidity moves, wide spreads, and stale markets.
- `lib/forecast/composite.ts` computes the cluster composite and source breakdown.
- `lib/processing/cache.ts` writes `ForecastCurrent`, the denormalized current forecast cache used by the app.

### Frontend And API Layer

- `lib/forecast/read-models.ts` reads cached forecast rows and detail audit data.
- `app/page.tsx` shows the fast forecast terminal.
- `app/forecasts/[id]/page.tsx` shows composite history and source-market breakdown.
- API routes return the same cached read models.
- The frontend and API do not run ingestion, matching, or composite calculation.

## AI Extension Point

Gemini and pgvector are not part of the current runtime. `lib/semantic/provider.ts` keeps a tiny provider interface with a `NullSemanticProvider` so a future AI matcher can be added behind a boundary without changing connectors, cache reads, or the UI contract.
