// Shared display helpers — used across Dashboard, Posts, etc.

const DATE_OPTS = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

export function fmt(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, DATE_OPTS); }
  catch { return "—"; }
}

export function num(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
