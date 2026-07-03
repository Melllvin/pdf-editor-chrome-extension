// Surlignage (sélection de texte → rects fusionnés, Multiply à l'export)
// et blanco (rectangle blanc opaque).
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';
import { extractText, pageContent, pageHasMultiplyBlend } from '../helpers/pdf-assert.mjs';

async function openSimple(context, viewerUrl) {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);
  return page;
}

/** Glisse une sélection du début de `fromSpan` à la fin de `toSpan`. */
async function dragSelect(page, fromSpan, toSpan) {
  const a = await fromSpan.boundingBox();
  const b = await toSpan.boundingBox();
  await page.mouse.move(a.x + 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('surligner une ligne par sélection, incrusté en Multiply', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await page.click('.tb-tool[data-tool="highlight"]');

  const spans = page.locator('.page[data-page-index="0"] .textLayer > span');
  await dragSelect(page, spans.nth(1), spans.nth(1));

  const group = page.locator('.highlightLayer .edit-box.edit-highlight');
  await expect(group).toHaveCount(1);
  await expect(group.locator('.highlight-rect')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const path = await (await downloadPromise).path();

  expect(await pageHasMultiplyBlend(path, 0)).toBe(true);
  // Le texte d'origine reste extractible (le surlignage ne détruit rien)
  expect(await extractText(path, 0)).toContain('whisky');
});

test('une sélection multi-lignes produit un rectangle par ligne', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await page.click('.tb-tool[data-tool="highlight"]');

  const spans = page.locator('.page[data-page-index="0"] .textLayer > span');
  await dragSelect(page, spans.nth(1), spans.nth(3)); // 3 lignes de texte

  const rects = page.locator('.highlightLayer .highlight-rect');
  await expect(rects).toHaveCount(3);

  // Chaque rect couvre une ligne : hauteurs comparables, tops distincts
  const boxes = [];
  for (let i = 0; i < 3; i++) boxes.push(await rects.nth(i).boundingBox());
  const tops = boxes.map((b) => Math.round(b.y)).sort((x, y) => x - y);
  expect(new Set(tops).size).toBe(3);
});

test('sélectionner avec l’outil Sélection puis cliquer Surligner convertit la sélection', async ({
  context,
  viewerUrl,
}) => {
  const page = await openSimple(context, viewerUrl);
  // Outil Sélection actif par défaut : la couche texte est sélectionnable
  const spans = page.locator('.page[data-page-index="0"] .textLayer > span');
  await dragSelect(page, spans.nth(2), spans.nth(2));
  await page.click('.tb-tool[data-tool="highlight"]');
  await expect(page.locator('.highlightLayer .highlight-rect')).toHaveCount(1);
});

test('blanco : rectangle blanc tracé et incrusté', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await page.click('.tb-tool[data-tool="whiteout"]');

  const pageBox = await page.locator('.page[data-page-index="0"]').boundingBox();
  await page.mouse.move(pageBox.x + 120, pageBox.y + 300);
  await page.mouse.down();
  await page.mouse.move(pageBox.x + 420, pageBox.y + 360, { steps: 5 });
  await page.mouse.up();

  const whiteout = page.locator('.editLayer .edit-box.edit-whiteout');
  await expect(whiteout).toHaveCount(1);
  const box = await whiteout.boundingBox();
  expect(box.width).toBeGreaterThan(280);
  expect(box.height).toBeGreaterThan(40);

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const path = await (await downloadPromise).path();
  const ops = await pageContent(path, 0);
  expect(ops).toMatch(/1 1 1 rg[\s\S]*?\bh\s+f\b/);
});

test('supprimer un surlignage via l’outil Sélection', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await page.click('.tb-tool[data-tool="highlight"]');
  const spans = page.locator('.page[data-page-index="0"] .textLayer > span');
  await dragSelect(page, spans.nth(1), spans.nth(1));
  await expect(page.locator('.highlightLayer .highlight-rect')).toHaveCount(1);

  await page.click('.tb-tool[data-tool="select"]');
  await page.locator('.highlightLayer .highlight-rect').click();
  await expect(page.locator('.highlightLayer .edit-box.selected')).toHaveCount(1);
  await page.keyboard.press('Delete');
  await expect(page.locator('.highlightLayer .highlight-rect')).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(page.locator('.highlightLayer .highlight-rect')).toHaveCount(1);
});
