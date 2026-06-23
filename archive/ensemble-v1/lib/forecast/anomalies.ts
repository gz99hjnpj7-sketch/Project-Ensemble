import { SignalConfidence, WarningType } from "@prisma/client";

export type SnapshotLike = {
  currentProbability: number | null;
  liquidity: number | null;
  bid: number | null;
  ask: number | null;
  observedAt: Date;
};

export type SignalWarningInput = {
  type: WarningType;
  message: string;
  severity: SignalConfidence;
  metadata: Record<string, unknown>;
};

export function detectSignalWarnings(
  latest: SnapshotLike,
  previous24h: SnapshotLike | null,
  lastUpdated: Date,
  now = new Date()
): SignalWarningInput[] {
  const warnings: SignalWarningInput[] = [];
  const spread = latest.bid !== null && latest.ask !== null ? latest.ask - latest.bid : null;

  if (previous24h && previous24h.currentProbability !== null && latest.currentProbability !== null) {
    const move = latest.currentProbability - previous24h.currentProbability;
    if (Math.abs(move) >= 0.1) {
      warnings.push({
        type: WarningType.LARGE_MOVE,
        message: `Probability moved ${formatPoints(move)} over roughly 24h.`,
        severity: SignalConfidence.MEDIUM,
        metadata: { move }
      });
    }
    if ((latest.liquidity ?? 0) < 1_000 && Math.abs(move) >= 0.05) {
      warnings.push({
        type: WarningType.LOW_LIQUIDITY_MOVE,
        message: `Low-liquidity market moved ${formatPoints(move)}.`,
        severity: SignalConfidence.LOW,
        metadata: { move, liquidity: latest.liquidity }
      });
    }
  }

  if (spread !== null && spread >= 0.08) {
    warnings.push({
      type: WarningType.WIDE_SPREAD,
      message: `Bid/ask spread is ${formatPoints(spread)}.`,
      severity: SignalConfidence.LOW,
      metadata: { spread }
    });
  }

  const staleHours = (now.getTime() - lastUpdated.getTime()) / 3_600_000;
  if (staleHours >= 24) {
    warnings.push({
      type: WarningType.STALE_MARKET,
      message: `Market has not updated for ${Math.round(staleHours)} hours.`,
      severity: SignalConfidence.LOW,
      metadata: { staleHours }
    });
  }

  return warnings;
}

function formatPoints(value: number): string {
  const points = Math.round(value * 1000) / 10;
  return `${points > 0 ? "+" : ""}${points} points`;
}
