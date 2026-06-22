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

## Keeping Changes in Sync with GitHub

**This project is NOT automatically synced** to GitHub. File edits (including in Codespaces) are local until you commit and push.

### Quick manual sync (recommended)

```bash
npm run git:sync
```

This stages everything, creates a timestamped commit if needed, and pushes.

### Near-automatic watching

While developing, run this in a second terminal:

```bash
npm run git:watch
```

It uses `inotifywait` to watch `app/`, `lib/`, `components/`, etc. and will auto-sync after you stop typing for a few seconds.

### In VS Code / Codespaces (easiest for most people)

1. Open the **Source Control** sidebar (left icon or `Ctrl+Shift+G`).
2. Review your changes.
3. Write a message and click **Commit**.
4. Click **Sync Changes** (or the cloud icon) — this does commit + push in one step.

In GitHub Codespaces, `git push` works with zero extra authentication thanks to the built-in credential helper.

### Tips
- The `.gitignore` already protects `.env`, `node_modules`, `.next`, etc.
- Commit frequently with clear messages when possible.
- The watcher is optional — many developers prefer manual control via the VS Code UI.
