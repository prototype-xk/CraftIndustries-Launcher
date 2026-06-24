#!/usr/bin/env node
'use strict';

/*
 * Génère modpack/manifest.json automatiquement.
 *
 * 1. Mods            -> build-modpack/mods/*.jar
 * 2. Configs/scripts -> build-modpack/overrides/   (ex: overrides/config, overrides/kubejs, ...)
 *                       => empaquetés dans build-modpack/overrides.zip
 * 3. Lancez :  npm run make-manifest -- --tag modpack-v1
 * 4. Créez une release GitHub taguée "modpack-v1" et uploadez :
 *      - tous les .jar de build-modpack/mods/
 *      - build-modpack/overrides.zip   (si présent)
 *
 * owner/repo viennent de package.json ("repository"), versions de package.json ("launcher").
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
}
const tag = arg('tag', 'modpack-v1');

const url = (pkg.repository && pkg.repository.url) || '';
const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
if (!m) {
  console.error('❌ Champ "repository" invalide dans package.json (URL GitHub attendue).');
  process.exit(1);
}
const owner = m[1];
const repo = m[2];
const dl = (file) => `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(file)}`;

const L = pkg.launcher || {};
const minecraft = L.minecraft || '1.20.1';
const forgeVersion = L.forge || '47.3.0';

function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

/* ---------- Mods ---------- */
const modsDir = path.join(root, 'build-modpack', 'mods');
if (!fs.existsSync(modsDir)) {
  console.error('❌ Dossier introuvable : build-modpack/mods/');
  process.exit(1);
}
const jars = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).sort();
const mods = jars.map((name) => {
  const buf = fs.readFileSync(path.join(modsDir, name));
  return { name, url: dl(name), sha1: sha1(buf), size: buf.length };
});

/* ---------- Overrides (config / kubejs / ...) ---------- */
function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.gitkeep') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

let overrides = null;
const overridesDir = path.join(root, 'build-modpack', 'overrides');
if (fs.existsSync(overridesDir) && listFiles(overridesDir).length > 0) {
  const zip = new AdmZip();
  // Ajoute le CONTENU de overrides/ (entrées du type "config/...", "kubejs/...")
  zip.addLocalFolder(overridesDir, '', (entry) => !entry.endsWith('.gitkeep'));
  const outZip = path.join(root, 'build-modpack', 'overrides.zip');
  zip.writeZip(outZip);
  const buf = fs.readFileSync(outZip);
  overrides = { name: 'overrides.zip', url: dl('overrides.zip'), sha1: sha1(buf), size: buf.length };
}

/* ---------- Manifeste ---------- */
const manifest = {
  name: L.serverName || 'CraftIndustries',
  version: tag,
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
if (overrides) manifest.overrides = overrides;

// Préserve les champs édités à la main (non auto-générés) du manifeste existant.
try {
  const prev = JSON.parse(fs.readFileSync(path.join(root, 'modpack', 'manifest.json'), 'utf8'));
  for (const k of ['changelog', 'maintenance', 'announcement']) {
    if (prev[k] !== undefined) manifest[k] = prev[k];
  }
} catch { /* pas de manifeste précédent */ }

fs.writeFileSync(path.join(root, 'modpack', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`✅ Manifeste généré (tag "${tag}") :`);
console.log(`   • ${mods.length} mod(s)`);
console.log(`   • overrides : ${overrides ? (overrides.size / 1024).toFixed(0) + ' Ko (build-modpack/overrides.zip)' : 'aucun'}`);
console.log('\nÀ uploader dans la release GitHub "' + tag + '" :');
console.log('   - les .jar de build-modpack/mods/');
if (overrides) console.log('   - build-modpack/overrides.zip');
console.log('\nPuis : git add modpack/manifest.json && git commit && git push');
