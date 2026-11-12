import { DestroyRef, effect, inject, InjectionToken, PendingTasks, Resource, signal, Signal, untracked } from '@angular/core';

/** How long results take to fade out; matches the `.results` transition in app.scss. */
export const FADE_MS = new InjectionToken<number>('FADE_MS', { factory: () => 200 });

export interface Faded<T> {
  /** What is on show: the last value until the new one may swap in. */
  readonly value: Signal<T | undefined>;
  /** True while the shown value is dimmed: the next one is loading or waiting for the fade-out to finish. */
  readonly fading: Signal<boolean>;
}

/**
 * Shows `source`'s value, but swaps in a new one only once the old one has faded out for FADE_MS, so the content never
 * jumps mid-fade, however fast the new value comes. While `busy` (a resource loading), the old value stays up, faded.
 * The first value shows at once (the page loader covers it). Must be called in an injection context.
 */
export function fadeSwap<T>(source: () => T | undefined, busy: () => boolean = () => false): Faded<T> {
  const fadeMs = inject(FADE_MS);
  const tasks = inject(PendingTasks);
  const value = signal<T | undefined>(undefined);
  const fading = signal(false);
  let fadeStart = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done: (() => void) | undefined;
  const release = () => {
    clearTimeout(timer);
    done?.();
    done = undefined;
  };
  // A pending task left behind would keep the app unstable, and the page loader up, for good.
  inject(DestroyRef).onDestroy(release);

  effect(() => {
    const next = source();
    const loading = busy();
    untracked(() => {
      if (value() === undefined) {
        value.set(next);
        return;
      }
      if (!loading && next === value() && !fading()) return;
      if (!fading()) {
        fading.set(true);
        fadeStart = Date.now();
        done = tasks.add(); // whenStable waits for the swap, so tests and the page loader see the settled content
      }
      clearTimeout(timer);
      if (loading) return;
      if (next === undefined) {
        // Failed: the page shows its error message instead of the results.
        fading.set(false);
        release();
        return;
      }
      timer = setTimeout(() => {
        value.set(next);
        fading.set(false);
        release();
      }, fadeMs - (Date.now() - fadeStart));
    });
  });
  return { value: value.asReadonly(), fading: fading.asReadonly() };
}

/** fadeSwap over a resource: its value (dropped on new params) and its loading state. */
export function fadeResource<T>(resource: () => Resource<T | undefined>): Faded<T> {
  return fadeSwap(
    () => (resource().hasValue() ? resource().value() : undefined),
    () => resource().isLoading(),
  );
}
