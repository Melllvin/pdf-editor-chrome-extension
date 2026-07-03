// Interception des navigations PDF par la règle declarativeNetRequest.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';

/** Attend que la règle dynamique soit installée (ou retirée). */
async function waitForRuleCount(sw, count) {
  await expect
    .poll(async () =>
      sw.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length),
    )
    .toBe(count);
}

test('une URL http *.pdf est redirigée vers le viewer', async ({ context, sw, extensionId }) => {
  await waitForRuleCount(sw, 1);

  const page = await context.newPage();
  await page.goto(`${FIXTURES_BASE}/simple.pdf`);

  await expect
    .poll(() => page.url())
    .toMatch(new RegExp(`^chrome-extension://${extensionId}/viewer/viewer\\.html\\?file=`));
  expect(page.url()).toContain(`file=${FIXTURES_BASE}/simple.pdf`);
  await waitForPageRendered(page);
  await expect(page.locator('#pageCount')).toHaveText('3');
});

test("la casse de l'extension est ignorée (.PDF)", async ({ context, sw, extensionId }) => {
  await waitForRuleCount(sw, 1);

  const page = await context.newPage();
  await page.goto(`${FIXTURES_BASE}/SIMPLE.PDF`);
  await expect
    .poll(() => page.url())
    .toContain(`chrome-extension://${extensionId}/viewer/viewer.html`);
});

test("une URL sans .pdf n'est pas interceptée", async ({ context, sw }) => {
  await waitForRuleCount(sw, 1);

  const page = await context.newPage();
  await page.goto(`${FIXTURES_BASE}/sans-extension-pdf`).catch(() => {
    /* le lecteur natif peut interrompre la navigation, peu importe */
  });
  await page.waitForTimeout(500);
  expect(page.url()).toBe(`${FIXTURES_BASE}/sans-extension-pdf`);
});

test('le réglage interceptPdf désactive puis réactive la redirection', async ({ context, sw }) => {
  await waitForRuleCount(sw, 1);

  await sw.evaluate(() => chrome.storage.sync.set({ interceptPdf: false }));
  await waitForRuleCount(sw, 0);

  const page = await context.newPage();
  await page.goto(`${FIXTURES_BASE}/simple.pdf`).catch(() => {});
  await page.waitForTimeout(500);
  expect(page.url()).toBe(`${FIXTURES_BASE}/simple.pdf`);
  await page.close();

  await sw.evaluate(() => chrome.storage.sync.set({ interceptPdf: true }));
  await waitForRuleCount(sw, 1);

  const page2 = await context.newPage();
  await page2.goto(`${FIXTURES_BASE}/simple.pdf`);
  await expect.poll(() => page2.url()).toContain('chrome-extension://');
});

test('les PDF file:// sont ouverts dans le viewer (si accès fichiers accordé)', async ({
  context,
  sw,
  extensionId,
}, testInfo) => {
  const allowed = await sw.evaluate(() =>
    typeof chrome.extension?.isAllowedFileSchemeAccess === 'function'
      ? chrome.extension.isAllowedFileSchemeAccess()
      : false,
  );
  testInfo.skip(!allowed, "l'accès aux URL de fichier n'est pas accordé dans ce profil");

  const fixture = new URL('../fixtures/simple.pdf', import.meta.url);
  const page = await context.newPage();
  await page.goto(fixture.href).catch(() => {});
  await expect
    .poll(() => page.url())
    .toContain(`chrome-extension://${extensionId}/viewer/viewer.html?file=file%3A`);
  await waitForPageRendered(page);
});
