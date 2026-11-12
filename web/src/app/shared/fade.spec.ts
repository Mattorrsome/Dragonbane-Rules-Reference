import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FADE_MS, fadeSwap } from './fade';

describe('fadeSwap', () => {
  const source = signal<string[] | undefined>(undefined);
  const busy = signal(false);

  beforeEach(() => {
    vi.useFakeTimers();
    source.set(undefined);
    busy.set(false);
    TestBed.configureTestingModule({ providers: [{ provide: FADE_MS, useValue: 200 }] });
  });

  afterEach(() => vi.useRealTimers());

  const create = () => {
    const faded = TestBed.runInInjectionContext(() => fadeSwap(source, busy));
    TestBed.tick();
    return faded;
  };
  const set = (value: string[] | undefined, loading = false) => {
    source.set(value);
    busy.set(loading);
    TestBed.tick();
  };

  it('shows the first value at once', () => {
    const faded = create();
    set(['a']);
    expect(faded.value()).toEqual(['a']);
    expect(faded.fading()).toBe(false);
  });

  it('a value that comes at once still waits for the fade-out before it swaps in', () => {
    const faded = create();
    set(['a']);
    set(['b']);
    expect(faded.value()).toEqual(['a']);
    expect(faded.fading()).toBe(true);

    vi.advanceTimersByTime(199);
    expect(faded.value()).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(faded.value()).toEqual(['b']);
    expect(faded.fading()).toBe(false);
  });

  it('keeps the old value up, faded, while it loads, and swaps once the fade is done', () => {
    const faded = create();
    set(['a']);
    set(undefined, true);
    vi.advanceTimersByTime(1000);
    expect(faded.value()).toEqual(['a']);
    expect(faded.fading()).toBe(true);

    set(['b']);
    vi.advanceTimersByTime(0);
    expect(faded.value()).toEqual(['b']);
    expect(faded.fading()).toBe(false);
  });

  it('stops fading when the load fails, and the app becomes stable', async () => {
    const faded = create();
    set(['a']);
    set(undefined, true);
    set(undefined);
    expect(faded.fading()).toBe(false);
    vi.useRealTimers();
    await expect(TestBed.inject(ApplicationRef).whenStable()).resolves.toBeUndefined();
  });
});
