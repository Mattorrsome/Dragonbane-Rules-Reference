import { ApplicationRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

/** Once shown, how long the loader stays at least, so it never blinks on and straight off. */
export const LOADER_MIN_MS = new InjectionToken<number>('LOADER_MIN_MS', { factory: () => 500 });

const pathOf = (url: string) => url.split(/[?#]/)[0];

/**
 * `visible` turns on the moment navigation to a new page starts, so neither the old page nor the new one's empty
 * shell shows while it loads. It turns off once the app is stable (Angular counts route chunks, HTTP requests and
 * resources as pending tasks, so the page's data is in and drawn), and not before LOADER_MIN_MS. A query-only change
 * (a search or filter) is not a new page and never shows it.
 */
@Injectable({ providedIn: 'root' })
export class LoadingTracker {
  readonly visible = signal(false);

  constructor() {
    const router = inject(Router);
    const appRef = inject(ApplicationRef);
    const minMs = inject(LOADER_MIN_MS);
    const navigationDone = () =>
      firstValueFrom(router.events.pipe(filter(e => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError)));
    let path: string | undefined;
    let run = 0;

    router.events.subscribe(async e => {
      if (e instanceof NavigationEnd) path = pathOf(e.urlAfterRedirects);
      if (!(e instanceof NavigationStart) || pathOf(e.url) === path) return;
      const id = ++run;
      const shownAt = Date.now();
      this.visible.set(true);
      await navigationDone();
      await appRef.whenStable();
      await new Promise(resolve => setTimeout(resolve, minMs - (Date.now() - shownAt)));
      // A newer navigation owns the loader now.
      if (id === run) this.visible.set(false);
    });
  }
}
