'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { autoUpdater } = require('electron-updater');

const config = require('./config');
const auth = require('./auth');
const { fetchManifest, syncMods, syncOverrides, repairPack } = require('./modpack');
const { launchGame } = require('./launcher');

const isDev = process.argv.includes('--dev');
const isSelftest = process.argv.includes('--selftest');
let win = null;

// msmc rejette parfois avec une chaîne (code lexique) plutôt qu'un Error :
// on normalise pour ne jamais afficher "undefined".
function fmtErr(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// Test de joignabilité TCP du serveur (connexion simple, sans protocole MC complet).
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

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0d0f14',
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

  // Mode capture (--shot [--view mods|settings]) : screenshot du rendu réel puis quitte.
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
          fs.writeFileSync(path.join(__dirname, '..', '..', `shot.png`), img.toPNG());
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- Contrôles de fenêtre ---------- */
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});
ipcMain.on('open:gameDir', () => {
  try { fs.mkdirSync(config.getGameDir(), { recursive: true }); } catch { /* ignore */ }
  shell.openPath(config.getGameDir());
});

/* ---------- Infos appli ---------- */
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  repo: config.repo,
  gameDir: config.getGameDir()
}));

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

/* ---------- Réparation du pack ---------- */
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
        name: m.name || config.pkg.launcher.serverName,
        minecraft: m.minecraft,
        forge: m.forge.version,
        mods: m.mods.length,
        modList: m.mods.map((x) => ({ name: x.name, size: x.size || 0 })),
        overrides: m.overrides ? { size: m.overrides.size || 0 } : null,
        server: m.server || null
      }
    };
  } catch (e) {
    return { ok: false, error: fmtErr(e) };
  }
});

/* ---------- Ping serveur ---------- */
ipcMain.handle('server:ping', async (_e, target) => {
  if (!target || !target.ip) return { online: false };
  return pingServer(target.ip, target.port || 25565);
});

/* ---------- Jouer (sync + lancement) ---------- */
let launching = false;
ipcMain.handle('game:play', async () => {
  if (launching) return { ok: false, error: 'Lancement déjà en cours.' };
  launching = true;
  try {
    const authorization = auth.getAuthorization();
    if (!authorization) throw new Error('Vous devez être connecté avec votre compte Microsoft.');

    send('status', 'Récupération du modpack...');
    const manifest = await fetchManifest(config.MANIFEST_URL);

    await syncMods(manifest, {
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', { phase: 'mods', ...p })
    });

    await syncOverrides(manifest, {
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', p)
    });

    const settings = config.loadSettings();
    send('status', 'Préparation de Forge et Minecraft (premier lancement plus long)...');

    await launchGame({
      authorization,
      manifest,
      settings,
      onStatus: (m) => send('status', m),
      onProgress: (p) => send('progress', { phase: 'mc', ...p }),
      onLog: (l) => send('log', String(l)),
      onStarted: () => {
        send('status', 'Minecraft est lancé. Bon jeu !');
        send('started');
        if (!settings.keepLauncherOpen) setTimeout(() => win && win.hide(), 4000);
      },
      onClose: () => {
        send('status', 'Minecraft s\'est fermé.');
        send('closed');
        if (!settings.keepLauncherOpen) app.quit();
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
  if (isDev) return; // pas d'auto-update en développement
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', (i) => send('update', { state: 'available', version: i.version }));
  autoUpdater.on('download-progress', (p) => send('update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => send('update', { state: 'ready' }));
  autoUpdater.on('error', (e) => send('update', { state: 'error', message: fmtErr(e) }));
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
