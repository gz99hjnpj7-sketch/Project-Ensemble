import type { MatchResult } from "./types";

export function unmatched(reason = "No match found."): MatchResult {
  return { kind: "unmatched", confidence: 0, method: "deterministic", reason };
}
