# CraftIndustries Launcher

Launcher Windows pour le **serveur Minecraft moddé CraftIndustries (Forge)**, en Electron, avec :

- 🔐 **Authentification Microsoft** officielle (OAuth, comptes premium)
- 📦 **Synchronisation automatique des mods** depuis GitHub (le joueur a toujours les bons mods)
- ⚙️ **Installation automatique de Forge** + téléchargement de Minecraft (via `minecraft-launcher-core`)
- 🔄 **Auto-update du launcher** via GitHub Releases (`electron-updater`)
- 🎚️ Réglages : mémoire allouée, chemin Java, etc.

> Par défaut : **Minecraft 1.20.1 + Forge 47.3.0** (modifiable dans `package.json`).

---

## 1. Configuration

Tout est centralisé dans **`package.json`** (déjà câblé sur ce dépôt) :

```jsonc
"repository": {
  "url": "https://github.com/prototype-xk/CraftIndustries-Launcher.git"
},
"launcher": {
  "branch": "main",
  "serverName": "CraftIndustries",    // ← nom affiché
  "minecraft": "1.20.1",              // ← version MC
  "forge": "47.3.0",                  // ← version Forge
  "serverIp": "play.exemple.fr",      // ← À REMPLACER par l'IP de votre serveur
  "serverPort": 25565
}
```

Le champ `repository` sert à **tout** : URL du manifeste des mods, cible de publication
du launcher et auto-update. Pas d'autre endroit à modifier.

---

## 2. Développement

```bash
npm install      # installe les dépendances
npm run dev      # lance le launcher (mode dev, DevTools ouverts)
```

- `npm start` : lance le launcher normalement.
- `npm run dev` : idem + DevTools, **sans** auto-update.

Le dossier de jeu est isolé dans `%APPDATA%\.craftindustries` (séparé du `.minecraft` officiel).

---

## 3. Gérer le modpack (mods + configs / KubeJS)

Un modpack = **les mods** *et* **tout le reste** (configs, scripts KubeJS, ressources…).
Le launcher synchronise les deux automatiquement au lancement :

- **Mods** : un `.jar` par entrée du manifeste, dans `mods/`.
- **Overrides** : tout le reste, empaqueté dans un `overrides.zip` extrait dans le dossier
  de jeu (avec **suppression des fichiers retirés** depuis la version précédente).

### a) Préparer le contenu

```
build-modpack/
├── mods/                 ← vos .jar
└── overrides/            ← tout le reste, en respectant l'arborescence du jeu
    ├── config/
    ├── kubejs/
    │   ├── server_scripts/
    │   ├── startup_scripts/
    │   └── ...
    ├── defaultconfigs/
    └── resourcepacks/
```

### b) Générer le manifeste + l'archive

```bash
npm run make-manifest -- --tag modpack-v1
```

Cela produit `modpack/manifest.json` (mods + entrée `overrides`) **et**
`build-modpack/overrides.zip`.

### c) Publier

1. Poussez le manifeste :
   ```bash
   git add modpack/manifest.json && git commit -m "Modpack v1" && git push
   ```
2. Sur GitHub → **Releases → Draft a new release**, tag `modpack-v1`, puis uploadez :
   - tous les `.jar` de `build-modpack/mods/`,
   - `build-modpack/overrides.zip`.
3. Publiez la release.

Pour une mise à jour : refaites avec un nouveau tag (`modpack-v2`, etc.). Les joueurs
récupèrent automatiquement les changements (mods **et** configs) au lancement suivant.
Le bouton **Paramètres → Forcer la resynchro** force un re-téléchargement complet.

> ⚠️ Vérifiez les licences des mods avant de les redistribuer. Pour les mods qui
> l'interdisent, mettez une `url` pointant vers la source officielle (Modrinth /
> CurseForge) plutôt que vers votre release.

Format du manifeste :

```json
{
  "mods": [
    { "name": "jei-1.20.1-forge.jar", "url": "https://github.com/…/jei.jar", "sha1": "…", "size": 1234567 }
  ],
  "overrides": {
    "name": "overrides.zip",
    "url": "https://github.com/…/releases/download/modpack-v1/overrides.zip",
    "sha1": "…",
    "size": 654321
  }
}
```

---

## 4. Publier le launcher — Windows / macOS / Linux (+ auto-update)

Le build des **3 plateformes** est automatique. Il suffit de pousser un **tag de version** :

```bash
# Incrémentez "version" dans package.json (ex: 1.0.1) puis :
git add package.json
git commit -m "v1.0.1"
git tag v1.0.1
git push origin main --tags
```

Le workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) lance **3 runners en parallèle** :

| OS runner | Artefacts produits |
|-----------|--------------------|
| `windows-latest` | `.exe` (NSIS) + `latest.yml` |
| `macos-latest` | `.dmg` + `.zip` (Intel x64 **et** Apple Silicon arm64) + `latest-mac.yml` |
| `ubuntu-latest` | `.AppImage` + `latest-linux.yml` |

Les 3 jobs déposent leurs fichiers dans **une même release GitHub, créée en brouillon**.
→ Vérifiez les artefacts dans l'onglet *Releases*, puis cliquez **« Publish release »**.
Une fois publiée, les launchers installés détectent la mise à jour et proposent **« Redémarrer »**.

> Vous pouvez aussi lancer le build à la main : onglet **Actions → Build & Release Launcher → Run workflow**.

### Signature de code (important)

Aucun certificat n'est utilisé sur le CI, donc les binaires ne sont **pas signés** :

- **Windows** : SmartScreen affiche un avertissement (« Informations complémentaires » → « Exécuter quand même »).
- **macOS** : Gatekeeper bloque l'ouverture → **clic droit → Ouvrir** la 1ʳᵉ fois. ⚠️ L'auto-update ne
  fonctionne pas sur macOS sans signature Apple (les utilisateurs retéléchargent le `.dmg`).
- **Linux** : l'AppImage fonctionne directement (`chmod +x` puis double-clic).

Pour supprimer ces avertissements il faut un certificat (Apple Developer ≈ 99 $/an, certificat Windows payant).

### Build local (test, sans publier)

```bash
npm run dist     # construit pour VOTRE OS uniquement, dans dist/
```

> Le build local ne génère que la plateforme courante (on ne peut pas créer un `.dmg`
> hors macOS). Le multi-plateforme se fait via GitHub Actions ci-dessus.

---

## 5. Authentification Microsoft

Le bouton **Se connecter** ouvre la fenêtre de connexion Microsoft officielle.
Le launcher ne stocke qu'un *refresh token* local (`%APPDATA%\CraftIndustries Launcher\msmc-auth.json`)
pour reconnecter automatiquement au démarrage. Aucun mot de passe n'est manipulé.

---

## 6. Java

Le launcher détecte automatiquement Java (Adoptium / JDK installés, sinon le PATH).
Minecraft **1.20.1 nécessite Java 17+**. Vous pouvez forcer un chemin précis dans
**Paramètres → Chemin Java**.

---

## Structure du projet

```
CraftIndustries-Launcher/
├── package.json              ← config centrale (dépôt, versions, serveur)
├── electron-builder.yml      ← config de packaging / publication
├── modpack/
│   └── manifest.json         ← liste des mods (distribuée via GitHub raw)
├── scripts/
│   └── generate-manifest.js  ← génère le manifeste depuis build-modpack/mods/
├── build-modpack/mods/       ← (local) vos .jar avant publication
├── src/
│   ├── main/                 ← processus principal Electron
│   │   ├── main.js           ← fenêtre, IPC, orchestration
│   │   ├── config.js         ← chemins + lecture de package.json
│   │   ├── auth.js           ← connexion Microsoft (msmc)
│   │   ├── modpack.js        ← téléchargement/sync des mods
│   │   ├── launcher.js       ← Forge + lancement (MCLC)
│   │   ├── util.js           ← download, SHA-1, détection Java
│   │   └── preload.js        ← pont sécurisé vers l'UI
│   └── renderer/             ← interface (HTML/CSS/JS)
└── .github/workflows/build.yml
```

## Licence

MIT — voir [LICENSE](LICENSE).
