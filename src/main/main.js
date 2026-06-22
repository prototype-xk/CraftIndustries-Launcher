'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const config = require('./config');
const auth = require('./auth');
const { fetchManifest, syncMods } = require('./modpack');
const { launchGame } = require('./launcher');

const isDev = process.argv.includes('--dev');
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 600,
    resizable: false,
    frame: false,
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
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

/* ---------- Paramètres ---------- */
ipcMain.handle('settings:get', () => config.loadSettings());
ipcMain.handle('settings:set', (_e, partial) => config.saveSettings(partial || {}));

/* ---------- Authentification ---------- */
ipcMain.handle('auth:login', async () => {
  try {
    return { ok: true, profile: await auth.login() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('auth:loginSilent', async () => {
  const profile = await auth.loginSilent();
  return { ok: !!profile, profile };
});
ipcMain.handle('auth:logout', async () => ({ ok: auth.logout() }));

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
        server: m.server || null
      }
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
    send('status', 'Erreur : ' + e.message);
    return { ok: false, error: e.message };
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
  autoUpdater.on('error', (e) => send('update', { state: 'error', message: String(e && e.message || e) }));
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
