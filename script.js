/* Mobile-first continuous Aviator with football + shadow on X-axis,
   origin-starting, realistic RNG (heavy tail), betting and auto-cashout.
*/

(() => {
  // DOM
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;

  const historyEl = document.getElementById('history');
  const multDisplay = document.getElementById('mult-display');
  const balanceEl = document.getElementById('balance');
  const roundNumEl = document.getElementById('round-num');

  const betInput = document.getElementById('bet-input');
  const placeBtn = document.getElementById('placeBtn');
  const cashBtn = document.getElementById('cashBtn');
  const autoToggle = document.getElementById('autoToggle');
  const autoInput = document.getElementById('autoInput');

  // demo balance
  let balance = 1000;
  balanceEl.textContent = balance.toFixed(0);

  // inline SVG football (transparent)
  const footballSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="62" fill="#fff"/>
    <g fill="#000">
      <path d="M64 14 L79 34 L64 46 L49 34 Z"/>
      <path d="M64 46 L80 56 L72 76 L56 76 Z"/>
      <path d="M46 56 L56 76 L40 62 Z"/>
      <path d="M88 68 L76 84 L60 78 Z"/>
      <path d="M40 62 L28 48 L46 56 Z"/>
    </g>
  </svg>`;
  const ballImg = new Image();
  ballImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(footballSVG);

  // canvas responsive for mobile
  function resizeCanvas() {
    const cssWidth = Math.min(430, Math.max(320, window.innerWidth - 12)); // mobile-friendly margins
    const cssHeight = Math.round(cssWidth * 0.72); // portrait rectangle
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.floor(cssWidth * DPR);
    canvas.height = Math.floor(cssHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildCurve();
  }
  window.addEventListener('resize', resizeCanvas);

  // curve parameters
  const leftPad = 36;
  const bottomPad = 36;
  let curvePoints = [];

  function buildCurve() {
    curvePoints = [];
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    const baseY = H - bottomPad;
    // scale tuned for mobile look (similar shape to your reference)
    const scale = Math.max(140, (W - leftPad) / 3.0);
    for (let x = 0; x <= W - leftPad; x += 1) {
      // start at origin (x=0 => baseY)
      const y = baseY - Math.log(1 + x / scale) * 86;
      curvePoints.push({ x: leftPad + x, y });
    }
  }

  // RNG heavy-tail (can produce very large multipliers rarely)
  function chooseCrashMultiplier() {
    const r = Math.random();
    if (r < 0.40) return +(1 + Math.random() * 0.99).toFixed(2);    // 1.00 - 1.99
    if (r < 0.75) return +(2 + Math.random() * 8).toFixed(2);      // 2 - 10
    if (r < 0.92) return +(10 + Math.random() * 50).toFixed(2);    // 10 - 60
    const tail = Math.pow(1 / (1 - Math.random()), 0.9);
    return +Math.min(1000, 50 + tail * 10).toFixed(2);
  }

  // growth tuning (slower start -> accelerate)
  const growthBase = 0.22;
  function multToTime(mult) { return Math.log(Math.max(1.0001, mult)) / growthBase; }
  function timeToMult(t) { return Math.exp(growthBase * t); }

  // state
  let round = 0;
  let roundStart = 0;
  let crashMult = 1;
  let roundDurationMs = 0;
  let running = false;
  let pausedAfterCrash = false;
  let history = [];

  // bets
  let activeBets = [];
  let betIdCounter = 0;

  // UI history
  function addHistory(v) {
    history.unshift(v);
    if (history.length > 16) history.pop();
    renderHistory();
  }
  function renderHistory() {
    historyEl.innerHTML = '';
    for (let v of history) {
      const d = document.createElement('div');
      d.className = 'chip ' + (v < 2 ? 'h-red' : (v <= 10 ? 'h-yellow' : 'h-green'));
      d.textContent = v.toFixed(2) + 'x';
      historyEl.appendChild(d);
    }
  }

  // round lifecycle
  function startRound() {
    round++;
    roundStart = performance.now();
    crashMult = chooseCrashMultiplier();
    roundDurationMs = multToTime(crashMult) * 1000;
    running = true;
    pausedAfterCrash = false;
    activeBets = activeBets.filter(b => b.cashed); // keep only cashed (should be empty)
    roundNumEl.textContent = round;
    cashBtn.disabled = activeBets.length === 0;
    console.log(`Round ${round} start — crash ${crashMult}x, duration ${Math.round(roundDurationMs)}ms`);
  }

  function onCrash() {
    running = false;
    pausedAfterCrash = true;
    addHistory(crashMult);
    multDisplay.textContent = `💥 ${crashMult.toFixed(2)}x`;
    cashBtn.disabled = true;
    // lost bets already deducted
    setTimeout(() => {
      pausedAfterCrash = false;
      multDisplay.textContent = '1.00x';
      startRound();
    }, 1700);
  }

  // bets
  placeBtn.addEventListener('click', () => {
    const amt = Math.max(1, Math.floor(Number(betInput.value) || 1));
    if (balance < amt) { alert('Insufficient balance'); return; }
    balance -= amt;
    balanceEl.textContent = balance.toFixed(0);
    activeBets.push({ id: ++betIdCounter, amount: amt, cashed: false, round: round });
    cashBtn.disabled = false;
  });

  cashBtn.addEventListener('click', () => {
    if (!running) return;
    const cur = getCurrentMult();
    let payout = 0;
    activeBets.forEach(b => {
      if (!b.cashed) { b.cashed = true; b.cashAt = cur; payout += b.amount * cur; }
    });
    if (payout > 0) {
      balance += payout;
      balanceEl.textContent = balance.toFixed(0);
      addHistory(cur);
    }
    cashBtn.disabled = true;
  });

  // auto cashout
  function processAuto() {
    if (!running || !autoToggle.checked) return;
    const target = Math.max(1.01, Number(autoInput.value) || 1.01);
    const cur = getCurrentMult();
    if (cur >= target) {
      let payout = 0;
      activeBets.forEach(b => {
        if (!b.cashed) { b.cashed = true; b.cashAt = cur; payout += b.amount * cur; }
      });
      if (payout > 0) {
        balance += payout;
        balanceEl.textContent = balance.toFixed(0);
        addHistory(cur);
      }
      cashBtn.disabled = true;
    }
  }

  function getCurrentMult() {
    if (!running) return 1.0;
    const elapsedS = (performance.now() - roundStart) / 1000;
    return Math.max(1.0, timeToMult(elapsedS));
  }

  function getProgressIndex() {
    if (!running) return 0;
    const elapsed = (performance.now() - roundStart);
    const progress = Math.min(elapsed / roundDurationMs, 1);
    return progress * (curvePoints.length - 1);
  }

  // draw shadow ellipse on baseline directly under the ball
  function drawShadow(x, ballY, baseY, ballSize) {
    // shadow size shrinks as ball goes higher
    const heightDiff = Math.max(0, baseY - ballY);
    const maxH = Math.max(1, baseY - (curvePoints[Math.floor(curvePoints.length/2)]?.y || (baseY-1)));
    const t = Math.min(1, heightDiff / (maxH * 1.6));
    // shadow scale between 0.35 .. 0.95 (smaller when higher)
    const scale = 0.95 - 0.6 * t;
    const shadowW = ballSize * 0.9 * scale;
    const shadowH = Math.max(6, ballSize * 0.28 * scale);
    const shadowX = x;
    const shadowY = baseY + 8; // slightly below baseline

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();
  }

  // main draw loop
  function draw() {
    ctx.clearRect(0,0,canvas.width / DPR, canvas.height / DPR);
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const baseY = H - bottomPad;

    // background panel
    ctx.fillStyle = 'rgba(0,0,0,0.04)'; roundRect(ctx, 0, 0, W, H, 8); ctx.fill();

    // Y axis (fixed left)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(leftPad - 8, 10); ctx.lineTo(leftPad - 8, H - bottomPad + 8); ctx.stroke();

    // X axis baseline
    ctx.beginPath(); ctx.moveTo(leftPad - 8, baseY); ctx.lineTo(W - 8, baseY); ctx.stroke();

    // moving ticks (so X looks sliding)
    const tick = Math.max(40, Math.round(W * 0.12));
    const progressX = getProgressIndex();
    const shift = progressX % tick;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let x = leftPad - shift; x < W; x += tick) {
      ctx.beginPath(); ctx.moveTo(x, baseY - 6); ctx.lineTo(x, baseY + 6); ctx.stroke();
    }

    // origin label
    ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.fillText('0', leftPad - 16, baseY + 18);

    // faint full curve
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,215,0,0.20)'; ctx.beginPath();
    for (let i=0;i<curvePoints.length;i++) {
      const p = curvePoints[i];
      if (i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();

    if (running) {
      const elapsed = (performance.now() - roundStart);
      const progress = Math.min(elapsed / roundDurationMs, 1);
      const idx = Math.floor(progress * (curvePoints.length - 1));
      const pos = curvePoints[Math.max(0, Math.min(curvePoints.length - 1, idx))];

      // highlight path up to pos
      ctx.lineWidth = 4; ctx.strokeStyle = '#ffd400'; ctx.beginPath();
      for (let i=0;i<=idx;i++){
        const p = curvePoints[i];
        if (i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();

      // draw shadow first (so it appears below ball)
      const curMult = getCurrentMult();
      const ballSize = Math.min(64, 24 + Math.log(Math.max(1,curMult)) * 10);
      drawShadow(pos.x, pos.y, baseY, ballSize);

      // draw football exactly on curve
      if (ballImg.complete) {
        ctx.drawImage(ballImg, pos.x - ballSize/2, pos.y - ballSize/2, ballSize, ballSize);
      } else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x,pos.y,8,0,Math.PI*2); ctx.fill();
      }

      // multiplier text near ball
      multDisplay.style.left = Math.max(8, pos.x + 10) + 'px';
      multDisplay.style.top = (pos.y - 26) + 'px';
      multDisplay.textContent = curMult.toFixed(2) + 'x';

      // auto
      processAuto();

      // crash check
      if (curMult >= crashMult || progress >= 0.999999) {
        onCrash();
      }
    } else {
      // idle: show ball at origin (curvePoints[0]) if available
      if (curvePoints.length > 0) {
        const p0 = curvePoints[0];
        const ballSize = 32;
        drawShadow(p0.x, p0.y, baseY, ballSize);
        if (ballImg.complete) ctx.drawImage(ballImg, p0.x - ballSize/2, p0.y - ballSize/2, ballSize, ballSize);
        multDisplay.style.left = (p0.x + 10) + 'px';
        multDisplay.style.top = (p0.y - 26) + 'px';
        if (!pausedAfterCrash) multDisplay.textContent = '1.00x';
      }
    }

    requestAnimationFrame(draw);
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  // start + init
  resizeCanvas();
  renderHistory();
  setTimeout(()=> { startRound(); requestAnimationFrame(draw); }, 500);

  // presets
  document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', ()=> betInput.value = b.dataset.val));
  document.getElementById('half').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(Number(betInput.value||1)/2)));
  document.getElementById('double').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(Number(betInput.value||1)*2)));
  document.getElementById('max').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(balance)));

  // small helpers to update history and UI
  function renderHistory(){ renderHistory = undefined; } // placeholder overwritten earlier
})();
