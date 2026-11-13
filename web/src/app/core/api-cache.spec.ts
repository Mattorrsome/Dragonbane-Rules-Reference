import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { apiCacheInterceptor } from './api-cache';

describe('apiCacheInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiCacheInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  const get = (url: string, params?: Record<string, string>) => firstValueFrom(http.get(url, { params }));

  it('answers a repeated GET from memory, without asking the server again', async () => {
    const first = get('/api/skills', { search: 'a' });
    backend.expectOne('/api/skills?search=a').flush([1]);
    expect(await first).toEqual([1]);

    expect(await get('/api/skills', { search: 'a' })).toEqual([1]);
    backend.verify();
  });

  it('asks the server for different params', async () => {
    const first = get('/api/skills', { search: 'a' });
    backend.expectOne('/api/skills?search=a').flush([1]);
    await first;

    const second = get('/api/skills', { search: 'b' });
    backend.expectOne('/api/skills?search=b').flush([2]);
    expect(await second).toEqual([2]);
  });

  it('does not keep a failed reply, so the next visit tries again', async () => {
    const failed = get('/api/skills');
    backend.expectOne('/api/skills').flush('down', { status: 500, statusText: 'Server Error' });
    await expect(failed).rejects.toBeTruthy();

    const retry = get('/api/skills');
    backend.expectOne('/api/skills').flush([1]);
    expect(await retry).toEqual([1]);
  });
});
