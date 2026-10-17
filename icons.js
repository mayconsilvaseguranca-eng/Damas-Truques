// Desenhos dos itens (feitos por código, sem arquivos de imagem).
// Icons.url(chave) devolve uma imagem pronta para <img src>; Icons.draw(ctx, chave, x, y, tamanho) desenha no canvas.
'use strict';
const Icons = (() => {
  const S = 64; // os desenhos são feitos numa grade de 64x64
  const TAU = Math.PI * 2;

  function glow(c, color, blur) { c.shadowColor = color; c.shadowBlur = blur; }
  function noGlow(c) { c.shadowBlur = 0; }
  function star(c, x, y, r1, r2, n, rot) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1;
      c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }

  const DRAW = {
    bolt(c) { // esfera azul com raio
      glow(c, '#4cc9f0', 14);
      const g = c.createRadialGradient(28, 26, 4, 32, 32, 24);
      g.addColorStop(0, '#e0f7ff'); g.addColorStop(0.5, '#4cc9f0'); g.addColorStop(1, '#1d4e89');
      c.fillStyle = g; c.beginPath(); c.arc(32, 32, 22, 0, TAU); c.fill();
      noGlow(c);
      c.fillStyle = '#ffd166'; c.strokeStyle = '#7a4b00'; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(36, 10); c.lineTo(22, 35); c.lineTo(31, 35); c.lineTo(26, 54); c.lineTo(43, 27); c.lineTo(33, 27); c.lineTo(38, 10); c.closePath();
      c.fill(); c.stroke();
    },
    orbit(c) { // três lâminas girando
      c.strokeStyle = 'rgba(224,225,221,.35)'; c.lineWidth = 2; c.setLineDash([4, 5]);
      c.beginPath(); c.arc(32, 32, 20, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3;
        c.save(); c.translate(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20); c.rotate(a + Math.PI / 2);
        glow(c, '#bde0fe', 8);
        const g = c.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8d99ae');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, -15); c.lineTo(7, 4); c.lineTo(0, 12); c.lineTo(-7, 4); c.closePath(); c.fill();
        noGlow(c); c.strokeStyle = '#2b2d42'; c.lineWidth = 1.5; c.stroke();
        c.restore();
      }
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(32, 32, 6, 0, TAU); c.fill();
    },
    aura(c) { // anel dourado brilhante
      const g = c.createRadialGradient(32, 32, 6, 32, 32, 28);
      g.addColorStop(0, 'rgba(255,214,102,.9)'); g.addColorStop(0.6, 'rgba(255,214,102,.25)'); g.addColorStop(1, 'rgba(255,214,102,0)');
      c.fillStyle = g; c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.fill();
      glow(c, '#ffd166', 12); c.strokeStyle = '#ffd166'; c.lineWidth = 4;
      c.beginPath(); c.arc(32, 32, 20, 0, TAU); c.stroke(); noGlow(c);
      c.fillStyle = '#ffffff';
      for (const [x, y, r] of [[14, 14, 4], [50, 18, 3], [48, 50, 4], [16, 48, 3]]) { star(c, x, y, r, r * 0.35, 4, 0); c.fill(); }
      c.fillStyle = '#fff3c4'; star(c, 32, 32, 9, 3.5, 4, Math.PI / 4); c.fill();
    },
    nova(c) { // explosão rosa
      glow(c, '#f72585', 14);
      c.fillStyle = '#f72585'; star(c, 32, 32, 28, 12, 8, 0); c.fill();
      noGlow(c);
      c.fillStyle = '#ff8fc7'; star(c, 32, 32, 18, 8, 8, Math.PI / 8); c.fill();
      c.fillStyle = '#fff0f8'; c.beginPath(); c.arc(32, 32, 7, 0, TAU); c.fill();
    },
    might(c) { // espada em chamas
      glow(c, '#ff6d00', 14);
      c.fillStyle = '#ff6d00'; c.beginPath();
      c.moveTo(32, 4); c.quadraticCurveTo(48, 20, 42, 40); c.lineTo(22, 40); c.quadraticCurveTo(16, 20, 32, 4); c.fill();
      noGlow(c);
      c.save(); c.translate(32, 34); c.rotate(Math.PI / 4);
      const g = c.createLinearGradient(-4, 0, 4, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#adb5bd');
      c.fillStyle = g; c.beginPath(); c.moveTo(-4, 6); c.lineTo(-4, -20); c.lineTo(0, -27); c.lineTo(4, -20); c.lineTo(4, 6); c.fill();
      c.fillStyle = '#ffd166'; c.fillRect(-11, 6, 22, 5);
      c.fillStyle = '#6f1d1b'; c.fillRect(-3, 11, 6, 12);
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(0, 25, 4, 0, TAU); c.fill();
      c.restore();
    },
    speed(c) { // bota com asa
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.lineCap = 'round';
      for (const y of [30, 40, 50]) { c.beginPath(); c.moveTo(4, y); c.lineTo(14, y); c.stroke(); }
      c.fillStyle = '#9c6644'; c.strokeStyle = '#3d2314'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(24, 12); c.lineTo(38, 12); c.lineTo(38, 40); c.lineTo(56, 44); c.quadraticCurveTo(60, 52, 54, 54); c.lineTo(22, 54); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#6f4518'; c.fillRect(22, 50, 34, 4);
      c.fillStyle = '#ffffff'; c.strokeStyle = '#4cc9f0'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(38, 22); c.quadraticCurveTo(52, 8, 60, 12); c.quadraticCurveTo(54, 16, 56, 20); c.quadraticCurveTo(48, 22, 50, 26); c.quadraticCurveTo(44, 28, 38, 30); c.closePath(); c.fill(); c.stroke();
    },
    maxhp(c) { // coração
      glow(c, '#ef233c', 12);
      const g = c.createLinearGradient(0, 10, 0, 56); g.addColorStop(0, '#ff5d73'); g.addColorStop(1, '#a4161a');
      c.fillStyle = g; c.beginPath();
      c.moveTo(32, 54); c.bezierCurveTo(6, 36, 6, 12, 22, 12); c.bezierCurveTo(28, 12, 32, 18, 32, 22);
      c.bezierCurveTo(32, 18, 36, 12, 42, 12); c.bezierCurveTo(58, 12, 58, 36, 32, 54); c.fill();
      noGlow(c);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(21, 22, 5, 3.5, -0.6, 0, TAU); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(42, 36, 12, 4); c.fillRect(46, 32, 4, 12);
    },
    magnet(c) { // ímã atraindo gemas
      c.lineWidth = 12; c.lineCap = 'butt'; c.strokeStyle = '#e63946';
      c.beginPath(); c.arc(32, 30, 16, Math.PI, 0); c.stroke();
      c.fillStyle = '#e63946'; c.fillRect(10, 30, 12, 10); c.fillRect(42, 30, 12, 10);
      c.fillStyle = '#e0e1dd'; c.fillRect(10, 40, 12, 9); c.fillRect(42, 40, 12, 9);
      c.fillStyle = '#4cc9f0';
      for (const [x, y] of [[16, 58], [32, 52], [48, 58]]) { c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 3.5, y); c.lineTo(x, y + 5); c.lineTo(x - 3.5, y); c.fill(); }
    },
    regen(c) { // folha com cruz verde
      glow(c, '#80ed99', 12);
      c.fillStyle = '#38b000'; c.beginPath();
      c.moveTo(12, 52); c.quadraticCurveTo(8, 14, 52, 10); c.quadraticCurveTo(56, 50, 12, 52); c.fill();
      noGlow(c);
      c.strokeStyle = '#1b4332'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 50); c.quadraticCurveTo(30, 30, 50, 12); c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(34, 34, 16, 6); c.fillRect(39, 29, 6, 16);
    },
    heal(c) { // poção vermelha
      c.fillStyle = '#e0e1dd'; c.fillRect(26, 6, 12, 6);
      c.fillStyle = '#9c6644'; c.fillRect(27, 10, 10, 6);
      glow(c, '#ef233c', 10);
      c.fillStyle = 'rgba(200,220,255,.35)'; c.beginPath(); c.moveTo(26, 16); c.lineTo(38, 16); c.lineTo(38, 24); c.arc(32, 40, 17, -Math.PI / 2 + 0.36, Math.PI * 1.5 - 0.36); c.closePath(); c.fill();
      noGlow(c);
      c.fillStyle = '#ef233c'; c.beginPath(); c.arc(32, 40, 15, 0.1, Math.PI - 0.1); c.lineTo(17, 38); c.lineTo(47, 38); c.closePath(); c.fill();
      c.beginPath(); c.arc(32, 40, 15, Math.PI - 0.1, 0.1, true); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(25, 34, 3, 6, 0.4, 0, TAU); c.fill();
    }
  };

  const cache = {};
  function canvasFor(key, px) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const c = cv.getContext('2d'); c.scale(px / S, px / S);
    (DRAW[key] || DRAW.heal)(c);
    return cv;
  }
  function url(key) {
    if (!cache[key]) cache[key] = canvasFor(key, 128).toDataURL();
    return cache[key];
  }
  const imgs = {};
  function draw(ctx, key, x, y, size) {
    if (!imgs[key]) imgs[key] = canvasFor(key, 96);
    ctx.drawImage(imgs[key], x, y, size, size);
  }
  return { url, draw, keys: Object.keys(DRAW) };
})();
