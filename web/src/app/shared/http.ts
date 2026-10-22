/** Drops undefined, null and empty values so they never reach the query string. */
export function definedOnly(params: Record<string, string | number | null | undefined>): Record<string, string | number> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number>;
}
