'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, Notification, nativeImage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { autoUpdater } = require('electron-updater');

const config = require('./config');
const auth = require('./auth');
const discord = require('./discord');
const achievements = require('./achievements');
const { fetchManifest, syncMods, syncOverrides, repairPack } = require('./modpack');
const { launchGame } = require('./launcher');

const isDev = process.argv.includes('--dev');
const isSelftest = process.argv.includes('--selftest');
const ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
let win = null;
let tray = null;
let sessionStart = 0;

function fmtErr(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}
function isRealIp(ip) { return typeof ip === 'string' && ip.length > 0 && !/exemple|example/i.test(ip); }
function notify(title, body) {
  try { if (Notification.isSupported()) new Notification({ title, body, icon: ICON, silent: false }).show(); } catch { /* ignore */ }
}

function pingServer(host, port, timeout = 3500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (online) => { if (done) return; done = true; try { socket.destroy(); } catch { /* */ } resolve({ online }); };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try { socket.connect(port || 25565, host); } catch { finish(false); }
  });
}

/* ---------- Server List Ping (statut détaillé : joueurs, MOTD) ---------- */
function writeVarInt(value) {
  const bytes = []; let v = value >>> 0;
  do { let temp = v & 0x7f; v >>>= 7; if (v !== 0) temp |= 0x80; bytes.push(temp); } while (v !== 0);
  return Buffer.from(bytes);
}
function readVarInt(buf, offset) {
  let numRead = 0, result = 0, byte;
  do {
    if (offset + numRead >= buf.length) return null;
    byte = buf[offset + numRead];
    result |= (byte & 0x7f) << (7 * numRead);
    numRead++;
    if (numRead > 5) return null;
  } while ((byte & 0x80) !== 0);
  return { value: result >>> 0, next: offset + numRead };
}
function chatText(d) {
  if (typeof d === 'string') return d;
  if (!d || typeof d !== 'object') return '';
  let s = d.text || '';
  if (Array.isArray(d.extra)) s += d.extra.map(chatText).join('');
  return s;
}
function slpStatus(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false, buf = Buffer.alloc(0);
    const finish = (val) => { if (done) return; done = true; try { socket.destroy(); } catch { /* */ } resolve(val); };
    socket.setTimeout(timeout);
    socket.once('timeout', () => finish({ online: false }));
    socket.once('error', () => finish({ online: false }));
    socket.connect(port || 25565, host, () => {
      try {
        const hostBuf = Buffer.from(host, 'utf8');
        const portBuf = Buffer.alloc(2); portBuf.writeUInt16BE(port || 25565, 0);
        const payload = Buffer.concat([writeVarInt(0x00), writeVarInt(763), writeVarInt(hostBuf.length), hostBuf, portBuf, writeVarInt(1)]);
        socket.write(Buffer.concat([writeVarInt(payload.length), payload]));
        socket.write(Buffer.concat([writeVarInt(1), writeVarInt(0x00)]));
      } catch { finish({ online: false }); }
    });
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const r1 = readVarInt(buf, 0); if (!r1) return;
      if (buf.length - r1.next < r1.value) return;
      let off = r1.next;
      const pid = readVarInt(buf, off); if (!pid) return; off = pid.next;
      const jl = readVarInt(buf, off); if (!jl) return; off = jl.next;
      if (buf.length - off < jl.value) return;
      try {
        const o = JSON.parse(buf.slice(off, off + jl.value).toString('utf8'));
        finish({
          online: true,
          players: { online: (o.players && o.players.online) || 0, max: (o.players && o.players.max) || 0 },
          version: (o.version && o.version.name) || '',
          motd: chatText(o.description).replace(/§./g, '').trim()
        });
      } catch { finish({ online: true }); }
    });
  });
}

function latestCrashReport(gameDir) {
  try {
    const dir = path.join(gameDir, 'crash-reports');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    if (!files.length) return null;
    const file = path.join(dir, files[0].f);
    return { file, content: fs.readFileSync(file, 'utf8'), mtime: files[0].t };
  } catch { return null; }
}

function countScreenshots() {
  try {
    const d = path.join(config.getGameDir(), 'screenshots');
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(png|jpe?g)$/i.test(f)).length : 0;
  } catch { return 0; }
}
function evalAchievements() {
  const stats = config.getStats();
  const { unlocked, fresh } = achievements.evaluate(stats, { screenshots: countScreenshots() });
  if (fresh.length) {
    config.saveStats({ unlocked });
    for (const a of fresh) send('achievement', { id: a.id, name: a.name, desc: a.desc, icon: a.icon });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 700, resizable: false, frame: false, transparent: true,
    icon: ICON, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });

  win.webContents.on('preload-error', (_e, file, error) => console.error('[preload-error]', file, error && error.stack ? error.stack : error));
  if (isDev) win.webContents.on('console-message', (_e, level, message, line, source) => console.log(`[renderer] ${message} (${source}:${line})`));

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('minimize', () => { if (tray) win.hide(); });
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  if (isSelftest) {
    win.webContents.on('did-finish-load', async () => {
      try {
        const r = await win.webContents.executeJavaScript('JSON.stringify({ api: typeof window.api, keys: window.api ? Object.keys(window.api) : null })');
        console.log('[selftest] ' + r);
      } catch (e) { console.log('[selftest] exec fail: ' + fmtErr(e)); }
      setTimeout(() => app.exit(0), 1200);
    });
  }
  if (process.argv.includes('--shot')) {
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      try {
        const vIdx = process.argv.indexOf('--view');
        const v = vIdx !== -1 ? process.argv[vIdx + 1] : 'home';
        if (v && v !== 'home') { await win.webContents.executeJavaScript(`document.querySelector('.nav__item[data-view="${v}"]').click()`); await new Promise((r) => setTimeout(r, 500)); }
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, '..', '..', 'shot.png'), img.toPNG());
        console.log('[shot] saved view=' + v);
      } catch (e) { console.log('[shot] fail: ' + fmtErr(e)); }
      app.exit(0);
    }, 4500));
  }
}

function setupTray() {
  try {
    let img = nativeImage.createFromPath(ICON);
    if (!img.isEmpty()) img = img.resize({ width: 18, height: 18 });
    tray = new Tray(img);
    tray.setToolTip('CraftIndustries Launcher');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Afficher', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() }
    ]));
    tray.on('click', () => { if (win) { if (win.isVisible()) win.focus(); else win.show(); } });
  } catch { tray = null; }
}

function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }

app.whenReady().then(() => {
  createWindow();
  setupTray();
  setupUpdater();
  discord.init();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---------- Fenêtre ---------- */
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('open:external', (_e, url) => { if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('open:gameDir', () => { try { fs.mkdirSync(config.getGameDir(), { recursive: true }); } catch { /* */ } shell.openPath(config.getGameDir()); });
ipcMain.on('open:path', (_e, p) => {
  if (typeof p !== 'string') return;
  const resolved = path.resolve(p); const game = path.resolve(config.getGameDir());
  if (resolved === game || resolved.startsWith(game + path.sep)) shell.openPath(resolved);
});

/* ---------- Infos appli / stats / succès ---------- */
ipcMain.handle('app:info', () => ({
  version: app.getVersion(), repo: config.repo, gameDir: config.getGameDir(),
  totalRamGB: Math.max(2, Math.round(os.totalmem() / (1024 ** 3))), hasWebhook: !!config.discordWebhook
}));
ipcMain.handle('stats:get', () => config.getStats());
ipcMain.handle('achievements:list', () => achievements.list(config.getStats()));

/* ---------- Paramètres ---------- */
ipcMain.handle('settings:get', () => config.loadSettings());
ipcMain.handle('settings:set', (_e, partial) => config.saveSettings(partial || {}));

/* ---------- Authentification ---------- */
ipcMain.handle('auth:login', async () => {
  try {
    const profile = await auth.login();
    config.saveStats({ everLoggedIn: true });
    evalAchievements();
    return { ok: true, profile };
  } catch (e) { console.error('[auth:login] échec :', fmtErr(e)); return { ok: false, error: fmtErr(e) }; }
});
ipcMain.handle('auth:loginSilent', async () => {
  const profile = await auth.loginSilent();
  if (profile) { config.saveStats({ everLoggedIn: true }); evalAchievements(); }
  return { ok: !!profile, profile };
});
ipcMain.handle('auth:logout', async () => ({ ok: auth.logout() }));

/* ---------- Réparation ---------- */
ipcMain.handle('pack:repair', async () => { try { return { ok: repairPack() }; } catch (e) { return { ok: false, error: fmtErr(e) }; } });

/* ---------- Infos modpack ---------- */
ipcMain.handle('modpack:info', async () => {
  try {
    const m = await fetchManifest(config.MANIFEST_URL);
    const stats = config.getStats();
    const isNewVersion = !!(m.version && stats.lastSeenVersion && m.version !== stats.lastSeenVersion);
    if (m.version) config.saveStats({ lastSeenVersion: m.version });
    return {
      ok: true,
      info: {
        name: m.name || config.serverName, minecraft: m.minecraft, forge: m.forge.version,
        mods: m.mods.length, modList: m.mods.map((x) => ({ name: x.name, size: x.size || 0 })),
        overrides: m.overrides ? { size: m.overrides.size || 0 } : null,
        server: m.server || null,
        admins: Array.isArray(m.admins) ? m.admins : [],
        maintenance: m.maintenance && m.maintenance.enabled ? { message: m.maintenance.message || 'Maintenance en cours.' } : null,
        announcement: m.announcement || null,
        changelog: Array.isArray(m.changelog) ? m.changelog : null,
        version: m.version || null, isNewVersion
      }
    };
  } catch (e) { return { ok: false, error: fmtErr(e) }; }
});

/* ---------- Actualités ---------- */
ipcMain.handle('news:get', async () => {
  try {
    const res = await fetch(config.NEWS_URL, { cache: 'no-store' });
    if (!res.ok) return { ok: true, items: [] };
    const data = await res.json();
    return { ok: true, items: Array.isArray(data) ? data : (data.items || []) };
  } catch { return { ok: true, items: [] }; }
});

/* ---------- Ping serveur ---------- */
ipcMain.handle('server:ping', async (_e, target) => { if (!target || !target.ip) return { online: false }; return pingServer(target.ip, target.port || 25565); });
ipcMain.handle('server:status', async (_e, target) => { if (!target || !target.ip) return { online: false }; return slpStatus(target.ip, target.port || 25565); });

/* ---------- Demandes de mods (issues GitHub publiques, lecture seule) ---------- */
ipcMain.handle('issues:list', async () => {
  try {
    const url = `https://api.github.com/repos/${config.repo.owner}/${config.repo.repo}/issues?state=open&labels=mod-request&per_page=30`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'craftindustries-launcher' } });
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status, items: [] };
    const data = await res.json();
    const items = (Array.isArray(data) ? data : []).filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title, user: i.user ? i.user.login : '?', body: (i.body || '').slice(0, 600), url: i.html_url }));
    return { ok: true, items };
  } catch (e) { return { ok: false, error: fmtErr(e), items: [] }; }
});

/* ---------- Screenshots ---------- */
ipcMain.handle('screens:list', () => {
  try {
    const dir = path.join(config.getGameDir(), 'screenshots');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f))
      .map((f) => { const full = path.join(dir, f); return { name: f, path: full, mtime: fs.statSync(full).mtimeMs }; })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
});
ipcMain.handle('screens:copy', (_e, p) => {
  try { const img = nativeImage.createFromPath(p); if (!img.isEmpty()) { clipboard.writeImage(img); return { ok: true }; } } catch { /* */ }
  return { ok: false };
});
ipcMain.handle('screens:share', async (_e, p) => {
  if (!config.discordWebhook) return { ok: false, error: 'Aucun webhook configuré.' };
  try {
    const buf = fs.readFileSync(p);
    const form = new FormData();
    form.append('content', `Nouvelle capture : ${path.basename(p)}`);
    form.append('files[0]', new Blob([buf], { type: 'image/png' }), path.basename(p));
    const res = await fetch(config.discordWebhook, { method: 'POST', body: form });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: fmtErr(e) }; }
});

/* ---------- Jouer ---------- */
let launching = false;
ipcMain.handle('game:play', async () => {
  if (launching) return { ok: false, error: 'Lancement déjà en cours.' };
  launching = true;
  try {
    const authorization = auth.getAuthorization();
    if (!authorization) throw new Error('Vous devez être connecté avec votre compte Microsoft.');

    send('status', 'Récupération du modpack...');
    const manifest = await fetchManifest(config.MANIFEST_URL);
    if (manifest.maintenance && manifest.maintenance.enabled) return { ok: false, error: manifest.maintenance.message || 'Serveur en maintenance.' };

    await syncMods(manifest, { onStatus: (m) => send('status', m), onProgress: (p) => send('progress', { phase: 'mods', ...p }) });
    await syncOverrides(manifest, { onStatus: (m) => send('status', m), onProgress: (p) => send('progress', p) });

    const settings = config.loadSettings();
    let quickPlay = null;
    if (settings.directJoin && manifest.server && isRealIp(manifest.server.ip)) {
      quickPlay = { identifier: `${manifest.server.ip}:${manifest.server.port || 25565}` };
    }

    send('status', 'Préparation de Forge et Minecraft (premier lancement plus long)...');
    await launchGame({
      authorization, manifest, settings, quickPlay,
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', { phase: 'mc', ...p }),
      onLog: (l) => send('log', String(l)),
      onStarted: () => {
        sessionStart = Date.now();
        discord.setPlaying(authorization.name);
        notify('CraftIndustries', quickPlay ? 'Connexion au serveur en cours…' : 'Minecraft est lancé !');
        send('status', quickPlay ? 'Connexion au serveur...' : 'Minecraft est lancé. Bon jeu !');
        send('started');
        if (!settings.keepLauncherOpen) setTimeout(() => win && !win.isDestroyed() && win.hide(), 5000);
      },
      onClose: (code) => {
        const ms = sessionStart ? Date.now() - sessionStart : 0;
        const stats = config.addSession(ms);
        send('stats', stats);
        discord.setIdle();
        evalAchievements();
        const cr = latestCrashReport(config.getGameDir());
        const crashed = cr && cr.mtime >= (sessionStart - 2000);
        sessionStart = 0;
        if (crashed) {
          if (win && !win.isDestroyed()) win.show();
          send('status', 'Minecraft a planté.');
          send('crash', { code, file: cr.file, content: cr.content.slice(0, 9000) });
          send('closed');
        } else {
          send('status', 'Minecraft s\'est fermé.');
          send('closed');
          if (!settings.keepLauncherOpen) app.quit();
        }
      }
    });
    return { ok: true };
  } catch (e) {
    send('status', 'Erreur : ' + fmtErr(e));
    return { ok: false, error: fmtErr(e) };
  } finally { launching = false; }
});

/* ---------- Mises à jour du launcher ---------- */
function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', (i) => { send('update', { state: 'available', version: i.version }); notify('Mise à jour disponible', `La version ${i.version} se télécharge…`); });
  autoUpdater.on('download-progress', (p) => send('update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => { send('update', { state: 'ready' }); notify('Mise à jour prête', 'Redémarre le launcher pour l\'installer.'); });
  autoUpdater.on('error', (e) => send('update', { state: 'error', message: fmtErr(e) }));
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
