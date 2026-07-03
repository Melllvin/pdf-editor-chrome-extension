// Harnais Playwright : contexte persistant avec l'extension chargée.
import { test as base, chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const EXT_PATH = fileURLToPath(new URL('../../extension', import.meta.url));
export const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const FIXTURES_BASE = 'http://127.0.0.1:8123';

export { expect };

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: true, // le « new headless » de Chromium 141 prend en charge les extensions
      executablePath: CHROMIUM_PATH,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    sw ??= await context.waitForEvent('serviceworker');
    await use(new URL(sw.url()).host);
  },

  /** URL du viewer, avec ?file= encodé. */
  viewerUrl: async ({ extensionId }, use) => {
    await use(
      (fileUrl) =>
        `chrome-extension://${extensionId}/viewer/viewer.html` +
        (fileUrl ? `?file=${encodeURIComponent(fileUrl)}` : ''),
    );
  },
});

/** Attend qu'une page du document soit rendue (canvas peint + couche texte). */
export async function waitForPageRendered(page, pageIndex = 0) {
  const sel = `.page[data-page-index="${pageIndex}"]`;
  await page.waitForSelector(`${sel} canvas`, { state: 'attached' });
  await page.waitForFunction(
    ([s]) => {
      const el = document.querySelector(s);
      const canvas = el?.querySelector('canvas');
      return canvas && canvas.width > 0 && el.querySelector('.textLayer')?.childElementCount >= 0;
    },
    [sel],
  );
  // La couche texte arrive après le canvas ; petite marge pour la peinture.
  await page.waitForTimeout(300);
}

/** Nombre de pixels « encrés » (sombres) dans le premier canvas. */
export async function inkedPixels(page, pageIndex = 0) {
  return page.evaluate((idx) => {
    const canvas = document.querySelector(`.page[data-page-index="${idx}"] canvas`);
    if (!canvas || canvas.width === 0) return 0;
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, Math.min(canvas.height, 600));
    let dark = 0;
    for (let i = 0; i < data.length; i += 40) {
      if (data[i] < 160 && data[i + 3] > 100) dark++;
    }
    return dark;
  }, pageIndex);
}
