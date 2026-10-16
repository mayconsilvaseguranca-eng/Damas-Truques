// Tela, controles e rede (PeerJS). O anfitrião roda a Sim; os outros só enviam comandos e desenham.
'use strict';

const ROOM_PREFIX = 'noitesemfim-mss-';
const PEER_OPTS = {
  debug: 0,
  config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ] }
};
const SEND_MS = 66; // ~15 atualizações por segundo
const ICONS = { bolt: '⚡', orbit: '🗡️', aura: '✨', nova: '💥', might: '💪', speed: '👟', maxhp: '❤️', magnet: '🧲', regen: '🌿', heal: '🧪' };

const $ = s => document.querySelector(s);
const cv = $('#cv');
const ctx = cv.getContext('2d');
if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };

// ---------- estado ----------
let mode = null;        // 'host' | 'client' | 'solo'
let peer = null;
let hostConn = null;
const conns = new Map();
let roster = new Map(); // id -> nome (só no anfitrião)
let roomCode = '';
let sim = null;
let myId = null;
let started = false;
let hostTimer = null, clientTimer = null;
let snapA = null, snapB = null, recvB = 0, snapGap = SEND_MS;
let localSnap = null;
const pred = { x: 0, y: 0, ok: false };
let shownChoices = '';
let overShown = false;

// ---------- utilidades de tela ----------
function show(id) {
  for (const s of ['#menu', '#lobby', '#over']) $(s).classList.toggle('hidden', s !== id);
}
function hideScreens() { for (const s of ['#menu', '#lobby', '#over']) $(s).classList.add('hidden'); }
function setMsg(sel, t) { $(sel).textContent = t || ''; }
let toastT = null;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 2500);
}
function myName() {
  const n = $('#name').value.trim() || 'Jogador';
  try { localStorage.setItem('nsf-name', n); } catch (e) {}
  return n.slice(0, 12);
}
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = ''; for (let i = 0; i < 4; i++) c += A[(Math.random() * A.length) | 0];
  return c;
}
function inviteLink() { return location.origin + location.pathname + '?sala=' + roomCode; }

// ---------- entrada ----------
const keys = new Set();
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let isTouch = matchMedia('(pointer: coarse)').matches;
addEventListener('pointerdown', e => { isTouch = e.pointerType === 'touch'; }, true);
addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (['1', '2', '3'].includes(e.key) && !$('#choices').classList.contains('hidden')) choose(+e.key - 1);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
cv.addEventListener('pointerdown', e => {
  if (joy.id !== null) return;
  const b = joyBase();
  joy.id = e.pointerId; joy.ox = b.x; joy.oy = b.y; joy.x = e.clientX; joy.y = e.clientY;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const endJoy = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);

// analógico fixo: embaixo, no centro da tela (vale para horizontal e vertical)
function joyBase() { return { x: W / 2, y: H - Math.max(95, Math.min(140, H * 0.16)) }; }
function readInput() {
  if (joy.id !== null) {
    const b = joyBase(); joy.ox = b.x; joy.oy = b.y;
    let x = (joy.x - joy.ox) / 50, y = (joy.y - joy.oy) / 50;
    const m = Math.hypot(x, y);
    if (m < 0.15) return { x: 0, y: 0 };
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x--;
  if (keys.has('d') || keys.has('arrowright')) x++;
  if (keys.has('w') || keys.has('arrowup')) y--;
  if (keys.has('s') || keys.has('arrowdown')) y++;
  const m = Math.hypot(x, y);
  return m ? { x: x / m, y: y / m } : { x: 0, y: 0 };
}

// ---------- anfitrião ----------
function hostGame(solo) {
  leave(true);
  mode = solo ? 'solo' : 'host';
  myId = 'host';
  roster = new Map([[myId, myName()]]);
  if (solo) { startSim(); return; }
  setMsg('#menuMsg', 'Criando sala...');
  createPeer(0);
}

function createPeer(tries) {
  const code = genCode();
  peer = new Peer(ROOM_PREFIX + code, PEER_OPTS);
  peer.on('open', () => {
    roomCode = code;
    setMsg('#menuMsg', '');
    $('#roomCode').textContent = code;
    $('#btnStart').classList.remove('hidden');
    $('#btnCopy').classList.remove('hidden');
    setMsg('#lobbyMsg', 'Mantenha esta tela aberta: o jogo roda no seu aparelho.');
    show('#lobby');
    updateRoster();
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id' && tries < 5) { peer.destroy(); createPeer(tries + 1); return; }
    if (!started) { setMsg('#menuMsg', 'Erro ao criar sala (' + err.type + '). Tente de novo.'); show('#menu'); }
  });
  peer.on('disconnected', () => { if (peer && !peer.destroyed) peer.reconnect(); });
  peer.on('connection', conn => {
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => dropConn(conn));
    conn.on('error', () => dropConn(conn));
  });
}

function onHostData(conn, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'join') {
    if (roster.size >= 4 && !roster.has(conn.peer)) {
      conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return;
    }
    const nm = String(d.name || 'Jogador').slice(0, 12);
    conns.set(conn.peer, conn);
    roster.set(conn.peer, nm);
    conn.send({ t: 'hi', id: conn.peer, code: roomCode });
    if (sim) sim.addPlayer(conn.peer, nm);
    updateRoster();
    toast(nm + ' entrou');
    return;
  }
  if (!conns.has(conn.peer) || !sim) return;
  if (d.t === 'in') sim.setInput(conn.peer, d.x, d.y);
  else if (d.t === 'pick') sim.pick(conn.peer, d.i | 0);
}

function dropConn(conn) {
  if (!conns.has(conn.peer)) return;
  conns.delete(conn.peer);
  const nm = roster.get(conn.peer);
  roster.delete(conn.peer);
  if (sim) sim.removePlayer(conn.peer);
  updateRoster();
  toast((nm || 'Jogador') + ' saiu');
}

function broadcast(m) { for (const c of conns.values()) if (c.open) { try { c.send(m); } catch (e) {} } }

function updateRoster() {
  renderRoster([...roster.values()]);
  broadcast({ t: 'lobby', pl: [...roster.values()] });
}

function renderRoster(names) {
  const colors = ['#ffd166', '#4cc9f0', '#f72585', '#80ed99'];
  $('#roster').innerHTML = '';
  names.forEach((n, i) => {
    const li = document.createElement('li');
    const dot = document.createElement('i'); dot.style.background = colors[i % 4];
    li.append(dot, document.createTextNode(n + (i === 0 ? ' (anfitrião)' : '')));
    $('#roster').append(li);
  });
}

function startSim() {
  sim = new Sim();
  for (const [id, nm] of roster) sim.addPlayer(id, nm);
  started = true; overShown = false; pred.ok = false;
  hideScreens();
  clearInterval(hostTimer);
  let last = performance.now(), acc = 0, lastSend = 0;
  hostTimer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(1000, now - last) / 1000; last = now;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 60) {
      const i = readInput(); sim.setInput(myId, i.x, i.y);
      sim.step(1 / 60); acc -= 1 / 60; steps++;
    }
    if (conns.size && now - lastSend >= SEND_MS) { lastSend = now; broadcast(sim.snapshot()); }
  }, 1000 / 60);
}

// ---------- convidado ----------
function joinGame(code) {
  code = (code || '').toUpperCase().trim();
  if (code.length !== 4) { setMsg('#menuMsg', 'Digite o código de 4 letras.'); return; }
  leave(true);
  mode = 'client';
  roomCode = code;
  setMsg('#menuMsg', 'Conectando...');
  peer = new Peer(PEER_OPTS);
  const fail = t => { if (mode !== 'client') return; leave(true); show('#menu'); setMsg('#menuMsg', t); };
  const timeout = setTimeout(() => { if (!myId) fail('Não consegui conectar. Confira o código e tente de novo.'); }, 15000);
  peer.on('open', () => {
    hostConn = peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'json' });
    hostConn.on('open', () => hostConn.send({ t: 'join', name: myName() }));
    hostConn.on('data', onClientData);
    hostConn.on('close', () => { clearTimeout(timeout); fail(started ? 'O anfitrião saiu da sala.' : 'A conexão caiu.'); });
  });
  peer.on('error', err => {
    clearTimeout(timeout);
    fail(err.type === 'peer-unavailable' ? 'Sala não encontrada.' : 'Erro de conexão (' + err.type + ').');
  });
}

function onClientData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hi') {
    myId = d.id;
    setMsg('#menuMsg', '');
    $('#roomCode').textContent = d.code || roomCode;
    $('#btnStart').classList.add('hidden');
    $('#btnCopy').classList.remove('hidden');
    setMsg('#lobbyMsg', 'Aguardando o anfitrião começar...');
    show('#lobby');
    let lastSent = '', lastT = 0;
    clearInterval(clientTimer);
    clientTimer = setInterval(() => {
      const i = readInput();
      const k = i.x.toFixed(2) + ',' + i.y.toFixed(2);
      const now = performance.now();
      if (hostConn && hostConn.open && (k !== lastSent || now - lastT > 250)) {
        hostConn.send({ t: 'in', x: +i.x.toFixed(2), y: +i.y.toFixed(2) });
        lastSent = k; lastT = now;
      }
    }, 33);
  } else if (d.t === 'lobby') {
    renderRoster(d.pl || []);
  } else if (d.t === 'full') {
    leave(true); show('#menu'); setMsg('#menuMsg', 'Sala cheia (máximo 4 jogadores).');
  } else if (d.t === 's') {
    if (!started) { started = true; hideScreens(); }
    const now = performance.now();
    if (snapB) snapGap = snapGap * 0.8 + Math.min(200, now - recvB) * 0.2;
    if (snapB && d.tm < snapB.tm) pred.ok = false; // partida reiniciada
    snapA = snapB || d; snapB = d; recvB = now;
  }
}

function sendPick(i) {
  if (mode === 'client') { if (hostConn && hostConn.open) hostConn.send({ t: 'pick', i }); }
  else if (sim) sim.pick(myId, i);
}

// ---------- sair ----------
function leave(silent) {
  clearInterval(hostTimer); clearInterval(clientTimer);
  Sfx.stopMusic(); prevA = null;
  if (peer) { try { peer.destroy(); } catch (e) {} }
  peer = null; hostConn = null; conns.clear(); roster = new Map();
  sim = null; started = false; myId = null; mode = null;
  snapA = snapB = localSnap = null; pred.ok = false;
  shownChoices = ''; overShown = false;
  $('#choices').classList.add('hidden');
  if (!silent) { show('#menu'); setMsg('#menuMsg', ''); }
}

// ---------- escolhas de nível ----------
function choose(i) {
  Sfx.play.pick();
  sendPick(i);
  for (const b of $('#cards').children) b.disabled = true;
}
function updateChoices(me) {
  const ch = me && !me.d && me.ch ? me.ch : null;
  const key = ch ? ch.join(',') + ':' + me.lv : '';
  if (key === shownChoices) return;
  shownChoices = key;
  const box = $('#choices');
  if (!ch) { box.classList.add('hidden'); return; }
  const cards = $('#cards'); cards.innerHTML = '';
  ch.forEach((k, i) => {
    const u = UPG[k];
    const cur = (me.u && me.u[k]) || 0;
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = '<span class="ico"></span><b></b><small></small><em></em>';
    b.querySelector('.ico').textContent = ICONS[k] || '★';
    b.querySelector('b').textContent = u.n;
    b.querySelector('small').textContent = u.d;
    b.querySelector('em').textContent = k === 'heal' ? '' : (cur ? 'Nível ' + (cur + 1) : 'Novo!');
    b.addEventListener('click', () => choose(i));
    cards.append(b);
  });
  box.classList.remove('hidden');
}

// ---------- fim de jogo ----------
function fmtTime(s) { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function updateOver(view) {
  if (view.ov && !overShown) {
    overShown = true;
    $('#overTitle').textContent = view.w ? 'VOCÊ VENCEU!' : 'FIM DE JOGO';
    const st = $('#overStats'); st.innerHTML = '';
    const row = (a, b) => { const d = document.createElement('div'); const x = document.createElement('span'); const y = document.createElement('b'); x.textContent = a; y.textContent = b; d.append(x, y); st.append(d); };
    row('Tempo sobrevivido', fmtTime(view.tm));
    row('Inimigos derrotados', view.k);
    for (const p of view.p) row(p.nm + ' (nível ' + p.lv + ')', p.k + ' abates');
    const canRestart = mode !== 'client';
    $('#btnAgain').classList.toggle('hidden', !canRestart);
    setMsg('#overMsg', canRestart ? '' : 'Aguardando o anfitrião reiniciar...');
    $('#choices').classList.add('hidden'); shownChoices = '';
    show('#over');
  } else if (!view.ov && overShown) {
    overShown = false; hideScreens();
  }
}

// ---------- sons a partir do estado do jogo ----------
let prevA = null;
function playSounds(v, me, boss) {
  const S = Sfx.play, P = prevA;
  const cur = { tm: v.tm, k: v.k, b: v.b.length, n: v.n.length, np: v.p.length, ov: v.ov, boss,
    lv: me ? me.lv : 0, xp: me ? me.xp : 0, d: me ? me.d : 0, h: me ? me.h : 0 };
  prevA = cur;
  if (!P || v.tm < P.tm) { if (!v.ov) Sfx.startMusic(); return; } // início ou reinício
  if (v.ov) { if (!P.ov) { Sfx.stopMusic(); v.w ? S.win() : S.lose(); } return; }
  if (P.ov) Sfx.startMusic();
  if (v.pz) return;
  Sfx.setIntensity(boss || v.tm > 420);
  if (boss && !P.boss) S.boss();
  if (cur.np > P.np) S.join();
  if (cur.b > P.b) S.shoot();
  if (cur.n > P.n) S.nova();
  if (cur.k > P.k) S.kill();
  if (me) {
    if (cur.lv > P.lv) S.level();
    else if (cur.xp > P.xp) S.gem(cur.xp);
    if (cur.h) S.hurt();
    if (cur.d && !P.d) S.down();
    if (!cur.d && P.d) S.revive();
  }
}

// ---------- desenho ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
addEventListener('resize', resize); resize();

const lerp = (a, b, t) => a + (b - a) * t;

function interpView(now) {
  const a = snapA, b = snapB;
  const t = Math.max(0, Math.min(1, (now - recvB) / Math.max(16, snapGap)));
  if (a === b) return Object.assign({}, b, { p: b.p.map(q => Object.assign({}, q)) });
  const pa = new Map(a.p.map(p => [p.id, p]));
  const p = b.p.map(q => { const o = pa.get(q.id); return Object.assign({}, q, o ? { x: lerp(o.x, q.x, t), y: lerp(o.y, q.y, t) } : {}); });
  const ea = new Map();
  for (let i = 0; i < a.e.length; i += 6) ea.set(a.e[i], i);
  const e = b.e.slice();
  for (let i = 0; i < e.length; i += 6) {
    const j = ea.get(e[i]);
    if (j !== undefined) { e[i + 2] = lerp(a.e[j + 2], e[i + 2], t); e[i + 3] = lerp(a.e[j + 3], e[i + 3], t); }
  }
  return Object.assign({}, b, { p, e, tm: a.tm <= b.tm ? lerp(a.tm, b.tm, t) : b.tm });
}

function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function drawGround(cx, cy, vw, vh) {
  const T = 96;
  const x0 = Math.floor((cx - vw / 2) / T) - 1, x1 = Math.floor((cx + vw / 2) / T) + 1;
  const y0 = Math.floor((cy - vh / 2) / T) - 1, y1 = Math.floor((cy + vh / 2) / T) + 1;
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
    const h = hash(tx, ty);
    ctx.fillStyle = (tx + ty) & 1 ? '#191c29' : '#1c1f2e';
    ctx.fillRect(tx * T, ty * T, T, T);
    const px = tx * T + hash(ty, tx) * 70 + 10, py = ty * T + h * 70 + 10;
    if (h < 0.25) { // tufo de grama
      ctx.strokeStyle = '#2b3a33'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 8); ctx.moveTo(px + 3, py); ctx.lineTo(px + 3, py - 10); ctx.moveTo(px + 6, py); ctx.lineTo(px + 10, py - 7); ctx.stroke();
    } else if (h < 0.33) { // pedra
      ctx.fillStyle = '#2a2d3d'; ctx.beginPath(); ctx.ellipse(px, py, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (h < 0.36) { // osso
      ctx.strokeStyle = '#4a4658'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py - 3); ctx.stroke();
    }
  }
}

function drawEnemy(t, x, y, flash, id, tm) {
  const R = ENEMY_TYPES[t].r;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, R * 0.9, R * 0.9, R * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  if (t === 0) { // morcego
    const f = Math.sin(tm * 18 + id) * 0.5 + 0.5;
    ctx.fillStyle = flash ? '#fff' : '#7b2cbf';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-R - 8, -4 - f * 8); ctx.lineTo(-R, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(R + 8, -4 - f * 8); ctx.lineTo(R, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#9d4edd'; ctx.beginPath(); ctx.arc(0, 0, R * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4d6d'; ctx.fillRect(-4, -2, 2, 2); ctx.fillRect(2, -2, 2, 2);
  } else if (t === 1) { // zumbi
    const w = Math.sin(tm * 6 + id) * 1.5;
    ctx.fillStyle = flash ? '#fff' : '#4f772d';
    ctx.beginPath(); ctx.roundRect(-R, -R + w, R * 2, R * 2, 5); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#31572c'; ctx.fillRect(-R, R * 0.3 + w, R * 2, R * 0.7);
    ctx.fillStyle = '#ecf39e'; ctx.fillRect(-6, -5 + w, 4, 4); ctx.fillRect(3, -5 + w, 4, 4);
  } else if (t === 2) { // brutamonte
    ctx.fillStyle = flash ? '#fff' : '#d00000';
    ctx.beginPath(); ctx.moveTo(-R * 0.7, -R * 0.6); ctx.lineTo(-R * 0.9, -R * 1.25); ctx.lineTo(-R * 0.3, -R * 0.8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R * 0.7, -R * 0.6); ctx.lineTo(R * 0.9, -R * 1.25); ctx.lineTo(R * 0.3, -R * 0.8); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#9d0208'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffba08'; ctx.fillRect(-8, -5, 5, 4); ctx.fillRect(3, -5, 5, 4);
    ctx.fillStyle = '#370617'; ctx.fillRect(-7, 5, 14, 3);
  } else { // chefe
    const g = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.6);
    g.addColorStop(0, 'rgba(255,0,60,.35)'); g.addColorStop(1, 'rgba(255,0,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#6a040f'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(-R * 0.6, -R * 0.75); ctx.lineTo(-R * 0.6, -R * 1.25); ctx.lineTo(-R * 0.3, -R * 1.0); ctx.lineTo(0, -R * 1.35); ctx.lineTo(R * 0.3, -R * 1.0); ctx.lineTo(R * 0.6, -R * 1.25); ctx.lineTo(R * 0.6, -R * 0.75); ctx.fill();
    ctx.fillStyle = '#ff0a54'; ctx.beginPath(); ctx.arc(-13, -6, 6, 0, Math.PI * 2); ctx.arc(13, -6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#250902'; ctx.fillRect(-16, 12, 32, 6);
  }
  ctx.restore();
}

function drawPlayer(p, x, y, isMe, tm) {
  ctx.save(); ctx.translate(x, y);
  if (p.d) ctx.globalAlpha = 0.45;
  else if (p.iv && Math.floor(tm * 10) % 2) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 14, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  // capa
  ctx.fillStyle = '#1b1830'; ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(13, -2); ctx.lineTo(16, 14); ctx.lineTo(-16, 14); ctx.fill();
  ctx.fillStyle = p.h ? '#ff4d6d' : p.c;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = isMe ? '#ffffff' : '#11131c'; ctx.stroke();
  ctx.fillStyle = '#11131c'; ctx.fillRect(-6, -4, 4, 5); ctx.fillRect(2, -4, 4, 5);
  ctx.globalAlpha = 1;
  if (p.d) { // anel de reviver
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    if (p.rv > 0) { ctx.strokeStyle = '#80ed99'; ctx.beginPath(); ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.rv); ctx.stroke(); }
  } else { // barra de vida
    ctx.fillStyle = '#2b0a12'; ctx.fillRect(-16, 20, 32, 4);
    ctx.fillStyle = '#ef233c'; ctx.fillRect(-16, 20, 32 * Math.max(0, p.hp / p.mh), 4);
  }
  if (!isMe) {
    ctx.font = '600 11px Rubik, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(p.nm, 1, -21);
    ctx.fillStyle = p.c; ctx.fillText(p.nm, 0, -22);
  }
  ctx.restore();
}

function render(view, now, dt) {
  const me = view.p.find(p => p.id === myId);
  // previsão local do convidado (movimento sem atraso)
  let cx = 0, cy = 0;
  if (me) {
    if (mode === 'client') {
      const sb = snapB.p.find(p => p.id === myId) || me;
      if (!pred.ok || me.d || view.pz) { pred.x = sb.x; pred.y = sb.y; pred.ok = true; }
      else {
        const i = readInput();
        pred.x += i.x * me.sp * dt; pred.y += i.y * me.sp * dt;
        const err = Math.hypot(sb.x - pred.x, sb.y - pred.y);
        const k = err > 150 ? 1 : (err > 40 ? 0.15 : (i.x || i.y ? 0.02 : 0.1));
        pred.x = lerp(pred.x, sb.x, k); pred.y = lerp(pred.y, sb.y, k);
      }
      me.x = pred.x; me.y = pred.y;
    }
    cx = me.x; cy = me.y;
  }

  const zoom = Math.max(0.55, Math.min(1.25, Math.min(W, H) / 620));
  const vw = W / zoom, vh = H / zoom;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#11131c'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, DPR * (W / 2 - cx * zoom), DPR * (H / 2 - cy * zoom));
  drawGround(cx, cy, vw, vh);
  const inView = (x, y, m) => Math.abs(x - cx) < vw / 2 + m && Math.abs(y - cy) < vh / 2 + m;
  const tm = view.tm;

  // auras
  for (const p of view.p) {
    const al = p.u && p.u.aura;
    if (!al || p.d) continue;
    const r = 55 + 10 * al;
    ctx.fillStyle = 'rgba(255,214,102,.07)'; ctx.strokeStyle = 'rgba(255,214,102,' + (0.25 + 0.1 * Math.sin(tm * 6)) + ')';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // gemas
  const g = view.g;
  for (let i = 0; i < g.length; i += 3) {
    const x = g[i], y = g[i + 1]; if (!inView(x, y, 10)) continue;
    const s = g[i + 2] ? 7 : 5;
    ctx.fillStyle = g[i + 2] ? '#80ed99' : '#4cc9f0';
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.fill();
  }
  // explosões
  const n = view.n;
  for (let i = 0; i < n.length; i += 4) {
    const a = Math.max(0, 1 - n[i + 2] / n[i + 3]);
    ctx.strokeStyle = 'rgba(247,37,133,' + a + ')'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(n[i], n[i + 1], n[i + 2], 0, Math.PI * 2); ctx.stroke();
  }
  // inimigos
  const e = view.e; let boss = null;
  for (let i = 0; i < e.length; i += 6) {
    if (e[i + 1] === 3) boss = e[i + 4];
    if (!inView(e[i + 2], e[i + 3], 60)) continue;
    drawEnemy(e[i + 1], e[i + 2], e[i + 3], e[i + 5], e[i], tm);
  }
  // jogadores (caídos primeiro)
  const order = view.p.slice().sort((a, b) => b.d - a.d);
  for (const p of order) drawPlayer(p, p.x, p.y, p.id === myId, tm);
  // lâminas orbitais
  for (const p of view.p) {
    const ol = p.u && p.u.orbit; if (!ol || p.d) continue;
    const cnt = Math.min(5, 1 + Math.floor(ol / 2));
    for (let i = 0; i < cnt; i++) {
      const a = tm * 3 + i * Math.PI * 2 / cnt;
      const bx = p.x + Math.cos(a) * 75, by = p.y + Math.sin(a) * 75;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#e0e1dd'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(5, 4); ctx.lineTo(0, 9); ctx.lineTo(-5, 4); ctx.fill();
      ctx.restore();
    }
  }
  // raios
  const b = view.b;
  ctx.fillStyle = '#bde0fe';
  for (let i = 0; i < b.length; i += 2) {
    ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(b[i], b[i + 1], 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // ---------- HUD ----------
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const top = 8;
  // setas para amigos fora da tela
  for (const p of view.p) {
    if (p.id === myId) continue;
    const sx = W / 2 + (p.x - cx) * zoom, sy = H / 2 + (p.y - cy) * zoom;
    if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const ex = Math.max(24, Math.min(W - 24, sx)), ey = Math.max(60, Math.min(H - 24, sy));
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = p.d ? '#ffffff' : p.c; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.fill();
    ctx.restore();
  }
  if (me) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, top, W - 16, 12);
    ctx.fillStyle = '#4cc9f0'; ctx.fillRect(10, top + 2, (W - 20) * Math.min(1, me.xp / me.nx), 8);
    ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText('NV ' + me.lv, 10, top + 32);
  }
  ctx.textAlign = 'center'; ctx.font = '14px "Press Start 2P", monospace'; ctx.fillStyle = '#fff';
  ctx.fillText(fmtTime(tm), W / 2, top + 36);
  ctx.textAlign = 'right'; ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('☠ ' + view.k, W - 10, top + 32);
  if (boss !== null) {
    const bw = Math.min(320, W - 40);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - bw / 2, top + 48, bw, 10);
    ctx.fillStyle = '#d00000'; ctx.fillRect(W / 2 - bw / 2 + 2, top + 50, (bw - 4) * boss / 100, 6);
    ctx.textAlign = 'center'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#ffba08';
    ctx.fillText('REI DA NOITE', W / 2, top + 72);
  }
  if (me && me.d && !view.ov) {
    ctx.textAlign = 'center'; ctx.font = '12px "Press Start 2P", monospace'; ctx.fillStyle = '#ff8fa3';
    ctx.fillText('VOCÊ CAIU!', W / 2, H / 2 - 50);
    ctx.font = '600 13px Rubik, sans-serif'; ctx.fillStyle = '#ddd';
    ctx.fillText('Um amigo pode te reviver ficando perto', W / 2, H / 2 - 30);
  }
  if (view.pz) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
  }
  // joystick (analógico digital)
  if (joy.id === null && isTouch && !view.ov) {
    const jb = joyBase(), hx = jb.x, hy = jb.y;
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(hx, hy, 22, 0, Math.PI * 2); ctx.fill();
  }
  if (joy.id !== null) {
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, Math.PI * 2); ctx.stroke();
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const m = Math.hypot(dx, dy);
    if (m > 50) { dx = dx / m * 50; dy = dy / m * 50; }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(joy.ox + dx, joy.oy + dy, 22, 0, Math.PI * 2); ctx.fill();
  }

  playSounds(view, me, boss !== null);
  updateChoices(me);
  updateOver(view);
}

function drawIdle(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#11131c'; ctx.fillRect(0, 0, W, H);
  const t = now / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, DPR * (W / 2 - t * 20), DPR * (H / 2 - t * 8));
  drawGround(t * 20, t * 8, W, H);
}

let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (!started) { drawIdle(now); return; }
  let view;
  if (mode === 'client') { if (!snapB) return; view = interpView(now); }
  else { if (!sim) return; view = sim.snapshot(); }
  render(view, now, dt);
}
requestAnimationFrame(frame);

// ---------- botões ----------
try { $('#name').value = localStorage.getItem('nsf-name') || ''; } catch (e) {}
const qs = new URLSearchParams(location.search).get('sala');
if (qs) { $('#code').value = qs.toUpperCase().slice(0, 4); setMsg('#menuMsg', 'Digite seu nome e toque em Entrar.'); }

addEventListener('pointerdown', () => Sfx.init(), true);
addEventListener('keydown', () => Sfx.init(), true);
for (const b of document.querySelectorAll('.panel button')) b.addEventListener('click', () => Sfx.play.click());
const SOUND_LABELS = ['🔊', '🔉', '🔇'];
const SOUND_TIPS = ['Som e música ligados', 'Só efeitos (sem música)', 'Mudo'];
function paintSound() { $('#btnSound').textContent = SOUND_LABELS[Sfx.mode]; $('#btnSound').title = SOUND_TIPS[Sfx.mode]; }
paintSound();
$('#btnSound').onclick = () => { Sfx.cycle(); paintSound(); toast(SOUND_TIPS[Sfx.mode]); };

$('#btnHost').onclick = () => hostGame(false);
$('#btnSolo').onclick = () => hostGame(true);
$('#btnJoin').onclick = () => joinGame($('#code').value);
$('#code').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame($('#code').value); });
$('#btnStart').onclick = () => startSim();
$('#btnLeave').onclick = () => leave(false);
$('#btnMenu').onclick = () => leave(false);
$('#btnAgain').onclick = () => { overShown = false; startSim(); };
$('#btnCopy').onclick = async () => {
  const link = inviteLink();
  try {
    if (navigator.share) await navigator.share({ title: 'Noite Sem Fim', text: 'Entra na minha sala! Código ' + roomCode, url: link });
    else { await navigator.clipboard.writeText(link); toast('Link copiado!'); }
  } catch (e) {
    try { await navigator.clipboard.writeText(link); toast('Link copiado!'); } catch (e2) { toast(link); }
  }
};
