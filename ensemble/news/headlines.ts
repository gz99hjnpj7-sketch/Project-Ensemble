type Movement = {
  day?: { probability: number } | null;
  sinceFirst?: { probability: number } | null;
  previousRun?: { probability: number } | null;
} | null;

type Outcome = { name: string; probability: number };
type Source = { question?: string; sourceRole?: string; displayQuestion?: string; probability?: number | null };

export type FutureNewsHeadline = {
  headline: string;
  summary: string;
  basis: string;
};

export function generateFutureNewsHeadline(input: {
  slug: string;
  title: string;
  probability: number | null;
  movement?: Movement;
  outcomeBreakdown?: Outcome[] | null;
  sources?: Source[];
}): FutureNewsHeadline {
  const probability = input.probability;
  const move = primaryMovement(input.movement ?? null);
  const direction = move && Math.abs(move.probability) >= 0.005 ? (move.probability > 0 ? "rise" : "fall") : "hold";
  const topSource = input.sources?.find((source) => source.sourceRole === "headline") ?? input.sources?.[0] ?? null;
  const basis = topSource?.displayQuestion ?? topSource?.question ?? "current headline source market";

  if (input.slug === "us-presidential-2028" && input.outcomeBreakdown?.[0] && probability !== null) {
    const leader = input.outcomeBreakdown[0];
    return {
      headline: `${leader.name} side leads 2028 winner markets at ${pct(leader.probability)}`,
      summary: `Prediction markets currently show ${leader.name} as the leading normalized side. The dashboard headline is the leading-side probability, not a single candidate probability.`,
      basis
    };
  }

  if (input.slug === "fed-rate-path" && probability !== null) {
    return {
      headline: `Fed cut odds ${direction === "hold" ? "hold near" : direction === "rise" ? "rise to" : "fall to"} ${pct(probability)}`,
      summary: "The headline uses the binary no-cut market inverted into at-least-one-cut odds when that market is available. Cut-count ladder markets remain supporting detail.",
      basis
    };
  }

  if (input.slug === "us-2026-midterms" && probability !== null) {
    return {
      headline: `Markets price Democrats near ${pct(probability)} for 2026 House control`,
      summary: "The headline is driven by direct House-control binary markets. Balance-of-power markets are supporting context, not averaged into the headline.",
      basis
    };
  }

  if (input.slug === "bitcoin-price" && probability !== null) {
    return {
      headline: `Bitcoin $100k odds ${direction === "hold" ? "hold near" : direction === "rise" ? "rise to" : "fall to"} ${pct(probability)}`,
      summary: "The headline tracks the exact December 31, 2026 Bitcoin $100k market.",
      basis
    };
  }

  if (input.slug === "frontier-ai-timeline" && probability !== null) {
    return {
      headline: `OpenAI frontier-model odds ${direction === "hold" ? "hold near" : direction === "rise" ? "rise to" : "fall to"} ${pct(probability)}`,
      summary: "The headline tracks the exact OpenAI frontier-model-by-deadline market.",
      basis
    };
  }

  return {
    headline: probability === null ? `${input.title} has no current market-implied odds` : `${input.title} sits near ${pct(probability)}`,
    summary: "This headline is generated from current prediction-market composites only.",
    basis
  };
}

function primaryMovement(movement: Movement) {
  return movement?.day ?? movement?.sinceFirst ?? movement?.previousRun ?? null;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
