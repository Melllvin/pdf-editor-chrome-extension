# Éditeur PDF — extension Chrome

Extension Chrome (Manifest V3) pour **afficher, remplir et annoter des PDF directement dans le navigateur** : texte libre, remplissage des lignes pointillées, cases à cocher, surlignage, blanco, formulaires interactifs (AcroForm), puis enregistrement du PDF modifié.

> Projet en cours de construction — voir les jalons dans l'historique des commits.

## Installation (extension non empaquetée)

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur** (en haut à droite).
3. Cliquer sur **« Charger l'extension non empaquetée »** et choisir le dossier `extension/` de ce dépôt.
4. (Recommandé) Dans les détails de l'extension, activer **« Autoriser l'accès aux URL de fichier »** pour ouvrir les PDF locaux (`file://`).

## Développement

```bash
npm install        # outillage uniquement (l'extension n'a pas de build)
npm run vendor     # (re)copie pdf.js et pdf-lib vers extension/vendor/ (commité)
npm run icons      # régénère les icônes PNG
npm run fixtures   # génère les PDF de test dans tests/fixtures/
npm test           # tests de bout en bout (Playwright + Chromium)
```

Le dossier `extension/` se charge tel quel dans Chrome : JavaScript vanilla en modules ES, aucune étape de build. Les bibliothèques ([pdf.js](https://mozilla.github.io/pdf.js/), licence Apache-2.0, et [pdf-lib](https://pdf-lib.js.org/), licence MIT) sont vendorisées dans `extension/vendor/` — versions listées dans `extension/vendor/VERSIONS.json`.
