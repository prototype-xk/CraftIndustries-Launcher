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

## 3. Gérer les mods (le modpack)

Les mods sont décrits dans **`modpack/manifest.json`** et distribués via **GitHub Releases**.

### a) Ajouter / mettre à jour les mods

1. Déposez les `.jar` de vos mods dans `build-modpack/mods/`.
2. Générez le manifeste (calcule les SHA-1 et les URLs) :

   ```bash
   npm run make-manifest -- --tag modpack-v1
   ```

3. Poussez le manifeste mis à jour :

   ```bash
   git add modpack/manifest.json
   git commit -m "Modpack v1"
   git push
   ```

4. Sur GitHub → **Releases → Draft a new release** :
   - Tag : `modpack-v1` (le même que `--tag`)
   - Uploadez les mêmes `.jar` que dans `build-modpack/mods/`
   - Publiez.

Au prochain lancement, **chaque joueur télécharge automatiquement** les mods manquants
et supprime ceux qui ne sont plus dans la liste. Pour mettre à jour : nouveau tag
(`modpack-v2`), `make-manifest --tag modpack-v2`, push, nouvelle release.

> ⚠️ Vérifiez les licences des mods avant de les redistribuer. Pour les mods qui
> l'interdisent, mettez dans `manifest.json` une `url` pointant vers la source
> officielle (Modrinth / CurseForge) plutôt que vers votre release.

Format d'une entrée de mod :

```json
{
  "name": "jei-1.20.1-forge.jar",
  "url": "https://github.com/prototype-xk/CraftIndustries-Launcher/releases/download/modpack-v1/jei-1.20.1-forge.jar",
  "sha1": "…",
  "size": 1234567
}
```

---

## 4. Publier le launcher (+ auto-update)

L'auto-update est géré par GitHub Actions : il suffit de pousser un **tag de version**.

```bash
# Incrémentez "version" dans package.json (ex: 1.0.1) puis :
git add package.json
git commit -m "v1.0.1"
git tag v1.0.1
git push origin main --tags
```

Le workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) :
1. build le `.exe` (NSIS) sur `windows-latest`,
2. publie l'installeur **et** `latest.yml` dans une GitHub Release.

Les launchers déjà installés détectent la nouvelle version au démarrage,
la téléchargent et proposent **« Redémarrer »**.

### Build local (test, sans publier)

```bash
npm run dist     # génère l'installeur dans dist/
```

> 💡 L'`.exe` n'est pas signé : Windows SmartScreen affichera un avertissement
> (« Informations complémentaires » → « Exécuter quand même »). Pour l'éviter,
> il faut un certificat de signature de code (payant).

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
