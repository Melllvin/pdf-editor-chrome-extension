// Export du PDF modifié : incrustation des éditions + remplissage du
// formulaire (M8) avec pdf-lib, puis téléchargement.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  BlendMode,
  LineCapStyle,
} from '../../vendor/pdf-lib/pdf-lib.esm.min.js';
import { LINE_HEIGHT_FACTOR, BASELINE_FACTOR } from '../edits/types.js';

/**
 * @param {{
 *   originalBytes: Uint8Array,
 *   edits: object[],
 *   formValues?: {name: string, type: string, value: any}[],
 * }} opts
 * @returns {Promise<{bytes: Uint8Array, warnings: Set<string>}>}
 */
export async function exportPdf({ originalBytes, edits, formValues = [] }) {
  const doc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const warnings = new Set();

  applyFormValues(doc, formValues, helv, warnings);

  for (const edit of edits) {
    const page = doc.getPage(edit.pageIndex);
    switch (edit.type) {
      case 'text':
      case 'fill':
        drawTextEdit(page, edit, helv, warnings);
        break;
      case 'check':
        drawCheckEdit(page, edit);
        break;
      case 'highlight':
        for (const r of edit.rects) {
          page.drawRectangle({
            x: r.x,
            y: r.y,
            width: r.w,
            height: r.h,
            color: hexToRgb(edit.color),
            blendMode: BlendMode.Multiply,
          });
        }
        break;
      case 'whiteout':
        page.drawRectangle({ x: edit.x, y: edit.y, width: edit.w, height: edit.h, color: rgb(1, 1, 1) });
        break;
      default:
        break;
    }
  }

  const bytes = await doc.save();
  return { bytes, warnings };
}

// ---------- Texte ----------

function drawTextEdit(page, edit, font, warnings) {
  const size = edit.fontSize;
  const lineHeight = size * LINE_HEIGHT_FACTOR;
  const lines = edit.text.split('\n').map((l) => sanitizeWinAnsi(l, font, warnings));
  const firstBaseline = edit.yTop - size * BASELINE_FACTOR;

  if (edit.whiteBg) {
    // Reproduit la boîte de l'élément à l'écran : du haut yTop, n lignes de haut
    const maxWidth = Math.max(0, ...lines.map((l) => font.widthOfTextAtSize(l, size)));
    const height = lineHeight * lines.length;
    const pad = 1.2; // équivalent du halo CSS qui déborde du bord des points
    page.drawRectangle({
      x: edit.x - pad,
      y: edit.yTop - height - pad,
      width: maxWidth + pad * 2,
      height: height + pad * 2,
      color: rgb(1, 1, 1),
    });
  }

  const color = hexToRgb(edit.color);
  lines.forEach((line, i) => {
    if (!line) return;
    page.drawText(line, {
      x: edit.x,
      y: firstBaseline - i * lineHeight,
      size,
      font,
      color,
    });
  });
}

/** Remplace les caractères hors WinAnsi (emoji, CJK…) par « ? ». */
function sanitizeWinAnsi(text, font, warnings) {
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
      warnings.add('charReplaced');
    }
  }
  return out;
}

// ---------- Coche / croix (traits vectoriels : aucun aléa de police) ----------

function drawCheckEdit(page, edit) {
  const { x, y, size } = edit;
  const color = hexToRgb(edit.color);
  const thickness = Math.max(1.4, size * 0.12);
  const seg = (x1, y1, x2, y2) =>
    page.drawLine({
      start: { x: x + size * x1, y: y + size * y1 },
      end: { x: x + size * x2, y: y + size * y2 },
      thickness,
      color,
      lineCap: LineCapStyle.Round,
    });
  if (edit.glyph === 'cross') {
    // mêmes proportions que le SVG de l'aperçu (M4 4→16 16 / M16 4→4 16, boîte 20)
    seg(0.2, 0.8, 0.8, 0.2);
    seg(0.8, 0.8, 0.2, 0.2);
  } else {
    // ✓ : M3 11 L8 16 L17 4 (boîte 20, origine haut) → origine PDF en bas
    seg(0.15, 0.45, 0.4, 0.2);
    seg(0.4, 0.2, 0.85, 0.8);
  }
}

// ---------- Formulaire (activé au jalon M8) ----------

function applyFormValues(doc, values, font, warnings) {
  if (!values.length) return;
  let form;
  try {
    form = doc.getForm();
  } catch {
    return;
  }
  for (const { name, type, value } of values) {
    try {
      if (type === 'text') {
        form.getTextField(name).setText(value ?? '');
      } else if (type === 'checkbox') {
        if (value) form.getCheckBox(name).check();
        else form.getCheckBox(name).uncheck();
      } else if (type === 'radiobutton' && value != null) {
        form.getRadioGroup(name).select(value);
      } else if ((type === 'combobox' || type === 'listbox') && value != null) {
        form.getDropdown(name).select(value);
      }
    } catch (err) {
      console.warn('Champ de formulaire ignoré :', name, err);
      warnings.add('fieldSkipped');
    }
  }
  try {
    // Régénère les apparences avec une police couvrant les accents français,
    // même si la police d'origine du champ ne le permettait pas.
    form.updateFieldAppearances(font);
  } catch (err) {
    console.warn('updateFieldAppearances a échoué :', err);
  }
}

// ---------- Utilitaires ----------

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return rgb(
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  );
}

/** Déclenche le téléchargement du PDF. */
export function download(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a); // l'attribut download n'est honoré qu'attaché au DOM
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * « dossier.pdf » → « dossier (modifie).pdf ».
 * ASCII uniquement : Chromium ignore l'attribut download (repli « download »)
 * dès que le nom contient un caractère non ASCII.
 */
export function suggestName(fileName) {
  const base = fileName
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // é → e, ç → c…
    .replace(/[^\x20-\x7E]/g, '_');
  return `${base} (modifie).pdf`;
}
