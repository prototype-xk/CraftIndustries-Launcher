'use strict';

/* global window, document, navigator, AudioContext */

(function () {
const api = window.api;
const $ = (id) => document.getElementById(id);

const el = {
  splash: $('splash'),
  btnMin: $('btn-min'), btnClose: $('btn-close'),
  account: $('account'), acctAvatar: $('acct-avatar'), acctName: $('acct-name'), acctState: $('acct-state'), btnAccount: $('btn-account'),
  content: $('content'), banner: $('banner'), bannerText: $('banner-text'),
  homeTitle: $('home-title'), chipMc: $('chip-mc'), chipForge: $('chip-forge'), chipMods: $('chip-mods'),
  homeServer: $('home-server'), heroAvatar: $('hero-avatar'), srvDot: $('srv-dot'), srvState: $('srv-state'), statPlaytime: $('stat-playtime'),
  btnAch: $('btn-achievements'), achCount: $('ach-count'),
  status: $('status'), progressBar: $('progress-bar'), btnPlay: $('btn-play'), btnPlaySub: $('btn-play-sub'), btnConsole: $('btn-console'),
  console: $('console'), consoleBody: $('console-body'), btnConsoleClear: $('btn-console-clear'),
  overlay: $('overlay'), overlayStatus: $('overlay-status'), overlayBar: $('overlay-bar'), overlayPct: $('overlay-pct'), overlayConsole: $('overlay-console'), overlayLog: $('overlay-log'),
  newsList: $('news-list'), newsEmpty: $('news-empty'), btnNewsRefresh: $('btn-news-refresh'),
  modsList: $('mods-list'), modsEmpty: $('mods-empty'), modsCount: $('mods-count'), overridesCard: $('overrides-card'), overridesSize: $('overrides-size'), btnChangelog: $('btn-changelog'),
  screensGrid: $('screens-grid'), screensEmpty: $('screens-empty'), btnScreensFolder: $('btn-screens-folder'),
  lightbox: $('lightbox'), lightboxImg: $('lightbox-img'), lbCopy: $('lb-copy'), lbShare: $('lb-share'), lbOpen: $('lb-open'), lbClose: $('lb-close'),
  crashModal: $('crash-modal'), crashLog: $('crash-log'), crashOpen: $('crash-open'), crashCopy: $('crash-copy'), crashDismiss: $('crash-dismiss'), crashX: $('crash-x'),
  achModal: $('ach-modal'), achGrid: $('ach-grid'), achX: $('ach-x'),
  achToast: $('ach-toast'), achToastIcon: $('ach-toast-icon'), achToastName: $('ach-toast-name'),
  clModal: $('cl-modal'), clBody: $('cl-body'), clX: $('cl-x'),
  ramHint: $('ram-hint'),
  setRam: $('set-ram'), setRamVal: $('set-ram-val'), setJava: $('set-java'), setKeep: $('set-keep'), setDirect: $('set-direct'),
  setSounds: $('set-sounds'), setAmbient: $('set-ambient'), setGamedir: $('set-gamedir'), btnOpendir: $('btn-opendir'),
  btnRepair: $('btn-repair'), btnSave: $('btn-save'), setSaved: $('set-saved'), aboutVersion: $('about-version'), btnGithub: $('btn-github'),
  navAdmin: $('nav-admin'), btnRequestMod: $('btn-request-mod'),
  adminReqlist: $('admin-reqlist'), adminReqEmpty: $('admin-req-empty'), adminReqRefresh: $('admin-req-refresh'),
  adminEditNews: $('admin-edit-news'), adminEditManifest: $('admin-edit-manifest'), adminOpenIssues: $('admin-open-issues'),
  adminResync: $('admin-resync'), adminOpenMods: $('admin-open-mods'), adminOpenConfig: $('admin-open-config'), adminOpenCrash: $('admin-open-crash'), adminOpenGame: $('admin-open-game'),
  adminDiag: $('admin-diag'), adminDiagRefresh: $('admin-diag-refresh'),
  onboard: $('onboard'), obTitle: $('ob-title'), obText: $('ob-text'), obDots: $('ob-dots'), obSkip: $('ob-skip'), obNext: $('ob-next')
};

/* ================= i18n ================= */
const I18N = {
  fr: {
    nav_home: 'Accueil', nav_news: 'Actualités', nav_mods: 'Mods', nav_screens: 'Captures', nav_settings: 'Paramètres',
    acct_disconnected: 'Non connecté', acct_offline: 'Hors ligne', acct_connected: 'Connecté', acct_login: 'Connexion', acct_logout: 'Quitter',
    srv_modded: 'Serveur moddé', srv_checking: 'Vérification…', srv_online: 'Serveur en ligne', srv_offline: 'Serveur hors ligne',
    chip_mc: 'Minecraft', chip_forge: 'Forge', chip_mods: 'Mods',
    addr: 'Adresse', addr_none: 'non configurée', playtime: 'Temps de jeu', achievements: 'succès',
    play: 'JOUER', play_login: "Connecte-toi d'abord", play_ready: 'Prêt à jouer', play_busy: 'Lancement en cours…', play_maint: 'Maintenance',
    console: 'Console', clear: 'Vider', show_console: 'Afficher la console', hide_console: 'Masquer la console',
    news_title: 'Actualités', news_sub: 'Annonces du serveur', refresh: 'Actualiser', news_empty: "Aucune actualité pour l'instant.", news_empty2: 'Les annonces publiées dans news.json apparaîtront ici.',
    mods_title: 'Mods du modpack', mods_sub: 'Synchronisés depuis GitHub', whatsnew: 'Quoi de neuf', overrides_title: 'Configs, scripts & ressources', overrides_sub: 'KubeJS, config, defaultconfigs… appliqués automatiquement', mods_empty: "Aucun mod dans le manifeste pour l'instant.", mods_empty2: 'Ajoute des .jar puis publie le manifeste sur GitHub.',
    screens_title: 'Captures', screens_sub: 'Tes screenshots en jeu', open_folder: 'Ouvrir le dossier', screens_empty: "Aucune capture pour l'instant.", screens_empty2: 'Appuie sur F2 en jeu pour prendre un screenshot.',
    settings_title: 'Paramètres', settings_sub: 'Configuration du jeu et du launcher', ram: 'Mémoire allouée', go: 'Go', java: 'Chemin Java', java_auto: '(vide = détection automatique)', java_hint: 'Minecraft 1.20.1 nécessite Java 17 ou supérieur.', direct: 'Rejoindre directement le serveur au lancement', keep: 'Garder le launcher ouvert pendant le jeu', lang: 'Langue', theme: "Thème d'accent", sounds: "Sons d'interface", ambient: "Musique d'ambiance", gamedir: 'Dossier de jeu', open: 'Ouvrir', repair: "Réparer l'installation", repair_sub: 'Re-télécharge mods et configs au prochain lancement', repair_btn: 'Forcer la resynchro', repo: 'Dépôt GitHub ↗', saved: 'Enregistré ✓', save: 'Enregistrer',
    restart: 'Redémarrer', crash_title: '⚠ Minecraft a planté', crash_desc: 'Le rapport de crash ci-dessous peut aider à identifier le mod ou le réglage en cause.', open_dir: 'Ouvrir le dossier', copy: 'Copier', close: 'Fermer',
    ach_title: '🏆 Succès', cl_title: '✨ Quoi de neuf', ach_unlocked: 'Succès débloqué', share: 'Partager Discord',
    ready: 'Prêt.', connect_to_play: 'Connecte-toi pour jouer.', connecting: 'Connexion à Microsoft…', auto_connect: 'Connexion automatique…', disconnected: 'Déconnecté.', welcome: 'Bienvenue', login_fail: 'Échec de la connexion : ', init: 'Initialisation…', error: 'Erreur : ', repaired: 'Installation réinitialisée — tout sera re-synchronisé au prochain lancement.',
    ob_skip: 'Passer', ob_next: 'Suivant', ob_start: 'Commencer',
    nav_admin: 'Admin', admin_title: 'Administration', admin_sub: 'Réservé aux administrateurs', admin_requests: 'Demandes de mods', admin_req_empty: 'Aucune demande en attente.', admin_content: 'Contenu (édition sur GitHub)', admin_edit_news: 'Éditer les actualités', admin_edit_manifest: 'Maintenance / annonce / mods', admin_open_issues: 'Toutes les demandes (GitHub)', admin_tools: 'Outils', admin_open_game: 'Dossier de jeu', admin_diag: 'Diagnostics', request_mod: 'Demander un mod', req_handle: 'Traiter sur GitHub', diag_players: 'Joueurs en ligne', diag_motd: 'MOTD', diag_mcver: 'Version serveur', diag_ram: 'RAM système', diag_gamedir: 'Dossier de jeu', diag_appver: 'Version launcher', diag_status: 'Statut serveur',
    ob_t1: 'Bienvenue sur CraftIndustries', ob_x1: 'Connecte-toi avec ton compte Microsoft (bouton en bas à gauche) pour jouer.',
    ob_t2: 'Règle ta mémoire', ob_x2: 'Dans Paramètres, ajuste la RAM (4–6 Go conseillé) et choisis ton thème.',
    ob_t3: 'Prêt à jouer', ob_x3: 'Clique sur JOUER : le launcher installe Minecraft, Forge, les mods et les configs automatiquement. Bon jeu !'
  },
  en: {
    nav_home: 'Home', nav_news: 'News', nav_mods: 'Mods', nav_screens: 'Screenshots', nav_settings: 'Settings',
    acct_disconnected: 'Not signed in', acct_offline: 'Offline', acct_connected: 'Signed in', acct_login: 'Sign in', acct_logout: 'Sign out',
    srv_modded: 'Modded server', srv_checking: 'Checking…', srv_online: 'Server online', srv_offline: 'Server offline',
    chip_mc: 'Minecraft', chip_forge: 'Forge', chip_mods: 'Mods',
    addr: 'Address', addr_none: 'not set', playtime: 'Playtime', achievements: 'achievements',
    play: 'PLAY', play_login: 'Sign in first', play_ready: 'Ready to play', play_busy: 'Launching…', play_maint: 'Maintenance',
    console: 'Console', clear: 'Clear', show_console: 'Show console', hide_console: 'Hide console',
    news_title: 'News', news_sub: 'Server announcements', refresh: 'Refresh', news_empty: 'No news yet.', news_empty2: 'Announcements posted in news.json will appear here.',
    mods_title: 'Modpack mods', mods_sub: 'Synced from GitHub', whatsnew: "What's new", overrides_title: 'Configs, scripts & resources', overrides_sub: 'KubeJS, config, defaultconfigs… applied automatically', mods_empty: 'No mods in the manifest yet.', mods_empty2: 'Add .jar files then publish the manifest on GitHub.',
    screens_title: 'Screenshots', screens_sub: 'Your in-game screenshots', open_folder: 'Open folder', screens_empty: 'No screenshots yet.', screens_empty2: 'Press F2 in-game to take a screenshot.',
    settings_title: 'Settings', settings_sub: 'Game and launcher configuration', ram: 'Allocated memory', go: 'GB', java: 'Java path', java_auto: '(empty = auto-detect)', java_hint: 'Minecraft 1.20.1 requires Java 17 or newer.', direct: 'Join the server directly on launch', keep: 'Keep the launcher open while playing', lang: 'Language', theme: 'Accent theme', sounds: 'Interface sounds', ambient: 'Ambient music', gamedir: 'Game folder', open: 'Open', repair: 'Repair installation', repair_sub: 'Re-downloads mods and configs on next launch', repair_btn: 'Force resync', repo: 'GitHub repo ↗', saved: 'Saved ✓', save: 'Save',
    restart: 'Restart', crash_title: '⚠ Minecraft crashed', crash_desc: 'The crash report below can help identify the mod or setting at fault.', open_dir: 'Open folder', copy: 'Copy', close: 'Close',
    ach_title: '🏆 Achievements', cl_title: "✨ What's new", ach_unlocked: 'Achievement unlocked', share: 'Share to Discord',
    ready: 'Ready.', connect_to_play: 'Sign in to play.', connecting: 'Connecting to Microsoft…', auto_connect: 'Auto sign-in…', disconnected: 'Signed out.', welcome: 'Welcome', login_fail: 'Sign-in failed: ', init: 'Initializing…', error: 'Error: ', repaired: 'Installation reset — everything will re-sync next launch.',
    ob_skip: 'Skip', ob_next: 'Next', ob_start: 'Get started',
    nav_admin: 'Admin', admin_title: 'Administration', admin_sub: 'Admins only', admin_requests: 'Mod requests', admin_req_empty: 'No pending requests.', admin_content: 'Content (edit on GitHub)', admin_edit_news: 'Edit news', admin_edit_manifest: 'Maintenance / announcement / mods', admin_open_issues: 'All requests (GitHub)', admin_tools: 'Tools', admin_open_game: 'Game folder', admin_diag: 'Diagnostics', request_mod: 'Request a mod', req_handle: 'Handle on GitHub', diag_players: 'Players online', diag_motd: 'MOTD', diag_mcver: 'Server version', diag_ram: 'System RAM', diag_gamedir: 'Game folder', diag_appver: 'Launcher version', diag_status: 'Server status',
    ob_t1: 'Welcome to CraftIndustries', ob_x1: 'Sign in with your Microsoft account (button at the bottom left) to play.',
    ob_t2: 'Set your memory', ob_x2: 'In Settings, adjust the RAM (4–6 GB recommended) and pick your theme.',
    ob_t3: 'Ready to play', ob_x3: 'Click PLAY: the launcher installs Minecraft, Forge, mods and configs automatically. Have fun!'
  }
};
let curLang = 'fr';
function t(k) { return (I18N[curLang] && I18N[curLang][k]) || I18N.fr[k] || k; }
function applyLang(lang) {
  curLang = I18N[lang] ? lang : 'fr';
  const dict = I18N[curLang];
  document.querySelectorAll('[data-i18n]').forEach((e) => { const v = dict[e.dataset.i18n]; if (v != null) e.textContent = v; });
  document.querySelectorAll('.langbtn').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === curLang));
  renderAccount(); renderServer(); updatePlayButton(); renderOnboard(); setRamHint();
  el.overlayConsole.textContent = el.overlayLog.classList.contains('hidden') ? t('show_console') : t('hide_console');
}

let connected = false, busy = false, maintenance = false;
let repoUrl = null, serverTarget = null, gameDir = '';
let crashFile = '', currentShot = '', changelogData = null, hasWebhook = false;
let currentUuid = '', adminList = [], branch = 'main', lastInfo = null;
let theme = 'cyan', profileName = null, serverOnline = null, particleRGB = '41,198,232', totalRamGB = 0;
function setRamHint() {
  if (!totalRamGB) return;
  const rec = Math.min(8, Math.max(4, Math.floor(totalRamGB / 2)));
  el.ramHint.textContent = curLang === 'en' ? `Detected RAM: ${totalRamGB} GB · recommended: ${rec} GB.` : `RAM détectée : ${totalRamGB} Go · recommandé : ${rec} Go.`;
}

/* ================= Thèmes ================= */
const THEMES = {
  cyan: { a: '#29c6e8', a2: '#18a6c9', ink: '#03161d', glow: 'rgba(41,198,232,.35)', rgb: '41,198,232' },
  green: { a: '#46d37b', a2: '#38c06c', ink: '#04150b', glow: 'rgba(70,211,123,.35)', rgb: '70,211,123' },
  orange: { a: '#f0962a', a2: '#d97d12', ink: '#1c1003', glow: 'rgba(240,150,42,.35)', rgb: '240,150,42' },
  violet: { a: '#a06cf0', a2: '#8a52e0', ink: '#140a22', glow: 'rgba(160,108,240,.35)', rgb: '160,108,240' },
  red: { a: '#ef5d7a', a2: '#db4666', ink: '#1c0610', glow: 'rgba(239,93,122,.35)', rgb: '239,93,122' }
};
function applyTheme(name) {
  const tt = THEMES[name] || THEMES.cyan; theme = THEMES[name] ? name : 'cyan';
  const r = document.documentElement.style;
  r.setProperty('--accent', tt.a); r.setProperty('--accent-2', tt.a2); r.setProperty('--accent-ink', tt.ink); r.setProperty('--accent-glow', tt.glow);
  particleRGB = tt.rgb;
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('is-active', s.dataset.theme === theme));
}

/* ================= Sons ================= */
const sound = (function () {
  let ctx = null, enabled = true, ambient = null, ambientWanted = false;
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
  function blip(freq, dur, type, vol) {
    if (!enabled) return; const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(vol || 0.05, c.currentTime + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12));
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + (dur || 0.12) + 0.03);
  }
  function startAmbient() {
    const c = ac(); if (!c || ambient) return;
    const master = c.createGain(); master.gain.value = 0.0001; master.connect(c.destination);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 560; lp.connect(master);
    const oscs = [110, 164.81, 220].map((f) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = Math.random() * 8 - 4; o.connect(lp); o.start(); return o; });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06; const lfoG = c.createGain(); lfoG.gain.value = 0.012; lfo.connect(lfoG); lfoG.connect(master.gain); lfo.start();
    master.gain.setTargetAtTime(0.03, c.currentTime, 2.5); ambient = { master, oscs, lfo };
  }
  function stopAmbient() { if (!ambient) return; const c = ctx, a = ambient; ambient = null; try { a.master.gain.setTargetAtTime(0.0001, c.currentTime, 1); } catch { /* */ } setTimeout(() => { try { a.oscs.forEach((o) => o.stop()); a.lfo.stop(); } catch { /* */ } }, 1600); }
  return {
    setEnabled(v) { enabled = !!v; }, setAmbientWanted(v) { ambientWanted = !!v; if (v) startAmbient(); else stopAmbient(); }, resume() { ac(); if (ambientWanted && !ambient) startAmbient(); },
    click() { blip(520, 0.07, 'triangle', 0.035); },
    launch() { blip(330, 0.13, 'sawtooth', 0.05); setTimeout(() => blip(494, 0.16, 'sawtooth', 0.05), 90); setTimeout(() => blip(660, 0.22, 'sawtooth', 0.045), 190); },
    success() { blip(523, 0.12, 'sine', 0.05); setTimeout(() => blip(784, 0.22, 'sine', 0.05), 110); },
    error() { blip(220, 0.28, 'square', 0.05); }
  };
})();
document.addEventListener('click', () => sound.resume(), { once: true });

/* ================= Utils ================= */
function setStatus(m) { el.status.textContent = m; el.overlayStatus.textContent = m; }
function setProgress(pct) { const v = Math.max(0, Math.min(100, pct || 0)); el.progressBar.style.width = v + '%'; el.overlayBar.style.width = v + '%'; el.overlayPct.textContent = Math.round(v) + '%'; }
function showOverlay() { el.overlay.classList.remove('hidden'); }
function hideOverlay() { el.overlay.classList.add('hidden'); }
function fmtSize(b) { if (!b) return ''; if (b > 1048576) return (b / 1048576).toFixed(1) + ' Mo'; if (b > 1024) return (b / 1024).toFixed(0) + ' Ko'; return b + ' o'; }
function fmtDuration(ms) { if (!ms || ms < 60000) return ms ? (curLang === 'en' ? 'under 1 min' : "moins d'1 min") : '—'; const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m`; }
function fileUrl(p) { return 'file:///' + String(p).replace(/\\/g, '/'); }
function updatePlayButton() {
  el.btnPlay.disabled = !connected || busy || maintenance;
  el.btnPlaySub.textContent = maintenance ? t('play_maint') : busy ? t('play_busy') : connected ? t('play_ready') : t('play_login');
}

/* ================= Navigation ================= */
function showView(view) {
  document.querySelectorAll('.nav__item').forEach((n) => n.classList.toggle('nav__item--active', n.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('view--active', v.id === 'view-' + view));
  if (view === 'news') loadNews();
  if (view === 'screens') loadScreens();
  if (view === 'admin') { loadRequests(); loadDiag(); }
}
document.querySelectorAll('.nav__item').forEach((item) => item.addEventListener('click', () => { sound.click(); showView(item.dataset.view); }));

el.btnMin.addEventListener('click', () => api.minimize());
el.btnClose.addEventListener('click', () => api.close());

/* ================= Compte ================= */
function renderAccount() {
  if (profileName) {
    el.acctName.textContent = profileName; el.acctState.textContent = t('acct_connected'); el.account.classList.add('is-online');
    el.btnAccount.textContent = t('acct_logout'); el.btnAccount.classList.add('account__btn--ghost');
  } else {
    el.acctName.textContent = t('acct_disconnected'); el.acctState.textContent = t('acct_offline'); el.account.classList.remove('is-online');
    el.btnAccount.textContent = t('acct_login'); el.btnAccount.classList.remove('account__btn--ghost');
  }
}
function setAccount(profile) {
  connected = !!profile; profileName = profile ? profile.name : null; currentUuid = profile ? (profile.uuid || '') : '';
  if (profile) {
    el.acctAvatar.src = `https://minotar.net/helm/${encodeURIComponent(profile.name)}/64.png`;
    el.heroAvatar.src = `https://minotar.net/armor/bust/${encodeURIComponent(profile.name)}/400.png`;
    el.heroAvatar.onload = () => el.heroAvatar.classList.add('is-shown');
  } else { el.acctAvatar.removeAttribute('src'); el.heroAvatar.classList.remove('is-shown'); el.heroAvatar.removeAttribute('src'); }
  renderAccount(); updatePlayButton(); updateAdmin();
}
el.btnAccount.addEventListener('click', async () => {
  if (busy) return; sound.click();
  if (connected) { await api.logout(); setAccount(null); setStatus(t('disconnected')); return; }
  setStatus(t('connecting')); el.btnAccount.disabled = true;
  const res = await api.login(); el.btnAccount.disabled = false;
  if (res.ok) { setAccount(res.profile); setStatus(`${t('welcome')} ${res.profile.name} !`); sound.success(); refreshAchCount(); }
  else { setStatus(t('login_fail') + res.error); sound.error(); }
});

/* ================= Modpack / serveur ================= */
function renderServer() {
  if (!serverTarget || !serverTarget.ip) { el.homeServer.textContent = `${t('addr')} : ${t('addr_none')}`; el.srvState.textContent = t('srv_modded'); return; }
  el.homeServer.textContent = `${t('addr')} : ${serverTarget.ip}:${serverTarget.port || 25565}`;
  el.srvState.textContent = serverOnline === null ? t('srv_checking') : serverOnline ? t('srv_online') : t('srv_offline');
}
function renderMods(list) {
  el.modsList.innerHTML = '';
  if (!list || !list.length) { el.modsEmpty.classList.remove('hidden'); return; }
  el.modsEmpty.classList.add('hidden');
  for (const mod of list) {
    const row = document.createElement('div'); row.className = 'modrow';
    row.innerHTML = '<div class="modrow__icon"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg></div><div class="modrow__name"></div><div class="modrow__size"></div>';
    row.querySelector('.modrow__name').textContent = mod.name; row.querySelector('.modrow__size').textContent = fmtSize(mod.size);
    el.modsList.appendChild(row);
  }
}
function showBanner(text, isMaint) { el.bannerText.textContent = text; el.banner.classList.toggle('banner--maint', !!isMaint); el.banner.classList.remove('hidden'); el.content.classList.add('has-banner'); }
async function loadModpackInfo() {
  const res = await api.getModpackInfo();
  if (!res.ok) { setStatus('Modpack: ' + res.error); el.srvState.textContent = '—'; return; }
  const i = res.info; lastInfo = i; adminList = Array.isArray(i.admins) ? i.admins : [];
  el.homeTitle.textContent = i.name;
  el.chipMc.querySelector('.chip__v').textContent = i.minecraft;
  el.chipForge.querySelector('.chip__v').textContent = i.forge;
  el.chipMods.querySelector('.chip__v').textContent = i.mods;
  el.modsCount.textContent = i.mods + (i.mods > 1 ? ' mods' : ' mod');
  renderMods(i.modList);
  if (i.overrides) { el.overridesCard.classList.remove('hidden'); el.overridesSize.textContent = fmtSize(i.overrides.size); } else el.overridesCard.classList.add('hidden');
  changelogData = i.changelog; el.btnChangelog.classList.toggle('hidden', !(changelogData && changelogData.length));
  if (i.isNewVersion && changelogData && changelogData.length) { renderChangelog(); el.clModal.classList.remove('hidden'); }
  maintenance = false;
  if (i.maintenance) { maintenance = true; showBanner('⚠ ' + i.maintenance.message, true); }
  else if (i.announcement && i.announcement.text) showBanner('📢 ' + i.announcement.text, false);
  updatePlayButton();
  serverTarget = i.server || null; serverOnline = null; renderServer();
  if (serverTarget && serverTarget.ip) pingServer();
  updateAdmin();
}
async function pingServer() {
  if (!serverTarget) return; serverOnline = null; renderServer();
  const r = await api.pingServer(serverTarget.ip, serverTarget.port); serverOnline = !!r.online;
  el.srvDot.classList.toggle('is-online', serverOnline); el.srvDot.classList.toggle('is-offline', !serverOnline);
  renderServer();
}

/* ================= Actualités ================= */
async function loadNews() {
  const res = await api.getNews(); const items = (res && res.items) || [];
  el.newsList.innerHTML = '';
  if (!items.length) { el.newsEmpty.classList.remove('hidden'); return; }
  el.newsEmpty.classList.add('hidden');
  for (const n of items) {
    const card = document.createElement('div'); card.className = 'newscard';
    card.innerHTML = (n.tag ? '<span class="newscard__tag"></span>' : '') + '<div class="newscard__head"><span class="newscard__title"></span><span class="newscard__date"></span></div><div class="newscard__body"></div>';
    if (n.tag) card.querySelector('.newscard__tag').textContent = n.tag;
    card.querySelector('.newscard__title').textContent = n.title || 'Annonce';
    card.querySelector('.newscard__date').textContent = n.date || '';
    card.querySelector('.newscard__body').textContent = n.body || n.content || '';
    el.newsList.appendChild(card);
  }
}
el.btnNewsRefresh.addEventListener('click', () => { sound.click(); loadNews(); });

/* ================= Captures ================= */
async function loadScreens() {
  const list = await api.listScreenshots(); el.screensGrid.innerHTML = '';
  if (!list || !list.length) { el.screensEmpty.classList.remove('hidden'); return; }
  el.screensEmpty.classList.add('hidden');
  for (const s of list) {
    const url = fileUrl(s.path);
    const cell = document.createElement('div'); cell.className = 'shot';
    cell.innerHTML = '<img loading="lazy" alt=""><div class="shot__name"></div>';
    cell.querySelector('img').src = url; cell.querySelector('.shot__name').textContent = s.name;
    cell.addEventListener('click', () => { currentShot = s.path; el.lightboxImg.src = url; el.lbShare.classList.toggle('hidden', !hasWebhook); el.lightbox.classList.remove('hidden'); });
    el.screensGrid.appendChild(cell);
  }
}
el.lightbox.addEventListener('click', (e) => { if (e.target === el.lightbox) el.lightbox.classList.add('hidden'); });
el.lbClose.addEventListener('click', () => el.lightbox.classList.add('hidden'));
el.lbOpen.addEventListener('click', () => { if (currentShot) api.openPath(currentShot); });
el.lbCopy.addEventListener('click', async () => { if (!currentShot) return; const r = await api.copyScreenshot(currentShot); el.lbCopy.textContent = r.ok ? 'Copié ✓' : 'Échec'; setTimeout(() => { el.lbCopy.textContent = t('copy'); }, 1500); });
el.lbShare.addEventListener('click', async () => { if (!currentShot) return; el.lbShare.textContent = '…'; const r = await api.shareScreenshot(currentShot); el.lbShare.textContent = r.ok ? '✓' : '✕'; setTimeout(() => { el.lbShare.textContent = t('share'); }, 1800); });
el.btnScreensFolder.addEventListener('click', () => { sound.click(); if (gameDir) api.openPath(gameDir + '\\screenshots'); });

/* ================= Admin ================= */
function norm(u) { return String(u).replace(/-/g, '').toLowerCase(); }
function updateAdmin() {
  const isAdmin = !!currentUuid && adminList.map(norm).includes(norm(currentUuid));
  el.navAdmin.classList.toggle('hidden', !isAdmin);
  if (!isAdmin && document.getElementById('view-admin').classList.contains('view--active')) showView('home');
}
async function loadRequests() {
  const res = await api.getIssues(); const items = (res && res.items) || [];
  el.adminReqlist.innerHTML = '';
  el.adminReqEmpty.classList.toggle('hidden', items.length > 0);
  for (const it of items) {
    const d = document.createElement('div'); d.className = 'req';
    d.innerHTML = '<div class="req__head"><span class="req__title"></span><span class="req__meta"></span></div><div class="req__body"></div><div class="req__actions"><button class="btn btn--ghost btn--sm"></button></div>';
    d.querySelector('.req__title').textContent = it.title;
    d.querySelector('.req__meta').textContent = '#' + it.number + ' · ' + it.user;
    d.querySelector('.req__body').textContent = it.body || '';
    const b = d.querySelector('button'); b.textContent = t('req_handle'); b.addEventListener('click', () => api.openExternal(it.url));
    el.adminReqlist.appendChild(d);
  }
}
function renderDiag(rows) {
  el.adminDiag.innerHTML = '';
  for (const [k, v] of rows) {
    const dk = document.createElement('div'); dk.className = 'diag__k'; dk.textContent = k;
    const dv = document.createElement('div'); dv.className = 'diag__v'; dv.textContent = v;
    el.adminDiag.appendChild(dk); el.adminDiag.appendChild(dv);
  }
}
async function loadDiag() {
  const rows = [];
  try { const info = await api.appInfo(); rows.push([t('diag_appver'), 'v' + info.version], [t('diag_ram'), info.totalRamGB + ' Go'], [t('diag_gamedir'), info.gameDir]); } catch { /* */ }
  if (lastInfo) rows.push([t('chip_mods'), String(lastInfo.mods)]);
  renderDiag(rows.concat([[t('diag_status'), '…']]));
  if (serverTarget && serverTarget.ip) {
    const s = await api.serverStatus(serverTarget.ip, serverTarget.port);
    const extra = [[t('diag_status'), s.online ? (curLang === 'en' ? 'Online' : 'En ligne') : (curLang === 'en' ? 'Offline' : 'Hors ligne')]];
    if (s.online && s.players) extra.push([t('diag_players'), s.players.online + ' / ' + s.players.max]);
    if (s.online && s.version) extra.push([t('diag_mcver'), s.version]);
    if (s.online && s.motd) extra.push([t('diag_motd'), s.motd]);
    renderDiag(rows.concat(extra));
  }
}
el.adminReqRefresh.addEventListener('click', () => { sound.click(); loadRequests(); });
el.adminDiagRefresh.addEventListener('click', () => { sound.click(); loadDiag(); });
el.adminEditNews.addEventListener('click', () => { if (repoUrl) api.openExternal(`${repoUrl}/edit/${branch}/news.json`); });
el.adminEditManifest.addEventListener('click', () => { if (repoUrl) api.openExternal(`${repoUrl}/edit/${branch}/modpack/manifest.json`); });
el.adminOpenIssues.addEventListener('click', () => { if (repoUrl) api.openExternal(`${repoUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Amod-request`); });
el.adminResync.addEventListener('click', async () => { sound.click(); await api.repairPack(); setStatus(t('repaired')); });
el.adminOpenMods.addEventListener('click', () => { if (gameDir) api.openPath(gameDir + '\\mods'); });
el.adminOpenConfig.addEventListener('click', () => { if (gameDir) api.openPath(gameDir + '\\config'); });
el.adminOpenCrash.addEventListener('click', () => { if (gameDir) api.openPath(gameDir + '\\crash-reports'); });
el.adminOpenGame.addEventListener('click', () => api.openGameDir());
el.btnRequestMod.addEventListener('click', () => {
  sound.click(); if (!repoUrl) return;
  const title = encodeURIComponent('Demande de mod : ');
  const body = encodeURIComponent('**Nom du mod :**\n\n**Lien (Modrinth / CurseForge) :**\n\n**Pourquoi ce mod :**\n');
  api.openExternal(`${repoUrl}/issues/new?labels=mod-request&title=${title}&body=${body}`);
});

/* ================= Succès ================= */
async function refreshAchCount() { try { const l = await api.getAchievements(); el.achCount.textContent = l.filter((a) => a.unlocked).length; } catch { /* */ } }
async function openAchievements() {
  sound.click(); const list = await api.getAchievements();
  el.achCount.textContent = list.filter((a) => a.unlocked).length; el.achGrid.innerHTML = '';
  for (const a of list) {
    const d = document.createElement('div'); d.className = 'ach' + (a.unlocked ? '' : ' locked');
    d.innerHTML = '<div class="ach__icon"></div><div><div class="ach__name"></div><div class="ach__desc"></div></div>';
    d.querySelector('.ach__icon').textContent = a.icon; d.querySelector('.ach__name').textContent = a.name; d.querySelector('.ach__desc').textContent = a.desc;
    el.achGrid.appendChild(d);
  }
  el.achModal.classList.remove('hidden');
}
el.btnAch.addEventListener('click', openAchievements);
el.achX.addEventListener('click', () => el.achModal.classList.add('hidden'));
api.onAchievement((a) => { el.achToastIcon.textContent = a.icon || '🏆'; el.achToastName.textContent = a.name; el.achToast.classList.remove('hidden'); sound.success(); setTimeout(() => el.achToast.classList.add('hidden'), 4200); refreshAchCount(); });

/* ================= Changelog ================= */
function renderChangelog() {
  el.clBody.innerHTML = '';
  if (!changelogData || !changelogData.length) { el.clBody.innerHTML = '<p class="muted">—</p>'; return; }
  for (const v of changelogData) {
    const div = document.createElement('div'); div.className = 'cl-ver';
    const head = document.createElement('div'); head.className = 'cl-ver__head'; head.textContent = 'Version ' + (v.version || '');
    if (v.date) { const d = document.createElement('span'); d.className = 'cl-ver__date'; d.textContent = v.date; head.appendChild(d); }
    const ul = document.createElement('ul');
    for (const c of (v.entries || v.changes || [])) { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); }
    div.appendChild(head); div.appendChild(ul); el.clBody.appendChild(div);
  }
}
el.btnChangelog.addEventListener('click', () => { sound.click(); renderChangelog(); el.clModal.classList.remove('hidden'); });
el.clX.addEventListener('click', () => el.clModal.classList.add('hidden'));

/* ================= Jouer ================= */
el.btnPlay.addEventListener('click', async () => {
  if (busy || !connected || maintenance) return;
  sound.launch(); busy = true; updatePlayButton(); setProgress(0); setStatus(t('init')); showOverlay();
  const res = await api.play();
  if (!res.ok) { setStatus(t('error') + res.error); sound.error(); hideOverlay(); busy = false; updatePlayButton(); }
});

/* ================= Console ================= */
el.btnConsole.addEventListener('click', () => { el.console.classList.toggle('hidden'); el.btnConsole.classList.toggle('is-active', !el.console.classList.contains('hidden')); });
el.btnConsoleClear.addEventListener('click', () => { el.consoleBody.textContent = ''; });
el.overlayConsole.addEventListener('click', () => { const hidden = el.overlayLog.classList.toggle('hidden'); el.overlayConsole.textContent = hidden ? t('show_console') : t('hide_console'); });

/* ================= Crash ================= */
api.onCrash((c) => { hideOverlay(); busy = false; updatePlayButton(); sound.error(); crashFile = c.file || ''; el.crashLog.textContent = c.content || '—'; el.crashModal.classList.remove('hidden'); });
function closeCrash() { el.crashModal.classList.add('hidden'); }
el.crashDismiss.addEventListener('click', closeCrash); el.crashX.addEventListener('click', closeCrash);
el.crashOpen.addEventListener('click', () => { if (crashFile) api.openPath(crashFile.replace(/[\\/][^\\/]+$/, '')); });
el.crashCopy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(el.crashLog.textContent); el.crashCopy.textContent = '✓'; setTimeout(() => { el.crashCopy.textContent = t('copy'); }, 1500); } catch { /* */ } });

/* ================= Paramètres ================= */
async function loadSettings() {
  const s = await api.getSettings();
  const gb = Math.max(2, Math.round((s.ramMax || 4096) / 1024));
  el.setRam.value = gb; el.setRamVal.textContent = gb;
  el.setJava.value = s.javaPath || ''; el.setKeep.checked = !!s.keepLauncherOpen; el.setDirect.checked = s.directJoin !== false;
  el.setSounds.checked = s.uiSounds !== false; el.setAmbient.checked = !!s.ambientMusic;
  applyTheme(s.theme || 'cyan'); applyLang(s.lang || 'fr');
  sound.setEnabled(el.setSounds.checked); sound.setAmbientWanted(el.setAmbient.checked);
  return s;
}
el.setRam.addEventListener('input', () => { el.setRamVal.textContent = el.setRam.value; });
document.querySelectorAll('.swatch').forEach((sw) => sw.addEventListener('click', () => { sound.click(); applyTheme(sw.dataset.theme); api.saveSettings({ theme: sw.dataset.theme }); }));
document.querySelectorAll('.langbtn').forEach((b) => b.addEventListener('click', () => { sound.click(); applyLang(b.dataset.lang); api.saveSettings({ lang: b.dataset.lang }); }));
el.btnSave.addEventListener('click', async () => {
  sound.click(); const gb = parseInt(el.setRam.value, 10);
  await api.saveSettings({ ramMax: gb * 1024, ramMin: Math.min(2048, gb * 1024), javaPath: el.setJava.value.trim(), keepLauncherOpen: el.setKeep.checked, directJoin: el.setDirect.checked, uiSounds: el.setSounds.checked, ambientMusic: el.setAmbient.checked, theme, lang: curLang });
  sound.setEnabled(el.setSounds.checked); sound.setAmbientWanted(el.setAmbient.checked);
  el.setSaved.classList.remove('hidden'); setTimeout(() => el.setSaved.classList.add('hidden'), 1800);
});
el.btnOpendir.addEventListener('click', () => { sound.click(); api.openGameDir(); });
el.btnGithub.addEventListener('click', () => { if (repoUrl) api.openExternal(repoUrl); });
el.btnRepair.addEventListener('click', async () => { sound.click(); el.btnRepair.disabled = true; await api.repairPack(); el.btnRepair.disabled = false; setStatus(t('repaired')); });

/* ================= Stats ================= */
function applyStats(s) { if (s) el.statPlaytime.textContent = fmtDuration(s.playtimeMs); }

/* ================= Événements push ================= */
api.onStatus((m) => setStatus(m));
api.onProgress((p) => {
  let pct = 0;
  if (p.phase === 'mods') { const frac = p.size ? p.recv / p.size : 0; if (p.total) pct = ((p.done + frac) / p.total) * 100; }
  else if (p.phase === 'overrides') { const frac = p.size ? p.recv / p.size : 0; pct = frac * 100; }
  else if (p.phase === 'mc') { const cur = typeof p.task === 'number' ? p.task : p.current; if (typeof cur === 'number' && p.total) pct = (cur / p.total) * 100; }
  setProgress(pct);
});
api.onLog((line) => { el.consoleBody.textContent += line + '\n'; el.consoleBody.scrollTop = el.consoleBody.scrollHeight; el.overlayLog.textContent += line + '\n'; el.overlayLog.scrollTop = el.overlayLog.scrollHeight; });
api.onStarted(() => { setProgress(100); setTimeout(hideOverlay, 600); });
api.onClosed(() => { setProgress(0); busy = false; updatePlayButton(); hideOverlay(); });
api.onStats((s) => applyStats(s));
api.onUpdate((u) => {
  const toast = $('update-toast'), text = $('update-text'), btn = $('btn-update'); toast.classList.remove('hidden');
  if (u.state === 'available') text.textContent = `${u.version} …`;
  else if (u.state === 'downloading') text.textContent = `${u.percent}%`;
  else if (u.state === 'ready') { text.textContent = '✓'; btn.classList.remove('hidden'); }
  else if (u.state === 'error') toast.classList.add('hidden');
});
$('btn-update').addEventListener('click', () => api.installUpdate());

/* ================= Particules ================= */
function initParticles() {
  const canvas = $('hero-particles'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); let w = 0, h = 0, particles = [];
  const make = () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.4, vy: -(Math.random() * 0.25 + 0.07), vx: (Math.random() - 0.5) * 0.12, a: Math.random() * 0.5 + 0.18 });
  function build() { const rect = canvas.getBoundingClientRect(); w = canvas.width = Math.max(1, Math.floor(rect.width)); h = canvas.height = Math.max(1, Math.floor(rect.height)); particles = Array.from({ length: Math.min(90, Math.max(34, Math.round(w / 15))) }, make); }
  let phase = 0;
  function frame() {
    ctx.clearRect(0, 0, w, h); phase += 0.02; ctx.shadowColor = `rgba(${particleRGB},0.8)`; ctx.shadowBlur = 6;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
      if (p.x < -6) p.x = w + 6; else if (p.x > w + 6) p.x = -6;
      const alpha = p.a * (0.6 + 0.4 * Math.sin(phase + p.x * 0.05));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(${particleRGB},${Math.max(0, alpha).toFixed(3)})`; ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  build(); window.addEventListener('resize', build); requestAnimationFrame(frame);
}

/* ================= Onboarding ================= */
const OB_STEPS = [['ob_t1', 'ob_x1'], ['ob_t2', 'ob_x2'], ['ob_t3', 'ob_x3']];
let obStep = 0;
function renderOnboard() {
  const [tk, xk] = OB_STEPS[obStep];
  el.obTitle.textContent = t(tk); el.obText.textContent = t(xk);
  el.obSkip.textContent = t('ob_skip');
  el.obNext.textContent = obStep === OB_STEPS.length - 1 ? t('ob_start') : t('ob_next');
  el.obDots.innerHTML = '';
  OB_STEPS.forEach((_, idx) => { const d = document.createElement('span'); d.className = 'onboard__dot' + (idx === obStep ? ' is-active' : ''); el.obDots.appendChild(d); });
}
function finishOnboard() { el.onboard.classList.add('hidden'); api.saveSettings({ onboarded: true }); }
el.obSkip.addEventListener('click', () => { sound.click(); finishOnboard(); });
el.obNext.addEventListener('click', () => { sound.click(); if (obStep < OB_STEPS.length - 1) { obStep++; renderOnboard(); } else finishOnboard(); });

/* ================= Démarrage ================= */
(async function init() {
  initParticles();
  try {
    const info = await api.appInfo();
    el.aboutVersion.textContent = `CraftIndustries Launcher v${info.version}`;
    el.setGamedir.textContent = info.gameDir; gameDir = info.gameDir; hasWebhook = !!info.hasWebhook;
    if (info.repo) { repoUrl = `https://github.com/${info.repo.owner}/${info.repo.repo}`; branch = info.repo.branch || 'main'; }
    if (info.totalRamGB) { totalRamGB = info.totalRamGB; el.setRam.max = Math.max(4, Math.min(32, totalRamGB - 1)); setRamHint(); }
  } catch { /* */ }

  const settings = await loadSettings();
  await loadModpackInfo();
  try { applyStats(await api.getStats()); } catch { /* */ }
  refreshAchCount();

  setStatus(t('auto_connect'));
  const res = await api.loginSilent();
  if (res.ok && res.profile) { setAccount(res.profile); setStatus(`${t('welcome')} ${res.profile.name} !`); refreshAchCount(); }
  else { setAccount(null); setStatus(t('connect_to_play')); }

  setTimeout(() => {
    el.splash.classList.add('is-hiding'); setTimeout(() => el.splash.classList.add('hidden'), 600);
    if (!settings.onboarded) { obStep = 0; renderOnboard(); el.onboard.classList.remove('hidden'); }
  }, 1500);
})();
})(); // fin de l'IIFE principale
