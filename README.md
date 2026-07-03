# Éditeur PDF — extension Chrome

Extension Chrome (Manifest V3) pour **afficher, remplir et annoter des PDF directement dans le navigateur**, puis **enregistrer le résultat**. Quand l'extension est active, les PDF ouverts dans Chrome s'affichent dans l'éditeur à la place du lecteur natif.

## Fonctionnalités

| Outil | Raccourci | Description |
|---|---|---|
| **Sélection** | `V` | Sélectionner, déplacer, redimensionner, supprimer les éléments ajoutés |
| **Texte** | `T` | Ajouter du texte n'importe où (taille, couleur, fond blanc optionnel, accents pris en charge) |
| **Pointillés** | `P` | Les lignes `..........`, `. . . .` et `____` deviennent cliquables : le texte tapé **recouvre les points sans rien déplacer** (façon touche Insert) |
| **Cocher** | `C` | Poser une coche ✓ ou une croix ✗ sur les cases « imprimées » |
| **Surligner** | `S` | Sélectionner du texte → surlignage (fusion *multiply*, texte lisible) ; rectangle libre hors texte |
| **Blanco** | `B` | Rectangle blanc pour masquer du contenu (correcteur) |

Et aussi :

- **Formulaires interactifs (AcroForm)** : champs texte et cases à cocher remplissables, valeurs enregistrées dans le PDF (accents compris) ;
- **Enregistrer** (`Ctrl+S`) : télécharge le PDF avec toutes les éditions incrustées — le rendu est identique à l'aperçu ;
- **Imprimer** (`Ctrl+P`) : imprime le PDF édité en pleine qualité vectorielle ;
- **Annuler / Rétablir** (`Ctrl+Z` / `Ctrl+Y`), zoom (`Ctrl+molette`), navigation, glisser-déposer de fichiers ;
- Pages pivotées (90/180/270°) prises en charge, y compris à l'export.

## Installation

1. Récupérer ce dépôt (`git clone` ou archive ZIP).
2. Ouvrir `chrome://extensions`.
3. Activer le **Mode développeur** (interrupteur en haut à droite).
4. Cliquer sur **« Charger l'extension non empaquetée »** et choisir le dossier **`extension/`** du dépôt.
5. *(Recommandé)* Dans **Détails** de l'extension, activer **« Autoriser l'accès aux URL de fichier »** pour que les PDF locaux (`file://`) s'ouvrent aussi dans l'éditeur.

Aucune étape de build : le dossier `extension/` se charge tel quel.

## Utilisation

- **PDF du web** : ouvrez n'importe quelle URL `.pdf` — l'éditeur remplace le lecteur natif. (Désactivable via le menu `⋯` → « Ouvrir automatiquement les PDF ».)
- **PDF locaux** : ouvrez un fichier `.pdf` (nécessite l'accès aux URL de fichier), ou glissez-déposez-le dans la fenêtre de l'éditeur.
- **PDF servis sans `.pdf` dans l'adresse** : clic droit sur la page → **« Ouvrir cette page dans l'Éditeur PDF »**, ou cliquez sur l'icône de l'extension. Un clic droit sur un lien PDF propose aussi « Ouvrir le lien dans l'Éditeur PDF ».
- **Enregistrer** produit `nom (modifie).pdf` dans vos téléchargements ; « Télécharger l'original » est disponible dans le menu `⋯`.

## Limites connues (v1)

- Le texte **existant** du PDF n'est pas ré-éditable en place (pas de re-mise en page) : utilisez Blanco + Texte, ou l'outil Pointillés.
- Formulaires **XFA** : affichage seul.
- PDF protégés par mot de passe : lecture possible (mot de passe demandé) ; l'enregistrement n'est pas garanti.
- Caractères hors alphabet latin étendu (émoji, CJK…) remplacés par `?` à l'export.
- Le remplacement du lecteur natif repose sur l'extension `.pdf` de l'URL ; les PDF détectés uniquement par type MIME s'ouvrent via le menu contextuel ou l'icône.

## Développement

```bash
npm install        # outillage uniquement
npm run vendor     # (re)copie pdf.js / pdf-lib vers extension/vendor/ (commité)
npm run icons      # régénère les icônes PNG
npm run fixtures   # génère les PDF de test dans tests/fixtures/
npm test           # suite Playwright (Chromium + extension chargée)
```

- **Rendu** : [pdf.js](https://mozilla.github.io/pdf.js/) (build *legacy*, Apache-2.0) — canvas HiDPI, couche texte, couche annotations (formulaires).
- **Enregistrement** : [pdf-lib](https://pdf-lib.js.org/) (MIT) — éditions incrustées dans le PDF d'origine, formulaire rempli via `updateFieldAppearances`.
- Les éditions sont stockées **en espace PDF** (points, origine bas-gauche) : indépendantes du zoom et de la rotation. Versions vendorisées : `extension/vendor/VERSIONS.json`.
- Interception : règle `declarativeNetRequest` dynamique (navigations `main_frame` vers `*.pdf`) + `webNavigation` pour `file://`.

### Vérification manuelle (avant publication)

1. Charger l'extension, ouvrir une URL `.pdf` réelle → l'éditeur s'ouvre.
2. Remplir un formulaire administratif à pointillés (outil Pointillés), cocher des cases, surligner, blanco.
3. `Ctrl+S`, rouvrir le fichier téléchargé : le rendu doit être identique à l'aperçu.
4. Vérifier un PDF local (`file://`), l'impression, le zoom pendant l'édition, Ctrl+Z/Y.
5. Menu `⋯` : désactiver l'ouverture automatique → une URL `.pdf` s'ouvre dans le lecteur natif ; réactiver.
