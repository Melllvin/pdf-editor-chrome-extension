// Assertions côté Node sur les PDF produits : extraction de texte (pdf.js),
// relecture de formulaire (pdf-lib), inspection des flux de contenu décodés.
import fs from 'node:fs';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRawStream,
  PDFDict,
  decodePDFRawStream,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/** @param {string|Uint8Array} src chemin ou octets */
export function toBytes(src) {
  return typeof src === 'string' ? new Uint8Array(fs.readFileSync(src)) : src;
}

/** Texte brut d'une page (items joints par des espaces). */
export async function extractText(src, pageIndex = 0) {
  const task = pdfjsLib.getDocument({
    data: toBytes(src).slice(),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    return content.items.map((i) => i.str).join(' ');
  } finally {
    await task.destroy();
  }
}

/** Formulaire pdf-lib du document. */
export async function loadForm(src) {
  const doc = await PDFDocument.load(toBytes(src));
  return doc.getForm();
}

/**
 * Flux de contenu d'une page, décodés (FlateDecode) et concaténés en texte —
 * pour vérifier la présence d'opérateurs (« 1 1 1 rg », « re », …).
 */
export async function pageContent(src, pageIndex = 0) {
  const doc = await PDFDocument.load(toBytes(src));
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return '';
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let out = '';
  for (const refOrStream of refs) {
    const stream = doc.context.lookup(refOrStream);
    if (!(stream instanceof PDFRawStream)) continue;
    out += Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1') + '\n';
  }
  return out;
}

/** La page référence-t-elle un ExtGState en mode de fusion Multiply ? */
export async function pageHasMultiplyBlend(src, pageIndex = 0) {
  const doc = await PDFDocument.load(toBytes(src));
  const page = doc.getPage(pageIndex);
  const resources = page.node.Resources();
  const extGState = resources?.lookup(PDFName.of('ExtGState'));
  if (!(extGState instanceof PDFDict)) return false;
  for (const [, value] of extGState.entries()) {
    const gs = doc.context.lookup(value);
    if (gs instanceof PDFDict && gs.get(PDFName.of('BM'))?.toString() === '/Multiply') {
      return true;
    }
  }
  return false;
}
