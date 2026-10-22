/** Trims text and drops undefined, null and blank values so they never reach the query string. */
export function definedOnly(params: Record<string, string | number | null | undefined>): Record<string, string | number> {
  const entries = Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v] as const);
  return Object.fromEntries(entries.filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number>;
}
