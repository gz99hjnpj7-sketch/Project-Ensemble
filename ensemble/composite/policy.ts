import { ResolutionStatus } from "@prisma/client";

export type CompositePolicyDecision = {
  includedMarketIds: string[];
  excludedSources: Array<{ marketId: string; reason: "missing_probability" | "low_quality" | "closed" }>;
  confidenceBand: "tight" | "normal" | "wide";
  flags: string[];
};

export type CompositePolicyInput = {
  marketId: string;
  probability: number | null;
  qualityScore: number;
  recencyScore: number;
  resolutionStatus: ResolutionStatus;
  warnings: Array<{ type: string }>;
};

export function decideCompositePolicy(inputs: CompositePolicyInput[]): CompositePolicyDecision {
  const includedMarketIds: string[] = [];
  const excludedSources: CompositePolicyDecision["excludedSources"] = [];
  const flags = new Set<string>();
  for (const input of inputs) {
    if (input.probability === null || input.probability === undefined) excludedSources.push({ marketId: input.marketId, reason: "missing_probability" });
    else if (input.resolutionStatus !== ResolutionStatus.OPEN) excludedSources.push({ marketId: input.marketId, reason: "closed" });
    else if (input.qualityScore < 30) excludedSources.push({ marketId: input.marketId, reason: "low_quality" });
    else {
      if (input.warnings.length) flags.add("warnings shown but not used for filtering");
      if (input.qualityScore < 45) flags.add("low confidence source included");
      includedMarketIds.push(input.marketId);
    }
  }
  const confidenceBand = excludedSources.length >= 2 ? "wide" : excludedSources.length === 1 ? "normal" : "tight";
  return { includedMarketIds, excludedSources, confidenceBand, flags: [...flags] };
}
