// Balanceamento: simula partidas com bots (sem navegador) usando as regras de sim.js.
// Uso: node tests/balanceamento.js [partidas por tamanho, padrão 4]
// Para testar outros números sem editar o jogo: BAL='{"bossHp":500}' node tests/balanceamento.js
// Meta atual: bots aguentam ~13–14,5 min sozinhos, em 2 e em 4 (vencer exige jogar melhor que o bot).
globalThis.__BAL = JSON.parse(process.env.BAL || '{}');
require('../sim.js');
const PRIO = ['bolt','orbit','might','nova','aura','maxhp','speed','magnet','regen'];
function botMove(s, p) {
  let fx = 0, fy = 0;
  for (const e of s.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < (e.t === 3 ? 260 : 170) && d > 0) { const w = (e.t === 3 ? 4 : 1) / (d * d) * 4000; fx += dx / d * w; fy += dy / d * w; }
  }
  // gemas próximas
  let best = null, bd = 1e9;
  for (const g of s.gems) { const d = Math.hypot(g.x - p.x, g.y - p.y); if (d < bd) { bd = d; best = g; } }
  if (best && bd < 400) { fx += (best.x - p.x) / bd * 1.0; fy += (best.y - p.y) / bd * 1.0; }
  // amigo caído
  for (const o of s.players.values()) if (o !== p && o.dead) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d > 30) { fx += (o.x - p.x) / d * 1.2; fy += (o.y - p.y) / d * 1.2; }
  }
  // não se afastar demais dos outros
  for (const o of s.players.values()) if (o !== p && !o.dead) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d > 400) { fx += (o.x - p.x) / d * 0.5; fy += (o.y - p.y) / d * 0.5; }
  }
  // pequeno ruído para não travar
  fx += (Math.random() - 0.5) * 0.2; fy += (Math.random() - 0.5) * 0.2;
  s.setInput(p.id, fx, fy);
}
function run(n, skill = 1, maxT = 900) {
  const s = new Sim();
  for (let i = 0; i < n; i++) s.addPlayer('p' + i, 'B' + i);
  const lv5 = [], log = {}, deaths = [];
  let frame = 0;
  while (!s.over && s.time < maxT) {
    if (frame % Math.max(1, Math.round(6 / skill)) === 0) for (const p of s.players.values()) if (!p.dead) botMove(s, p);
    const wasDead = new Set([...s.players.values()].filter(p => p.dead).map(p => p.id));
    s.step(1 / 30); frame++;
    for (const p of s.players.values()) if (p.dead && !wasDead.has(p.id)) deaths.push((s.time/60).toFixed(1) + (s.enemies.some(e => e.t === 3) ? 'B' : ''));
    for (const p of s.players.values()) if (p.choices) {
      const r = PRIO.map(k => p.choices.indexOf(k)).find(i => i >= 0);
      s.pick(p.id, r === undefined ? 0 : r);
    }
    const m = Math.floor(s.time / 60);
    if (!log[m]) log[m] = { en: s.enemies.length, lv: [...s.players.values()].map(p => p.lv).join('/'), dead: [...s.players.values()].filter(p => p.dead).length };
  }
  return { deaths, t: s.time, win: s.win, kills: s.kills, lv: [...s.players.values()].map(p => p.lv), log };
}
const reps = +process.argv[2] || 4;
for (const n of [1, 2, 4]) {
  const out = [];
  for (let i = 0; i < reps; i++) out.push(run(n));
  const ts = out.map(r => (r.t / 60).toFixed(1)).sort((a, b) => a - b);
  const lv5 = out.map(r => r.log[5] ? r.log[5].lv.split('/')[0] : '-');
  console.log(`${n} jogador(es): minutos=${ts.join(' ')}  vitórias=${out.filter(r => r.win).length}/${reps}  nível aos 5 min=${lv5.join(' ')}`);
}
