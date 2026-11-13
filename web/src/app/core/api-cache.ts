import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { of, tap } from 'rxjs';

/** Successful GET replies by URL and params, kept until the page reloads. */
const API_CACHE = new InjectionToken('API_CACHE', { factory: () => new Map<string, HttpResponse<unknown>>() });

/**
 * The API serves a read-only database, so a reply never changes while the app runs: a repeated GET (a revisited
 * section, a search run before) is answered from memory. Failed replies are not kept. Replies are shared, not copied:
 * nothing in the app changes the data it gets.
 */
export const apiCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith('/api/')) return next(req);
  const cache = inject(API_CACHE);
  const key = req.urlWithParams;
  const hit = cache.get(key);
  return hit ? of(hit.clone()) : next(req).pipe(tap(e => e instanceof HttpResponse && cache.set(key, e)));
};
