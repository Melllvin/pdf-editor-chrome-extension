// Petit serveur HTTP pour les tests : sert les PDF de tests/fixtures/.
// Routes spéciales :
//   /sans-extension-pdf  → sert simple.pdf sans « .pdf » dans l'URL (non intercepté par DNR)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const PORT = 8123;

if (!fs.existsSync(path.join(FIXTURES, 'simple.pdf'))) {
  await import('../scripts/make-fixtures.mjs'); // génère les fixtures manquantes
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
    const name =
      pathname === '/sans-extension-pdf' ? 'simple.pdf' : path.basename(pathname);
    const file = path.join(FIXTURES, name);
    if (name && fs.existsSync(file)) {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': fs.statSync(file).size,
      });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('introuvable');
    }
  })
  .listen(PORT, () => console.log(`Fixtures servies sur http://127.0.0.1:${PORT}`));
