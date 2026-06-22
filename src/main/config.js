'use strict';

// Configuration centrale du launcher.
// Source de vérité unique : le fichier package.json (champs "repository" et "launcher").
// => Pour pointer vers VOTRE dépôt, il suffit de modifier package.json.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const pkg = require('../../package.json');

// Déduit owner/repo depuis le champ "repository" de package.json.
function repoInfo() {
  const url = (pkg.repository && pkg.repository.url) || '';
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return {
    owner: m ? m[1] : 'OWNER',
    repo: m ? m[2] : 'REPO',
    branch: (pkg.launcher && pkg.launcher.branch) || 'main'
  };
}

const repo = repoInfo();

// URL "raw" du manifeste du modpack (toujours à jour sur la branche choisie).
const MANIFEST_URL =
  `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/modpack/manifest.json`;

// Dossier de jeu isolé (séparé du .minecraft officiel).
function getGameDir() {
  return path.join(app.getPath('appData'), '.craftindustries');
}

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function authFile() {
  return path.join(app.getPath('userData'), 'msmc-auth.json');
}

const DEFAULT_SETTINGS = {
  ramMax: 4096, // Mo
  ramMin: 2048, // Mo
  javaPath: '', // vide = détection automatique
  keepLauncherOpen: false
};

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = {
  pkg,
  repo,
  MANIFEST_URL,
  getGameDir,
  settingsFile,
  authFile,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings
};
