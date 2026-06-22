'use strict';

// Authentification Microsoft via msmc.
// On ouvre une fenêtre Electron pour le login Microsoft (OAuth officiel),
// puis on conserve un "refresh token" pour les connexions suivantes (login silencieux).
//
// NOTE : les noms de méthodes ci-dessous suivent l'API msmc v4
// (Auth, launch('electron'), getMinecraft, save, refresh, mclc).

const fs = require('fs');
const { Auth } = require('msmc');
const config = require('./config');

// "select_account" force l'écran de choix de compte Microsoft (valeur valide en msmc v5).
const authManager = new Auth('select_account');
let currentMc = null; // résultat getMinecraft() courant (jeton pour le lancement)

function saveRefresh(token) {
  try {
    fs.writeFileSync(config.authFile(), JSON.stringify({ refresh: token }), 'utf8');
  } catch {
    /* non bloquant */
  }
}

function loadRefresh() {
  try {
    return JSON.parse(fs.readFileSync(config.authFile(), 'utf8')).refresh;
  } catch {
    return null;
  }
}

function profileOf(mc) {
  const p = mc.profile || {};
  return { name: p.name || 'Joueur', uuid: (p.id || '').replace(/-/g, '') };
}

// Connexion interactive (ouvre la fenêtre Microsoft).
async function login() {
  const xbox = await authManager.launch('electron');
  currentMc = await xbox.getMinecraft();
  saveRefresh(xbox.save());
  return profileOf(currentMc);
}

// Connexion silencieuse depuis le refresh token stocké (au démarrage).
async function loginSilent() {
  const token = loadRefresh();
  if (!token) return null;
  try {
    const xbox = await authManager.refresh(token);
    currentMc = await xbox.getMinecraft();
    saveRefresh(xbox.save());
    return profileOf(currentMc);
  } catch {
    return null; // token expiré/invalide : l'utilisateur devra se reconnecter
  }
}

function logout() {
  currentMc = null;
  try {
    fs.unlinkSync(config.authFile());
  } catch {
    /* déjà absent */
  }
  return true;
}

// Objet d'autorisation au format attendu par minecraft-launcher-core.
function getAuthorization() {
  return currentMc ? currentMc.mclc() : null;
}

module.exports = { login, loginSilent, logout, getAuthorization };
