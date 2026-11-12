import { linkedSignal, Resource, Signal } from '@angular/core';

/** Trims text and drops undefined, null and blank values so they never reach the query string. */
export function definedOnly(params: Record<string, string | number | null | undefined>): Record<string, string | number> {
  const entries = Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v] as const);
  return Object.fromEntries(entries.filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number>;
}

/**
 * The resource's last loaded value, held while a new one loads (a resource drops its value when its params change),
 * so search and filter results fade over instead of blanking.
 */
export function held<T>(resource: () => Resource<T | undefined>): Signal<T | undefined> {
  return linkedSignal<T | undefined, T | undefined>({
    source: () => (resource().hasValue() ? resource().value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
}
