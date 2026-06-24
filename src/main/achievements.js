'use strict';

// Succès / badges du launcher. Débloqués selon les stats (stats.json).

const ACHIEVEMENTS = [
  { id: 'login',  name: 'Bienvenue',              desc: 'Se connecter pour la première fois', icon: '🔑', test: (s) => s.everLoggedIn },
  { id: 'play1',  name: 'Premier lancement',      desc: 'Lancer le jeu une fois',             icon: '🚀', test: (s) => s.sessions >= 1 },
  { id: 'play10', name: 'Habitué',                desc: 'Lancer le jeu 10 fois',              icon: '🎮', test: (s) => s.sessions >= 10 },
  { id: 'play50', name: 'Accro',                  desc: 'Lancer le jeu 50 fois',              icon: '🔥', test: (s) => s.sessions >= 50 },
  { id: 'time1',  name: 'Une heure au compteur',  desc: 'Jouer 1 heure au total',             icon: '⏱️', test: (s) => s.playtimeMs >= 3600000 },
  { id: 'time10', name: 'Vétéran',                desc: 'Jouer 10 heures au total',           icon: '🏆', test: (s) => s.playtimeMs >= 36000000 },
  { id: 'time100', name: 'Légende',               desc: 'Jouer 100 heures au total',          icon: '👑', test: (s) => s.playtimeMs >= 360000000 },
  { id: 'shot',   name: 'Photographe',            desc: 'Prendre une capture en jeu',         icon: '📸', test: (s, ctx) => (ctx.screenshots || 0) >= 1 }
];

// Renvoie { unlocked: [ids], fresh: [achievements nouvellement débloqués] }.
function evaluate(stats, ctx = {}) {
  const unlocked = new Set(stats.unlocked || []);
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.test(stats, ctx)) { unlocked.add(a.id); fresh.push(a); }
  }
  return { unlocked: [...unlocked], fresh };
}

function list(stats) {
  const set = new Set((stats && stats.unlocked) || []);
  return ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, unlocked: set.has(a.id) }));
}

module.exports = { ACHIEVEMENTS, evaluate, list };
