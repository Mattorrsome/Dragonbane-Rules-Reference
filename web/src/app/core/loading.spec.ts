import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { httpResource, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationStart, provideRouter, Router, RouterOutlet } from '@angular/router';
import { LOADER_MIN_MS, LoadingTracker } from './loading';

@Component({ template: '{{ data.value()?.length }}', changeDetection: ChangeDetectionStrategy.OnPush })
class DataPage {
  readonly data = httpResource<unknown[]>(() => '/api/data');
}

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EmptyPage {}

@Component({ imports: [RouterOutlet], template: '<router-outlet />', changeDetection: ChangeDetectionStrategy.OnPush })
class Shell {}

describe('LoadingTracker', () => {
  let router: Router;
  let backend: HttpTestingController;
  let tracker: LoadingTracker;

  const setup = (minMs: number) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'data', component: DataPage },
          { path: 'empty', component: EmptyPage },
        ]),
        { provide: LOADER_MIN_MS, useValue: minMs },
      ],
    });
    tracker = TestBed.inject(LoadingTracker);
    router = TestBed.inject(Router);
    backend = TestBed.inject(HttpTestingController);
    TestBed.createComponent(Shell).autoDetectChanges();
  };

  it('shows as soon as navigation to a new page starts, and hides only once its data is in', async () => {
    setup(0);
    const atStart: boolean[] = [];
    router.events.subscribe(e => e instanceof NavigationStart && atStart.push(tracker.visible()));

    await router.navigateByUrl('/data');
    expect(atStart).toEqual([true]);
    await vi.waitFor(() => backend.expectOne('/api/data'), { timeout: 1000 }).then(req => {
      expect(tracker.visible()).toBe(true);
      req.flush([1, 2]);
    });
    await vi.waitFor(() => expect(tracker.visible()).toBe(false), { timeout: 1000 });
  });

  it('stays up for the minimum time when the page loads at once', async () => {
    setup(200);
    const start = Date.now();
    await router.navigateByUrl('/empty');
    await vi.waitFor(() => expect(tracker.visible()).toBe(false), { timeout: 1000 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(190);
  });

  it('does not show for a query-only change, such as a search', async () => {
    setup(0);
    await router.navigateByUrl('/empty');
    await vi.waitFor(() => expect(tracker.visible()).toBe(false), { timeout: 1000 });

    await router.navigateByUrl('/empty?search=x');
    expect(tracker.visible()).toBe(false);
  });
});
