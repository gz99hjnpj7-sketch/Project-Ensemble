import type { MatchResult } from "@/ensemble/matching/types";

export type SemanticMatchInput = {
  marketId: string;
  text: string;
  candidates: Array<{ clusterId: string; text: string }>;
};

export type SemanticMatchProvider = {
  match(input: SemanticMatchInput): Promise<MatchResult>;
};

export class NullSemanticProvider implements SemanticMatchProvider {
  async match(): Promise<MatchResult> {
    return { kind: "unmatched", confidence: 0, method: "semantic", reason: "Semantic matching is disabled for MVP." };
  }
}
