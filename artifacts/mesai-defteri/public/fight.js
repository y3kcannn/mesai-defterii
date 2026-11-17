// Ekranın altında iki çöp adamın kısa dövüşü. Her dövüş farklı akar: yumruk, tekme, uçan tekme,
// enerji topu, savuşturma, sıyrılma, havaya atma, yere düşüp kalkma. Dokunmayı engellemez.
const stickFight = (() => {
  const H = 72, GROUND = 66, G = 900;
  const COL = ['#2a9d8f', '#7b4fb0'];
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  // Duruşlar: [gövde eğimi, ön kol (omuz, dirsek), arka kol, ön bacak (kalça, diz), arka bacak] — derece, 0 = aşağı
  const P = {
    stand:   [4, 30, 70, -20, 60, 12, -8, -10, 6],
    guard:   [8, 60, 100, 10, 110, 18, -10, -14, 8],
    walk1:   [6, 40, 70, -30, 50, 28, -20, -18, 4],
    walk2:   [6, 10, 80, 20, 60, -10, 4, 24, -26],
    punch:   [14, 92, 0, 20, 110, 22, -8, -22, 6],
    punch2:  [16, 20, 110, 95, 0, 26, -8, -24, 8],
    upper:   [-8, 150, 10, 0, 60, 16, -20, -10, 10],
    kick:    [-14, 60, 90, -40, 50, 92, 0, -12, 4],
    lowkick: [10, 70, 100, 0, 80, 70, 4, -30, 30],
    jumpk:   [-10, 120, 60, 60, 80, 88, 0, -40, 80],
    crouch:  [20, 70, 100, 20, 110, 70, -100, -40, 90],
    block:   [4, 120, 140, 100, 150, 14, -6, -16, 6],
    cast:    [10, 88, 0, 88, 0, 20, -6, -24, 8],
    charge:  [18, 20, 60, -20, 60, 30, -40, -30, 40],
    hit:     [-24, -40, 60, -70, 40, 6, 10, -20, 14],
    air:     [-40, -100, 40, -130, 30, 40, 50, -20, 40],
    down:    [-90, -150, 20, -160, 10, -80, 0, -100, 0],
    win:     [0, 170, 10, 40, 60, 10, -4, -10, 4],
    dash:    [36, 30, 120, -60, 60, 50, -60, -50, 40],
  };

  const make = (i, x) => ({ i, x, y: GROUND, vx: 0, vy: 0, face: i ? -1 : 1, hp: 100, st: 'idle', t: 0, pose: P.stand.slice(), target: P.stand, act: null, hitDone: false, stun: 0, cool: rnd(.2, .6), combo: 0, trail: [] });

  let cv, ctx, W = 0, dpr = 1, raf = 0, F = [], fx = [], shots = [], last = 0, life = 0, endT = 0, reduce = false;

  const ATT = {
    jab:   { pose: 'punch',  wind: .08, act: .08, rec: .14, reach: 14, dmg: 6,  kb: 70,  up: 0 },
    cross: { pose: 'punch2', wind: .07, act: .08, rec: .16, reach: 15, dmg: 7,  kb: 90,  up: 0 },
    upper: { pose: 'upper',  wind: .12, act: .1,  rec: .26, reach: 12, dmg: 11, kb: 60,  up: 300 },
    kick:  { pose: 'kick',   wind: .12, act: .1,  rec: .22, reach: 19, dmg: 10, kb: 170, up: 60 },
    sweep: { pose: 'lowkick',wind: .1,  act: .1,  rec: .24, reach: 18, dmg: 8,  kb: 40,  up: 220 },
  };

  const joints = (f) => {
    const [lean, fa1, fa2, ba1, ba2, fl1, fl2, bl1, bl2] = f.pose, s = f.face;
    const rad = d => d * Math.PI / 180;
    const seg = (x, y, ang, len) => [x + Math.sin(rad(ang)) * len * s, y + Math.cos(rad(ang)) * len];
    const hip = [f.x, f.y - 12];
    const neck = seg(hip[0], hip[1], 180 + lean, 10);
    const head = seg(neck[0], neck[1], 180 + lean, 3.6);
    const fe = seg(neck[0], neck[1], fa1, 5.5), fh = seg(fe[0], fe[1], fa1 + fa2 * 0 + (fa2 - fa1) * .6, 5.5);
    const be = seg(neck[0], neck[1], ba1, 5.5), bh = seg(be[0], be[1], ba1 + (ba2 - ba1) * .6, 5.5);
    const fk = seg(hip[0], hip[1], fl1, 6.5), ff = seg(fk[0], fk[1], fl1 + fl2, 6.5);
    const bk = seg(hip[0], hip[1], bl1, 6.5), bf = seg(bk[0], bk[1], bl1 + bl2, 6.5);
    return { hip, neck, head, fe, fh, be, bh, fk, ff, bk, bf };
  };

  const draw = (f, alpha = 1, col) => {
    const j = joints(f);
    ctx.globalAlpha = alpha; ctx.strokeStyle = col || COL[f.i]; ctx.fillStyle = col || COL[f.i];
    ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    const L = (...p) => { ctx.moveTo(...p[0]); for (const q of p.slice(1)) ctx.lineTo(...q); };
    L(j.hip, j.neck); L(j.neck, j.be, j.bh); L(j.hip, j.bk, j.bf); L(j.hip, j.fk, j.ff); L(j.neck, j.fe, j.fh);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(j.head[0], j.head[1], 3.4, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  };

  const spark = (x, y, n, col, sp = 120) => { for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), v = rnd(sp * .3, sp); fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: rnd(.18, .4), col }); } };
  const ring = (x, y, col, r = 10) => fx.push({ k: 'r', x, y, t: 0, life: .28, col, r });
  const dust = (x, y) => { for (let k = 0; k < 5; k++) fx.push({ k: 'p', x: x + rnd(-4, 4), y, vx: rnd(-40, 40), vy: rnd(-40, -10), t: 0, life: rnd(.2, .4), col: '#9a9a90' }); };

  const setPose = (f, name) => { f.target = P[name]; };
  const other = f => F[1 - f.i];

  const startAttack = (f, name) => { f.st = 'att'; f.act = ATT[name]; f.t = 0; f.hitDone = false; setPose(f, 'guard'); };

  const hurt = (f, dmg, kb, up, from) => {
    if (f.st === 'down' || f.st === 'ko') return;
    const dir = Math.sign(f.x - from.x) || -from.face;
    const blocking = f.st === 'block' && f.face === -dir;
    const j = joints(f), hx = (j.neck[0] + j.hip[0]) / 2, hy = j.neck[1] + 3;
    if (blocking) { f.vx = dir * kb * .5; spark(hx - dir * 3, hy, 6, '#ffd34d', 90); ring(hx - dir * 3, hy, '#ffd34d', 7); f.hp -= dmg * .15; return 'block'; }
    f.hp -= dmg; f.vx = dir * kb; f.vy = -up; f.face = -dir;
    spark(hx, hy, dmg > 9 ? 12 : 7, '#fff2c0', 150); ring(hx, hy, COL[from.i], dmg > 9 ? 13 : 8);
    if (f.hp <= 0) { f.st = 'ko'; f.vy = -260; f.vx = dir * 160; f.t = 0; setPose(f, 'air'); endT = life + 2.4; return 'ko'; }
    if (up > 150 || kb > 150) { f.st = 'air'; f.t = 0; setPose(f, 'air'); f.vy = -Math.max(up, 160); }
    else { f.st = 'hit'; f.t = 0; f.stun = .22; setPose(f, 'hit'); }
    return 'hit';
  };

  const think = (f, dt) => {
    const o = other(f), d = Math.abs(o.x - f.x), dir = Math.sign(o.x - f.x) || f.face;
    if (f.st === 'idle' || f.st === 'walk') f.face = dir;
    f.cool -= dt;
    if (f.cool > 0 || !(f.st === 'idle' || f.st === 'walk')) return;
    const r = Math.random(), oAtt = o.st === 'att' || o.st === 'jump';
    // Rakip saldırıyorsa: savuştur, geri sıçra ya da araya gir
    if (oAtt && d < 26 && r < .45) {
      const c = Math.random();
      if (c < .45) { f.st = 'block'; f.t = 0; setPose(f, 'block'); }
      else if (c < .75) { f.st = 'dodge'; f.t = 0; f.vx = -dir * 220; f.vy = -120; setPose(f, 'crouch'); }
      else { f.st = 'dash'; f.t = 0; f.vx = -dir * 260; setPose(f, 'dash'); }
      f.cool = rnd(.1, .3); return;
    }
    if (d > 70) {
      if (r < .3 && !shots.some(s => s.o === f)) { f.st = 'cast'; f.t = 0; setPose(f, 'charge'); f.cool = rnd(.3, .6); }
      else if (r < .55) { f.st = 'dash'; f.t = 0; f.vx = dir * 300; setPose(f, 'dash'); f.cool = .05; }
      else { f.st = 'walk'; f.vx = dir * 70; f.cool = rnd(.15, .35); }
    } else if (d > 22) {
      if (r < .3) { f.st = 'jump'; f.t = 0; f.vx = dir * 150; f.vy = -270; setPose(f, 'crouch'); f.hitDone = false; f.cool = .1; }
      else if (r < .5) { f.st = 'dash'; f.t = 0; f.vx = dir * 260; setPose(f, 'dash'); f.cool = 0; }
      else if (r < .62 && !shots.some(s => s.o === f)) { f.st = 'cast'; f.t = 0; setPose(f, 'charge'); f.cool = .4; }
      else { f.st = 'walk'; f.vx = dir * 90; f.cool = rnd(.1, .25); }
    } else {
      if (r < .14) { f.st = 'dodge'; f.t = 0; f.vx = -dir * 200; f.vy = -140; setPose(f, 'crouch'); f.cool = .2; return; }
      f.combo = f.combo > 2 ? 0 : f.combo + 1;
      startAttack(f, f.combo === 3 ? pick(['upper', 'kick']) : pick(['jab', 'cross', 'jab', 'kick', 'sweep', 'upper']));
      f.cool = rnd(.05, .2);
    }
  };

  const step = (f, dt) => {
    const o = other(f);
    f.t += dt;
    switch (f.st) {
      case 'idle': setPose(f, 'guard'); f.vx *= .8; break;
      case 'walk': setPose(f, Math.floor(life * 8) % 2 ? 'walk1' : 'walk2'); if (f.cool <= 0) f.st = 'idle'; break;
      case 'dash': f.trail.push({ x: f.x, y: f.y, pose: f.pose.slice(), face: f.face, a: .45 }); if (f.t > .18 || Math.abs(o.x - f.x) < 14) { f.st = 'idle'; f.vx *= .3; if (Math.abs(o.x - f.x) < 20) startAttack(f, pick(['cross', 'kick', 'upper'])); } break;
      case 'block': f.vx *= .85; if (f.t > .35) f.st = 'idle'; break;
      case 'dodge': if (f.y >= GROUND && f.t > .1) { f.st = 'idle'; dust(f.x, GROUND); } break;
      case 'cast':
        if (f.t < .3) { if (Math.random() < .5) fx.push({ k: 'p', x: f.x + rnd(-8, 8), y: f.y - rnd(4, 24), vx: (f.x - (f.x + rnd(-8, 8))) * 3, vy: 0, t: 0, life: .2, col: COL[f.i] }); }
        else if (!f.hitDone) { f.hitDone = true; setPose(f, 'cast'); const j = joints(f); shots.push({ o: f, x: j.fh[0], y: j.fh[1], vx: f.face * 190, r: 3.2, t: 0, big: Math.random() < .3 }); }
        if (f.t > .55) f.st = 'idle'; break;
      case 'jump':
        if (f.t > .08) setPose(f, 'jumpk');
        if (!f.hitDone && f.t > .12 && Math.abs(o.x - (f.x + f.face * 12)) < 12 && Math.abs(o.y - 12 - f.y) < 16) { f.hitDone = true; const r = hurt(o, 9, 160, 120, f); if (r === 'block') f.vx = -f.face * 100; }
        if (f.y >= GROUND && f.t > .1) { f.st = 'idle'; dust(f.x, GROUND); } break;
      case 'att': {
        const a = f.act;
        if (f.t < a.wind) setPose(f, 'guard');
        else if (f.t < a.wind + a.act) {
          setPose(f, a.pose); f.vx = f.face * 40;
          if (!f.hitDone && Math.abs(o.x - f.x) < a.reach && o.st !== 'dodge' && o.y > GROUND - 22) {
            f.hitDone = true;
            // İki yumruk aynı anda: çakışma kıvılcımı, ikisi de geri itilir
            if (o.st === 'att' && o.t > o.act.wind && o.t < o.act.wind + o.act.act && Math.random() < .5) {
              const mx = (f.x + o.x) / 2; spark(mx, GROUND - 18, 14, '#ffffff', 170); ring(mx, GROUND - 18, '#ffd34d', 14);
              f.vx = -f.face * 160; o.vx = -o.face * 160; f.st = o.st = 'idle';
            } else if (hurt(o, a.dmg, a.kb, a.up, f) === 'block') f.vx = -f.face * 90;
          }
        } else if (f.t < a.wind + a.act + a.rec) setPose(f, 'guard');
        else f.st = 'idle';
        break;
      }
      case 'hit': if (f.t > f.stun) f.st = 'idle'; break;
      case 'air': case 'ko':
        if (f.y >= GROUND && f.vy >= 0 && f.t > .1) { f.vy = 0; dust(f.x, GROUND); if (Math.abs(f.vx) > 60) { f.vx *= .5; f.vy = -90; spark(f.x, GROUND, 3, '#9a9a90', 60); } else { f.st = f.st === 'ko' ? 'out' : 'down'; f.t = 0; setPose(f, 'down'); } }
        break;
      case 'down': f.vx *= .7; if (f.t > .55) { f.st = 'rise'; f.t = 0; setPose(f, 'crouch'); } break;
      case 'rise': if (f.t > .22) { f.st = 'idle'; f.cool = .1; } break;
      case 'out': f.vx *= .7; setPose(f, 'down'); break;
      case 'win': setPose(f, f.t % .5 < .25 ? 'win' : 'stand'); break;
    }
    // Fizik
    if (f.y < GROUND || f.vy < 0) { f.vy += G * dt; }
    f.x += f.vx * dt; f.y = Math.min(GROUND, f.y + f.vy * dt);
    if (f.y >= GROUND && f.st !== 'air' && f.st !== 'ko') { f.vy = 0; if (f.st !== 'dash' && f.st !== 'walk' && f.st !== 'att') f.vx *= .86; }
    // Kenarlar: duvara çarpan geri seker
    if (f.x < 10) { f.x = 10; if (Math.abs(f.vx) > 100) { f.vx = -f.vx * .5; spark(10, f.y - 12, 5, '#d8d4c8', 80); } else f.vx = 0; }
    if (f.x > W - 10) { f.x = W - 10; if (Math.abs(f.vx) > 100) { f.vx = -f.vx * .5; spark(W - 10, f.y - 12, 5, '#d8d4c8', 80); } else f.vx = 0; }
    // Duruşu yumuşak geçir
    const k = Math.min(1, dt * (f.st === 'att' ? 30 : 16));
    for (let n = 0; n < 9; n++) f.pose[n] = lerp(f.pose[n], f.target[n], k);
    f.trail = f.trail.filter(p => (p.a -= dt * 2.4) > 0).slice(-5);
  };

  const frame = now => {
    const dt = Math.min(.033, (now - last) / 1000 || .016); last = now; life += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const f of F) { think(f, dt); step(f, dt); }
    // Yüzleşme: iç içe girmesinler
    const [a, b] = F, gap = b.x - a.x;
    if (Math.abs(gap) < 8 && a.y > GROUND - 6 && b.y > GROUND - 6) { const p = (8 - Math.abs(gap)) / 2 * (Math.sign(gap) || 1); a.x -= p; b.x += p; }
    // Enerji topları
    for (const s of shots) {
      s.t += dt; s.x += s.vx * dt; const o = other(s.o);
      ctx.fillStyle = COL[s.o.i]; ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(s.x - Math.sign(s.vx) * 4, s.y, s.r * .8, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (s.big ? 1.4 : 1) + Math.sin(life * 40) * .5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .45, 0, 7); ctx.fill();
      const foe = shots.find(q => q !== s && q.o !== s.o && Math.abs(q.x - s.x) < 6);
      if (foe) { spark(s.x, s.y, 16, '#ffffff', 170); ring(s.x, s.y, '#ffd34d', 16); s.dead = foe.dead = true; continue; }
      if (Math.abs(o.x - s.x) < 6 && o.y > GROUND - 24 && o.st !== 'dodge' && o.st !== 'down' && o.st !== 'out') {
        s.dead = true;
        if (o.st === 'idle' && Math.random() < .3) { spark(s.x, s.y, 8, '#ffd34d', 120); s.dead = false; s.vx = -s.vx * 1.15; s.o = o; }
        else hurt(o, s.big ? 14 : 9, s.big ? 190 : 110, s.big ? 200 : 60, s.o);
      }
      if (s.x < -10 || s.x > W + 10) s.dead = true;
    }
    shots = shots.filter(s => !s.dead);
    // Gölgeler ve dövüşçüler
    for (const f of F) {
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(f.x, GROUND + 1, 7 - (GROUND - f.y) * .08, 1.4, 0, 0, 7); ctx.fill();
      for (const p of f.trail) draw({ ...f, x: p.x, y: p.y, pose: p.pose, face: p.face }, p.a * .5);
      draw(f);
      // Can çubuğu
      const w = 18, x = f.x - w / 2, y = Math.max(1, f.y - 36);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = COL[f.i]; ctx.fillRect(x, y, w * Math.max(0, f.hp) / 100, 2);
    }
    // Efektler
    for (const e of fx) {
      e.t += dt; const q = e.t / e.life;
      if (e.k === 'p') { e.vy += 300 * dt; e.x += e.vx * dt; e.y += e.vy * dt; ctx.globalAlpha = 1 - q; ctx.fillStyle = e.col; ctx.fillRect(e.x - 1, e.y - 1, 2, 2); }
      else { ctx.globalAlpha = (1 - q) * .8; ctx.strokeStyle = e.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (.3 + q), 0, 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; fx = fx.filter(e => e.t < e.life);
    // Nakavt: kazanan sevinir, sonra sahne söner
    if (endT) {
      const w = F.find(f => f.st !== 'out' && f.st !== 'ko');
      if (w && w.st !== 'win' && w.st !== 'air' && life > endT - 1.8) { w.st = 'win'; w.t = 0; w.vx = 0; }
      if (life > endT) cv.style.opacity = '0';
      if (life > endT + .4) return stop();
    } else if (life > 22) { endT = life + .6; }
    raf = requestAnimationFrame(frame);
  };

  const stop = () => { cancelAnimationFrame(raf); raf = 0; cv.style.opacity = '0'; ctx && ctx.clearRect(0, 0, W, H); };

  const start = () => {
    if (reduce || raf || document.hidden) return;
    W = innerWidth; dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px';
    const mid = W / 2, sp = Math.min(120, W * .3);
    F = [make(0, mid - sp + rnd(-20, 20)), make(1, mid + sp + rnd(-20, 20))];
    F[0].hp = F[1].hp = 100; F.forEach(f => { f.cool = rnd(.2, .7); });
    fx = []; shots = []; life = 0; endT = 0; last = performance.now();
    cv.style.opacity = '1'; raf = requestAnimationFrame(frame);
  };

  const init = () => {
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return;
    cv = document.createElement('canvas'); cv.className = 'stick-fight'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv); ctx = cv.getContext('2d');
    document.addEventListener('visibilitychange', () => { if (document.hidden && raf) stop(); });
  };

  return { init, start, stop };
})();
