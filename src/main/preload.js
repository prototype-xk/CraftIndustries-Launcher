'use strict';

// Pont sécurisé entre le processus principal (Node) et l'interface (renderer).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Infos appli / stats / succès
  appInfo: () => ipcRenderer.invoke('app:info'),
  getStats: () => ipcRenderer.invoke('stats:get'),
  getAchievements: () => ipcRenderer.invoke('achievements:list'),

  // Authentification
  login: () => ipcRenderer.invoke('auth:login'),
  loginSilent: () => ipcRenderer.invoke('auth:loginSilent'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Modpack / serveur / news / lancement
  getModpackInfo: () => ipcRenderer.invoke('modpack:info'),
  getNews: () => ipcRenderer.invoke('news:get'),
  pingServer: (ip, port) => ipcRenderer.invoke('server:ping', { ip, port }),
  serverStatus: (ip, port) => ipcRenderer.invoke('server:status', { ip, port }),
  getIssues: () => ipcRenderer.invoke('issues:list'),
  hashFile: () => ipcRenderer.invoke('tools:hashFile'),
  repairPack: () => ipcRenderer.invoke('pack:repair'),
  play: () => ipcRenderer.invoke('game:play'),

  // Screenshots
  listScreenshots: () => ipcRenderer.invoke('screens:list'),
  copyScreenshot: (p) => ipcRenderer.invoke('screens:copy', p),
  shareScreenshot: (p) => ipcRenderer.invoke('screens:share', p),

  // Paramètres
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),

  // Actions système
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  openGameDir: () => ipcRenderer.send('open:gameDir'),
  openPath: (p) => ipcRenderer.send('open:path', p),
  installUpdate: () => ipcRenderer.send('update:install'),

  // Événements (push depuis le main)
  onStatus: (cb) => ipcRenderer.on('status', (_e, m) => cb(m)),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, p) => cb(p)),
  onLog: (cb) => ipcRenderer.on('log', (_e, l) => cb(l)),
  onStarted: (cb) => ipcRenderer.on('started', () => cb()),
  onClosed: (cb) => ipcRenderer.on('closed', () => cb()),
  onCrash: (cb) => ipcRenderer.on('crash', (_e, c) => cb(c)),
  onStats: (cb) => ipcRenderer.on('stats', (_e, s) => cb(s)),
  onAchievement: (cb) => ipcRenderer.on('achievement', (_e, a) => cb(a)),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, u) => cb(u))
});
