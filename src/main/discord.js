'use strict';

// Discord Rich Presence (affiche « Joue sur CraftIndustries » dans Discord).
// Entièrement optionnel : inactif tant que launcher.discordAppId est vide dans
// package.json. Tout est encapsulé dans des try/catch pour ne jamais bloquer
// le launcher si Discord est absent ou la lib indisponible.

const config = require('./config');

let client = null;
let ready = false;
const launchTs = Date.now();

function safeSet(activity) {
  if (!client || !ready || !client.user) return;
  try { client.user.setActivity(activity); } catch { /* ignore */ }
}

function init() {
  const appId = config.discordAppId;
  if (!appId) return; // fonctionnalité non configurée
  try {
    const { Client } = require('@xhayper/discord-rpc');
    client = new Client({ clientId: appId });
    client.on('ready', () => { ready = true; setIdle(); });
    client.login().catch(() => { client = null; });
  } catch {
    client = null;
  }
}

function setIdle() {
  safeSet({
    details: 'Dans le launcher',
    state: config.serverName,
    largeImageKey: 'logo',
    largeImageText: config.serverName,
    startTimestamp: launchTs
  });
}

function setPlaying(profileName) {
  safeSet({
    details: 'En jeu',
    state: profileName ? `${config.serverName} — ${profileName}` : config.serverName,
    largeImageKey: 'logo',
    largeImageText: config.serverName,
    startTimestamp: Date.now()
  });
}

module.exports = { init, setIdle, setPlaying };
