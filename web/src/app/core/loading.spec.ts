import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LOADER_DELAY_MS, LOADER_MIN_MS, loadingInterceptor, LoadingTracker } from './loading';

describe('LoadingTracker', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let tracker: LoadingTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        { provide: LOADER_DELAY_MS, useValue: 300 },
        { provide: LOADER_MIN_MS, useValue: 500 },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    tracker = TestBed.inject(LoadingTracker);
  });

  afterEach(() => vi.useRealTimers());

  it('shows only once a request outlasts the delay, and stays until the last one ends', () => {
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();
    vi.advanceTimersByTime(299);
    expect(tracker.visible()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(tracker.visible()).toBe(true);

    vi.advanceTimersByTime(1000);
    backend.expectOne('/api/a').flush([]);
    expect(tracker.visible()).toBe(true);
    backend.expectOne('/api/b').flush([]);
    expect(tracker.visible()).toBe(false);
  });

  it('stays up for the minimum time when the request ends soon after it shows', () => {
    http.get('/api/a').subscribe();
    vi.advanceTimersByTime(400);
    backend.expectOne('/api/a').flush([]);
    expect(tracker.visible()).toBe(true);

    vi.advanceTimersByTime(399);
    expect(tracker.visible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(tracker.visible()).toBe(false);
  });

  it('a request starting while it waits to hide keeps it up', () => {
    http.get('/api/a').subscribe();
    vi.advanceTimersByTime(400);
    backend.expectOne('/api/a').flush([]);
    http.get('/api/b').subscribe();
    vi.advanceTimersByTime(1000);
    expect(tracker.visible()).toBe(true);

    backend.expectOne('/api/b').flush([]);
    expect(tracker.visible()).toBe(false);
  });

  it('never shows for a request that ends before the delay', () => {
    http.get('/api/a').subscribe();
    backend.expectOne('/api/a').flush([]);
    vi.advanceTimersByTime(1000);
    expect(tracker.visible()).toBe(false);
  });

  it('counts a cancelled request as ended', () => {
    const sub = http.get('/api/a').subscribe();
    vi.advanceTimersByTime(300);
    sub.unsubscribe();
    vi.advanceTimersByTime(500);
    expect(tracker.visible()).toBe(false);
  });

  describe('first load only', () => {
    /** Runs one slow request through the loader until it hides, ending the first load. */
    const slowLoad = (url: string) => {
      http.get(url).subscribe();
      vi.advanceTimersByTime(400);
      backend.expectOne(url).flush([]);
      vi.advanceTimersByTime(500);
    };

    it('does not show for later requests on the same page, such as a search', () => {
      slowLoad('/api/a');
      http.get('/api/a?search=x').subscribe();
      vi.advanceTimersByTime(1000);
      expect(tracker.visible()).toBe(false);
      backend.expectOne('/api/a?search=x').flush([]);
    });

    it('ends the first load when its requests finish before the delay too', () => {
      http.get('/api/a').subscribe();
      backend.expectOne('/api/a').flush([]);
      http.get('/api/b').subscribe();
      vi.advanceTimersByTime(1000);
      expect(tracker.visible()).toBe(false);
      backend.expectOne('/api/b').flush([]);
    });

    it('shows again after navigating to another path, but not after a query-only change', async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/skills');
      slowLoad('/api/a');

      await router.navigateByUrl('/skills?search=x');
      http.get('/api/b').subscribe();
      vi.advanceTimersByTime(400);
      expect(tracker.visible()).toBe(false);
      backend.expectOne('/api/b').flush([]);

      await router.navigateByUrl('/spells');
      http.get('/api/c').subscribe();
      vi.advanceTimersByTime(400);
      expect(tracker.visible()).toBe(true);
      backend.expectOne('/api/c').flush([]);
    });
  });
});
