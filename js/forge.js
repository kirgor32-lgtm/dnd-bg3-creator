/* ============================================================
   Кузня на фоне: каменный горн с живым огнём, угли, искры,
   наковальня с раскалённой заготовкой. Всё рисуется в <canvas>.
   + вспышка искр при нажатии на кнопки и плитки выбора.
   ============================================================ */
(function(){
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bg = document.createElement("canvas");
  bg.id = "forgeScene"; bg.setAttribute("aria-hidden","true");
  const fx = document.createElement("canvas");
  fx.id = "forgeFx"; fx.setAttribute("aria-hidden","true");
  document.body.prepend(bg); document.body.appendChild(fx);
  const g = bg.getContext("2d"), gf = fx.getContext("2d");
  const fire = document.createElement("canvas"), gx = fire.getContext("2d");   // огонь в пониженном разрешении = мягкие края
  let W = 0, H = 0, DPR = 1, geo = null, still = null, tongues = [], coals = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function sprite(stops, size){
    const c = document.createElement("canvas"); c.width = c.height = size;
    const x = c.getContext("2d"), r = size/2, gr = x.createRadialGradient(r,r,0,r,r,r);
    stops.forEach(([o,col]) => gr.addColorStop(o,col)); x.fillStyle = gr; x.fillRect(0,0,size,size); return c;
  }
  const S = {
    hot:   sprite([[0,"rgba(255,245,200,.9)"],[.35,"rgba(255,180,70,.55)"],[1,"rgba(255,90,20,0)"]], 64),
    deep:  sprite([[0,"rgba(255,90,25,.65)"],[.5,"rgba(190,40,10,.28)"],[1,"rgba(90,10,0,0)"]], 64),
    spark: sprite([[0,"rgba(255,255,230,1)"],[.3,"rgba(255,200,90,.9)"],[1,"rgba(255,120,20,0)"]], 16),
  };

  function layout(){
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    [bg, fx].forEach(c => { c.width = Math.round(W*DPR); c.height = Math.round(H*DPR); c.style.width = W+"px"; c.style.height = H+"px"; });
    g.setTransform(DPR,0,0,DPR,0,0); gf.setTransform(DPR,0,0,DPR,0,0);
    const mobile = W < 760;
    const hw = Math.min(W * (mobile ? 1.05 : 0.6), 800);
    const hh = Math.max(170, Math.min(H * (mobile ? 0.26 : 0.34), 310));
    const cx = W/2, mw = hw * 0.64, mh = hh * 0.66;
    geo = { cx, hw, hh, mw, mh, top: H - hh, floor: H - hh*0.12, mobile,
            anvilX: mobile ? Math.max(70, W*0.15) : Math.max(110, cx - hw*0.5 - 150) };
    // огонь рисуем в половинном разрешении в рамке устья
    fire.width = Math.ceil(mw/2) + 8; fire.height = Math.ceil(mh/2) + 8;
    // языки: случайные ширины/фазы, чтобы пламя не было «гребёнкой»
    tongues = [];
    [[16,.17,.95,0],[20,.12,.78,1],[24,.075,.55,2]].forEach(([n, w, h, layer]) => {
      for (let i = 0; i < n; i++) tongues.push({ layer, u: (i + rnd(.1,.9)) / n, w: w * rnd(.7, 1.35), h: h * rnd(.7, 1.15),
        p1: rnd(0, 6.28), p2: rnd(0, 6.28), f1: rnd(.0009,.0017), f2: rnd(.0026,.0048) });
    });
    coals = [];
    for (let x = -mw/2 + 6; x < mw/2 - 6; x += rnd(12, 22)) coals.push({ x, r: rnd(7, 14), h: rnd(.55,.9), p: rnd(0,6.28) });
    still = buildStill();
  }

  function mouthPath(x, ox = 0, oy = 0, sc = 1){
    const { cx, mw, mh, floor } = geo, r = mw/2;
    const X = v => (v - ox) * sc, Y = v => (v - oy) * sc;
    x.beginPath();
    x.moveTo(X(cx - r), Y(floor + 2));
    x.lineTo(X(cx - r), Y(floor - mh + r*0.5));
    x.quadraticCurveTo(X(cx - r), Y(floor - mh), X(cx), Y(floor - mh));
    x.quadraticCurveTo(X(cx + r), Y(floor - mh), X(cx + r), Y(floor - mh + r*0.5));
    x.lineTo(X(cx + r), Y(floor + 2)); x.closePath();
  }

  /* неподвижное: копоть, кладка, устье, под, наковальня с молотом */
  function buildStill(){
    const c = document.createElement("canvas"); c.width = W*DPR; c.height = H*DPR;
    const x = c.getContext("2d"); x.setTransform(DPR,0,0,DPR,0,0);
    const { cx, hw, hh, mw, mh, top, floor } = geo;
    const L = cx - hw/2, R = cx + hw/2;
    // копоть на стене над горном
    const soot = x.createRadialGradient(cx, top, 10, cx, top, hw*0.75);
    soot.addColorStop(0, "rgba(60,40,26,.30)"); soot.addColorStop(1, "rgba(60,40,26,0)");
    x.fillStyle = soot; x.fillRect(cx - hw, top - hw*0.75, hw*2, hw*0.75);
    // кладка
    x.save(); x.beginPath(); x.rect(L, top, hw, hh); x.clip();
    const sg = x.createLinearGradient(0, top, 0, H);
    sg.addColorStop(0, "#a58d72"); sg.addColorStop(1, "#7a634e");
    x.fillStyle = sg; x.fillRect(L, top, hw, hh);
    let row = 0, seed = 7;
    const pr = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let y = top; y < H; y += 26, row++){
      const bw = 56, off = (row % 2) * bw/2;
      for (let bx = L - off; bx < R; bx += bw){
        const v = pr();
        x.fillStyle = v < .33 ? "rgba(70,45,28,.20)" : v < .66 ? "rgba(120,85,55,.12)" : "rgba(255,235,205,.08)";
        x.fillRect(bx+2, y+2, bw-4, 22);
        x.fillStyle = "rgba(40,26,15,.55)"; x.fillRect(bx, y + 24, bw, 2); x.fillRect(bx, y, 2, 26);   // швы
        x.fillStyle = "rgba(255,240,215,.16)"; x.fillRect(bx+2, y+2, bw-4, 2);                     // фаска
      }
    }
    // копоть и закал вокруг устья
    const sc2 = x.createRadialGradient(cx, floor - mh*0.45, mw*0.3, cx, floor - mh*0.45, mw*0.85);
    sc2.addColorStop(0, "rgba(30,15,8,.65)"); sc2.addColorStop(1, "rgba(30,15,8,0)");
    x.fillStyle = sc2; x.fillRect(L, top, hw, hh);
    x.restore();
    // карниз
    x.fillStyle = "#6a533e"; x.fillRect(L - 14, top - 14, hw + 28, 16);
    x.fillStyle = "rgba(255,235,200,.28)"; x.fillRect(L - 14, top - 14, hw + 28, 3);
    x.fillStyle = "rgba(40,25,14,.35)"; x.fillRect(L - 14, top + 1, hw + 28, 3);
    // устье
    mouthPath(x);
    const mg = x.createLinearGradient(0, floor - mh, 0, floor);
    mg.addColorStop(0, "#120804"); mg.addColorStop(.75, "#2a0f05"); mg.addColorStop(1, "#4d1a07");
    x.fillStyle = mg; x.fill();
    x.lineWidth = 9; x.strokeStyle = "#3e2d1f"; x.stroke();
    x.lineWidth = 2; x.strokeStyle = "rgba(255,150,70,.45)"; x.stroke();
    // под
    x.fillStyle = "#4e3a2b"; x.fillRect(cx - mw/2 - 20, floor, mw + 40, H - floor);
    x.fillStyle = "rgba(255,170,90,.35)"; x.fillRect(cx - mw/2 - 20, floor, mw + 40, 2);
    if (!(geo.mobile && W <= 420)) drawAnvil(x, geo.anvilX, H);
    return c;
  }
  function drawAnvil(x, ax, base){
    const s = geo.mobile ? 0.7 : 1;
    x.save(); x.translate(ax, base); x.scale(s, s);
    // тень
    const sh = x.createRadialGradient(0, -2, 4, 0, -2, 120); sh.addColorStop(0, "rgba(40,25,12,.35)"); sh.addColorStop(1, "rgba(40,25,12,0)");
    x.fillStyle = sh; x.fillRect(-130, -30, 260, 32);
    // колода
    x.fillStyle = "#4a3424"; x.fillRect(-48, -74, 96, 74);
    x.fillStyle = "rgba(0,0,0,.18)"; for (let i = -40; i < 48; i += 14) x.fillRect(i, -74, 2, 74);
    x.fillStyle = "#5c4330"; x.fillRect(-50, -78, 100, 6);
    // наковальня
    const ag = x.createLinearGradient(0, -118, 0, -76); ag.addColorStop(0, "#3c3632"); ag.addColorStop(1, "#1f1b18");
    x.fillStyle = ag;
    x.beginPath();
    x.moveTo(-70, -118); x.lineTo(78, -118); x.quadraticCurveTo(122, -116, 136, -104);
    x.lineTo(54, -100); x.lineTo(32, -88); x.lineTo(38, -78); x.lineTo(-38, -78); x.lineTo(-32, -88);
    x.lineTo(-66, -100); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,190,120,.35)"; x.fillRect(-70, -118, 148, 2);
    // молот, прислонённый к колоде
    x.save(); x.translate(64, -2); x.rotate(-0.32);
    x.fillStyle = "#6b4a2b"; x.fillRect(-4, -96, 8, 96);
    x.fillStyle = "#2b2622"; x.fillRect(-17, -112, 34, 20);
    x.fillStyle = "rgba(255,190,120,.3)"; x.fillRect(-17, -112, 34, 2);
    x.restore();
    x.restore();
  }

  /* раскалённая заготовка на наковальне — дышит жаром */
  function drawIngot(t){
    if (geo.mobile && W <= 420) return;
    const s = geo.mobile ? 0.7 : 1, ax = geo.anvilX, base = H;
    const p = .75 + .25*Math.sin(t/1600);
    g.save(); g.translate(ax, base); g.scale(s, s);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = .55*p; g.drawImage(S.hot, -20, -150, 110, 60);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    const ig = g.createLinearGradient(-6, 0, 80, 0);
    ig.addColorStop(0, "#7a1a08"); ig.addColorStop(.3, `rgb(255,${140 + 60*p|0},60)`); ig.addColorStop(.7, "#ffdf8a"); ig.addColorStop(1, "#c8401a");
    g.fillStyle = ig; g.fillRect(-4, -125, 82, 7);
    g.restore();
  }

  /* ---------- частицы ---------- */
  const flames = [], sparks = [], pops = [];
  function spawnFlame(){
    const { cx, mw, floor, mh } = geo;
    const u = (Math.random() + Math.random()) / 2;
    flames.push({ x: cx + (u - .5) * mw * 0.85, y: floor - 6, vy: -rnd(.45, 1.1) * (mh/180), life: 0, max: rnd(70, 120), size: rnd(20, 44), seed: rnd(0, 6.28) });
  }
  function spawnSpark(){
    const { cx, mw, floor, mh } = geo;
    sparks.push({ x: cx + (Math.random()-.5)*mw*0.6, y: floor - mh*0.55, vx: (Math.random()-.5)*.4,
      vy: -rnd(.55, 1.4), life: 0, max: rnd(260, 560), s: rnd(.8, 2.2), seed: rnd(0, 6.28) });
  }
  function burst(x, y, n, list, power = 1){
    for (let i = 0; i < n; i++){
      const a = -Math.PI/2 + (Math.random()-.5) * Math.PI * 1.3, v = rnd(2, 6) * power;
      list.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 0, max: rnd(50, 95), s: rnd(.9, 2) });
    }
  }

  function drawFire(t){
    const { cx, mw, mh, floor } = geo;
    const ox = cx - mw/2, oy = floor - mh, sc = .5;
    gx.setTransform(1,0,0,1,0,0); gx.clearRect(0, 0, fire.width, fire.height);
    gx.globalCompositeOperation = "lighter";
    const COL = [
      ["rgba(225,55,12,.55)","rgba(160,25,6,.25)","rgba(120,10,0,0)"],
      ["rgba(255,135,30,.6)","rgba(240,90,20,.35)","rgba(220,60,10,0)"],
      ["rgba(255,248,205,.8)","rgba(255,205,100,.5)","rgba(255,150,40,0)"],
    ];
    tongues.forEach(T => {
      const center = 1 - Math.pow(Math.abs(T.u - .5) * 2, 2) * .6;
      const nse = .62 + .22*Math.sin(t*T.f1 + T.p1) + .14*Math.sin(t*T.f2 + T.p2) + Math.random()*.015;
      const h = mh * T.h * center * nse * sc, w = mw * T.w * sc;
      const x0 = (T.u * mw * .94 + mw*.03) * sc, base = mh * sc + 2;
      const sway = Math.sin(t*T.f1*1.7 + T.p2) * w * .55;
      const c = COL[T.layer], gr = gx.createLinearGradient(0, base, 0, base - h);
      gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[2]);
      gx.fillStyle = gr;
      gx.beginPath();
      gx.moveTo(x0 - w/2, base);
      gx.bezierCurveTo(x0 - w*.55, base - h*.4, x0 + sway*.4 - w*.2, base - h*.72, x0 + sway, base - h);
      gx.bezierCurveTo(x0 + sway*.4 + w*.2, base - h*.72, x0 + w*.55, base - h*.4, x0 + w/2, base);
      gx.fill();
    });
    for (let i = flames.length - 1; i >= 0; i--){
      const f = flames[i]; f.life++;
      const k = f.life / f.max;
      f.x += Math.sin(f.seed + f.life*.05) * .45; f.y += f.vy;
      const sz = f.size * (1 - k*.7) * sc;
      gx.globalAlpha = (1 - k) * .5;
      gx.drawImage(k < .4 ? S.hot : S.deep, (f.x - ox) * sc - sz/2, (f.y - oy) * sc - sz*.8, sz, sz*1.4);
      if (f.life >= f.max) flames.splice(i, 1);
    }
    gx.globalAlpha = 1; gx.globalCompositeOperation = "source-over";
    // угли поверх основания пламени
    coals.forEach(k => {
      const x = (k.x + mw/2) * sc, y = mh * sc - 1, r = k.r * sc;
      const glow = .5 + .5*Math.sin(t/1300 + k.p);
      gx.fillStyle = "#2a1007";
      gx.beginPath(); gx.ellipse(x, y, r, r*k.h, 0, Math.PI, 0); gx.fill();
      gx.fillStyle = `rgba(255,${110 + 90*glow|0},40,${.55 + .4*glow})`;
      gx.beginPath(); gx.ellipse(x, y - r*k.h*.35, r*.55, r*k.h*.35, 0, 0, 6.28); gx.fill();
    });
    // переносим в сцену, обрезая по арке
    g.save(); mouthPath(g); g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(fire, ox, oy, fire.width / sc, fire.height / sc);
    g.restore();
  }

  function brickGlow(flick){
    const { cx, hw, hh, top, floor, mh } = geo;
    g.save(); g.beginPath(); g.rect(cx - hw/2 - 14, top - 14, hw + 28, hh + 14); g.clip();
    g.globalCompositeOperation = "lighter";
    const gl = g.createRadialGradient(cx, floor - mh*0.3, mh*0.3, cx, floor - mh*0.3, hw*0.6);
    gl.addColorStop(0, `rgba(150,60,10,${.55*flick})`); gl.addColorStop(1, "rgba(150,60,10,0)");
    g.fillStyle = gl; g.fillRect(cx - hw/2 - 14, top - 14, hw + 28, hh + 14);
    g.restore();
  }

  function frame(t){
    g.clearRect(0,0,W,H);
    const { cx, floor, mh } = geo;
    const flick = 0.82 + Math.sin(t/520)*.06 + Math.sin(t/233)*.04 + Math.random()*.012;
    const glow = g.createRadialGradient(cx, floor - mh*0.4, 10, cx, floor - mh*0.4, Math.max(W, H) * 0.75);
    glow.addColorStop(0, `rgba(255,150,60,${0.30*flick})`);
    glow.addColorStop(.35, `rgba(255,170,90,${0.12*flick})`);
    glow.addColorStop(1, "rgba(255,200,140,0)");
    g.fillStyle = glow; g.fillRect(0,0,W,H);
    g.drawImage(still, 0, 0, W, H);
    brickGlow(flick);
    drawFire(t);
    drawIngot(t);
    // время от времени заготовка «стреляет» искрами
    if (!geo.mobile || W > 420){ if (Math.random() < .004) burst(geo.anvilX + 40*(geo.mobile?.7:1), H - 124*(geo.mobile?.7:1), 8, pops, .45); }
    for (const arr of [sparks, pops]){
      for (let i = arr.length - 1; i >= 0; i--){
        const p = arr[i]; p.life++;
        if (arr === sparks){ p.x += p.vx + Math.sin(p.seed + p.life*.022)*.45; p.y += p.vy; p.vy *= .998; }
        else { p.x += p.vx; p.y += p.vy; p.vy += .09; p.vx *= .985; }
        const a = Math.max(0, 1 - p.life/p.max);
        g.globalAlpha = a;
        const sz = p.s * 5;
        g.drawImage(S.spark, p.x - sz/2, p.y - sz/2, sz, sz);
        g.strokeStyle = `rgba(255,200,110,${a*.6})`; g.lineWidth = p.s*.7;               // хвостик искры
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx||0)*3, p.y - p.vy*3); g.stroke();
        if (p.life >= p.max || p.y < -20 || p.y > H + 20) arr.splice(i, 1);
      }
    }
    g.globalAlpha = 1;
  }

  let running = true;
  function loop(t){
    if (!running) return;
    for (let i = 0; i < (geo.mobile ? 1 : 2); i++) spawnFlame();
    if (Math.random() < (geo.mobile ? .08 : .14)) spawnSpark();
    frame(t);
    requestAnimationFrame(loop);
  }

  /* искры от нажатий — слой поверх интерфейса */
  const clickSparks = []; let fxOn = false;
  function fxLoop(){
    gf.clearRect(0,0,W,H);
    for (let i = clickSparks.length - 1; i >= 0; i--){
      const p = clickSparks[i]; p.life++;
      p.x += p.vx; p.y += p.vy; p.vy += .1; p.vx *= .975;
      gf.globalAlpha = Math.max(0, 1 - p.life/p.max);
      const sz = p.s * 5; gf.drawImage(S.spark, p.x - sz/2, p.y - sz/2, sz, sz);
      if (p.life >= p.max) clickSparks.splice(i, 1);
    }
    gf.globalAlpha = 1;
    if (clickSparks.length) requestAnimationFrame(fxLoop); else { fxOn = false; gf.clearRect(0,0,W,H); }
  }
  document.addEventListener("pointerdown", e => {
    if (reduce) return;
    const el = e.target.closest(".btn-gold, .choice-tile, .pick-row, .class-icon-item, .choice-card, .mode-tab, .equip-choice, .spell-card, .lore-btn, .skill-opt");
    if (!el || el.disabled) return;
    burst(e.clientX, e.clientY, el.matches(".btn-gold") ? 18 : 9, clickSparks, .55);
    if (!fxOn){ fxOn = true; requestAnimationFrame(fxLoop); }
  }, { passive: true });

  layout();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  if (reduce){
    for (let i = 0; i < 60; i++){ spawnFlame(); spawnFlame(); }
    frame(1000);
  } else {
    requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
  }
  window.__forge = { layout, frame };
})();
