// Rendu du viewer : ouverture, pages, zoom, navigation, état vide.
import {
  test,
  expect,
  FIXTURES_BASE,
  waitForPageRendered,
  inkedPixels,
} from '../helpers/extension.mjs';

test('ouvre un PDF via ?file= et rend les pages', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await expect(page.locator('.page')).toHaveCount(3);
  await expect(page.locator('#pageCount')).toHaveText('3');
  await expect(page).toHaveTitle(/simple\.pdf/);

  // Canvas réellement peint (du texte sombre est présent)
  expect(await inkedPixels(page)).toBeGreaterThan(100);

  // Couche texte présente pour la sélection
  const spanCount = await page.locator('.page[data-page-index="0"] .textLayer > span').count();
  expect(spanCount).toBeGreaterThan(3);
});

test('zoom : boutons et ajustement à la largeur', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  const pageWidth = async () =>
    (await page.locator('.page').first().boundingBox()).width;

  const before = await pageWidth();
  await page.click('#btnZoomIn');
  await expect.poll(pageWidth).toBeGreaterThan(before + 10);

  await page.click('#btnZoomOut');
  await expect.poll(pageWidth).toBeLessThan(before + 1);

  await page.click('#zoomLabel'); // réinitialise à 100 %
  await expect(page.locator('#zoomLabel')).toHaveText(/100\s*%/);

  await page.click('#btnFitWidth');
  const containerWidth = (await page.locator('#viewerContainer').boundingBox()).width;
  await expect.poll(pageWidth).toBeGreaterThan(containerWidth - 80);
});

test('navigation entre pages', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await page.click('#btnNext');
  await expect(page.locator('#pageInput')).toHaveValue('2');

  await page.click('#btnPrev');
  await expect(page.locator('#pageInput')).toHaveValue('1');

  await page.fill('#pageInput', '3');
  await page.dispatchEvent('#pageInput', 'change');
  await expect(page.locator('#pageInput')).toHaveValue('3');
  // La 3e page doit finir rendue (montage paresseux)
  await waitForPageRendered(page, 2);
});

test('état vide sans paramètre file', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl());
  await expect(page.locator('#emptyState')).toBeVisible();
  await expect(page.locator('#btnEmptyOpen')).toHaveText('Choisir un fichier');
});

test('ouverture via le sélecteur de fichier', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl());
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#btnEmptyOpen'),
  ]);
  await chooser.setFiles(new URL('../fixtures/dotted-form.pdf', import.meta.url).pathname);
  await waitForPageRendered(page);
  await expect(page.locator('#emptyState')).toBeHidden();
  await expect(page).toHaveTitle(/dotted-form\.pdf/);
});
