'use strict';

// Pont sécurisé entre le processus principal (Node) et l'interface (renderer).
// contextIsolation activé + nodeIntegration désactivé => l'UI n'a accès
// QU'aux fonctions exposées ci-dessous via window.api.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Authentification
  login: () => ipcRenderer.invoke('auth:login'),
  loginSilent: () => ipcRenderer.invoke('auth:loginSilent'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Modpack / lancement
  getModpackInfo: () => ipcRenderer.invoke('modpack:info'),
  play: () => ipcRenderer.invoke('game:play'),

  // Paramètres
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),

  // Contrôles fenêtre
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  openExternal: (url) => ipcRenderer.send('open:external', url),

  // Mises à jour du launcher
  installUpdate: () => ipcRenderer.send('update:install'),

  // Événements (push depuis le main)
  onStatus: (cb) => ipcRenderer.on('status', (_e, m) => cb(m)),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, p) => cb(p)),
  onLog: (cb) => ipcRenderer.on('log', (_e, l) => cb(l)),
  onStarted: (cb) => ipcRenderer.on('started', () => cb()),
  onClosed: (cb) => ipcRenderer.on('closed', () => cb()),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, u) => cb(u))
});
