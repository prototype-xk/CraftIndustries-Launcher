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
  // titlebar
  btnMin: $('btn-min'), btnClose: $('btn-close'),
  // account
  account: $('account'), acctAvatar: $('acct-avatar'), acctName: $('acct-name'),
  acctState: $('acct-state'), btnAccount: $('btn-account'),
  // hero
  homeTitle: $('home-title'), chipMc: $('chip-mc'), chipForge: $('chip-forge'),
  chipMods: $('chip-mods'), homeServer: $('home-server'), heroAvatar: $('hero-avatar'),
  srvDot: $('srv-dot'), srvState: $('srv-state'),
  // launchbar
  status: $('status'), progressBar: $('progress-bar'), btnPlay: $('btn-play'),
  btnPlaySub: $('btn-play-sub'), btnConsole: $('btn-console'),
  // console
  console: $('console'), consoleBody: $('console-body'), btnConsoleClear: $('btn-console-clear'),
  // mods
  modsList: $('mods-list'), modsEmpty: $('mods-empty'), modsCount: $('mods-count'),
  // settings
  setRam: $('set-ram'), setRamVal: $('set-ram-val'), setJava: $('set-java'),
  setKeep: $('set-keep'), setGamedir: $('set-gamedir'), btnOpendir: $('btn-opendir'),
  btnSave: $('btn-save'), setSaved: $('set-saved'), aboutVersion: $('about-version'),
  btnGithub: $('btn-github')
};

let connected = false;
let busy = false;
let repoUrl = null;
let serverTarget = null;

/* ---------- Utils ---------- */
function setStatus(m) { el.status.textContent = m; }
function setProgress(pct) {
  el.progressBar.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
}
function fmtSize(b) {
  if (!b) return '';
  if (b > 1048576) return (b / 1048576).toFixed(1) + ' Mo';
  if (b > 1024) return (b / 1024).toFixed(0) + ' Ko';
  return b + ' o';
}
function updatePlayButton() {
  el.btnPlay.disabled = !connected || busy;
  if (busy) el.btnPlaySub.textContent = 'Lancement en cours…';
  else if (connected) el.btnPlaySub.textContent = 'Prêt à jouer';
  else el.btnPlaySub.textContent = "Connecte-toi d'abord";
}

/* ---------- Navigation ---------- */
document.querySelectorAll('.nav__item').forEach((item) => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    document.querySelectorAll('.nav__item').forEach((n) => n.classList.toggle('nav__item--active', n === item));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('view--active', v.id === 'view-' + view));
  });
});

/* ---------- Fenêtre ---------- */
el.btnMin.addEventListener('click', () => api.minimize());
el.btnClose.addEventListener('click', () => api.close());

/* ---------- Compte ---------- */
function setAccount(profile) {
  connected = !!profile;
  if (profile) {
    el.acctName.textContent = profile.name;
    el.acctState.textContent = 'Connecté';
    el.account.classList.add('is-online');
    el.acctAvatar.src = `https://minotar.net/helm/${encodeURIComponent(profile.name)}/64.png`;
    el.btnAccount.textContent = 'Quitter';
    el.btnAccount.classList.add('account__btn--ghost');
    el.heroAvatar.src = `https://minotar.net/armor/body/${encodeURIComponent(profile.name)}/360.png`;
    el.heroAvatar.onload = () => el.heroAvatar.classList.add('is-shown');
  } else {
    el.acctName.textContent = 'Non connecté';
    el.acctState.textContent = 'Hors ligne';
    el.account.classList.remove('is-online');
    el.acctAvatar.removeAttribute('src');
    el.btnAccount.textContent = 'Connexion';
    el.btnAccount.classList.remove('account__btn--ghost');
    el.heroAvatar.classList.remove('is-shown');
    el.heroAvatar.removeAttribute('src');
  }
  updatePlayButton();
}

el.btnAccount.addEventListener('click', async () => {
  if (busy) return;
  if (connected) {
    await api.logout();
    setAccount(null);
    setStatus('Déconnecté.');
    return;
  }
  setStatus('Connexion à Microsoft…');
  el.btnAccount.disabled = true;
  const res = await api.login();
  el.btnAccount.disabled = false;
  if (res.ok) {
    setAccount(res.profile);
    setStatus(`Bienvenue ${res.profile.name} !`);
  } else {
    setStatus('Échec de la connexion : ' + res.error);
  }
});

/* ---------- Modpack / serveur ---------- */
function renderMods(list) {
  el.modsList.innerHTML = '';
  if (!list || list.length === 0) {
    el.modsEmpty.classList.remove('hidden');
    return;
  }
  el.modsEmpty.classList.add('hidden');
  for (const mod of list) {
    const row = document.createElement('div');
    row.className = 'modrow';
    row.innerHTML =
      '<div class="modrow__icon"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg></div>' +
      '<div class="modrow__name"></div>' +
      '<div class="modrow__size"></div>';
    row.querySelector('.modrow__name').textContent = mod.name;
    row.querySelector('.modrow__size').textContent = fmtSize(mod.size);
    el.modsList.appendChild(row);
  }
}

async function loadModpackInfo() {
  const res = await api.getModpackInfo();
  if (!res.ok) {
    setStatus('Modpack injoignable : ' + res.error);
    el.srvState.textContent = 'Modpack indisponible';
    return;
  }
  const i = res.info;
  el.homeTitle.textContent = i.name;
  el.chipMc.querySelector('.chip__v').textContent = i.minecraft;
  el.chipForge.querySelector('.chip__v').textContent = i.forge;
  el.chipMods.querySelector('.chip__v').textContent = i.mods;
  el.modsCount.textContent = i.mods + (i.mods > 1 ? ' mods' : ' mod');
  renderMods(i.modList);

  if (i.server && i.server.ip) {
    serverTarget = i.server;
    el.homeServer.textContent = `Adresse du serveur : ${i.server.ip}:${i.server.port || 25565}`;
    pingServer();
  } else {
    el.homeServer.textContent = 'Adresse du serveur : non configurée';
  }
}

async function pingServer() {
  if (!serverTarget) return;
  el.srvState.textContent = 'Vérification…';
  const r = await api.pingServer(serverTarget.ip, serverTarget.port);
  el.srvDot.classList.toggle('is-online', r.online);
  el.srvDot.classList.toggle('is-offline', !r.online);
  el.srvState.textContent = r.online ? 'Serveur en ligne' : 'Serveur hors ligne';
}

/* ---------- Jouer ---------- */
el.btnPlay.addEventListener('click', async () => {
  if (busy || !connected) return;
  busy = true;
  el.btnPlay.classList.add('is-busy');
  updatePlayButton();
  setProgress(0);
  const res = await api.play();
  if (!res.ok) {
    setStatus('Erreur : ' + res.error);
    busy = false;
    el.btnPlay.classList.remove('is-busy');
    updatePlayButton();
  }
});

/* ---------- Console ---------- */
el.btnConsole.addEventListener('click', () => {
  el.console.classList.toggle('hidden');
  el.btnConsole.classList.toggle('is-active', !el.console.classList.contains('hidden'));
});
el.btnConsoleClear.addEventListener('click', () => { el.consoleBody.textContent = ''; });

/* ---------- Paramètres ---------- */
async function loadSettings() {
  const s = await api.getSettings();
  const gb = Math.max(2, Math.round((s.ramMax || 4096) / 1024));
  el.setRam.value = gb;
  el.setRamVal.textContent = gb;
  el.setJava.value = s.javaPath || '';
  el.setKeep.checked = !!s.keepLauncherOpen;
}
el.setRam.addEventListener('input', () => { el.setRamVal.textContent = el.setRam.value; });
el.btnSave.addEventListener('click', async () => {
  const gb = parseInt(el.setRam.value, 10);
  await api.saveSettings({
    ramMax: gb * 1024,
    ramMin: Math.min(2048, gb * 1024),
    javaPath: el.setJava.value.trim(),
    keepLauncherOpen: el.setKeep.checked
  });
  el.setSaved.classList.remove('hidden');
  setTimeout(() => el.setSaved.classList.add('hidden'), 1800);
});
el.btnOpendir.addEventListener('click', () => api.openGameDir());
el.btnGithub.addEventListener('click', () => { if (repoUrl) api.openExternal(repoUrl); });

/* ---------- Événements push ---------- */
api.onStatus((m) => setStatus(m));

api.onProgress((p) => {
  let pct = 0;
  if (p.phase === 'mods') {
    const frac = p.size ? p.recv / p.size : 0;
    if (p.total) pct = ((p.done + frac) / p.total) * 100;
    if (p.file && p.size) setStatus(`Téléchargement ${p.file} — ${Math.round(frac * 100)}%`);
  } else if (p.phase === 'mc') {
    const cur = typeof p.task === 'number' ? p.task : p.current;
    const tot = p.total;
    if (typeof cur === 'number' && tot) pct = (cur / tot) * 100;
    if (p.type) setStatus(`Téléchargement de Minecraft : ${p.type}…`);
  }
  setProgress(pct);
});

api.onLog((line) => {
  el.consoleBody.textContent += line + '\n';
  el.consoleBody.scrollTop = el.consoleBody.scrollHeight;
});

api.onStarted(() => { setProgress(100); setStatus('Minecraft est lancé. Bon jeu !'); });
api.onClosed(() => {
  setProgress(0);
  busy = false;
  el.btnPlay.classList.remove('is-busy');
  updatePlayButton();
});

api.onUpdate((u) => {
  const toast = $('update-toast');
  const text = $('update-text');
  const btn = $('btn-update');
  toast.classList.remove('hidden');
  if (u.state === 'available') text.textContent = `Mise à jour ${u.version} en téléchargement…`;
  else if (u.state === 'downloading') text.textContent = `Mise à jour : ${u.percent}%`;
  else if (u.state === 'ready') { text.textContent = 'Mise à jour prête.'; btn.classList.remove('hidden'); }
  else if (u.state === 'error') toast.classList.add('hidden');
});
$('btn-update').addEventListener('click', () => api.installUpdate());

/* ---------- Démarrage ---------- */
(async function init() {
  try {
    const info = await api.appInfo();
    el.aboutVersion.textContent = `CraftIndustries Launcher v${info.version}`;
    el.setGamedir.textContent = info.gameDir;
    if (info.repo) repoUrl = `https://github.com/${info.repo.owner}/${info.repo.repo}`;
  } catch { /* non bloquant */ }

  await loadSettings();
  await loadModpackInfo();

  setStatus('Connexion automatique…');
  const res = await api.loginSilent();
  if (res.ok && res.profile) {
    setAccount(res.profile);
    setStatus(`Bienvenue ${res.profile.name} !`);
  } else {
    setAccount(null);
    setStatus('Connecte-toi pour jouer.');
  }
})();
})(); // fin de l'IIFE principale
