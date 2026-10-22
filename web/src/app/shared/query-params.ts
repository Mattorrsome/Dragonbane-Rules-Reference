import { inject } from '@angular/core';
import { Params, Router } from '@angular/router';

/** Returns a function that merges filter values into the URL (null removes one), replacing the history entry. */
export function injectQueryParamWriter(): (params: Params) => void {
  const router = inject(Router);
  return params => router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
}
