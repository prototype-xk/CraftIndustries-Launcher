# Préparation du modpack (local)

Ce dossier sert à **préparer** le contenu du modpack avant de le publier.
Rien ici n'est chargé directement par le launcher : tout passe par la release GitHub.

## 1. `mods/`

Déposez ici les `.jar` de vos mods.

## 2. `overrides/`

Déposez ici tout le **reste** du modpack, en respectant l'arborescence du dossier
de jeu (`%APPDATA%\.craftindustries`). Exemples :

```
overrides/
├── config/                 (configs des mods)
├── defaultconfigs/
├── kubejs/                 (vos scripts KubeJS)
│   ├── server_scripts/
│   ├── client_scripts/
│   ├── startup_scripts/
│   └── assets/
├── resourcepacks/
└── ... (tout fichier à déployer dans le dossier de jeu)
```

> ⚠️ Ne mettez **pas** les mods dans `overrides/` : ils ont leur propre dossier `mods/`.

## 3. Générer puis publier

```bash
npm run make-manifest -- --tag modpack-v1
```

Cela produit :
- `modpack/manifest.json` (mods + entrée `overrides`),
- `build-modpack/overrides.zip` (archive de tout le dossier `overrides/`).

Ensuite, créez la release GitHub taguée `modpack-v1` et uploadez :
- tous les `.jar` de `mods/`,
- `build-modpack/overrides.zip`.

Au lancement, le launcher synchronise les mods **et** extrait `overrides.zip` dans le
dossier de jeu (en supprimant les fichiers d'overrides retirés depuis la version précédente).
