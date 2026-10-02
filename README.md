# Claude Export Merger

Transforme un export de données Claude (compte, projets, conversations) en une
archive **Markdown** lisible, **entièrement dans le navigateur**. Aucune donnée ne
quitte votre machine : les zips sont lus en mémoire et l'archive est produite côté
client.

## Pourquoi pas un téléchargement automatique ?

Les `export_url` du manifeste Claude refusent les requêtes cross-origin (CORS) et
sont à usage unique. L'app les expose donc comme simples liens : votre navigateur
télécharge chaque zip avec votre session claude.ai, puis vous déposez les zips
dans l'app.

## Utilisation

Ouvrez l'app (version publiée sur GitHub Pages, ou en local, voir plus bas), puis :

1. Déposez le fichier `member-manifest-*.json` fourni par Claude.
2. Cliquez « Télécharger » pour chaque fichier listé, **une seule fois par fichier**
   (l'URL ne fonctionne qu'une fois).
3. Déposez les zips téléchargés dans la zone prévue.
4. Cliquez « Générer l'archive ».

Si un zip manque, un bouton « Générer quand même (partiel) » reste disponible et
l'archive le signale.

## Contenu de l'archive

L'archive `claude-export-<date>.zip` est entièrement en Markdown :

```
claude-export-2026-09-17/
  README.md                                   # index : compte (nom, e-mail), chiffres, liens
  projects/<projet>-<id>/README.md            # fiche projet (description, instructions, documents)
  projects/<projet>-<id>/conversations/<date>-<titre>-<id>.md
  conversations/<date>-<titre>-<id>.md        # conversations sans projet
```

Chaque conversation est un fichier qui se lit comme dans l'interface Claude :
messages dans l'ordre, fichiers créés par Claude inclus (Markdown inliné ou bloc
de code), autres appels d'outils résumés en une ligne, résultats d'outils et
raisonnement omis, aucune métadonnée JSON. L'historique de connexion n'est pas
archivé. Un JSON que l'app ne sait pas lire est recopié tel quel et signalé dans
le `README.md` de l'archive.

Limites connues : tout est traité en mémoire (confortable jusqu'à quelques
centaines de Mo d'export) ; le rapprochement zip ↔ manifeste se fait sur le nom
de fichier, le suffixe ` (1)` ajouté par le navigateur est toléré.

## Lancer en local

Prérequis : Node.js 24 recommandé (fichier `.nvmrc` fourni, `nvm use` suffit), 22.12 minimum.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Développement

```bash
npm test           # tests unitaires (Vitest)
npm run build      # dist/ statique, hébergeable n'importe où
npm run preview    # sert dist/ en local pour vérification
```

Stack : Vite, JavaScript sans framework, [fflate](https://github.com/101arrowz/fflate)
pour lire et écrire les zips. Code dans `src/` (modules purs testés sous Node :
`manifest`, `zipIntake`, `convert`, `archive`, `render/*`, `state` ; interface dans
`ui/` et `main.js`), tests dans `tests/`.
