// Génère les PDF de test dans tests/fixtures/ (gitignoré). Utilisé par `npm test` (pretest).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const outDir = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'tests',
  'fixtures',
);

const A4 = [595.28, 841.89];
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.35, 0.35, 0.35);

async function simple() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let p = 1; p <= 3; p++) {
    const page = doc.addPage(A4);
    page.drawText(`Document d'exemple — page ${p}`, { x: 60, y: 770, size: 18, font: bold });
    const lines = [
      'Portez ce vieux whisky au juge blond qui fume sur son île intérieure, à côté',
      "de l'alcôve ovoïde, où les bûches se consument dans l'âtre, ce qui lui permet",
      'de penser à la cænogenèse de l’être dont il est question dans la cause ambiguë',
      'entendue à Moÿ, dans un capharnaüm qui, pense-t-il, diminue çà et là la qualité',
      'de son œuvre. Voyelles accentuées : é è ê ë à â ù û ü ï î ô ç œ Œ — 12 €.',
      '',
      'Ce paragraphe sert de cible aux tests de sélection et de surlignage. Chaque',
      'ligne contient suffisamment de mots pour vérifier la fusion des rectangles de',
      'sélection ligne par ligne, ainsi que la conversion des coordonnées entre la',
      'couche texte et l’espace du document PDF.',
    ];
    lines.forEach((line, i) => {
      page.drawText(line, { x: 60, y: 720 - i * 22, size: 12, font });
    });
  }
  return doc.save();
}

async function dottedForm() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  page.drawText('FORMULAIRE DE DEMANDE', { x: 60, y: 780, size: 16, font: bold });

  const row = (label, y, dots) => {
    page.drawText(label, { x: 60, y, size: 12, font });
    page.drawText(dots, { x: 60 + font.widthOfTextAtSize(label, 12) + 4, y, size: 12, font });
  };
  row('Nom :', 730, '.'.repeat(60));
  row('Prénom :', 700, '.'.repeat(55));
  row('Adresse :', 670, '. '.repeat(32).trim());
  row('Code postal :', 640, '_'.repeat(20));
  // Deux zones sur la même ligne
  page.drawText('Fait à', { x: 60, y: 610, size: 12, font });
  page.drawText('.'.repeat(28), { x: 98, y: 610, size: 12, font });
  page.drawText(', le', { x: 270, y: 610, size: 12, font });
  page.drawText('.'.repeat(22), { x: 295, y: 610, size: 12, font });

  // Cases à cocher « plates » (dessinées, sans AcroForm)
  const flatBox = (y, label) => {
    page.drawRectangle({ x: 60, y, width: 12, height: 12, borderColor: BLACK, borderWidth: 1 });
    page.drawText(label, { x: 80, y: y + 2, size: 11, font });
  };
  flatBox(560, "J'accepte les conditions générales.");
  flatBox(535, "Je souhaite recevoir la lettre d'information.");

  page.drawText(
    'Les informations recueillies font l’objet d’un traitement destiné aux tests.',
    { x: 60, y: 490, size: 10, font, color: GRAY },
  );
  return doc.save();
}

async function acroform() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const form = doc.getForm();
  page.drawText('FORMULAIRE INTERACTIF (AcroForm)', { x: 60, y: 780, size: 16, font: bold });

  page.drawText('Nom :', { x: 60, y: 724, size: 12, font });
  const nom = form.createTextField('nom');
  nom.addToPage(page, { x: 150, y: 718, width: 250, height: 20, borderColor: GRAY, borderWidth: 1 });

  page.drawText('Ville :', { x: 60, y: 684, size: 12, font });
  const ville = form.createTextField('ville');
  ville.addToPage(page, { x: 150, y: 678, width: 250, height: 20, borderColor: GRAY, borderWidth: 1 });

  const majeur = form.createCheckBox('majeur');
  majeur.addToPage(page, { x: 60, y: 630, width: 15, height: 15, borderColor: BLACK, borderWidth: 1 });
  page.drawText('Je certifie être majeur(e).', { x: 84, y: 633, size: 11, font });

  const news = form.createCheckBox('newsletter');
  news.addToPage(page, { x: 60, y: 600, width: 15, height: 15, borderColor: BLACK, borderWidth: 1 });
  page.drawText("Je m'abonne à la lettre d'information.", { x: 84, y: 603, size: 11, font });

  return doc.save();
}

async function rotated() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage(A4);
  page.setRotation(degrees(90));
  // Texte lisible une fois la page pivotée (dessiné tourné dans l'espace utilisateur)
  page.drawText('Page pivotée à 90 degrés — cible des tests de rotation.', {
    x: 520, y: 120, size: 14, font, rotate: degrees(90),
  });
  page.drawText('Nom : ' + '.'.repeat(40), { x: 480, y: 120, size: 12, font, rotate: degrees(90) });
  return doc.save();
}

fs.mkdirSync(outDir, { recursive: true });
const jobs = { 'simple.pdf': simple, 'dotted-form.pdf': dottedForm, 'acroform.pdf': acroform, 'rotated.pdf': rotated };
for (const [name, make] of Object.entries(jobs)) {
  fs.writeFileSync(path.join(outDir, name), await make());
}
console.log(`Fixtures générées → ${outDir} (${Object.keys(jobs).join(', ')})`);
