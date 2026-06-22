# Project Ensemble: Future News

Project Ensemble is a multi-market forecast intelligence terminal. This MVP ships one connector, Polymarket, while keeping the schema, ingestion path, scoring, and UI source-aware for future Kalshi and Manifold connectors.

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

## Keeping Changes in Sync with GitHub

This project is **not** automatically synced to GitHub.

### Recommended: VS Code Source Control panel

1. Open the **Source Control** sidebar (left icon or `Ctrl+Shift+G`).
2. Review your changes.
3. Write a commit message and click **Commit**.
4. Click **Sync Changes** (cloud icon) — this commits + pushes in one step.

### Occasional manual sync from terminal

```bash
npm run git:sync
```

In GitHub Codespaces, `git push` works without extra authentication thanks to the built-in credential helper.

The `.gitignore` already protects `.env`, `node_modules`, `.next`, etc. Commit frequently with clear messages when possible.
