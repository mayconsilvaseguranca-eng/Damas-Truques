// Simulação do jogo — roda só no navegador de quem cria a sala (anfitrião).
'use strict';
(function (root) {
  const COLORS = ['#ffd166', '#4cc9f0', '#f72585', '#80ed99'];
  const WIN_TIME = 15 * 60; // sobreviver 15 minutos = vitória
  // Números de balanceamento (ajustados com partidas simuladas por bots — ver tests/balanceamento.js)
  const BAL = {
    // ritmo dos inimigos
    spawnBase: 0.8, spawnGrow: 50,     // por segundo: base + tempo/grow
    hpGrow: 120, hpGrow2: 315,        // vida: 1 + t/hpGrow + (t/hpGrow2)²
    dmgGrow: 450, batSp: 92,          // dano: 1 + t/dmgGrow
    capBase: 240, capPerPlayer: 30,  // máximo de inimigos na tela
    kbCd: 0.4,                        // intervalo mínimo entre empurrões no mesmo inimigo
    // grupo (por jogador a mais)
    spawnPerPlayer: 0.6, hpPerPlayer: 0.55, hpRamp: 420, dmgPerPlayer: 0.12, xpSplit: 0.35,
    // chefe
    bossEvery: 180, bossHp: 400, bossHpGrow: 120, bossPerPlayer: 1.2,
    // jogador
    xpA: 3, xpB: 2.5, xpC: 0.2,           // XP do próximo nível: A + B*nv + C*nv²
    magnet: 85, contact: 1,
    boltCd: 0.8, boltCdLv: 0.06, boltDmg: 12, boltDmgLv: 5,
    orbitDmg: 8, orbitDmgLv: 4, auraDmg: 3, auraDmgLv: 2.5, novaDmg: 25, novaDmgLv: 10
  };
  if (typeof globalThis !== 'undefined' && globalThis.__BAL) Object.assign(BAL, globalThis.__BAL);

  const ENEMY_TYPES = [
    { hp: 8, sp: 100, dmg: 10, r: 10, xp: 1 },   // 0 morcego
    { hp: 25, sp: 55, dmg: 15, r: 14, xp: 2 },   // 1 zumbi
    { hp: 80, sp: 72, dmg: 22, r: 19, xp: 6 },   // 2 brutamonte
    { hp: 1800, sp: 55, dmg: 30, r: 42, xp: 60 } // 3 chefe (vida própria: BAL.bossHp)
  ];

  const UPG = {
    bolt:   { n: 'Raio Mágico',      s: 'Raio',     k: 'arma', d: 'Dispara no inimigo mais perto', max: 8 },
    orbit:  { n: 'Lâminas Orbitais', s: 'Lâminas',  k: 'arma', d: 'Lâminas giram ao seu redor', max: 8 },
    aura:   { n: 'Aura Sagrada',     s: 'Aura',     k: 'arma', d: 'Fere quem chega perto', max: 8 },
    nova:   { n: 'Explosão Estelar', s: 'Explosão', k: 'arma', d: 'Onda de choque periódica', max: 8 },
    might:  { n: 'Poder',            s: 'Poder',    k: 'bonus', d: '+15% de dano', max: 5 },
    speed:  { n: 'Botas Velozes',    s: 'Botas',    k: 'bonus', d: '+10% de velocidade', max: 5 },
    maxhp:  { n: 'Coração Forte',    s: 'Coração',  k: 'bonus', d: '+25 de vida máxima', max: 5 },
    magnet: { n: 'Ímã',              s: 'Ímã',      k: 'bonus', d: 'Coleta XP de mais longe', max: 5 },
    regen:  { n: 'Regeneração',      s: 'Regenera', k: 'bonus', d: 'Recupera vida com o tempo', max: 5 },
    heal:   { n: 'Poção',            s: 'Poção',    k: 'cura', d: 'Cura 40 de vida', max: Infinity }
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const CELL = 64;

  class Sim {
    constructor() {
      this.players = new Map();
      this.enemies = [];
      this.bolts = [];
      this.gems = [];
      this.novas = [];
      this.time = 0;
      this.kills = 0;
      this.nextId = 1;
      this.spawnAcc = 0;
      this.bossAt = BAL.bossEvery;
      this.over = false;
      this.win = false;
      this.grid = new Map();
    }

    get solo() { return this.players.size === 1; }

    addPlayer(id, name) {
      if (this.players.has(id)) return this.players.get(id);
      const used = new Set([...this.players.values()].map(p => p.col));
      const col = COLORS.find(c => !used.has(c)) || COLORS[0];
      const anchor = [...this.players.values()].find(p => !p.dead);
      const p = {
        id, name: String(name || 'Jogador').slice(0, 12), col,
        x: (anchor ? anchor.x : 0) + rnd(-40, 40), y: (anchor ? anchor.y : 0) + rnd(-40, 40),
        hp: 100, maxhp: 100, lv: 1, xp: 0, next: Math.floor(BAL.xpA + BAL.xpB + BAL.xpC),
        u: { bolt: 1 }, cd: { bolt: 0, aura: 0, nova: 0 },
        inp: { x: 0, y: 0 }, dead: false, rev: 0, inv: 2, hitT: 0,
        kills: 0, queue: 0, choices: null
      };
      this.players.set(id, p);
      return p;
    }

    removePlayer(id) { this.players.delete(id); }

    setInput(id, x, y) {
      const p = this.players.get(id);
      if (!p) return;
      x = Number(x) || 0; y = Number(y) || 0;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      p.inp.x = x; p.inp.y = y;
    }

    pick(id, i) {
      const p = this.players.get(id);
      if (!p || !p.choices) return;
      const k = p.choices[i];
      if (!k) return;
      if (k === 'heal') p.hp = Math.min(p.maxhp, p.hp + 40);
      else {
        p.u[k] = (p.u[k] || 0) + 1;
        if (k === 'maxhp') { p.maxhp += 25; p.hp += 25; }
      }
      p.choices = null;
      if (p.queue > 0) { p.queue--; p.choices = this.roll(p); }
    }

    roll(p) {
      const opts = Object.keys(UPG).filter(k => k !== 'heal' && (p.u[k] || 0) < UPG[k].max);
      for (let i = opts.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      const c = opts.slice(0, 3);
      while (c.length < 3) c.push('heal');
      return c;
    }

    alive() { return [...this.players.values()].filter(p => !p.dead); }

    nearestPlayer(x, y, list) {
      let best = null, bd = Infinity;
      for (const p of list) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return [best, Math.sqrt(bd)];
    }

    buildGrid() {
      const g = this.grid; g.clear();
      for (const e of this.enemies) {
        const k = Math.floor(e.x / CELL) * 73856093 ^ Math.floor(e.y / CELL) * 19349663;
        let a = g.get(k); if (!a) g.set(k, a = []);
        a.push(e);
      }
    }

    near(x, y, r, fn) {
      const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
      const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const a = this.grid.get(cx * 73856093 ^ cy * 19349663);
        if (a) for (const e of a) if (e.hp > 0) fn(e);
      }
    }

    hurt(e, dmg, p, kx, ky) {
      e.hp -= dmg; e.last = p.id; e.flash = 0.08;
      // empurrão no máximo a cada 0,4 s por inimigo (senão vários jogadores juntos viram uma parede)
      if (kx !== undefined && e.t !== 3 && !(e.kb > 0)) { e.x += kx; e.y += ky; e.kb = BAL.kbCd; }
    }

    spawn(alive) {
      const n = this.players.size;
      const p = alive[(Math.random() * alive.length) | 0];
      const a = Math.random() * Math.PI * 2, d = rnd(520, 640);
      let t;
      if (this.time >= this.bossAt) { t = 3; this.bossAt += BAL.bossEvery; }
      else {
        const r = Math.random();
        const brute = Math.min(0.3, this.time / 600);
        t = r < brute ? 2 : (r < brute + (this.time < 60 ? 0.4 : 0.35) ? 1 : 0);
      }
      const T = ENEMY_TYPES[t];
      const scale = (1 + this.time / BAL.hpGrow + (BAL.hpGrow2 ? (this.time / BAL.hpGrow2) ** 2 : 0)) * (1 + BAL.hpPerPlayer * (n - 1) * Math.min(1, this.time / BAL.hpRamp)); // em grupo os inimigos endurecem aos poucos
      const hp = t === 3 ? BAL.bossHp * (1 + this.time / BAL.bossHpGrow) * (1 + BAL.bossPerPlayer * (n - 1)) : T.hp * scale;
      this.enemies.push({
        id: this.nextId++, t, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
        hp, max: hp, sp: (t === 0 ? BAL.batSp : T.sp) * (1 + Math.min(0.4, this.time / 1500)), dmg: T.dmg * (1 + this.time / BAL.dmgGrow) * (1 + BAL.dmgPerPlayer * (n - 1)), r: T.r, xp: T.xp,
        oh: 0, flash: 0, last: null
      });
    }

    step(dt) {
      if (this.over || this.players.size === 0) return;
      if (this.solo && [...this.players.values()][0].choices) return; // pausa no modo solo
      this.time += dt;
      if (this.time >= WIN_TIME) { this.over = true; this.win = true; return; }

      const alive = this.alive();

      // jogadores
      for (const p of this.players.values()) {
        p.hitT = Math.max(0, p.hitT - dt);
        p.inv = Math.max(0, p.inv - dt);
        if (p.dead) continue;
        const spd = 150 * (1 + 0.1 * (p.u.speed || 0));
        p.x += p.inp.x * spd * dt; p.y += p.inp.y * spd * dt;
        p.hp = Math.min(p.maxhp, p.hp + (p.u.regen || 0) * 0.6 * dt);
      }

      // nascimento de inimigos
      if (alive.length) {
        const n = this.players.size;
        this.spawnAcc += (BAL.spawnBase + this.time / BAL.spawnGrow) * (1 - BAL.spawnPerPlayer + BAL.spawnPerPlayer * n) * dt;
        while (this.spawnAcc >= 1) {
          this.spawnAcc--;
          if (this.enemies.length < BAL.capBase + BAL.capPerPlayer * this.players.size || this.time >= this.bossAt) this.spawn(alive);
        }
      }

      this.buildGrid();

      // movimento dos inimigos + dano de contato
      for (const e of this.enemies) {
        e.flash = Math.max(0, e.flash - dt);
        e.oh = Math.max(0, e.oh - dt);
        e.kb = Math.max(0, (e.kb || 0) - dt);
        const [p, d] = this.nearestPlayer(e.x, e.y, alive);
        if (!p) continue;
        if (d > 1100) { // longe demais: reaparece perto
          const a = Math.random() * Math.PI * 2;
          e.x = p.x + Math.cos(a) * 560; e.y = p.y + Math.sin(a) * 560;
          continue;
        }
        if (d > 1) { e.x += (p.x - e.x) / d * e.sp * dt; e.y += (p.y - e.y) / d * e.sp * dt; }
        // separação simples
        this.near(e.x, e.y, e.r * 2, o => {
          if (o === e) return;
          const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy), min = e.r + o.r;
          if (dd > 0 && dd < min) { const push = (min - dd) * 0.25; e.x += dx / dd * push; e.y += dy / dd * push; }
        });
        if (d < e.r + 14 && p.inv <= 0) { p.hp -= e.dmg * BAL.contact * dt; p.hitT = 0.15; }
      }

      // armas
      for (const p of alive) this.weapons(p, dt);

      // projéteis
      for (const b of this.bolts) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0) continue;
        const owner = this.players.get(b.owner);
        this.near(b.x, b.y, 50, e => {
          if (b.life <= 0 || b.hit.has(e.id)) return;
          if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 6) ** 2) {
            b.hit.add(e.id);
            if (owner) this.hurt(e, b.dmg, owner, b.vx * 0.02, b.vy * 0.02);
            if (b.pierce-- <= 0) b.life = 0;
          }
        });
      }
      this.bolts = this.bolts.filter(b => b.life > 0);

      // explosões
      for (const nv of this.novas) {
        nv.r += 420 * dt;
        const owner = this.players.get(nv.owner);
        this.near(nv.x, nv.y, nv.r, e => {
          if (nv.hit.has(e.id)) return;
          const d = Math.hypot(e.x - nv.x, e.y - nv.y);
          if (d < nv.r + e.r && owner) { nv.hit.add(e.id); this.hurt(e, nv.dmg, owner, (e.x - nv.x) / (d || 1) * 18, (e.y - nv.y) / (d || 1) * 18); }
        });
      }
      this.novas = this.novas.filter(nv => nv.r < nv.max);

      // mortes de inimigos
      const keep = [];
      for (const e of this.enemies) {
        if (e.hp > 0) { keep.push(e); continue; }
        this.kills++;
        const k = this.players.get(e.last); if (k) k.kills++;
        if (e.t === 3) for (let i = 0; i < 12; i++) this.gems.push({ x: e.x + rnd(-40, 40), y: e.y + rnd(-40, 40), v: 5 });
        else this.gems.push({ x: e.x, y: e.y, v: e.xp });
      }
      this.enemies = keep;
      if (this.gems.length > 500) { // junta gemas antigas
        const extra = this.gems.splice(0, this.gems.length - 500);
        this.gems[0].v += extra.reduce((s, g) => s + g.v, 0);
      }

      // gemas de XP
      if (alive.length) {
        this.gems = this.gems.filter(g => {
          const [p, d] = this.nearestPlayer(g.x, g.y, alive);
          const mag = BAL.magnet * (1 + 0.5 * (p.u.magnet || 0));
          if (d < 18) { const v = g.v / (1 + BAL.xpSplit * (this.players.size - 1)); for (const q of alive) this.gainXp(q, v); return false; } // XP vai para o time todo
          if (d < mag) { g.x += (p.x - g.x) / d * 450 * dt; g.y += (p.y - g.y) / d * 450 * dt; }
          return true;
        });
      }

      // vida, morte e reviver
      for (const p of this.players.values()) {
        if (!p.dead && p.hp <= 0) { p.dead = true; p.hp = 0; p.rev = 0; p.choices = null; p.queue = 0; }
        if (p.dead) {
          const helper = alive.some(o => o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 60);
          p.rev = helper ? p.rev + dt : Math.max(0, p.rev - dt * 0.5);
          if (p.rev >= 3) { p.dead = false; p.hp = p.maxhp * 0.5; p.inv = 2; p.rev = 0; }
        }
      }
      if ([...this.players.values()].every(p => p.dead)) this.over = true;
    }

    gainXp(p, v) {
      p.xp += v;
      while (p.xp >= p.next) {
        p.xp -= p.next; p.lv++;
        p.next = Math.floor(BAL.xpA + p.lv * BAL.xpB + p.lv * p.lv * BAL.xpC);
        p.queue++;
      }
      if (!p.choices && p.queue > 0) { p.queue--; p.choices = this.roll(p); }
    }

    weapons(p, dt) {
      const dm = 1 + 0.15 * (p.u.might || 0);
      // Raio Mágico
      const bl = p.u.bolt || 0;
      if (bl) {
        p.cd.bolt -= dt;
        if (p.cd.bolt <= 0 && this.enemies.length) {
          p.cd.bolt = Math.max(0.25, BAL.boltCd - BAL.boltCdLv * bl);
          const count = 1 + Math.floor((bl - 1) / 2);
          const targets = this.enemies
            .map(e => [e, (e.x - p.x) ** 2 + (e.y - p.y) ** 2])
            .filter(a => a[1] < 520 * 520)
            .sort((a, b) => a[1] - b[1]).slice(0, count);
          for (const [e] of targets) {
            const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
            this.bolts.push({ x: p.x, y: p.y, vx: (e.x - p.x) / d * 440, vy: (e.y - p.y) / d * 440,
              dmg: (BAL.boltDmg + BAL.boltDmgLv * bl) * dm, pierce: Math.floor(bl / 3), life: 1.4, owner: p.id, hit: new Set() });
          }
        }
      }
      // Lâminas Orbitais
      const ol = p.u.orbit || 0;
      if (ol) {
        const n = Math.min(5, 1 + Math.floor(ol / 2));
        for (let i = 0; i < n; i++) {
          const a = this.time * 3 + i * Math.PI * 2 / n;
          const bx = p.x + Math.cos(a) * 75, by = p.y + Math.sin(a) * 75;
          this.near(bx, by, 50, e => {
            if (e.oh > 0) return;
            if ((e.x - bx) ** 2 + (e.y - by) ** 2 < (e.r + 12) ** 2) {
              e.oh = 0.35; this.hurt(e, (BAL.orbitDmg + BAL.orbitDmgLv * ol) * dm, p, Math.cos(a) * 10, Math.sin(a) * 10);
            }
          });
        }
      }
      // Aura Sagrada
      const al = p.u.aura || 0;
      if (al) {
        p.cd.aura -= dt;
        if (p.cd.aura <= 0) {
          p.cd.aura = 0.5;
          const r = 55 + 10 * al;
          this.near(p.x, p.y, r, e => {
            if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (r + e.r) ** 2) this.hurt(e, (BAL.auraDmg + BAL.auraDmgLv * al) * dm, p);
          });
        }
      }
      // Explosão Estelar
      const nl = p.u.nova || 0;
      if (nl) {
        p.cd.nova -= dt;
        if (p.cd.nova <= 0) {
          p.cd.nova = Math.max(1.5, 4 - 0.3 * nl);
          this.novas.push({ x: p.x, y: p.y, r: 0, max: 130 + 20 * nl, dmg: (BAL.novaDmg + BAL.novaDmgLv * nl) * dm, owner: p.id, hit: new Set() });
        }
      }
    }

    snapshot() {
      const e = [], b = [], g = [], n = [];
      for (const x of this.enemies) e.push(x.id, x.t, x.x | 0, x.y | 0, Math.max(0, Math.round(x.hp / x.max * 100)), x.flash > 0 ? 1 : 0);
      for (const x of this.bolts) b.push(x.x | 0, x.y | 0);
      for (const x of this.gems) g.push(x.x | 0, x.y | 0, x.v >= 5 ? 1 : 0);
      for (const x of this.novas) n.push(x.x | 0, x.y | 0, x.r | 0, x.max | 0);
      const p = [...this.players.values()].map(q => ({
        id: q.id, nm: q.name, c: q.col, x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10,
        hp: Math.ceil(q.hp), mh: q.maxhp, lv: q.lv, xp: Math.round(q.xp * 10) / 10, nx: q.next, d: q.dead ? 1 : 0,
        rv: Math.round(q.rev / 3 * 100) / 100, u: q.u, ch: q.choices, k: q.kills,
        sp: 150 * (1 + 0.1 * (q.u.speed || 0)), h: q.hitT > 0 ? 1 : 0, iv: q.inv > 0 ? 1 : 0
      }));
      const paused = this.solo && !!p[0] && !!p[0].ch;
      return { t: 's', tm: Math.round(this.time * 100) / 100, k: this.kills, ov: this.over ? 1 : 0, w: this.win ? 1 : 0, pz: paused ? 1 : 0, p, e, b, g, n };
    }
  }

  root.Sim = Sim;
  root.BAL = BAL;
  root.UPG = UPG;
  root.ENEMY_TYPES = ENEMY_TYPES;
  root.WIN_TIME = WIN_TIME;
})(typeof window !== 'undefined' ? window : globalThis);
