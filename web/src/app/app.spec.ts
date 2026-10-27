import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  /**
   * Renders the shell at `url` and returns its host element. Change detection runs by hand: the routed page's
   * requests are never flushed here, so `whenStable` would wait on them forever.
   */
  async function at(url: string) {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const hrefs = (host: HTMLElement, selector: string) => [...host.querySelectorAll(selector)].map(a => a.getAttribute('href'));

  it('links to the five sections under /reference', async () => {
    const host = await at('/reference/skills');

    expect(hrefs(host, 'nav[aria-label="Sections"] a')).toEqual([
      '/reference/skills', '/reference/heroic-abilities', '/reference/spells', '/reference/equipment', '/reference/treasure',
    ]);
  });

  it('menu lists both apps', async () => {
    const host = await at('/reference/skills');

    const menu = host.querySelector('#app-menu')!;
    expect(menu.hasAttribute('popover')).toBe(true);
    expect([...menu.querySelectorAll('a')].map(a => a.textContent?.trim())).toEqual(['Dragonbane Reference', 'NPC Manager']);
    expect(hrefs(host, '#app-menu a')).toEqual(['/reference', '/npcs']);
    const button = host.querySelector('button.menu-button')!;
    expect(button.getAttribute('popovertarget')).toBe('app-menu');
    expect(button.getAttribute('aria-label')).toBe('Menu');
  });

  it('brand shows the current app; the NPC Manager has no section tabs or coin select', async () => {
    let host = await at('/npcs');
    expect(host.querySelector('.nav-brand')?.textContent?.trim()).toBe('NPC Manager');
    expect(host.querySelector('nav[aria-label="Sections"]')).toBeNull();
    expect(host.querySelector('select#coin-standard')).toBeNull();

    host = await at('/reference/spells');
    expect(host.querySelector('.nav-brand')?.textContent?.trim()).toBe('Dragonbane Reference');
    expect(host.querySelector('nav[aria-label="Sections"]')).not.toBeNull();
  });

  it('redirects the root, the old section paths and unknown paths into the Reference', async () => {
    const router = TestBed.inject(Router);
    await at('');
    expect(router.url).toBe('/reference/skills');

    await router.navigateByUrl('/skills?search=x');
    expect(router.url).toBe('/reference/skills?search=x');

    await router.navigateByUrl('/treasure');
    expect(router.url).toBe('/reference/treasure');

    await router.navigateByUrl('/nonsense');
    expect(router.url).toBe('/reference/skills');
  });

  it('has a labelled coin standard select bound to the store', async () => {
    const host = await at('/reference/skills');

    const select = host.querySelector<HTMLSelectElement>('select#coin-standard')!;
    expect(host.querySelector('label[for="coin-standard"]')?.textContent).toContain('Coin standard');
    expect(select.value).toBe('written');
  });
});
