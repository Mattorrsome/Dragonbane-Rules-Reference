import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { finalize } from 'rxjs';

/** How long a request runs before the loader shows, so quick calls never flash it. */
export const LOADER_DELAY_MS = new InjectionToken<number>('LOADER_DELAY_MS', { factory: () => 300 });

/** Once shown, how long the loader stays at least, so it never blinks on and straight off. */
export const LOADER_MIN_MS = new InjectionToken<number>('LOADER_MIN_MS', { factory: () => 500 });

/**
 * Counts HTTP requests in flight. `visible` turns on once any has run past the delay, and off when none are left
 * and it has shown for the minimum time. A request starting while it waits to hide keeps it up.
 */
@Injectable({ providedIn: 'root' })
export class LoadingTracker {
  private readonly delayMs = inject(LOADER_DELAY_MS);
  private readonly minMs = inject(LOADER_MIN_MS);
  private pending = 0;
  private shownAt = 0;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  readonly visible = signal(false);

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
    if (!this.visible()) return;
    const left = this.minMs - (Date.now() - this.shownAt);
    if (left > 0) this.hideTimer = setTimeout(() => this.visible.set(false), left);
    else this.visible.set(false);
  }
}

/** Tracks every request, including ones cancelled when a resource's params change (finalize runs on unsubscribe). */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const tracker = inject(LoadingTracker);
  tracker.start();
  return next(req).pipe(finalize(() => tracker.stop()));
};
