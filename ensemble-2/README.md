# Ensemble 2

Ensemble 2 is a forecast-market pipeline organized around four product jobs:

1. Collect prices from external prediction markets.
2. Match markets that ask the same real-world question.
3. Combine matched prices into one composite number with explicit quality policy.
4. Serve the current number fast with an audit trail.

## Local Run

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## Data Refresh

```bash
npm run worker:ingest
```

The ingestion worker creates an `IngestionRun`, writes market snapshots, records match decisions including unmatched markets, recomputes composite forecasts, and updates the derived `ForecastCurrent` cache.

## Architecture

- `ensemble/connectors`: Collect and normalize source markets.
- `ensemble/ingestion`: Orchestrate fetch -> persist -> match -> recompute.
- `ensemble/matching`: Conservative deterministic matching plus a disabled semantic provider interface.
- `ensemble/quality`: Quality scores and anomaly warnings.
- `ensemble/composite`: Explicit policy and composite persistence.
- `ensemble/serving`: Fast read models and cache rebuild checks.
