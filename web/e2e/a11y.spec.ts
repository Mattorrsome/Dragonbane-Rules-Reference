import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/skills', '/heroic-abilities', '/spells', '/equipment', '/treasure'];

/**
 * Content that does not fit. The page itself never scrolls sideways because `.page-scroll` clips with
 * overflow:hidden, so also count table boxes that scroll and elements reaching past the scroll's right edge.
 */
function overflow(): { page: boolean; scrollingTables: number; clipped: string[] } {
  const edge = document.querySelector('.page-scroll')!.getBoundingClientRect().right;
  return {
    page: document.documentElement.scrollWidth > innerWidth,
    scrollingTables: [...document.querySelectorAll('.table-wrap')].filter(w => w.scrollWidth > w.clientWidth).length,
    clipped: [...document.querySelectorAll('main *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.right > edge + 1; })
      // Visually hidden content (e.g. the header row of stacked tables) is clipped on purpose.
      .filter(e => { for (let a: Element | null = e; a; a = a.parentElement) if (getComputedStyle(a).clipPath !== 'none') return false; return true; })
      .slice(0, 5)
      .map(e => `${e.tagName.toLowerCase()}.${e.className}`),
  };
}
const viewports = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];

for (const viewport of viewports) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route} is axe-clean and nothing overflows`, async ({ page }) => {
        await page.goto(route);
        await page.locator('table').first().waitFor();

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
        expect(await page.evaluate(overflow)).toEqual({ page: false, scrollingTables: 0, clipped: [] });
      });
    }
  });
}

test('equipment controls by keyboard', async ({ page }) => {
  await page.goto('/equipment');
  await page.locator('table').first().waitFor();

  await page.locator('input[name="price-mode"][value="buy"]').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.locator('input[name="price-mode"][value="sell"]')).toBeChecked();
  const rate = page.locator('#sell-rate');
  await expect(rate).toBeVisible();
  await rate.focus();
  await expect(rate).toBeFocused();
});

test('treasure roll opens an accessible dialog', async ({ page }) => {
  await page.goto('/treasure');
  await page.locator('table').first().waitFor();
  const roll = page.getByRole('button', { name: 'Roll treasure (D40)' });

  await roll.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/^\d+ - /);
  const results = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);

  await dialog.getByRole('button', { name: 'Roll again' }).click();
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(roll).toBeFocused();
});
