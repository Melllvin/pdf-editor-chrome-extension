// Menu ⋯ : téléchargement de l'original, dialogue des raccourcis,
// bascule de l'interception depuis le viewer.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';

test('menu : original, raccourcis, bascule d’interception', async ({
  context,
  sw,
  viewerUrl,
}) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  // Télécharger l'original (octets intacts, nom d'origine)
  await page.click('#btnMenu');
  await expect(page.locator('#menuDropdown')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.click('#menuOriginal');
  expect((await downloadPromise).suggestedFilename()).toBe('simple.pdf');

  // Dialogue des raccourcis
  await page.click('#btnMenu');
  await page.click('#menuShortcuts');
  await expect(page.locator('dialog')).toContainText('Raccourcis clavier');
  await page.click('dialog .primary');

  // Bascule de l'interception → la règle DNR disparaît puis revient
  const ruleCount = () =>
    sw.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length);
  await expect.poll(ruleCount).toBe(1);

  await page.click('#btnMenu');
  await page.uncheck('#menuIntercept');
  await expect.poll(ruleCount).toBe(0);

  await page.check('#menuIntercept');
  await expect.poll(ruleCount).toBe(1);
});
