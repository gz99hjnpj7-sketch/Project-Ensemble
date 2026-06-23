# Source Filtering and Clustering Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand forecast clustering and source inclusion so the dashboard numbers use more vetted relevant markets for each seed topic, with auditable normalization and explicit noise filters instead of overly narrow literal matching.

**Architecture:** Replace one-dimensional `deterministicHints` with explicit cluster rules that separate candidate matching, exclusion, and probability orientation. Composite computation will consume normalized source probabilities and preserve the raw market probability plus the display target. Tests will lock in the expected broader source coverage for midterms, Fed rates, Bitcoin, and known false positives.

**Tech Stack:** Next.js 15, TypeScript, Prisma/Postgres, Vitest.

---

## File Structure

- Modify `ensemble/config/clusters.ts`: add rule metadata per seed cluster: `includePatterns`, `excludePatterns`, `targetMetric`, and optional `orientationRules`.
- Modify `ensemble/matching/deterministic.ts`: score markets with regex/text rules instead of substring-only hints.
- Modify `ensemble/composite/compute.ts`: replace hard-coded Fed/House normalization with reusable orientation from cluster/source metadata.
- Modify `ensemble/composite/persist.ts`: pass cluster context into composite computation.
- Modify `ensemble/ingestion/run.ts`: load seeded clusters with their rule metadata and keep reset behavior.
- Modify `ensemble/serving/read-models.ts`: expose raw/source normalized fields consistently.
- Modify `tests/unit/matching.test.ts`: encode broader cluster coverage and false-positive guards.
- Modify `tests/unit/composite.test.ts`: encode Fed ladder, House/Senate/balance-of-power, and Bitcoin orientation rules.
- Add `tests/unit/cluster-coverage.test.ts`: fixture-level tests asserting expected source counts from representative market titles.
- Update `README.md` and `WORKFLOW.md`: describe the new matching/filtering policy.

---

### Task 1: Introduce Explicit Cluster Rule Types

**Files:**
- Modify: `ensemble/config/clusters.ts`
- Test: `tests/unit/matching.test.ts`

- [ ] **Step 1: Write the failing tests for broader seed intent**

Replace the Senate-blocking test in `tests/unit/matching.test.ts` with these tests:

```ts
it("matches Senate control into the broad 2026 midterms cluster", () => {
  const result = matchDeterministically(
    {
      question: "Will the Republican Party control the Senate after the 2026 Midterm elections?",
      eventTitle: "Which party will win the Senate in 2026?",
      sourceSlug: null,
      category: ForecastCategory.POLITICS
    },
    [{ id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" }]
  );
  expect(result.kind).toBe("matched");
  if (result.kind === "matched") expect(result.clusterId).toBe("midterms");
});

it("matches balance-of-power outcomes into the 2026 midterms cluster", () => {
  const result = matchDeterministically(
    {
      question: "2026 Balance of Power: D Senate, R House",
      eventTitle: "Balance of Power: 2026 Midterms",
      sourceSlug: "balance-of-power-2026-midterms-d-senate-r-house",
      category: ForecastCategory.POLITICS
    },
    [{ id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" }]
  );
  expect(result.kind).toBe("matched");
});

it("matches Fed cut ladder outcomes into the Fed rate path cluster", () => {
  const result = matchDeterministically(
    {
      question: "Will 6 Fed rate cuts happen in 2026?",
      eventTitle: "How many Fed rate cuts in 2026?",
      sourceSlug: "will-6-fed-rate-cuts-happen-in-2026",
      category: ForecastCategory.MACRO
    },
    [{ id: "fed", slug: "fed-rate-path", category: ForecastCategory.MACRO, title: "Federal Reserve Rate Cut Odds", description: "Fed cuts" }]
  );
  expect(result.kind).toBe("matched");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/unit/matching.test.ts
```

Expected: the new Senate, balance-of-power, and Fed ladder tests fail with `unmatched` under the current literal hints.

- [ ] **Step 3: Replace the seed cluster shape**

Update `ensemble/config/clusters.ts` types:

```ts
export type ClusterRule = {
  includePatterns: RegExp[];
  excludePatterns?: RegExp[];
  targetMetric: "democratic-congress-control-2026" | "at-least-one-fed-cut-2026" | "presidential-winner-2028" | "frontier-ai-release" | "bitcoin-upside-2026";
};

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  rule: ClusterRule;
};
```

Use these rules for the two problematic clusters:

```ts
{
  slug: "fed-rate-path",
  title: "Federal Reserve Rate Cut Odds",
  category: ForecastCategory.MACRO,
  description: "Whether the Fed cuts rates in 2026. Cut-count ladder markets are included and normalized.",
  rule: {
    targetMetric: "at-least-one-fed-cut-2026",
    includePatterns: [
      /\bfed(?:eral reserve)?\b.*\brate cuts?\b.*\b2026\b/i,
      /\bhow many fed rate cuts in 2026\b/i,
      /\bwill \d+ fed rate cuts happen in 2026\b/i,
      /\bwill 12 or more fed rate cuts happen in 2026\b/i,
      /\bno fed rate cuts happen in 2026\b/i
    ],
    excludePatterns: [/\bfedex\b/i, /\brate hike\b/i, /\bupper bound\b/i, /\blower bound\b/i]
  }
},
{
  slug: "us-2026-midterms",
  title: "US 2026 Midterms",
  category: ForecastCategory.POLITICS,
  description: "Which party controls Congress after the 2026 midterm elections.",
  rule: {
    targetMetric: "democratic-congress-control-2026",
    includePatterns: [
      /\b2026\b.*\bmidterm/i,
      /\bwhich party will win the (house|senate) in 2026\b/i,
      /\bcontrol the (house|senate) after the 2026 midterm/i,
      /\bbalance of power:\s*2026 midterms\b/i,
      /\b2026 balance of power:/i
    ],
    excludePatterns: [/\bprimary\b/i, /\bnominee\b/i, /\bgovernor(ship)?\b/i, /\bexactly \d+ senate seats\b/i]
  }
}
```

- [ ] **Step 4: Update the matcher to use the rule**

In `ensemble/matching/deterministic.ts`, replace `hintsBySlug` and `blockedHintsBySlug` with a rules map:

```ts
const rulesBySlug = new Map(seedClusters.map((cluster) => [cluster.slug, cluster.rule]));
```

Use this matching function:

```ts
function scoreRule(haystack: string, rule: { includePatterns: RegExp[]; excludePatterns?: RegExp[] }) {
  if (rule.excludePatterns?.some((pattern) => pattern.test(haystack))) return { score: 0, reason: "Excluded by cluster guardrail" };
  const hits = rule.includePatterns.filter((pattern) => pattern.test(haystack));
  return { score: hits.length, reason: hits[0] ? `Matched rule: ${hits[0].source}` : "No deterministic seed rules matched this market." };
}
```

Then select the cluster with the highest positive score and return confidence:

```ts
confidence: Math.min(0.95, 0.7 + best.score * 0.08)
```

- [ ] **Step 5: Run tests and verify matching passes**

Run:

```bash
npm test -- tests/unit/matching.test.ts
```

Expected: all matching tests pass, including the FedEx and nominee false-positive guards.

---

### Task 2: Normalize Source Probabilities by Target Metric

**Files:**
- Modify: `ensemble/composite/compute.ts`
- Modify: `ensemble/composite/persist.ts`
- Test: `tests/unit/composite.test.ts`

- [ ] **Step 1: Write failing composite tests for current bad assumptions**

Add these tests to `tests/unit/composite.test.ts`:

```ts
it("combines House, Senate, and balance-of-power markets into Democratic Congress control", () => {
  const result = computeCompositeForecast(
    [
      { marketId: "d-house", sourcePlatform: "POLYMARKET", question: "Will the Democratic Party control the House after the 2026 Midterm elections?", probability: 0.82, qualityScore: 96, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "r-house", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the House after the 2026 Midterm elections?", probability: 0.20, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "d-senate", sourcePlatform: "POLYMARKET", question: "Will the Democratic Party control the Senate after the 2026 Midterm elections?", probability: 0.43, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "r-senate", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the Senate after the 2026 Midterm elections?", probability: 0.57, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "d-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: D Senate, D House", probability: 0.43, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "r-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: R Senate, D House", probability: 0.37, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
    ],
    { targetMetric: "democratic-congress-control-2026" }
  );
  expect(result.sourceBreakdown.filter((source) => source.included)).toHaveLength(6);
  expect(result.sourceBreakdown.find((source) => source.marketId === "r-house")?.probability).toBeCloseTo(0.8);
  expect(result.compositeProbability).toBeGreaterThan(0.5);
});

it("includes Fed cut ladder markets while normalizing to at-least-one-cut probability", () => {
  const result = computeCompositeForecast(
    [
      { marketId: "no-cuts", sourcePlatform: "POLYMARKET", question: "Will no Fed rate cuts happen in 2026?", probability: 0.8, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "six-cuts", sourcePlatform: "POLYMARKET", question: "Will 6 Fed rate cuts happen in 2026?", probability: 0.0035, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "twelve-plus", sourcePlatform: "POLYMARKET", question: "Will 12 or more Fed rate cuts happen in 2026?", probability: 0.0035, qualityScore: 80, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
    ],
    { targetMetric: "at-least-one-fed-cut-2026" }
  );
  expect(result.sourceBreakdown.filter((source) => source.included)).toHaveLength(3);
  expect(result.sourceBreakdown.find((source) => source.marketId === "no-cuts")?.probability).toBeCloseTo(0.2);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/unit/composite.test.ts
```

Expected: TypeScript/test failure because `computeCompositeForecast` has no second options argument and because hard-coded normalization does not cover Senate/balance-of-power.

- [ ] **Step 3: Add composite options**

In `ensemble/composite/compute.ts`, add:

```ts
export type CompositeOptions = {
  targetMetric?: "democratic-congress-control-2026" | "at-least-one-fed-cut-2026" | "presidential-winner-2028" | "frontier-ai-release" | "bitcoin-upside-2026";
};
```

Change the signature:

```ts
export function computeCompositeForecast(inputs: CompositeInput[], options: CompositeOptions = {}): CompositeResult {
```

- [ ] **Step 4: Replace `standardizeInput` with target-aware orientation**

Use this function body:

```ts
function standardizeInput(input: CompositeInput, options: CompositeOptions): CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string } {
  const rawProbability = input.probability;
  if (input.probability === null) return { ...input, rawProbability, displayQuestion: input.question, orientation: "Raw contract price" };
  const question = input.question.toLowerCase();

  if (options.targetMetric === "at-least-one-fed-cut-2026") {
    if (question.includes("no fed rate cuts")) {
      return { ...input, rawProbability, probability: 1 - input.probability, displayQuestion: "At least one Fed rate cut in 2026", orientation: "Inverted from raw No-cuts contract" };
    }
    if (/will \d+ fed rate cuts happen in 2026|will 12 or more fed rate cuts happen in 2026/.test(question)) {
      return { ...input, rawProbability, displayQuestion: "Specific Fed cut-count outcome in 2026", orientation: "Raw cut-count ladder contract" };
    }
  }

  if (options.targetMetric === "democratic-congress-control-2026") {
    if (question.includes("republican party control the house after the 2026") || question.includes("republican party control the senate after the 2026")) {
      return { ...input, rawProbability, probability: 1 - input.probability, displayQuestion: "Democratic control side of 2026 Congress market", orientation: "Inverted from Republican-control contract" };
    }
    if (question.includes("democratic party control the house after the 2026") || question.includes("democratic party control the senate after the 2026")) {
      return { ...input, rawProbability, displayQuestion: "Democratic control side of 2026 Congress market", orientation: "Raw Democratic-control contract" };
    }
    if (/2026 balance of power:\s*d senate,\s*d house/i.test(input.question) || /2026 balance of power:\s*r senate,\s*d house/i.test(input.question)) {
      return { ...input, rawProbability, displayQuestion: "Democratic House side of 2026 balance-of-power market", orientation: "Raw balance-of-power outcome with Democratic House" };
    }
    if (/2026 balance of power:\s*d senate,\s*r house/i.test(input.question) || /2026 balance of power:\s*r senate,\s*r house/i.test(input.question)) {
      return { ...input, rawProbability, probability: 1 - input.probability, displayQuestion: "Democratic House side of 2026 balance-of-power market", orientation: "Inverted balance-of-power outcome with Republican House" };
    }
  }

  return { ...input, rawProbability, displayQuestion: input.question, orientation: "Raw contract price" };
}
```

Call it with:

```ts
const normalizedInputs = inputs.map((input) => standardizeInput(input, options));
```

- [ ] **Step 5: Pass cluster target metric from persistence**

In `ensemble/composite/persist.ts`, when calling `computeCompositeForecast`, derive the seed cluster by slug:

```ts
const seedCluster = seedClusters.find((seed) => seed.slug === cluster.slug);
const result = computeCompositeForecast(inputs, { targetMetric: seedCluster?.rule.targetMetric });
```

- [ ] **Step 6: Run composite tests**

Run:

```bash
npm test -- tests/unit/composite.test.ts
```

Expected: all composite tests pass.

---

### Task 3: Add Coverage Tests for Source Counts

**Files:**
- Add: `tests/unit/cluster-coverage.test.ts`

- [ ] **Step 1: Create representative market fixture tests**

Create `tests/unit/cluster-coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { matchDeterministically } from "@/ensemble/matching/deterministic";

const clusters = [
  { id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" },
  { id: "fed", slug: "fed-rate-path", category: ForecastCategory.MACRO, title: "Federal Reserve Rate Cut Odds", description: "Fed cuts" },
  { id: "btc", slug: "bitcoin-price", category: ForecastCategory.CRYPTO, title: "Bitcoin Price Milestones", description: "Bitcoin upside" }
];

describe("cluster source coverage", () => {
  it("matches the visible 2026 midterms source families", () => {
    const questions = [
      "Will the Democratic Party control the House after the 2026 Midterm elections?",
      "Will the Republican Party control the House after the 2026 Midterm elections?",
      "Will the Democratic Party control the Senate after the 2026 Midterm elections?",
      "Will the Republican Party control the Senate after the 2026 Midterm elections?",
      "2026 Balance of Power: D Senate, D House",
      "2026 Balance of Power: R Senate, D House",
      "2026 Balance of Power: D Senate, R House",
      "2026 Balance of Power: R Senate, R House"
    ];
    const matched = questions.filter((question) => matchDeterministically({ question, eventTitle: "Balance of Power: 2026 Midterms", sourceSlug: null, category: ForecastCategory.POLITICS }, clusters).kind === "matched");
    expect(matched).toHaveLength(8);
  });

  it("matches the Fed 2026 cut-count ladder family", () => {
    const questions = [
      "Will no Fed rate cuts happen in 2026?",
      "Will 6 Fed rate cuts happen in 2026?",
      "Will 7 Fed rate cuts happen in 2026?",
      "Will 8 Fed rate cuts happen in 2026?",
      "Will 9 Fed rate cuts happen in 2026?",
      "Will 10 Fed rate cuts happen in 2026?",
      "Will 11 Fed rate cuts happen in 2026?",
      "Will 12 or more Fed rate cuts happen in 2026?"
    ];
    const matched = questions.filter((question) => matchDeterministically({ question, eventTitle: "How many Fed rate cuts in 2026?", sourceSlug: null, category: ForecastCategory.MACRO }, clusters).kind === "matched");
    expect(matched).toHaveLength(8);
  });

  it("keeps known noisy markets out of broad clusters", () => {
    const noisy = [
      { question: "Fed rate hike in 2026?", eventTitle: "Fed rate hike in 2026?", category: ForecastCategory.MACRO },
      { question: "Will Al Mina be the Republican nominee for Senate in Virginia?", eventTitle: "Virginia Republican Senate Primary Winner", category: ForecastCategory.POLITICS },
      { question: "Will Bitcoin dip to $15,000 by December 31, 2026?", eventTitle: "What price will Bitcoin hit in 2026?", category: ForecastCategory.CRYPTO }
    ];
    for (const market of noisy) {
      expect(matchDeterministically({ ...market, sourceSlug: null }, clusters).kind).toBe("unmatched");
    }
  });
});
```

- [ ] **Step 2: Run the coverage tests**

Run:

```bash
npm test -- tests/unit/cluster-coverage.test.ts
```

Expected: pass after Tasks 1 and 2.

---

### Task 4: Recompute Local Data and Verify GUI Counts

**Files:**
- No code files modified.

- [ ] **Step 1: Reseed and ingest**

Run:

```bash
npm run prisma:seed
npm run worker:ingest
```

Expected: ingestion completes with `SUCCEEDED` or `PARTIAL` only if a connector has a fetch issue. `marketsFetched`, `matchDecisionsWritten`, and `compositesUpdated` should be nonzero.

- [ ] **Step 2: Query source counts**

Run:

```bash
node -e "const {PrismaClient}=require('@prisma/client'); const db=new PrismaClient(); (async()=>{ const clusters=await db.forecastCluster.findMany({include:{markets:true,current:true},orderBy:{slug:'asc'}}); for (const c of clusters) console.log(c.slug, 'clustered=', c.markets.length, 'currentSourceCount=', c.current?.sourceCount ?? 0, 'prob=', c.current?.compositeProbability ?? null); await db.\$disconnect(); })().catch(async e=>{console.error(e); await db.\$disconnect(); process.exit(1);})"
```

Expected minimums from the current local census:

```text
fed-rate-path currentSourceCount >= 8
us-2026-midterms currentSourceCount >= 8
bitcoin-price currentSourceCount >= 2
```

- [ ] **Step 3: Verify dashboard HTML**

Run:

```bash
curl -s http://localhost:3002 | head -c 5000
```

Expected: the dashboard includes `US 2026 Midterms`, `Federal Reserve Rate Cut Odds`, and their source pills should show expanded counts after ingestion.

---

### Task 5: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `WORKFLOW.md`

- [ ] **Step 1: Update README source policy**

Add this paragraph under `Data Refresh`:

```md
Seed forecasts use deterministic cluster rules with explicit include and exclude patterns. A matched source is then normalized to the cluster's target metric, so inverse contracts such as Republican control or no Fed cuts can contribute to the same displayed number while retaining raw probability and orientation in the audit trail.
```

- [ ] **Step 2: Update workflow layer map**

In `WORKFLOW.md`, update the matching/composite section to say:

```md
Matching chooses candidate markets with cluster-specific rule sets. Composite computation does not infer topic intent from generic titles; it receives the cluster target metric and normalizes each source contract into that metric before weighting.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: TypeScript passes and all Vitest files pass.

---

## Self-Review

**Spec coverage:** The plan addresses numbers, sources, filtering, and clustering. It broadens source counts for midterms and Fed rates, keeps false-positive and meme/noise filters, and preserves source auditability.

**Placeholder scan:** No TBD/TODO placeholders remain. Each implementation step has a target file, command, and expected result.

**Type consistency:** `targetMetric` is introduced in `SeedCluster.rule`, passed to `computeCompositeForecast`, and reused in tests with the same string union names.
