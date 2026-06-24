'use strict';

// Configuration centrale du launcher.
// Source de vérité unique : package.json (champs "repository" et "launcher").

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const pkg = require('../../package.json');

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
const L = pkg.launcher || {};

const MANIFEST_URL =
  `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/modpack/manifest.json`;
const NEWS_URL =
  `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/news.json`;

const serverName = L.serverName || 'CraftIndustries';
const discordAppId = L.discordAppId || '';
const discordWebhook = L.discordWebhook || '';

function getGameDir() { return path.join(app.getPath('appData'), '.craftindustries'); }
function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }
function authFile() { return path.join(app.getPath('userData'), 'msmc-auth.json'); }
function statsFile() { return path.join(app.getPath('userData'), 'stats.json'); }

const DEFAULT_SETTINGS = {
  ramMax: 4096,
  ramMin: 2048,
  javaPath: '',
  keepLauncherOpen: false,
  directJoin: true,
  uiSounds: true,
  ambientMusic: false,
  theme: 'cyan'
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
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

const DEFAULT_STATS = { playtimeMs: 0, sessions: 0, lastPlayed: null, unlocked: [], everLoggedIn: false, lastSeenVersion: null };
function getStats() {
  try {
    return { ...DEFAULT_STATS, ...JSON.parse(fs.readFileSync(statsFile(), 'utf8')) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}
function saveStats(partial) {
  const merged = { ...getStats(), ...partial };
  try {
    fs.mkdirSync(path.dirname(statsFile()), { recursive: true });
    fs.writeFileSync(statsFile(), JSON.stringify(merged, null, 2));
  } catch { /* non bloquant */ }
  return merged;
}
function addSession(ms) {
  const s = getStats();
  return saveStats({ playtimeMs: s.playtimeMs + Math.max(0, ms || 0), sessions: s.sessions + 1, lastPlayed: Date.now() });
}

module.exports = {
  pkg, repo, serverName, discordAppId, discordWebhook,
  MANIFEST_URL, NEWS_URL,
  getGameDir, settingsFile, authFile, statsFile,
  DEFAULT_SETTINGS, loadSettings, saveSettings,
  getStats, saveStats, addSession
};
