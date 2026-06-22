'use strict';

/* global window, document */

// IIFE : `window.api` est exposé par contextBridge comme propriété globale
// NON-configurable. Au niveau racine d'un script classique, `const api = ...`
// tenterait de redéclarer ce nom -> "SyntaxError: Identifier 'api' has already
// been declared", ce qui ferait échouer TOUT le script (boutons inertes).
// En l'enfermant dans une fonction, `const api` devient local : plus de conflit.
(function () {
const api = window.api;

const $ = (id) => document.getElementById(id);

const el = {
  serverName: $('server-name'),
  serverAddress: $('server-address'),
  chipMc: $('chip-mc'),
  chipForge: $('chip-forge'),
  chipMods: $('chip-mods'),
  avatar: $('avatar'),
  accountName: $('account-name'),
  btnAccount: $('btn-account'),
  btnPlay: $('btn-play'),
  btnSettings: $('btn-settings'),
  btnLogs: $('btn-logs'),
  status: $('status'),
  progressBar: $('progress-bar'),
  logs: $('logs'),
  updateToast: $('update-toast'),
  updateText: $('update-text'),
  btnUpdate: $('btn-update'),
  settingsModal: $('settings-modal'),
  ramMax: $('ram-max'),
  ramValue: $('ram-value'),
  javaPath: $('java-path'),
  keepOpen: $('keep-open'),
  btnSettingsSave: $('btn-settings-save'),
  btnSettingsCancel: $('btn-settings-cancel')
};

let connected = false;

/* ---------- Contrôles fenêtre ---------- */
$('btn-min').addEventListener('click', () => api.minimize());
$('btn-close').addEventListener('click', () => api.close());

/* ---------- Utilitaires UI ---------- */
function setStatus(msg) { el.status.textContent = msg; }
function setProgress(pct) { el.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
function setPlayEnabled(on) { el.btnPlay.disabled = !on; }

function setAccount(profile) {
  connected = !!profile;
  if (profile) {
    el.accountName.textContent = profile.name;
    el.avatar.src = `https://minotar.net/avatar/${encodeURIComponent(profile.name)}/48`;
    el.btnAccount.textContent = 'Déconnexion';
    setPlayEnabled(true);
  } else {
    el.accountName.textContent = 'Non connecté';
    el.avatar.removeAttribute('src');
    el.btnAccount.textContent = 'Se connecter';
    setPlayEnabled(false);
  }
}

/* ---------- Infos modpack ---------- */
async function loadModpackInfo() {
  const res = await api.getModpackInfo();
  if (res.ok) {
    const i = res.info;
    el.serverName.textContent = i.name;
    el.chipMc.textContent = `Minecraft ${i.minecraft}`;
    el.chipForge.textContent = `Forge ${i.forge}`;
    el.chipMods.textContent = `${i.mods} mods`;
    if (i.server) el.serverAddress.textContent = `Serveur : ${i.server.ip}:${i.server.port || 25565}`;
  } else {
    setStatus('Modpack injoignable : ' + res.error);
  }
}

/* ---------- Authentification ---------- */
el.btnAccount.addEventListener('click', async () => {
  if (connected) {
    await api.logout();
    setAccount(null);
    setStatus('Déconnecté.');
    return;
  }
  setStatus('Connexion à Microsoft...');
  el.btnAccount.disabled = true;
  const res = await api.login();
  el.btnAccount.disabled = false;
  if (res.ok) {
    setAccount(res.profile);
    setStatus(`Connecté en tant que ${res.profile.name}.`);
  } else {
    setStatus('Échec de la connexion : ' + res.error);
  }
});

/* ---------- Jouer ---------- */
el.btnPlay.addEventListener('click', async () => {
  setPlayEnabled(false);
  el.btnAccount.disabled = true;
  setProgress(0);
  const res = await api.play();
  if (!res.ok) {
    setStatus('Erreur : ' + res.error);
    setPlayEnabled(true);
    el.btnAccount.disabled = false;
  }
});

/* ---------- Événements push ---------- */
api.onStatus((m) => setStatus(m));

api.onProgress((p) => {
  if (p.phase === 'mods') {
    // p.recv/p.size = octets du fichier courant ; p.done/p.total = nb de mods
    if (p.size) {
      setStatus(`Téléchargement ${p.file} (${Math.round((p.recv / p.size) * 100)}%)`);
    }
    if (p.total) setProgress((p.done / p.total) * 100);
  } else if (p.phase === 'mc') {
    // Événement MCLC : { type, task, total }
    if (typeof p.task === 'number' && p.total) {
      setProgress((p.task / p.total) * 100);
      if (p.type) setStatus(`Téléchargement ${p.type}...`);
    }
  }
});

api.onLog((line) => {
  el.logs.textContent += line + '\n';
  el.logs.scrollTop = el.logs.scrollHeight;
});

api.onStarted(() => { setProgress(100); });
api.onClosed(() => { setProgress(0); setPlayEnabled(true); el.btnAccount.disabled = false; });

api.onUpdate((u) => {
  el.updateToast.classList.remove('hidden');
  if (u.state === 'available') el.updateText.textContent = `Mise à jour ${u.version} en téléchargement...`;
  else if (u.state === 'downloading') el.updateText.textContent = `Téléchargement de la mise à jour : ${u.percent}%`;
  else if (u.state === 'ready') { el.updateText.textContent = 'Mise à jour prête.'; el.btnUpdate.classList.remove('hidden'); }
  else if (u.state === 'error') el.updateToast.classList.add('hidden');
});
el.btnUpdate.addEventListener('click', () => api.installUpdate());

/* ---------- Journal (toggle) ---------- */
el.btnLogs.addEventListener('click', () => el.logs.classList.toggle('hidden'));

/* ---------- Paramètres ---------- */
async function openSettings() {
  const s = await api.getSettings();
  el.ramMax.value = s.ramMax;
  el.ramValue.textContent = s.ramMax;
  el.javaPath.value = s.javaPath || '';
  el.keepOpen.checked = !!s.keepLauncherOpen;
  el.settingsModal.classList.remove('hidden');
}
el.btnSettings.addEventListener('click', openSettings);
el.btnSettingsCancel.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
el.ramMax.addEventListener('input', () => { el.ramValue.textContent = el.ramMax.value; });
el.btnSettingsSave.addEventListener('click', async () => {
  const ramMax = parseInt(el.ramMax.value, 10);
  await api.saveSettings({
    ramMax,
    ramMin: Math.min(2048, ramMax),
    javaPath: el.javaPath.value.trim(),
    keepLauncherOpen: el.keepOpen.checked
  });
  el.settingsModal.classList.add('hidden');
  setStatus('Paramètres enregistrés.');
});

/* ---------- Démarrage ---------- */
(async function init() {
  await loadModpackInfo();
  setStatus('Connexion automatique...');
  const res = await api.loginSilent();
  if (res.ok && res.profile) {
    setAccount(res.profile);
    setStatus(`Bienvenue ${res.profile.name} !`);
  } else {
    setAccount(null);
    setStatus('Connectez-vous pour jouer.');
  }
})();
})(); // fin de l'IIFE principale
