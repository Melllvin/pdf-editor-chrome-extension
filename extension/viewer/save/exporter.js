// Export du PDF modifié : incrustation des éditions + remplissage du
// formulaire (M8) avec pdf-lib, puis téléchargement.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  BlendMode,
  LineCapStyle,
} from '../../vendor/pdf-lib/pdf-lib.esm.min.js';
import { LINE_HEIGHT_FACTOR, BASELINE_FACTOR } from '../edits/types.js';

/**
 * Compensation de la rotation de page (/Rotate 90|180|270) : les éditions sont
 * stockées en espace utilisateur mais pensées « à l'écran » (page affichée
 * pivotée). On exprime les directions écran (droite, bas) en espace
 * utilisateur pour que texte et coches restent droits à l'affichage.
 */
function screenFrame(page) {
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  switch (angle) {
    case 90:
      return { angle, right: [0, 1], down: [1, 0] };
    case 180:
      return { angle, right: [-1, 0], down: [0, 1] };
    case 270:
      return { angle, right: [0, -1], down: [-1, 0] };
    default:
      return { angle: 0, right: [1, 0], down: [0, -1] };
  }
}

/**
 * Coin écran-haut-gauche d'un rect user-space normalisé {x,y,w,h},
 * selon la rotation de la page.
 */
function screenTopLeftOfRect(rect, angle) {
  switch (angle) {
    case 90:
      return [rect.x, rect.y];
    case 180:
      return [rect.x + rect.w, rect.y];
    case 270:
      return [rect.x + rect.w, rect.y + rect.h];
    default:
      return [rect.x, rect.y + rect.h];
  }
}

/** Rect user-space normalisé couvrant, à l'écran, w×h depuis topLeft. */
function rectFromScreenBox(topLeft, w, h, { right, down }) {
  const x2 = topLeft[0] + right[0] * w + down[0] * h;
  const y2 = topLeft[1] + right[1] * w + down[1] * h;
  return {
    x: Math.min(topLeft[0], x2),
    y: Math.min(topLeft[1], y2),
    w: Math.abs(x2 - topLeft[0]),
    h: Math.abs(y2 - topLeft[1]),
  };
}

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
  const frame = screenFrame(page);
  const { right, down } = frame;
  // (x, yTop) = point user-space du coin écran-haut-gauche de la boîte
  const topLeft = [edit.x, edit.yTop];

  if (edit.whiteBg) {
    const maxWidth = Math.max(0, ...lines.map((l) => font.widthOfTextAtSize(l, size)));
    const height = lineHeight * lines.length;
    const pad = 1.2; // équivalent du halo CSS qui déborde du bord des points
    const padded = [
      topLeft[0] - right[0] * pad - down[0] * pad,
      topLeft[1] - right[1] * pad - down[1] * pad,
    ];
    const rect = rectFromScreenBox(padded, maxWidth + pad * 2, height + pad * 2, frame);
    page.drawRectangle({ x: rect.x, y: rect.y, width: rect.w, height: rect.h, color: rgb(1, 1, 1) });
  }

  const color = hexToRgb(edit.color);
  lines.forEach((line, i) => {
    if (!line) return;
    const offset = size * BASELINE_FACTOR + i * lineHeight; // descente écran jusqu'à la ligne de base
    page.drawText(line, {
      x: topLeft[0] + down[0] * offset,
      y: topLeft[1] + down[1] * offset,
      size,
      font,
      color,
      rotate: degrees(frame.angle),
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
  const { size } = edit;
  const color = hexToRgb(edit.color);
  const thickness = Math.max(1.4, size * 0.12);
  const frame = screenFrame(page);
  const corner = screenTopLeftOfRect({ x: edit.x, y: edit.y, w: size, h: size }, frame.angle);
  // (sx, sy) = fractions ÉCRAN depuis le haut-gauche → point user-space
  const pt = (sx, sy) => ({
    x: corner[0] + frame.right[0] * sx * size + frame.down[0] * sy * size,
    y: corner[1] + frame.right[1] * sx * size + frame.down[1] * sy * size,
  });
  const seg = (x1, y1, x2, y2) =>
    page.drawLine({
      start: pt(x1, y1),
      end: pt(x2, y2),
      thickness,
      color,
      lineCap: LineCapStyle.Round,
    });
  if (edit.glyph === 'cross') {
    // mêmes proportions que le SVG de l'aperçu (boîte 20 : M4 4→16 16 / M16 4→4 16)
    seg(0.2, 0.2, 0.8, 0.8);
    seg(0.8, 0.2, 0.2, 0.8);
  } else {
    // ✓ : M3 11 L8 16 L17 4 (boîte 20, fractions écran haut-gauche)
    seg(0.15, 0.55, 0.4, 0.8);
    seg(0.4, 0.8, 0.85, 0.2);
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
