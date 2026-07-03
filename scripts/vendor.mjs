// Copie les bibliothèques depuis node_modules vers extension/vendor/ (sortie commitée :
// l'extension se charge « non empaquetée » sans étape de build).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'extension', 'vendor');

// [source relative à node_modules, destination relative à extension/vendor]
const COPIES = [
  ['pdfjs-dist/build/pdf.mjs', 'pdfjs/pdf.mjs'],
  ['pdfjs-dist/build/pdf.worker.mjs', 'pdfjs/pdf.worker.mjs'],
  ['pdfjs-dist/web/pdf_viewer.css', 'pdfjs/pdf_viewer.css'],
  ['pdfjs-dist/web/images', 'pdfjs/images'],
  ['pdfjs-dist/cmaps', 'pdfjs/cmaps'],
  ['pdfjs-dist/standard_fonts', 'pdfjs/standard_fonts'],
  ['pdfjs-dist/iccs', 'pdfjs/iccs'],
  ['pdfjs-dist/wasm/jbig2.wasm', 'pdfjs/wasm/jbig2.wasm'],
  ['pdfjs-dist/wasm/jbig2_nowasm_fallback.js', 'pdfjs/wasm/jbig2_nowasm_fallback.js'],
  ['pdfjs-dist/wasm/openjpeg.wasm', 'pdfjs/wasm/openjpeg.wasm'],
  ['pdfjs-dist/wasm/openjpeg_nowasm_fallback.js', 'pdfjs/wasm/openjpeg_nowasm_fallback.js'],
  ['pdfjs-dist/wasm/qcms_bg.wasm', 'pdfjs/wasm/qcms_bg.wasm'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
  ['pdf-lib/dist/pdf-lib.esm.min.js', 'pdf-lib/pdf-lib.esm.min.js'],
  ['pdf-lib/LICENSE.md', 'pdf-lib/LICENSE.md'],
];
// quickjs-eval.* (sandbox de scripting) volontairement exclu : enableScripting est désactivé.

fs.rmSync(out, { recursive: true, force: true });

for (const [src, dst] of COPIES) {
  const from = path.join(nm, src);
  const to = path.join(out, dst);
  if (!fs.existsSync(from)) {
    console.error(`ERREUR : chemin source manquant : ${src}`);
    console.error('La structure du paquet a probablement changé — mettre à jour scripts/vendor.mjs.');
    process.exit(1);
  }
  fs.cpSync(from, to, { recursive: true });
}

const versionOf = (pkg) =>
  JSON.parse(fs.readFileSync(path.join(nm, pkg, 'package.json'), 'utf8')).version;

fs.writeFileSync(
  path.join(out, 'VERSIONS.json'),
  JSON.stringify(
    {
      'pdfjs-dist': { version: versionOf('pdfjs-dist'), license: 'Apache-2.0' },
      'pdf-lib': { version: versionOf('pdf-lib'), license: 'MIT' },
      generatedBy: 'scripts/vendor.mjs',
    },
    null,
    2,
  ) + '\n',
);

console.log(`Vendoring terminé → ${path.relative(root, out)}`);
console.log(`  pdfjs-dist ${versionOf('pdfjs-dist')}, pdf-lib ${versionOf('pdf-lib')}`);
