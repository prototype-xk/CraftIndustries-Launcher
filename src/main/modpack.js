'use strict';

// Synchronisation du modpack :
//  1) les mods (un fichier .jar par entrée du manifeste) -> dossier mods/
//  2) les "overrides" (config, kubejs, defaultconfigs, ressources...) empaquetés
//     dans un overrides.zip, extrait proprement dans le dossier de jeu.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');
const { downloadFile, sha1File } = require('./util');

const STATE_FILE = '.craftindustries-pack.json';

/* ---------- Manifeste ---------- */
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

/* ---------- État local (suivi des overrides appliqués) ---------- */
function readState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.getGameDir(), STATE_FILE), 'utf8'));
  } catch {
    return { overridesVersion: null, files: [] };
  }
}
function writeState(state) {
  try {
    fs.writeFileSync(path.join(config.getGameDir(), STATE_FILE), JSON.stringify(state, null, 2));
  } catch { /* non bloquant */ }
}

/* ---------- Mods ---------- */
async function syncMods(manifest, { onStatus, onProgress } = {}) {
  const modsDir = path.join(config.getGameDir(), 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  const wanted = new Set(manifest.mods.map((m) => m.name));
  const allowedSha = new Set((manifest.allowedMods || []).map((m) => String(m.sha1 || '').toLowerCase()).filter(Boolean));

  // Anti-triche : on garde les mods obligatoires + les mods client AUTORISÉS (par SHA-1),
  // et on supprime tout autre .jar (xray, killaura, etc.).
  for (const file of fs.readdirSync(modsDir)) {
    if (!file.endsWith('.jar') || wanted.has(file)) continue;
    let allowed = false;
    if (allowedSha.size) {
      try { allowed = allowedSha.has((await sha1File(path.join(modsDir, file))).toLowerCase()); } catch { allowed = false; }
    }
    if (!allowed) {
      if (onStatus) onStatus(`Mod non autorisé supprimé : ${file}`);
      fs.rmSync(path.join(modsDir, file), { force: true });
    }
  }

  const total = manifest.mods.length;
  let done = 0;
  for (const mod of manifest.mods) {
    const dest = path.join(modsDir, mod.name);
    let valid = fs.existsSync(dest);
    if (valid && mod.sha1) {
      valid = (await sha1File(dest)).toLowerCase() === String(mod.sha1).toLowerCase();
    }
    if (!valid) {
      if (onStatus) onStatus(`Téléchargement du mod : ${mod.name}`);
      await downloadFile(mod.url, dest, (recv, size) => {
        if (onProgress) onProgress({ done, total, file: mod.name, recv, size });
      });
    }
    done += 1;
    if (onProgress) onProgress({ done, total, file: mod.name });
  }
  if (onStatus) onStatus(total ? `${total} mod(s) synchronisé(s)` : 'Aucun mod à synchroniser');
}

/* ---------- Overrides (config / kubejs / ...) ---------- */

// Extrait une archive d'overrides dans gameDir en nettoyant les fichiers
// précédemment posés qui ne sont plus présents. Renvoie la nouvelle liste.
// (Fonction pure et testable : pas de téléchargement ici.)
function applyOverridesArchive(zipPath, gameDir, prevFiles = []) {
  const zip = new AdmZip(zipPath);
  const newFiles = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const rel = entry.entryName.replace(/\\/g, '/');
    const target = path.join(gameDir, rel);
    // Garde-fou anti "zip slip" : la cible doit rester dans gameDir.
    const within = path.relative(gameDir, target);
    if (within.startsWith('..') || path.isAbsolute(within)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
    newFiles.push(rel);
  }

  // Supprime les fichiers d'overrides retirés depuis la version précédente.
  const keep = new Set(newFiles);
  for (const old of prevFiles) {
    if (!keep.has(old)) {
      try { fs.rmSync(path.join(gameDir, old), { force: true }); } catch { /* ignore */ }
    }
  }
  return newFiles;
}

// Sauvegarde best-effort des fichiers d'overrides actuels avant une mise à jour.
// Conserve les 3 dernières sauvegardes dans gameDir/backups/<horodatage>/.
function backupOverrides(gameDir, files) {
  if (!files || !files.length) return;
  try {
    const root = path.join(gameDir, 'backups');
    fs.mkdirSync(root, { recursive: true });
    const existing = fs.readdirSync(root).filter((d) => /^\d{4}-/.test(d)).sort();
    while (existing.length >= 3) { try { fs.rmSync(path.join(root, existing.shift()), { recursive: true, force: true }); } catch { /* */ } }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(root, stamp);
    for (const rel of files) {
      const src = path.join(gameDir, rel);
      if (!fs.existsSync(src)) continue;
      const out = path.join(dest, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.copyFileSync(src, out);
    }
  } catch { /* non bloquant */ }
}

async function syncOverrides(manifest, { onStatus, onProgress } = {}) {
  const gameDir = config.getGameDir();
  fs.mkdirSync(gameDir, { recursive: true });
  const state = readState();
  const ov = manifest.overrides;

  // Pas d'overrides dans ce pack : on nettoie ceux d'avant si besoin.
  if (!ov || !ov.url) {
    if (state.files && state.files.length) {
      for (const f of state.files) { try { fs.rmSync(path.join(gameDir, f), { force: true }); } catch { /* ignore */ } }
      writeState({ overridesVersion: null, files: [] });
    }
    return;
  }

  const version = ov.sha1 || ov.url;
  if (state.overridesVersion === version) {
    if (onStatus) onStatus('Configs déjà à jour');
    return; // déjà appliqué
  }

  if (onStatus) onStatus('Téléchargement des configs & scripts...');
  const tmp = path.join(gameDir, 'overrides.zip.tmp');
  await downloadFile(ov.url, tmp, (recv, size) => {
    if (onProgress) onProgress({ phase: 'overrides', recv, size });
  });

  if (ov.sha1) {
    const actual = await sha1File(tmp);
    if (actual.toLowerCase() !== String(ov.sha1).toLowerCase()) {
      fs.rmSync(tmp, { force: true });
      throw new Error('Archive de configs corrompue (SHA-1 invalide).');
    }
  }

  if (state.files && state.files.length) {
    if (onStatus) onStatus('Sauvegarde des configs actuelles...');
    backupOverrides(gameDir, state.files);
  }
  if (onStatus) onStatus('Application des configs & scripts...');
  const files = applyOverridesArchive(tmp, gameDir, state.files || []);
  fs.rmSync(tmp, { force: true });
  writeState({ overridesVersion: version, files });
  if (onStatus) onStatus(`${files.length} fichier(s) de config appliqué(s)`);
}

// Réinitialise l'installation : prochain lancement = resynchro complète.
function repairPack() {
  const gameDir = config.getGameDir();
  try { fs.rmSync(path.join(gameDir, 'mods'), { recursive: true, force: true }); } catch { /* ignore */ }
  try { fs.rmSync(path.join(gameDir, STATE_FILE), { force: true }); } catch { /* ignore */ }
  return true;
}

module.exports = { fetchManifest, syncMods, syncOverrides, applyOverridesArchive, repairPack };
