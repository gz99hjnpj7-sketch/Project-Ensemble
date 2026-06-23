# Ensemble 2

Ensemble 2 is a focused forecast-market pipeline. It collects prediction-market prices, matches them to a small set of important seed events, combines clean sources into one number, and shows what that number means.

The active seed clusters are:

- US Presidential Election 2028
- Federal Reserve Rate Path
- US 2026 Midterms
- Frontier AI Timeline
- Bitcoin Price Milestones

## Local Run

```bash
npm install
cp .env.example .env
docker compose up -d
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

Seed forecasts use deterministic cluster rules with explicit include and exclude patterns. A matched source is normalized to the cluster's target metric, so inverse contracts such as Republican control or no Fed cuts can contribute to the same displayed number while retaining raw probability and orientation in the audit trail. After each refresh, ingestion rematches the stored open-market universe so a narrow live fetch page does not erase still-relevant source markets.

## Repository Layout

Ensemble 2 is now the main app at the repository root. The previous root version is preserved under `archive/ensemble-v1` for reference only.

## Architecture

See `WORKFLOW.md` for the plain-English layer map.

- Raw data: `ensemble/connectors`
- Matching: `ensemble/matching`
- Processing: `ensemble/quality`, `ensemble/composite`, `ensemble/ingestion`
- Frontend: `app`, `components`, `ensemble/serving`

Temporarily disabled: dynamic cluster creation, LLM classification/synthesis, warning-based composite filters, and move calculations.
