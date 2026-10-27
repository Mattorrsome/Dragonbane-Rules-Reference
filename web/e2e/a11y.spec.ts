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

test.describe('filter rows line up', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of routes) {
    test(`${route}: labels share a top, search and selects share a height`, async ({ page }) => {
      await page.goto(route);
      await page.locator('table').first().waitFor();

      const row = await page.locator('.filters').first().evaluate(f => {
        const top = (e: Element | null) => (e ? Math.round(e.getBoundingClientRect().top) : null);
        const labelled = [...f.children].filter(c => c.querySelector('label, legend'));
        return {
          labelTops: [...new Set(labelled.map(c => top(c.querySelector('label, legend'))))],
          controlHeights: [...new Set([...f.querySelectorAll('input[type="search"], input[type="text"], select')]
            .map(e => Math.round(e.getBoundingClientRect().height)))],
        };
      });
      expect(row.labelTops).toHaveLength(1);
      expect(row.controlHeights).toHaveLength(1);
    });
  }
});

test('equipment controls by keyboard', async ({ page }) => {
  await page.goto('/equipment');
  await page.locator('table').first().waitFor();

  await page.locator('input[name="price-mode"][value="buy"]').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.locator('input[name="price-mode"][value="sell"]')).toBeChecked();
  const full = page.locator('input[name="sell-rate"][value="100"]');
  await expect(full).toBeVisible();
  await full.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="sell-rate"][value="50"]')).toBeChecked();

  const mastercrafted = page.getByRole('button', { name: 'Mastercrafted' }).first();
  await mastercrafted.focus();
  await page.keyboard.press('Enter');
  await expect(mastercrafted).toHaveAttribute('aria-pressed', 'true');
});

/**
 * Axe reports text over the scroll texture as "incomplete", so check the mastercrafted row by hand: the pressed
 * button's text against the row tint laid over the sandiest parchment tone in the scroll tile (#e8dbbf).
 */
test('pressed mastercrafted button keeps AA contrast on the tinted row', async ({ page }) => {
  await page.goto('/equipment');
  await page.locator('table').first().waitFor();
  const button = page.getByRole('button', { name: 'Mastercrafted' }).first();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  const ratio = await button.evaluate(el => {
    const rgba = (css: string) => css.match(/[\d.]+/g)!.map(Number);
    const [tr, tg, tb, ta] = rgba(getComputedStyle(el.closest('td')!).backgroundColor);
    const sand = [0xe8, 0xdb, 0xbf];
    const bg = [tr, tg, tb].map((c, i) => c * ta + sand[i] * (1 - ta));
    const lum = ([r, g, b]: number[]) => {
      const lin = (c: number) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const [a, b] = [lum(rgba(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('treasure roll opens an accessible dialog', async ({ page }) => {
  await page.goto('/treasure');
  await page.locator('table').first().waitFor();
  const roll = page.getByRole('button', { name: 'Roll treasure (D40)' });

  await roll.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Rolling…');
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/^\d+ - /);
  const results = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);

  await dialog.getByRole('button', { name: 'Re-roll' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Rolling…');
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/^\d+ - /);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(roll).toBeFocused();
});

/** Rolls one treasure row and waits for its result (the spinner takes 0.5 s). */
async function rollRow(page: import('@playwright/test').Page, name: string, roll: number) {
  await page.getByRole('button', { name: `Roll ${name} (${roll})` }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText(`${roll} - ${name}`);
}

for (const viewport of viewports) {
  test.describe(`treasure dialog layout ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('Close sits on the top-right corner, inside the window', async ({ page }) => {
      await page.goto('/treasure');
      await page.locator('table').first().waitFor();
      await rollRow(page, 'Rat', 40);

      const dialog = page.getByRole('dialog');
      const d = (await dialog.boundingBox())!;
      const c = (await dialog.getByRole('button', { name: 'Close' }).boundingBox())!;
      expect(Math.abs(c.x + c.width / 2 - (d.x + d.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y + c.height / 2 - d.y)).toBeLessThanOrEqual(1);
      expect(c.width).toBeGreaterThanOrEqual(44);
      expect(c.x + c.width).toBeLessThanOrEqual(viewport.width);
      expect(c.y).toBeGreaterThanOrEqual(0);
    });

    test('a short result sits in the middle, text left-aligned, and Re-roll does not move', async ({ page }) => {
      await page.goto('/treasure');
      await page.locator('table').first().waitFor();
      await rollRow(page, 'Rat', 40);

      const dialog = page.getByRole('dialog');
      const layout = await dialog.evaluate(el => {
        const box = (s: string) => el.querySelector(s)!.getBoundingClientRect();
        const body = box('.dialog-body'), head = box('.dialog-head'), actions = box('.dialog-actions'), result = box('.treasure-result');
        const style = getComputedStyle(el.querySelector('.dialog-body')!);
        const left = body.left + parseFloat(style.paddingLeft), right = body.right - parseFloat(style.paddingRight);
        return {
          dx: (result.left + result.right) / 2 - (left + right) / 2,
          dy: (result.top + result.bottom) / 2 - (head.bottom + actions.top) / 2,
          align: [...el.querySelectorAll('.treasure-result p')].map(p => getComputedStyle(p).textAlign),
          reroll: actions.top,
        };
      });
      expect(Math.abs(layout.dx)).toBeLessThanOrEqual(1);
      // The margins between the blocks are uneven by a few pixels; the block must sit near the middle, not the top.
      expect(Math.abs(layout.dy)).toBeLessThanOrEqual(12);
      expect(new Set(layout.align)).toEqual(new Set(['start']));
      // The real text "Roll EVADE. On failure, take D4 damage ignoring armour." ends in a colon, not a stop.
      await expect(dialog.locator('.treasure-result > p.multiline')).toHaveText(/armour:$/);
      // Each outcome line opens with a decorative green arrow (CSS, empty alt text).
      expect(await dialog.locator('.result-line > p').first().evaluate(p => getComputedStyle(p, '::before').content)).toContain('→');

      // Only laptop widths keep one box size; on a phone the box grows to fit a long result.
      if (viewport.width < 1000) return;
      await dialog.getByRole('button', { name: 'Close' }).click();
      await rollRow(page, 'Bottle', 36);
      expect(await dialog.evaluate(el => el.querySelector('.dialog-actions')!.getBoundingClientRect().top)).toBeCloseTo(layout.reroll, 0);
      expect(await dialog.evaluate(el => el.querySelector('.dialog-body')!.scrollHeight <= el.querySelector('.dialog-body')!.clientHeight)).toBe(true);
    });
  });
}
