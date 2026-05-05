export function extractFYYear(fy: string | undefined | null): number | null {
  if (!fy) return null;

  // Handles formats:
  // FY2027, FY2027-H1, FY2027-H2, 2027, etc.
  const match = String(fy).match(/(\d{4})/);
  if (!match) return null;

  return Number(match[1]);
}

export function getCurrentFYYear(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // FY starts April → March
  return month >= 4 ? year : year - 1;
}

export function getRetentionThresholdFY(): number {
  const currentFY = getCurrentFYYear();

  // Keep last 3 FYs → archive older than (current - 2)
  return currentFY - 2;
}

export function isOlderThanRetention(fy: string | undefined | null): boolean {
  const fyYear = extractFYYear(fy);
  if (!fyYear) return false;

  const threshold = getRetentionThresholdFY();

  return fyYear < threshold;
}