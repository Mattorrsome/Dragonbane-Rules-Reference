import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { finalize } from 'rxjs';

/** How long a request runs before the loader shows, so quick calls never flash it. */
export const LOADER_DELAY_MS = new InjectionToken<number>('LOADER_DELAY_MS', { factory: () => 300 });

/** Counts HTTP requests in flight; `visible` turns on once any has run past the delay, off when none are left. */
@Injectable({ providedIn: 'root' })
export class LoadingTracker {
  private readonly delayMs = inject(LOADER_DELAY_MS);
  private pending = 0;
  private timer?: ReturnType<typeof setTimeout>;
  readonly visible = signal(false);

  start(): void {
    if (this.pending++ === 0) this.timer = setTimeout(() => this.visible.set(true), this.delayMs);
  }

  stop(): void {
    if (--this.pending > 0) return;
    clearTimeout(this.timer);
    this.visible.set(false);
  }
}

/** Tracks every request, including ones cancelled when a resource's params change (finalize runs on unsubscribe). */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const tracker = inject(LoadingTracker);
  tracker.start();
  return next(req).pipe(finalize(() => tracker.stop()));
};
