// Infrastructure d'édition : outil Texte, modèle en espace PDF (zoom),
// annuler/rétablir, suppression, glisser.
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';

async function openSimple(context, viewerUrl) {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);
  return page;
}

async function addText(page, text, position = { x: 320, y: 260 }) {
  await page.click('.tb-tool[data-tool="text"]');
  await page.click('.page[data-page-index="0"]', { position });
  await expect(page.locator('.edit-box.editing')).toHaveCount(1);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape'); // commit + retour à l'outil Sélection
  await expect(page.locator('.edit-box.editing')).toHaveCount(0);
}

test('créer un texte, le modèle survit au zoom (espace PDF)', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await addText(page, 'Bonjour édition');

  const editBox = page.locator('.editLayer .edit-box.edit-text');
  await expect(editBox).toHaveCount(1);
  await expect(editBox).toHaveText('Bonjour édition');

  // Position relative à la page avant / après zoom : doit rester identique
  const relPos = async () => {
    const pb = await page.locator('.page[data-page-index="0"]').boundingBox();
    const eb = await editBox.boundingBox();
    return { rx: (eb.x - pb.x) / pb.width, ry: (eb.y - pb.y) / pb.height };
  };
  const before = await relPos();
  await page.click('#btnZoomIn');
  await page.waitForTimeout(400); // re-rendu
  const after = await relPos();
  expect(Math.abs(after.rx - before.rx)).toBeLessThan(0.005);
  expect(Math.abs(after.ry - before.ry)).toBeLessThan(0.005);
});

test('annuler / rétablir au clavier et via les boutons', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await addText(page, 'À annuler');
  const editBox = page.locator('.editLayer .edit-box.edit-text');

  await page.keyboard.press('Control+z');
  await expect(editBox).toHaveCount(0);

  await page.keyboard.press('Control+y');
  await expect(editBox).toHaveCount(1);

  await page.click('#btnUndo');
  await expect(editBox).toHaveCount(0);
  await page.click('#btnRedo');
  await expect(editBox).toHaveCount(1);
  await expect(page.locator('#btnRedo')).toBeDisabled();
});

test('sélectionner puis supprimer avec la touche Suppr', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await addText(page, 'À supprimer');
  const editBox = page.locator('.editLayer .edit-box.edit-text');

  // La validation re-sélectionne l'édition ; on désélectionne pour tester le clic
  await page.keyboard.press('Escape');
  await expect(page.locator('.edit-box.selected')).toHaveCount(0);

  await editBox.click();
  await expect(page.locator('.edit-box.selected')).toHaveCount(1);

  await page.keyboard.press('Delete');
  await expect(editBox).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(editBox).toHaveCount(1);
});

test("glisser une édition la déplace, l'annulation restaure", async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await addText(page, 'À déplacer');
  const editBox = page.locator('.editLayer .edit-box.edit-text');

  const start = await editBox.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 80, start.y + start.height / 2 + 40, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(async () => Math.round((await editBox.boundingBox()).x - start.x))
    .toBeGreaterThan(70);

  await page.keyboard.press('Control+z');
  await expect
    .poll(async () => Math.abs((await editBox.boundingBox()).x - start.x))
    .toBeLessThan(2);
});

test('la barre d’options texte modifie une édition sélectionnée', async ({ context, viewerUrl }) => {
  const page = await openSimple(context, viewerUrl);
  await addText(page, 'Style');
  const editBox = page.locator('.editLayer .edit-box.edit-text');

  // L'édition est re-sélectionnée après commit → la barre d'options est visible
  await expect(page.locator('#toolOptions')).toBeVisible();

  // Changer la couleur via le 3e swatch (rouge)
  await page.locator('#toolOptions .swatch').nth(2).click();
  await expect
    .poll(async () => editBox.evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(198, 40, 40)');

  // Changer la taille
  await page.fill('#toolOptions input[type="number"]', '20');
  await page.dispatchEvent('#toolOptions input[type="number"]', 'change');
  await expect
    .poll(async () => editBox.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
    .toBeGreaterThan(24); // 20 pt × ~1.55 d'échelle ≈ 31 px
});
