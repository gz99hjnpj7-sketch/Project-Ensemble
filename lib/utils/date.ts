import { parseISO } from 'date-fns';

/**
 * Unified timestamp formatter.
 * All dates from backend are ISO 8601 UTC strings (from Prisma .toISOString()).
 * This ensures charts and tables always render the exact same local browser time.
 */
export function formatTimestamp(isoString: string | Date | null | undefined): string {
  if (!isoString) return 'N/A';
  let date: Date;
  if (typeof isoString === 'string') {
    date = parseISO(isoString);
  } else if (isoString instanceof Date) {
    date = isoString;
  } else {
    date = new Date(isoString);
  }
  // Consistent local browser time display.
  // All backend timestamps are ISO UTC; this converts to user's local TZ uniformly.
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimestampFull(isoString: string | Date | null | undefined): string {
  if (!isoString) return 'N/A';
  const date = typeof isoString === 'string' ? parseISO(isoString) : isoString;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
