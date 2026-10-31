import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
});
