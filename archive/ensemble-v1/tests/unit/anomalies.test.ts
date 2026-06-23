import { describe, expect, it } from "vitest";
import { WarningType } from "@prisma/client";
import { detectSignalWarnings } from "@/lib/forecast/anomalies";

describe("detectSignalWarnings", () => {
  it("detects large moves, low-liquidity moves, wide spreads, and stale markets", () => {
    const warnings = detectSignalWarnings(
      {
        currentProbability: 0.65,
        liquidity: 500,
        bid: 0.58,
        ask: 0.68,
        observedAt: new Date("2026-06-22T12:00:00.000Z")
      },
      {
        currentProbability: 0.5,
        liquidity: 500,
        bid: 0.49,
        ask: 0.51,
        observedAt: new Date("2026-06-21T12:00:00.000Z")
      },
      new Date("2026-06-20T12:00:00.000Z"),
      new Date("2026-06-22T12:00:00.000Z")
    );

    expect(warnings.map((warning) => warning.type)).toEqual(
      expect.arrayContaining([
        WarningType.LARGE_MOVE,
        WarningType.LOW_LIQUIDITY_MOVE,
        WarningType.WIDE_SPREAD,
        WarningType.STALE_MARKET
      ])
    );
  });
});
