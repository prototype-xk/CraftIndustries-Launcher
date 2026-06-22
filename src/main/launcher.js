'use strict';

// Lancement de Minecraft + Forge via minecraft-launcher-core (MCLC).
// MCLC télécharge le client vanilla, les assets/bibliothèques, exécute
// l'installateur Forge si besoin, puis démarre le jeu avec le jeton Microsoft.

const fs = require('fs');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const config = require('./config');
const { downloadFile, findJava } = require('./util');

// Télécharge l'installateur Forge s'il n'est pas déjà présent localement.
async function ensureForgeInstaller(manifest, onStatus) {
  const dir = path.join(config.getGameDir(), 'forge');
  const fileName = `forge-${manifest.minecraft}-${manifest.forge.version}-installer.jar`;
  const dest = path.join(dir, fileName);

  if (!fs.existsSync(dest)) {
    if (onStatus) onStatus('Téléchargement de Forge...');
    const url =
      manifest.forge.installerUrl ||
      `https://maven.minecraftforge.net/net/minecraftforge/forge/` +
        `${manifest.minecraft}-${manifest.forge.version}/${fileName}`;
    await downloadFile(url, dest);
  }
  return dest;
}

async function launchGame({
  authorization,
  manifest,
  settings,
  onStatus,
  onProgress,
  onLog,
  onStarted,
  onClose
}) {
  const forgeInstaller = await ensureForgeInstaller(manifest, onStatus);
  const javaPath = findJava(settings.javaPath);
  const launcher = new Client();

  const options = {
    authorization,
    root: config.getGameDir(),
    version: {
      number: manifest.minecraft,
      type: 'release'
    },
    forge: forgeInstaller, // MCLC gère l'installation de Forge
    memory: {
      max: `${settings.ramMax}M`,
      min: `${settings.ramMin}M`
    },
    javaPath,
    overrides: {
      detached: false
    }
  };

  // Événements MCLC -> remontés vers l'UI.
  launcher.on('progress', (e) => onProgress && onProgress(e));
  launcher.on('download-status', (e) => onProgress && onProgress(e));
  launcher.on('debug', (line) => onLog && onLog(line));
  launcher.on('data', (line) => onLog && onLog(line));
  launcher.on('close', (code) => onClose && onClose(code));

  await launcher.launch(options);
  if (onStarted) onStarted();
}

module.exports = { launchGame };
