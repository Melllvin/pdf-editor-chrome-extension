// Export : le texte ajouté (accents compris) est incrusté dans le PDF téléchargé.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';
import { extractText, pageContent } from '../helpers/pdf-assert.mjs';

const PHRASE = 'Éléonore çà où — œuf 12 €';

test('enregistre un PDF contenant le texte accentué ajouté', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="text"]');
  await page.click('.page[data-page-index="0"]', { position: { x: 300, y: 500 } });
  await page.keyboard.type(PHRASE);
  await page.keyboard.press('Escape');
  await expect(page.locator('.editLayer .edit-box.edit-text')).toHaveText(PHRASE);

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('simple (modifie).pdf');
  const path = await download.path();

  const extracted = await extractText(path, 0);
  expect(extracted).toContain(PHRASE);
  // Le contenu d'origine est toujours là
  expect(extracted).toContain('Document');
});

test('Ctrl+S valide la saisie en cours puis enregistre', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="text"]');
  await page.click('.page[data-page-index="0"]', { position: { x: 260, y: 300 } });
  await page.keyboard.type('Sauvé en cours de frappe');
  // PAS d'Escape : Ctrl+S doit d'abord valider la saisie
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadPromise;

  const extracted = await extractText(await download.path(), 0);
  expect(extracted).toContain('Sauvé en cours de frappe');
});

test('multi-lignes et fond blanc incrustés', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="text"]');
  // Activer le fond blanc via la barre d'options (s'applique aux nouveaux textes)
  await page.check('#toolOptions .opt-check input');
  await page.click('.page[data-page-index="0"]', { position: { x: 200, y: 350 } });
  await page.keyboard.type('Première ligne');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Seconde ligne');
  await page.keyboard.press('Escape');

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const download = await downloadPromise;
  const path = await download.path();

  const extracted = await extractText(path, 0);
  expect(extracted).toContain('Première ligne');
  expect(extracted).toContain('Seconde ligne');
  // Le rectangle blanc du fond est dessiné en RGB 1 1 1 dans le flux ajouté
  const ops = await pageContent(path, 0);
  // Rectangle blanc rempli (pdf-lib trace les rects en chemins m/l/h + f)
  expect(ops).toMatch(/1 1 1 rg[\s\S]*?\bh\s+f\b/);
});

test('caractères hors WinAnsi remplacés avec avertissement', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="text"]');
  await page.click('.page[data-page-index="0"]', { position: { x: 200, y: 420 } });
  await page.keyboard.type('Emoji 😀 et texte');
  await page.keyboard.press('Escape');

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const download = await downloadPromise;

  const extracted = await extractText(await download.path(), 0);
  expect(extracted).toContain('Emoji ? et texte');
  await expect(page.locator('.toast', { hasText: 'remplacés' })).toBeVisible();
});
