# Future News

Future News is a multi-market forecast intelligence terminal. This MVP ships one connector, Polymarket, while keeping the schema, ingestion path, scoring, and UI source-aware for future Kalshi and Manifold connectors.

## Stack

- Next.js App Router + TypeScript
- Postgres + Prisma
- Scheduled TypeScript ingestion worker
- Recharts dashboard visualizations
- Vitest unit and component tests

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run worker:ingest
npm run dev
```

Open `http://localhost:3000`.

## Workers

- `npm run worker:ingest` runs one ingestion pass.
- `npm run worker:schedule` runs immediately and then every `INGEST_INTERVAL_MINUTES`, defaulting to 30 minutes.

The Polymarket connector uses public Gamma and CLOB read endpoints only. There are no trading, wallet, authenticated, or AI provider flows in v1.
