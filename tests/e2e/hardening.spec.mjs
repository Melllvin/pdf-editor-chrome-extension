// Durcissement : compensation de rotation à l'incrustation, impression.
import http from 'node:http';
import fs from 'node:fs';
import { test, expect, FIXTURES_BASE, waitForPageRendered } from '../helpers/extension.mjs';

/** Boîte englobante des pixels sombres du canvas dans une fenêtre (px CSS). */
async function darkBBox(page, pageIndex, region) {
  return page.evaluate(
    ({ idx, region }) => {
      const canvas = document.querySelector(`.page[data-page-index="${idx}"] canvas`);
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(
        Math.round(region.x * scale),
        Math.round(region.y * scale),
        Math.round(region.w * scale),
        Math.round(region.h * scale),
      );
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
          const i = (y * data.width + x) * 4;
          if (data.data[i] < 120 && data.data[i + 3] > 100) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      return maxX < 0 ? null : { w: (maxX - minX) / scale, h: (maxY - minY) / scale };
    },
    { idx: pageIndex, region },
  );
}

test('page pivotée à 90° : le texte incrusté reste horizontal à l’écran', async ({
  context,
  viewerUrl,
}, testInfo) => {
  // Sert le PDF sauvé pour le ré-ouvrir dans le viewer
  let savedBytes = null;
  const server = http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(savedBytes);
    })
    .listen(8125);

  try {
    const page = await context.newPage();
    await page.goto(viewerUrl(`${FIXTURES_BASE}/rotated.pdf`));
    await waitForPageRendered(page);

    // La page A4 pivotée s'affiche en paysage
    const pageBox = await page.locator('.page[data-page-index="0"]').boundingBox();
    expect(pageBox.width).toBeGreaterThan(pageBox.height);

    const CLICK = { x: 160, y: 260 };
    await page.click('.tb-tool[data-tool="text"]');
    await page.click('.page[data-page-index="0"]', { position: CLICK });
    await page.keyboard.type('HORIZONTAL');
    await page.keyboard.press('Escape');

    // L'aperçu est horizontal par construction ; on mesure sa boîte réelle
    const editBox = await page.locator('.editLayer .edit-box.edit-text').boundingBox();
    expect(editBox.width).toBeGreaterThan(editBox.height);

    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnSave');
    savedBytes = fs.readFileSync(await (await downloadPromise).path());

    // Ré-ouverture du PDF sauvé : le texte doit occuper une bande horizontale
    // au même endroit (et non une bande verticale = rotation non compensée)
    const page2 = await context.newPage();
    await page2.goto(viewerUrl('http://127.0.0.1:8125/saved.pdf'));
    await waitForPageRendered(page2);

    const region = { x: CLICK.x - 15, y: CLICK.y - 15, w: 260, h: 70 };
    const bbox = await darkBBox(page2, 0, region);
    expect(bbox).not.toBeNull();
    expect(bbox.w).toBeGreaterThan(bbox.h * 2.5);
    expect(bbox.h).toBeLessThan(30); // une seule ligne de ~12 pt
  } finally {
    server.close();
  }
});

test('imprimer crée un iframe blob avec le PDF édité', async ({ context, viewerUrl }) => {
  const page = await context.newPage();
  await page.goto(viewerUrl(`${FIXTURES_BASE}/simple.pdf`));
  await waitForPageRendered(page);

  await expect(page.locator('#btnPrint')).toBeEnabled();
  await page.click('#btnPrint');
  const frame = page.locator('#printFrame');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('src', /^blob:/);
  // Pas de bannière d'erreur
  await expect(page.locator('.banner.error')).toHaveCount(0);
});
