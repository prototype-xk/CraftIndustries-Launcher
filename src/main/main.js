'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { autoUpdater } = require('electron-updater');

const config = require('./config');
const auth = require('./auth');
const discord = require('./discord');
const { fetchManifest, syncMods, syncOverrides, repairPack } = require('./modpack');
const { launchGame } = require('./launcher');

const isDev = process.argv.includes('--dev');
const isSelftest = process.argv.includes('--selftest');
let win = null;
let sessionStart = 0;

function fmtErr(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function isRealIp(ip) {
  return typeof ip === 'string' && ip.length > 0 && !/exemple|example/i.test(ip);
}

function pingServer(host, port, timeout = 3500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (online) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve({ online });
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try { socket.connect(port || 25565, host); } catch { finish(false); }
  });
}

function latestCrashReport(gameDir) {
  try {
    const dir = path.join(gameDir, 'crash-reports');
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!files.length) return null;
    const file = path.join(dir, files[0].f);
    return { file, content: fs.readFileSync(file, 'utf8'), mtime: files[0].t };
  } catch {
    return null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    resizable: false,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on('preload-error', (_e, file, error) => {
    console.error('[preload-error]', file, error && error.stack ? error.stack : error);
  });
  if (isDev) {
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      console.log(`[renderer] ${message} (${source}:${line})`);
    });
  }

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  if (isSelftest) {
    win.webContents.on('did-finish-load', async () => {
      try {
        const r = await win.webContents.executeJavaScript(
          'JSON.stringify({ api: typeof window.api, keys: window.api ? Object.keys(window.api) : null })'
        );
        console.log('[selftest] ' + r);
      } catch (e) {
        console.log('[selftest] exec fail: ' + fmtErr(e));
      }
      setTimeout(() => app.exit(0), 1200);
    });
  }

  if (process.argv.includes('--shot')) {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const vIdx = process.argv.indexOf('--view');
          const v = vIdx !== -1 ? process.argv[vIdx + 1] : 'home';
          if (v && v !== 'home') {
            await win.webContents.executeJavaScript(
              `document.querySelector('.nav__item[data-view="${v}"]').click()`
            );
            await new Promise((r) => setTimeout(r, 500));
          }
          const img = await win.webContents.capturePage();
          fs.writeFileSync(path.join(__dirname, '..', '..', 'shot.png'), img.toPNG());
          console.log('[shot] saved view=' + v);
        } catch (e) { console.log('[shot] fail: ' + fmtErr(e)); }
        app.exit(0);
      }, 4500);
    });
  }
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

app.whenReady().then(() => {
  createWindow();
  setupUpdater();
  discord.init();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- Fenêtre ---------- */
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});
ipcMain.on('open:gameDir', () => {
  try { fs.mkdirSync(config.getGameDir(), { recursive: true }); } catch { /* ignore */ }
  shell.openPath(config.getGameDir());
});
ipcMain.on('open:path', (_e, p) => {
  if (typeof p !== 'string') return;
  const resolved = path.resolve(p);
  const game = path.resolve(config.getGameDir());
  if (resolved === game || resolved.startsWith(game + path.sep)) shell.openPath(resolved);
});

/* ---------- Infos appli / stats ---------- */
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  repo: config.repo,
  gameDir: config.getGameDir()
}));
ipcMain.handle('stats:get', () => config.getStats());

/* ---------- Paramètres ---------- */
ipcMain.handle('settings:get', () => config.loadSettings());
ipcMain.handle('settings:set', (_e, partial) => config.saveSettings(partial || {}));

/* ---------- Authentification ---------- */
ipcMain.handle('auth:login', async () => {
  try {
    return { ok: true, profile: await auth.login() };
  } catch (e) {
    console.error('[auth:login] échec :', fmtErr(e));
    return { ok: false, error: fmtErr(e) };
  }
});
ipcMain.handle('auth:loginSilent', async () => {
  const profile = await auth.loginSilent();
  return { ok: !!profile, profile };
});
ipcMain.handle('auth:logout', async () => ({ ok: auth.logout() }));

/* ---------- Réparation ---------- */
ipcMain.handle('pack:repair', async () => {
  try { return { ok: repairPack() }; } catch (e) { return { ok: false, error: fmtErr(e) }; }
});

/* ---------- Infos modpack ---------- */
ipcMain.handle('modpack:info', async () => {
  try {
    const m = await fetchManifest(config.MANIFEST_URL);
    return {
      ok: true,
      info: {
        name: m.name || config.serverName,
        minecraft: m.minecraft,
        forge: m.forge.version,
        mods: m.mods.length,
        modList: m.mods.map((x) => ({ name: x.name, size: x.size || 0 })),
        overrides: m.overrides ? { size: m.overrides.size || 0 } : null,
        server: m.server || null,
        maintenance: m.maintenance && m.maintenance.enabled ? { message: m.maintenance.message || 'Maintenance en cours.' } : null,
        announcement: m.announcement || null
      }
    };
  } catch (e) {
    return { ok: false, error: fmtErr(e) };
  }
});

/* ---------- Actualités ---------- */
ipcMain.handle('news:get', async () => {
  try {
    const res = await fetch(config.NEWS_URL, { cache: 'no-store' });
    if (!res.ok) return { ok: true, items: [] };
    const data = await res.json();
    return { ok: true, items: Array.isArray(data) ? data : (data.items || []) };
  } catch {
    return { ok: true, items: [] };
  }
});

/* ---------- Ping serveur ---------- */
ipcMain.handle('server:ping', async (_e, target) => {
  if (!target || !target.ip) return { online: false };
  return pingServer(target.ip, target.port || 25565);
});

/* ---------- Screenshots ---------- */
ipcMain.handle('screens:list', () => {
  try {
    const dir = path.join(config.getGameDir(), 'screenshots');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .map((f) => {
        const full = path.join(dir, f);
        return { name: f, path: full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
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

    if (manifest.maintenance && manifest.maintenance.enabled) {
      return { ok: false, error: manifest.maintenance.message || 'Serveur en maintenance.' };
    }

    await syncMods(manifest, {
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', { phase: 'mods', ...p })
    });

    await syncOverrides(manifest, {
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', p)
    });

    const settings = config.loadSettings();

    let quickPlay = null;
    if (settings.directJoin && manifest.server && isRealIp(manifest.server.ip)) {
      quickPlay = { identifier: `${manifest.server.ip}:${manifest.server.port || 25565}` };
    }

    send('status', 'Préparation de Forge et Minecraft (premier lancement plus long)...');

    await launchGame({
      authorization,
      manifest,
      settings,
      quickPlay,
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', { phase: 'mc', ...p }),
      onLog: (l) => send('log', String(l)),
      onStarted: () => {
        sessionStart = Date.now();
        discord.setPlaying(authorization.name);
        send('status', quickPlay ? 'Connexion au serveur...' : 'Minecraft est lancé. Bon jeu !');
        send('started');
        if (!settings.keepLauncherOpen) setTimeout(() => win && !win.isDestroyed() && win.hide(), 5000);
      },
      onClose: (code) => {
        const ms = sessionStart ? Date.now() - sessionStart : 0;
        const stats = config.addSession(ms);
        send('stats', stats);
        discord.setIdle();

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
  } finally {
    launching = false;
  }
});

/* ---------- Mises à jour du launcher ---------- */
function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', (i) => send('update', { state: 'available', version: i.version }));
  autoUpdater.on('download-progress', (p) => send('update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => send('update', { state: 'ready' }));
  autoUpdater.on('error', (e) => send('update', { state: 'error', message: fmtErr(e) }));
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
