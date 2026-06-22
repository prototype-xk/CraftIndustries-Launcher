'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Calcule le SHA-1 d'un fichier (pour vérifier l'intégrité des mods).
function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Télécharge un fichier avec suivi de progression (fetch natif de Node 18+).
async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Échec du téléchargement (HTTP ${res.status}) : ${url}`);
  }

  const total = Number(res.headers.get('content-length')) || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const tmp = dest + '.part';
  const fileStream = fs.createWriteStream(tmp);
  const reader = res.body.getReader();
  let downloaded = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      downloaded += value.length;
      if (!fileStream.write(Buffer.from(value))) {
        await new Promise((r) => fileStream.once('drain', r));
      }
      if (onProgress && total) onProgress(downloaded, total);
    }
  } catch (err) {
    fileStream.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }

  await new Promise((resolve, reject) => {
    fileStream.end(() => resolve());
    fileStream.on('error', reject);
  });

  fs.rmSync(dest, { force: true });
  fs.renameSync(tmp, dest);
}

// Détecte un exécutable Java utilisable.
// 1) chemin fourni par l'utilisateur, 2) JDK Adoptium installés, 3) PATH système.
function findJava(preferred) {
  if (preferred && fs.existsSync(preferred)) return preferred;

  const roots = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Eclipse Adoptium'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Java'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft', 'jdk')
  ];

  for (const root of roots) {
    try {
      const entries = fs.readdirSync(root);
      for (const e of entries) {
        const candidate = path.join(root, e, 'bin', 'javaw.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {
      /* dossier absent, on continue */
    }
  }

  // Repli : on suppose que Java est dans le PATH.
  return process.platform === 'win32' ? 'javaw' : 'java';
}

module.exports = { sha1File, downloadFile, findJava };
