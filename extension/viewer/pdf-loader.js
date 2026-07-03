// Chargement des octets (URL http/https/file/blob ou File) puis ouverture pdf.js.
import * as pdfjsLib from '../vendor/pdfjs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

export { pdfjsLib };

export class LoadError extends Error {
  /** @param {'http'|'network'|'file-access'|'invalid'|'password-canceled'|'bad-scheme'} code */
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

const ALLOWED_SCHEMES = /^(https?|file|blob):/i;

export function isAllowedUrl(url) {
  return ALLOWED_SCHEMES.test(url);
}

/** Nom de fichier déduit d'une URL, pour le titre et le téléchargement. */
export function fileNameFromUrl(url, fallback) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').pop() || '');
    if (last) return last.toLowerCase().endsWith('.pdf') ? last : `${last}.pdf`;
  } catch {
    /* URL invalide : repli */
  }
  return fallback;
}

function xhrArrayBuffer(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      // Les URL file:// répondent status 0 en cas de succès.
      if (xhr.status === 200 || (xhr.status === 0 && xhr.response?.byteLength > 0)) {
        resolve(xhr.response);
      } else {
        reject(new LoadError('file-access', `status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new LoadError('file-access'));
    xhr.send();
  });
}

/**
 * Récupère les octets d'un PDF.
 * @param {string} url
 * @returns {Promise<Uint8Array>}
 */
export async function fetchBytes(url) {
  if (!isAllowedUrl(url)) throw new LoadError('bad-scheme', url);
  if (url.toLowerCase().startsWith('file:')) {
    // fetch() rejette le schéma file:, XHR fonctionne (si l'accès aux fichiers est accordé).
    return new Uint8Array(await xhrArrayBuffer(url));
  }
  let res;
  try {
    res = await fetch(url, { credentials: 'include' });
  } catch {
    throw new LoadError('network');
  }
  if (!res.ok) throw new LoadError('http', String(res.status));
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Ouvre un document avec pdf.js.
 * @param {Uint8Array} bytes octets originaux — ils sont copiés car pdf.js transfère
 *   (détache) le tampon vers son worker ; l'original reste utilisable pour l'export.
 * @param {{askPassword?: (isRetry: boolean) => Promise<string|null>}} [opts]
 * @returns {Promise<import('../vendor/pdfjs/pdf.mjs').PDFDocumentProxy>}
 */
export async function openDocument(bytes, { askPassword } = {}) {
  const task = pdfjsLib.getDocument({
    data: bytes.slice(),
    cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('../vendor/pdfjs/wasm/', import.meta.url).href,
    iccUrl: new URL('../vendor/pdfjs/iccs/', import.meta.url).href,
    isEvalSupported: false,
  });

  if (askPassword) {
    task.onPassword = async (updatePassword, reason) => {
      const isRetry = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
      const pwd = await askPassword(isRetry);
      if (pwd === null || pwd === undefined) {
        task.destroy();
        return;
      }
      updatePassword(pwd);
    };
  }

  try {
    return await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException' || /worker was destroyed/i.test(err?.message ?? '')) {
      throw new LoadError('password-canceled');
    }
    if (err?.name === 'InvalidPDFException') throw new LoadError('invalid');
    throw err;
  }
}
