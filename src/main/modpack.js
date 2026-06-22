'use strict';

// Synchronisation du modpack : récupère le manifeste depuis GitHub,
// puis aligne le dossier "mods" local avec la liste attendue.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { downloadFile, sha1File } = require('./util');

// Récupère le manifeste JSON (sans cache, pour toujours avoir la dernière version).
async function fetchManifest(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Manifeste introuvable (HTTP ${res.status}). Vérifiez modpack/manifest.json sur GitHub.`);
  }
  const manifest = await res.json();
  if (!Array.isArray(manifest.mods)) manifest.mods = [];
  if (!manifest.minecraft || !manifest.forge) {
    throw new Error('Manifeste invalide : champs "minecraft" et "forge" requis.');
  }
  return manifest;
}

// Aligne le dossier mods local sur le manifeste :
//  - supprime les .jar qui ne sont plus dans la liste,
//  - télécharge ceux qui manquent ou dont le SHA-1 ne correspond pas.
async function syncMods(manifest, { onStatus, onProgress } = {}) {
  const modsDir = path.join(config.getGameDir(), 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  const wanted = new Set(manifest.mods.map((m) => m.name));

  // Nettoyage des mods obsolètes (miroir exact du serveur).
  for (const file of fs.readdirSync(modsDir)) {
    if (file.endsWith('.jar') && !wanted.has(file)) {
      if (onStatus) onStatus(`Suppression : ${file}`);
      fs.rmSync(path.join(modsDir, file), { force: true });
    }
  }

  const total = manifest.mods.length;
  let done = 0;

  for (const mod of manifest.mods) {
    const dest = path.join(modsDir, mod.name);

    let valid = fs.existsSync(dest);
    if (valid && mod.sha1) {
      const actual = await sha1File(dest);
      valid = actual.toLowerCase() === String(mod.sha1).toLowerCase();
    }

    if (!valid) {
      if (onStatus) onStatus(`Téléchargement : ${mod.name}`);
      await downloadFile(mod.url, dest, (recv, size) => {
        if (onProgress) onProgress({ done, total, file: mod.name, recv, size });
      });
    }

    done += 1;
    if (onProgress) onProgress({ done, total, file: mod.name });
  }

  if (onStatus) onStatus(total ? `${total} mod(s) synchronisé(s)` : 'Aucun mod à synchroniser');
}

module.exports = { fetchManifest, syncMods };
