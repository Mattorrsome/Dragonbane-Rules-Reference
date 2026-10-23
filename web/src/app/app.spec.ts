import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('links to the five sections', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map(a => a.getAttribute('href'));
    expect(links).toEqual(['/skills', '/heroic-abilities', '/spells', '/equipment', '/treasure']);
  });

  it('has a labelled coin standard select bound to the store', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const select = host.querySelector<HTMLSelectElement>('select#coin-standard')!;
    expect(host.querySelector('label[for="coin-standard"]')?.textContent).toContain('Coin standard');
    expect(select.value).toBe('written');
  });
});
