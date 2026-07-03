// Pointillés : détection des zones, remplissage façon « insert », incrustation.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';
import { extractText, pageContent } from '../helpers/pdf-assert.mjs';

async function openDotted(context, viewerUrl) {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/dotted-form.pdf`));
  await waitForPageRendered(page);
  return page;
}

test('les suites de points, points espacés et underscores sont détectés', async ({
  context,
  viewerUrl,
}) => {
  const page = await openDotted(context, viewerUrl);
  await page.click('.tb-tool[data-tool="dots"]');

  // Nom, Prénom, Adresse (points espacés), Code postal (____), Fait à ×2 → ≥ 5
  const zones = page.locator('.dotZones .dot-zone');
  await expect.poll(() => zones.count()).toBeGreaterThanOrEqual(5);
});

test('cliquer une zone permet de taper par-dessus les points', async ({ context, viewerUrl }) => {
  const page = await openDotted(context, viewerUrl);
  await page.click('.tb-tool[data-tool="dots"]');
  const zones = page.locator('.dotZones .dot-zone');
  await expect.poll(() => zones.count()).toBeGreaterThanOrEqual(5);

  // La zone la plus haute = ligne « Nom : ......... »
  const boxes = [];
  for (let i = 0, n = await zones.count(); i < n; i++) {
    boxes.push({ i, box: await zones.nth(i).boundingBox() });
  }
  boxes.sort((a, b) => a.box.y - b.box.y);
  const nameZone = zones.nth(boxes[0].i);
  const zoneBox = await nameZone.boundingBox();

  await nameZone.click();
  const editing = page.locator('.edit-box.editing');
  await expect(editing).toHaveCount(1);
  await page.keyboard.type('Dupont Éléonore');
  await page.keyboard.press('Escape');

  // L'édition « fill » a un fond blanc et reste calée sur la zone
  const fill = page.locator('.editLayer .edit-box.edit-fill');
  await expect(fill).toHaveCount(1);
  await expect(fill).toHaveClass(/white-bg/);
  const fillBox = await fill.boundingBox();
  expect(Math.abs(fillBox.x - zoneBox.x)).toBeLessThan(8);
  // Le texte repose sur la même ligne que les points (chevauchement vertical)
  expect(fillBox.y).toBeLessThan(zoneBox.y + zoneBox.height);
  expect(fillBox.y + fillBox.height).toBeGreaterThan(zoneBox.y);
});

test('le remplissage est incrusté : texte présent + masque blanc', async ({
  context,
  viewerUrl,
}) => {
  const page = await openDotted(context, viewerUrl);
  await page.click('.tb-tool[data-tool="dots"]');
  const zones = page.locator('.dotZones .dot-zone');
  await expect.poll(() => zones.count()).toBeGreaterThanOrEqual(5);
  await zones.first().click();
  await page.keyboard.type('Vergé-Dupont');
  await page.keyboard.press('Escape');

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const path = await (await downloadPromise).path();

  expect(await extractText(path, 0)).toContain('Vergé-Dupont');
  expect(await pageContent(path, 0)).toMatch(/1 1 1 rg[\s\S]*?\bh\s+f\b/);
});

test('document sans pointillés : indication à l’utilisateur', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/acroform.pdf`));
  await waitForPageRendered(page);
  await page.click('.tb-tool[data-tool="dots"]');
  await expect(page.locator('.toast')).toContainText('Aucune ligne pointillée');
});
