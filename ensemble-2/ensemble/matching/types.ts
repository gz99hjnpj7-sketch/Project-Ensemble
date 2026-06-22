import type { MatchMethod } from "@prisma/client";

export type MatchResult =
  | { kind: "matched"; clusterId: string; confidence: number; method: "deterministic" | "semantic"; reason: string }
  | { kind: "unmatched"; confidence: 0; method: "deterministic" | "semantic"; reason: string };

export function toPrismaMatchMethod(method: MatchResult["method"]): MatchMethod {
  return method.toUpperCase() as MatchMethod;
}
