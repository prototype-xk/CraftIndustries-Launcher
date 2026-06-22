#!/usr/bin/env node
'use strict';

/*
 * Génère modpack/manifest.json automatiquement.
 *
 * 1. Placez les .jar de vos mods dans  build-modpack/mods/
 * 2. Lancez :  npm run make-manifest -- --tag modpack-v1
 * 3. Créez une release GitHub avec le tag "modpack-v1" et uploadez-y ces mêmes .jar
 *    (les URLs du manifeste pointeront automatiquement vers ces fichiers).
 *
 * Le script lit owner/repo depuis package.json (champ "repository")
 * et la version MC / Forge depuis package.json (champ "launcher").
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

// --- Arguments ---
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}
const tag = arg('tag', 'modpack-v1');

// --- Dépôt GitHub ---
const url = (pkg.repository && pkg.repository.url) || '';
const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
if (!m) {
  console.error('❌ Champ "repository" invalide dans package.json (URL GitHub attendue).');
  process.exit(1);
}
const owner = m[1];
const repo = m[2];

// --- Versions ---
const L = pkg.launcher || {};
const minecraft = L.minecraft || '1.20.1';
const forgeVersion = L.forge || '47.3.0';

// --- Scan des mods ---
const modsDir = path.join(root, 'build-modpack', 'mods');
if (!fs.existsSync(modsDir)) {
  console.error('❌ Dossier introuvable : build-modpack/mods/');
  process.exit(1);
}
const jars = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).sort();

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

const mods = jars.map((name) => {
  const full = path.join(modsDir, name);
  return {
    name,
    url: `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`,
    sha1: sha1(full),
    size: fs.statSync(full).size
  };
});

const manifest = {
  name: L.serverName || 'Mon Serveur Moddé',
  minecraft,
  forge: {
    version: forgeVersion,
    installerUrl:
      `https://maven.minecraftforge.net/net/minecraftforge/forge/` +
      `${minecraft}-${forgeVersion}/forge-${minecraft}-${forgeVersion}-installer.jar`
  },
  server: { ip: L.serverIp || 'play.exemple.fr', port: L.serverPort || 25565 },
  mods
};

const out = path.join(root, 'modpack', 'manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`✅ Manifeste généré : ${mods.length} mod(s), tag "${tag}".`);
console.log(`   -> ${out}`);
console.log('\nÉtapes suivantes :');
console.log(`   1) git add modpack/manifest.json && git commit -m "modpack ${tag}" && git push`);
console.log(`   2) Créez la release GitHub "${tag}" et uploadez les .jar de build-modpack/mods/`);
