'use strict';

// Discord Rich Presence (« Joue sur CraftIndustries »).
// Optionnel : inactif tant que launcher.discordAppId est vide.
// Équivalent Node du SDK C (Discord_UpdatePresence / DiscordRichPresence) :
//   details / state / startTimestamp / largeImageKey+Text / smallImageKey+Text / buttons.
// Tout est encapsulé pour ne jamais bloquer le launcher.

const config = require('./config');

let client = null;
let ready = false;
const launchTs = Date.now();
let last = null;

function buttons() {
  const url = config.discordButtonUrl;
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    return [{ label: config.discordButtonLabel || 'Rejoindre', url }];
  }
  return undefined;
}

function safeSet(activity) {
  last = activity;
  if (!client || !ready || !client.user) return;
  try { client.user.setActivity(activity); } catch { /* ignore */ }
}

function init() {
  const appId = config.discordAppId;
  if (!appId) return; // non configuré
  try {
    const { Client } = require('@xhayper/discord-rpc');
    client = new Client({ clientId: appId });
    client.on('ready', () => { ready = true; safeSet(last || idleActivity()); });
    client.login().catch(() => { client = null; });
  } catch {
    client = null;
  }
}

function idleActivity() {
  return {
    details: 'Dans le launcher',
    state: config.serverName,
    largeImageKey: 'logo',
    largeImageText: config.serverName,
    smallImageKey: 'idle',
    smallImageText: 'En attente',
    startTimestamp: launchTs,
    buttons: buttons()
  };
}

function setIdle() { safeSet(idleActivity()); }

function setPlaying(profileName) {
  safeSet({
    details: `En jeu sur ${config.serverName}`,
    state: profileName ? `Pseudo : ${profileName}` : 'En partie',
    largeImageKey: 'logo',
    largeImageText: config.serverName,
    smallImageKey: 'play',
    smallImageText: 'En partie',
    startTimestamp: Date.now(),
    buttons: buttons()
  });
}

module.exports = { init, setIdle, setPlaying };
