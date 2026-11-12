import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';

/** How long a request runs before the loader shows, so quick calls never flash it. */
export const LOADER_DELAY_MS = new InjectionToken<number>('LOADER_DELAY_MS', { factory: () => 300 });

/** Once shown, how long the loader stays at least, so it never blinks on and straight off. */
export const LOADER_MIN_MS = new InjectionToken<number>('LOADER_MIN_MS', { factory: () => 500 });

/**
 * Counts a page's first-load HTTP requests in flight. `visible` turns on once any has run past the delay, and off
 * when none are left and it has shown for the minimum time. A request starting while it waits to hide keeps it up.
 * The first load ends when that happens; later requests on the same page (searches and filters, which only change
 * the query string) are not counted. Navigating to another path starts a new first load.
 */
@Injectable({ providedIn: 'root' })
export class LoadingTracker {
  private readonly delayMs = inject(LOADER_DELAY_MS);
  private readonly minMs = inject(LOADER_MIN_MS);
  private pending = 0;
  private shownAt = 0;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private path = '';
  /** True from the app start or a move to a new path until that page's requests are done. */
  firstLoad = true;
  readonly visible = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(filter(e => e instanceof NavigationStart))
      .subscribe(e => {
        const path = e.url.split(/[?#]/)[0];
        if (path !== this.path) this.firstLoad = true;
        this.path = path;
      });
  }

  start(): void {
    if (this.pending++ > 0) return;
    clearTimeout(this.hideTimer);
    if (this.visible()) return;
    this.showTimer = setTimeout(() => {
      this.shownAt = Date.now();
      this.visible.set(true);
    }, this.delayMs);
  }

  stop(): void {
    if (--this.pending > 0) return;
    clearTimeout(this.showTimer);
    const left = this.visible() ? this.minMs - (Date.now() - this.shownAt) : 0;
    if (left > 0) this.hideTimer = setTimeout(() => this.hide(), left);
    else this.hide();
  }

  private hide(): void {
    this.visible.set(false);
    this.firstLoad = false;
  }
}

/**
 * Tracks first-load requests, including ones cancelled when a resource's params change (finalize runs on
 * unsubscribe). Other requests pass through untracked.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const tracker = inject(LoadingTracker);
  if (!tracker.firstLoad) return next(req);
  tracker.start();
  return next(req).pipe(finalize(() => tracker.stop()));
};
