'use strict';

/* global window, document, navigator, AudioContext */

// IIFE : évite le conflit entre `const api` et la globale non-configurable window.api.
(function () {
const api = window.api;
const $ = (id) => document.getElementById(id);

const el = {
  splash: $('splash'),
  btnMin: $('btn-min'), btnClose: $('btn-close'),
  account: $('account'), acctAvatar: $('acct-avatar'), acctName: $('acct-name'),
  acctState: $('acct-state'), btnAccount: $('btn-account'),
  content: $('content'), banner: $('banner'), bannerText: $('banner-text'),
  homeTitle: $('home-title'), chipMc: $('chip-mc'), chipForge: $('chip-forge'),
  chipMods: $('chip-mods'), homeServer: $('home-server'), heroAvatar: $('hero-avatar'),
  srvDot: $('srv-dot'), srvState: $('srv-state'), statPlaytime: $('stat-playtime'),
  btnAch: $('btn-achievements'), achCount: $('ach-count'),
  status: $('status'), progressBar: $('progress-bar'), btnPlay: $('btn-play'),
  btnPlaySub: $('btn-play-sub'), btnConsole: $('btn-console'),
  console: $('console'), consoleBody: $('console-body'), btnConsoleClear: $('btn-console-clear'),
  overlay: $('overlay'), overlayStatus: $('overlay-status'), overlayBar: $('overlay-bar'),
  overlayPct: $('overlay-pct'), overlayConsole: $('overlay-console'), overlayLog: $('overlay-log'),
  newsList: $('news-list'), newsEmpty: $('news-empty'), btnNewsRefresh: $('btn-news-refresh'),
  modsList: $('mods-list'), modsEmpty: $('mods-empty'), modsCount: $('mods-count'),
  overridesCard: $('overrides-card'), overridesSize: $('overrides-size'), btnChangelog: $('btn-changelog'),
  screensGrid: $('screens-grid'), screensEmpty: $('screens-empty'), btnScreensFolder: $('btn-screens-folder'),
  lightbox: $('lightbox'), lightboxImg: $('lightbox-img'),
  lbCopy: $('lb-copy'), lbShare: $('lb-share'), lbOpen: $('lb-open'), lbClose: $('lb-close'),
  crashModal: $('crash-modal'), crashLog: $('crash-log'), crashOpen: $('crash-open'),
  crashCopy: $('crash-copy'), crashDismiss: $('crash-dismiss'), crashX: $('crash-x'),
  achModal: $('ach-modal'), achGrid: $('ach-grid'), achX: $('ach-x'),
  achToast: $('ach-toast'), achToastIcon: $('ach-toast-icon'), achToastName: $('ach-toast-name'),
  clModal: $('cl-modal'), clBody: $('cl-body'), clX: $('cl-x'),
  themes: $('themes'), ramHint: $('ram-hint'),
  setRam: $('set-ram'), setRamVal: $('set-ram-val'), setJava: $('set-java'),
  setKeep: $('set-keep'), setDirect: $('set-direct'), setSounds: $('set-sounds'),
  setAmbient: $('set-ambient'), setGamedir: $('set-gamedir'), btnOpendir: $('btn-opendir'),
  btnRepair: $('btn-repair'), btnSave: $('btn-save'), setSaved: $('set-saved'),
  aboutVersion: $('about-version'), btnGithub: $('btn-github')
};

let connected = false, busy = false, maintenance = false;
let repoUrl = null, serverTarget = null, gameDir = '';
let crashFile = '', currentShot = '', changelogData = null, hasWebhook = false;
let theme = 'cyan';
let particleRGB = '41,198,232';

/* ================= Thèmes ================= */
const THEMES = {
  cyan:   { a: '#29c6e8', a2: '#18a6c9', ink: '#03161d', glow: 'rgba(41,198,232,.35)', rgb: '41,198,232' },
  green:  { a: '#46d37b', a2: '#38c06c', ink: '#04150b', glow: 'rgba(70,211,123,.35)', rgb: '70,211,123' },
  orange: { a: '#f0962a', a2: '#d97d12', ink: '#1c1003', glow: 'rgba(240,150,42,.35)', rgb: '240,150,42' },
  violet: { a: '#a06cf0', a2: '#8a52e0', ink: '#140a22', glow: 'rgba(160,108,240,.35)', rgb: '160,108,240' },
  red:    { a: '#ef5d7a', a2: '#db4666', ink: '#1c0610', glow: 'rgba(239,93,122,.35)', rgb: '239,93,122' }
};
function applyTheme(name) {
  const t = THEMES[name] || THEMES.cyan; theme = THEMES[name] ? name : 'cyan';
  const r = document.documentElement.style;
  r.setProperty('--accent', t.a); r.setProperty('--accent-2', t.a2);
  r.setProperty('--accent-ink', t.ink); r.setProperty('--accent-glow', t.glow);
  particleRGB = t.rgb;
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('is-active', s.dataset.theme === theme));
}

/* ================= Sons (WebAudio) ================= */
const sound = (function () {
  let ctx = null, enabled = true, ambient = null, ambientWanted = false;
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
  function blip(freq, dur, type, vol) {
    if (!enabled) return; const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(vol || 0.05, c.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12));
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
    setEnabled(v) { enabled = !!v; },
    setAmbientWanted(v) { ambientWanted = !!v; if (v) startAmbient(); else stopAmbient(); },
    resume() { ac(); if (ambientWanted && !ambient) startAmbient(); },
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
function fmtDuration(ms) { if (!ms || ms < 60000) return ms ? "moins d'1 min" : '—'; const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m`; }
function fileUrl(p) { return 'file:///' + String(p).replace(/\\/g, '/'); }
function updatePlayButton() {
  el.btnPlay.disabled = !connected || busy || maintenance;
  if (maintenance) el.btnPlaySub.textContent = 'Maintenance';
  else if (busy) el.btnPlaySub.textContent = 'Lancement en cours…';
  else if (connected) el.btnPlaySub.textContent = 'Prêt à jouer';
  else el.btnPlaySub.textContent = "Connecte-toi d'abord";
}

/* ================= Navigation ================= */
function showView(view) {
  document.querySelectorAll('.nav__item').forEach((n) => n.classList.toggle('nav__item--active', n.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('view--active', v.id === 'view-' + view));
  if (view === 'news') loadNews();
  if (view === 'screens') loadScreens();
}
document.querySelectorAll('.nav__item').forEach((item) => item.addEventListener('click', () => { sound.click(); showView(item.dataset.view); }));

/* ================= Fenêtre ================= */
el.btnMin.addEventListener('click', () => api.minimize());
el.btnClose.addEventListener('click', () => api.close());

/* ================= Compte ================= */
function setAccount(profile) {
  connected = !!profile;
  if (profile) {
    el.acctName.textContent = profile.name; el.acctState.textContent = 'Connecté';
    el.account.classList.add('is-online');
    el.acctAvatar.src = `https://minotar.net/helm/${encodeURIComponent(profile.name)}/64.png`;
    el.btnAccount.textContent = 'Quitter'; el.btnAccount.classList.add('account__btn--ghost');
    el.heroAvatar.src = `https://minotar.net/armor/bust/${encodeURIComponent(profile.name)}/400.png`;
    el.heroAvatar.onload = () => el.heroAvatar.classList.add('is-shown');
  } else {
    el.acctName.textContent = 'Non connecté'; el.acctState.textContent = 'Hors ligne';
    el.account.classList.remove('is-online'); el.acctAvatar.removeAttribute('src');
    el.btnAccount.textContent = 'Connexion'; el.btnAccount.classList.remove('account__btn--ghost');
    el.heroAvatar.classList.remove('is-shown'); el.heroAvatar.removeAttribute('src');
  }
  updatePlayButton();
}
el.btnAccount.addEventListener('click', async () => {
  if (busy) return; sound.click();
  if (connected) { await api.logout(); setAccount(null); setStatus('Déconnecté.'); return; }
  setStatus('Connexion à Microsoft…'); el.btnAccount.disabled = true;
  const res = await api.login(); el.btnAccount.disabled = false;
  if (res.ok) { setAccount(res.profile); setStatus(`Bienvenue ${res.profile.name} !`); sound.success(); refreshAchCount(); }
  else { setStatus('Échec de la connexion : ' + res.error); sound.error(); }
});

/* ================= Modpack / serveur ================= */
function renderMods(list) {
  el.modsList.innerHTML = '';
  if (!list || !list.length) { el.modsEmpty.classList.remove('hidden'); return; }
  el.modsEmpty.classList.add('hidden');
  for (const mod of list) {
    const row = document.createElement('div'); row.className = 'modrow';
    row.innerHTML = '<div class="modrow__icon"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg></div><div class="modrow__name"></div><div class="modrow__size"></div>';
    row.querySelector('.modrow__name').textContent = mod.name;
    row.querySelector('.modrow__size').textContent = fmtSize(mod.size);
    el.modsList.appendChild(row);
  }
}
function showBanner(text, isMaint) { el.bannerText.textContent = text; el.banner.classList.toggle('banner--maint', !!isMaint); el.banner.classList.remove('hidden'); el.content.classList.add('has-banner'); }
async function loadModpackInfo() {
  const res = await api.getModpackInfo();
  if (!res.ok) { setStatus('Modpack injoignable : ' + res.error); el.srvState.textContent = 'Modpack indisponible'; return; }
  const i = res.info;
  el.homeTitle.textContent = i.name;
  el.chipMc.querySelector('.chip__v').textContent = i.minecraft;
  el.chipForge.querySelector('.chip__v').textContent = i.forge;
  el.chipMods.querySelector('.chip__v').textContent = i.mods;
  el.modsCount.textContent = i.mods + (i.mods > 1 ? ' mods' : ' mod');
  renderMods(i.modList);
  if (i.overrides) { el.overridesCard.classList.remove('hidden'); el.overridesSize.textContent = fmtSize(i.overrides.size); } else el.overridesCard.classList.add('hidden');

  changelogData = i.changelog;
  el.btnChangelog.classList.toggle('hidden', !(changelogData && changelogData.length));
  if (i.isNewVersion && changelogData && changelogData.length) { renderChangelog(); el.clModal.classList.remove('hidden'); }

  maintenance = false;
  if (i.maintenance) { maintenance = true; showBanner('⚠ ' + i.maintenance.message, true); }
  else if (i.announcement && i.announcement.text) showBanner('📢 ' + i.announcement.text, false);
  updatePlayButton();

  if (i.server && i.server.ip) { serverTarget = i.server; el.homeServer.textContent = `Adresse : ${i.server.ip}:${i.server.port || 25565}`; pingServer(); }
  else el.homeServer.textContent = 'Adresse : non configurée';
}
async function pingServer() {
  if (!serverTarget) return; el.srvState.textContent = 'Vérification…';
  const r = await api.pingServer(serverTarget.ip, serverTarget.port);
  el.srvDot.classList.toggle('is-online', r.online); el.srvDot.classList.toggle('is-offline', !r.online);
  el.srvState.textContent = r.online ? 'Serveur en ligne' : 'Serveur hors ligne';
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
el.lbCopy.addEventListener('click', async () => { if (!currentShot) return; const r = await api.copyScreenshot(currentShot); el.lbCopy.textContent = r.ok ? 'Copié ✓' : 'Échec'; setTimeout(() => { el.lbCopy.textContent = 'Copier'; }, 1500); });
el.lbShare.addEventListener('click', async () => { if (!currentShot) return; el.lbShare.textContent = 'Envoi…'; const r = await api.shareScreenshot(currentShot); el.lbShare.textContent = r.ok ? 'Partagé ✓' : 'Échec'; setTimeout(() => { el.lbShare.textContent = 'Partager Discord'; }, 1800); });
el.btnScreensFolder.addEventListener('click', () => { sound.click(); if (gameDir) api.openPath(gameDir + '\\screenshots'); });

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
api.onAchievement((a) => {
  el.achToastIcon.textContent = a.icon || '🏆'; el.achToastName.textContent = a.name;
  el.achToast.classList.remove('hidden'); sound.success();
  setTimeout(() => el.achToast.classList.add('hidden'), 4200); refreshAchCount();
});

/* ================= Changelog ================= */
function renderChangelog() {
  el.clBody.innerHTML = '';
  if (!changelogData || !changelogData.length) { el.clBody.innerHTML = '<p class="muted">Aucun changelog disponible.</p>'; return; }
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
  sound.launch(); busy = true; updatePlayButton();
  setProgress(0); setStatus('Initialisation…'); showOverlay();
  const res = await api.play();
  if (!res.ok) { setStatus('Erreur : ' + res.error); sound.error(); hideOverlay(); busy = false; updatePlayButton(); }
});

/* ================= Console ================= */
el.btnConsole.addEventListener('click', () => { el.console.classList.toggle('hidden'); el.btnConsole.classList.toggle('is-active', !el.console.classList.contains('hidden')); });
el.btnConsoleClear.addEventListener('click', () => { el.consoleBody.textContent = ''; });
el.overlayConsole.addEventListener('click', () => { const hidden = el.overlayLog.classList.toggle('hidden'); el.overlayConsole.textContent = hidden ? 'Afficher la console' : 'Masquer la console'; });

/* ================= Crash ================= */
api.onCrash((c) => {
  hideOverlay(); busy = false; updatePlayButton(); sound.error();
  crashFile = c.file || ''; el.crashLog.textContent = c.content || 'Aucun rapport disponible.';
  el.crashModal.classList.remove('hidden');
});
function closeCrash() { el.crashModal.classList.add('hidden'); }
el.crashDismiss.addEventListener('click', closeCrash);
el.crashX.addEventListener('click', closeCrash);
el.crashOpen.addEventListener('click', () => { if (crashFile) api.openPath(crashFile.replace(/[\\/][^\\/]+$/, '')); });
el.crashCopy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(el.crashLog.textContent); el.crashCopy.textContent = 'Copié ✓'; setTimeout(() => { el.crashCopy.textContent = 'Copier'; }, 1500); } catch { /* */ } });

/* ================= Paramètres ================= */
async function loadSettings() {
  const s = await api.getSettings();
  const gb = Math.max(2, Math.round((s.ramMax || 4096) / 1024));
  el.setRam.value = gb; el.setRamVal.textContent = gb;
  el.setJava.value = s.javaPath || '';
  el.setKeep.checked = !!s.keepLauncherOpen;
  el.setDirect.checked = s.directJoin !== false;
  el.setSounds.checked = s.uiSounds !== false;
  el.setAmbient.checked = !!s.ambientMusic;
  applyTheme(s.theme || 'cyan');
  sound.setEnabled(el.setSounds.checked); sound.setAmbientWanted(el.setAmbient.checked);
}
el.setRam.addEventListener('input', () => { el.setRamVal.textContent = el.setRam.value; });
document.querySelectorAll('.swatch').forEach((sw) => sw.addEventListener('click', () => { sound.click(); applyTheme(sw.dataset.theme); api.saveSettings({ theme: sw.dataset.theme }); }));
el.btnSave.addEventListener('click', async () => {
  sound.click(); const gb = parseInt(el.setRam.value, 10);
  await api.saveSettings({ ramMax: gb * 1024, ramMin: Math.min(2048, gb * 1024), javaPath: el.setJava.value.trim(), keepLauncherOpen: el.setKeep.checked, directJoin: el.setDirect.checked, uiSounds: el.setSounds.checked, ambientMusic: el.setAmbient.checked, theme });
  sound.setEnabled(el.setSounds.checked); sound.setAmbientWanted(el.setAmbient.checked);
  el.setSaved.classList.remove('hidden'); setTimeout(() => el.setSaved.classList.add('hidden'), 1800);
});
el.btnOpendir.addEventListener('click', () => { sound.click(); api.openGameDir(); });
el.btnGithub.addEventListener('click', () => { if (repoUrl) api.openExternal(repoUrl); });
el.btnRepair.addEventListener('click', async () => {
  sound.click(); el.btnRepair.disabled = true; el.btnRepair.textContent = 'Réinitialisation…';
  await api.repairPack(); el.btnRepair.textContent = 'Forcer la resynchro'; el.btnRepair.disabled = false;
  setStatus('Installation réinitialisée — tout sera re-synchronisé au prochain lancement.');
});

/* ================= Stats ================= */
function applyStats(s) { if (s) el.statPlaytime.textContent = fmtDuration(s.playtimeMs); }

/* ================= Événements push ================= */
api.onStatus((m) => setStatus(m));
api.onProgress((p) => {
  let pct = 0;
  if (p.phase === 'mods') { const frac = p.size ? p.recv / p.size : 0; if (p.total) pct = ((p.done + frac) / p.total) * 100; if (p.file && p.size) setStatus(`Mod ${p.file} — ${Math.round(frac * 100)}%`); }
  else if (p.phase === 'overrides') { const frac = p.size ? p.recv / p.size : 0; pct = frac * 100; setStatus(`Configs & scripts — ${Math.round(frac * 100)}%`); }
  else if (p.phase === 'mc') { const cur = typeof p.task === 'number' ? p.task : p.current; if (typeof cur === 'number' && p.total) pct = (cur / p.total) * 100; if (p.type) setStatus(`Minecraft : ${p.type}…`); }
  setProgress(pct);
});
api.onLog((line) => { el.consoleBody.textContent += line + '\n'; el.consoleBody.scrollTop = el.consoleBody.scrollHeight; el.overlayLog.textContent += line + '\n'; el.overlayLog.scrollTop = el.overlayLog.scrollHeight; });
api.onStarted(() => { setProgress(100); setTimeout(hideOverlay, 600); });
api.onClosed(() => { setProgress(0); busy = false; updatePlayButton(); hideOverlay(); });
api.onStats((s) => applyStats(s));
api.onUpdate((u) => {
  const toast = $('update-toast'), text = $('update-text'), btn = $('btn-update'); toast.classList.remove('hidden');
  if (u.state === 'available') text.textContent = `Mise à jour ${u.version} en téléchargement…`;
  else if (u.state === 'downloading') text.textContent = `Mise à jour : ${u.percent}%`;
  else if (u.state === 'ready') { text.textContent = 'Mise à jour prête.'; btn.classList.remove('hidden'); }
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

/* ================= Démarrage ================= */
(async function init() {
  initParticles();
  try {
    const info = await api.appInfo();
    el.aboutVersion.textContent = `CraftIndustries Launcher v${info.version}`;
    el.setGamedir.textContent = info.gameDir; gameDir = info.gameDir;
    hasWebhook = !!info.hasWebhook;
    if (info.repo) repoUrl = `https://github.com/${info.repo.owner}/${info.repo.repo}`;
    if (info.totalRamGB) {
      const max = Math.max(4, Math.min(32, info.totalRamGB - 1));
      el.setRam.max = max;
      const rec = Math.min(8, Math.max(4, Math.floor(info.totalRamGB / 2)));
      el.ramHint.textContent = `RAM détectée : ${info.totalRamGB} Go · recommandé : ${rec} Go.`;
    }
  } catch { /* */ }

  await loadSettings();
  await loadModpackInfo();
  try { applyStats(await api.getStats()); } catch { /* */ }
  refreshAchCount();

  setStatus('Connexion automatique…');
  const res = await api.loginSilent();
  if (res.ok && res.profile) { setAccount(res.profile); setStatus(`Bienvenue ${res.profile.name} !`); refreshAchCount(); }
  else { setAccount(null); setStatus('Connecte-toi pour jouer.'); }

  setTimeout(() => { el.splash.classList.add('is-hiding'); setTimeout(() => el.splash.classList.add('hidden'), 600); }, 1500);
})();
})(); // fin de l'IIFE principale
