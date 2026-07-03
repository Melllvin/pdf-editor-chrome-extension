// Formulaires AcroForm : widgets interactifs rendus, valeurs enregistrées,
// coche « plate » posée avec l'outil Cocher.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';
import { loadForm, pageContent } from '../helpers/pdf-assert.mjs';

async function openForm(context, viewerUrl) {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/acroform.pdf`));
  await waitForPageRendered(page);
  return page;
}

test('remplir un champ texte et cocher une case, relus par pdf-lib', async ({
  context,
  viewerUrl,
}) => {
  const page = await openForm(context, viewerUrl);

  const nameInput = page.locator('.annotationLayer input[type="text"]').first();
  await expect(nameInput).toBeVisible();
  await nameInput.fill('Éléonore Vergé');

  const checkbox = page.locator('.annotationLayer input[type="checkbox"]').first();
  await checkbox.check();

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const path = await (await downloadPromise).path();

  const form = await loadForm(path);
  expect(form.getTextField('nom').getText()).toBe('Éléonore Vergé');
  expect(form.getCheckBox('majeur').isChecked()).toBe(true);
  expect(form.getCheckBox('newsletter').isChecked()).toBe(false);
});

test('décocher une case cochée est aussi enregistré', async ({ context, viewerUrl }) => {
  const page = await openForm(context, viewerUrl);
  const checkbox = page.locator('.annotationLayer input[type="checkbox"]').first();
  await checkbox.check();
  await checkbox.uncheck();

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const form = await loadForm(await (await downloadPromise).path());
  expect(form.getCheckBox('majeur').isChecked()).toBe(false);
});

test('outil Cocher : coche vectorielle posée et incrustée', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/dotted-form.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="check"]');
  // Sur la case « plate » dessinée de la fixture (~60,282 px à l'échelle 155 %)
  const pageBox = await page.locator('.page[data-page-index="0"]').boundingBox();
  await page.mouse.click(pageBox.x + 71, pageBox.y + 289);

  const check = page.locator('.editLayer .edit-box.edit-check');
  await expect(check).toHaveCount(1);
  await expect(check.locator('svg path')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnSave');
  const ops = await pageContent(await (await downloadPromise).path(), 0);
  // Deux segments avec extrémités arrondies (l'opérateur J 1)
  expect(ops).toMatch(/1 J/);
  expect(ops).toMatch(/\bl\s+S\b/);
});

test('basculer croix ✗ via la barre d’options', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/dotted-form.pdf`));
  await waitForPageRendered(page);

  await page.click('.tb-tool[data-tool="check"]');
  await page.click('#toolOptions .opt-glyph[title="Croix"]');
  const pageBox = await page.locator('.page[data-page-index="0"]').boundingBox();
  await page.mouse.click(pageBox.x + 71, pageBox.y + 330);

  const path = page.locator('.editLayer .edit-box.edit-check svg path');
  await expect(path).toHaveAttribute('d', /M4 4/); // tracé de la croix
});
