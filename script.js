/* Robust continuous Aviator (football) implementation.
   If something still doesn't work: open browser console (F12) and paste any error here.
*/

(function () {
  // DOM refs
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;

  const historyEl = document.getElementById('history');
  const multDisplay = document.getElementById('mult-display');
  const balanceEl = document.getElementById('balance');
  const roundStateEl = document.getElementById('round-state');
  const roundNumEl = document.getElementById('round-num');

  const betInput = document.getElementById('bet-input');
  const placeBtn = document.getElementById('placeBtn');
  const cashBtn = document.getElementById('cashBtn');
  const autoToggle = document.getElementById('autoToggle');
  const autoInput = document.getElementById('autoInput');

  // demo balance
  let balance = 1000;
  balanceEl.textContent = balance.toFixed(2);

  // Inline small SVG football (transparent background)
  const footballSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
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

  // Canvas/curve params
  const leftPad = 60;
  const bottomPad = 40;
  let curvePoints = [];

  function resizeCanvas() {
    const cssWidth = Math.min(1100, Math.max(360, window.innerWidth * 0.86));
    const cssHeight = window.innerWidth < 720 ? 320 : 420;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.floor(cssWidth * DPR);
    canvas.height = Math.floor(cssHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildCurve();
  }
  window.addEventListener('resize', resizeCanvas);

  function buildCurve() {
    curvePoints = [];
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    const baseY = H - bottomPad;
    const scale = Math.max(220, (W - leftPad) / 3.2);
    for (let x = 0; x <= W - leftPad; x += 1) {
      // At x=0: y=baseY  -> origin
      const y = baseY - Math.log(1 + x / scale) * 92;
      curvePoints.push({ x: leftPad + x, y });
    }
  }

  // RNG heavy-tail
  function chooseCrashMultiplier() {
    const r = Math.random();
    if (r < 0.40) return +(1 + Math.random() * 0.99).toFixed(2);     // 1.00 - 1.99
    if (r < 0.75) return +(2 + Math.random() * 8).toFixed(2);         // 2 - 10
    if (r < 0.92) return +(10 + Math.random() * 50).toFixed(2);       // 10 - 60
    const tail = Math.pow(1 / (1 - Math.random()), 0.9);
    return +Math.min(1000, 50 + tail * 10).toFixed(2);
  }

  // growth
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

  function addHistory(v) {
    history.unshift(v);
    if (history.length > 20) history.pop();
    renderHistory();
  }
  function renderHistory() {
    historyEl.innerHTML = '';
    history.forEach(v => {
      const d = document.createElement('div');
      d.className = 'chip ' + (v < 2 ? 'h-red' : (v <= 10 ? 'h-yellow' : 'h-green'));
      d.textContent = v.toFixed(2) + 'x';
      historyEl.appendChild(d);
    });
  }

  function startRound() {
    round++;
    roundStart = performance.now();
    crashMult = chooseCrashMultiplier();
    roundDurationMs = multToTime(crashMult) * 1000;
    running = true;
    pausedAfterCrash = false;
    activeBets = activeBets.filter(b => b.cashed); // keep already cashed
    roundStateEl.textContent = 'running';
    roundNumEl.textContent = round;
    cashBtn.disabled = activeBets.length === 0;
    console.log(`Round ${round} started — crash at ${crashMult}x (duration ${Math.round(roundDurationMs)}ms)`);
  }

  function onCrash() {
    running = false;
    pausedAfterCrash = true;
    roundStateEl.textContent = 'crashed';
    multDisplay.textContent = `💥 ${crashMult.toFixed(2)}x`;
    addHistory(crashMult);
    cashBtn.disabled = true;
    setTimeout(() => {
      pausedAfterCrash = false;
      multDisplay.textContent = '1.00x';
      startRound();
    }, 1600);
  }

  // bets UI
  placeBtn.addEventListener('click', () => {
    const amt = Math.max(1, Math.floor(Number(betInput.value) || 1));
    if (balance < amt) { alert('Not enough balance'); return; }
    balance -= amt;
    balanceEl.textContent = balance.toFixed(2);
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
      balanceEl.textContent = balance.toFixed(2);
      addHistory(cur);
    }
    cashBtn.disabled = true;
  });

  // auto
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
        balanceEl.textContent = balance.toFixed(2);
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

  function draw() {
    try {
      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
      const W = canvas.width / DPR, H = canvas.height / DPR;

      // background panel
      ctx.fillStyle = 'rgba(0,0,0,0.04)'; roundRect(ctx, 0, 0, W, H, 8); ctx.fill();

      // Y axis
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(leftPad - 10, 12); ctx.lineTo(leftPad - 10, H - bottomPad + 8); ctx.stroke();

      // X axis baseline
      ctx.beginPath(); ctx.moveTo(leftPad - 10, H - bottomPad); ctx.lineTo(W - 12, H - bottomPad); ctx.stroke();

      // moving ticks
      const tick = 60;
      const progressX = getProgressIndex();
      const shift = progressX % tick;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let x = leftPad - shift; x < W; x += tick) {
        ctx.beginPath(); ctx.moveTo(x, H - bottomPad - 6); ctx.lineTo(x, H - bottomPad + 6); ctx.stroke();
      }

      // origin label
      ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.fillText('0', leftPad - 18, H - bottomPad + 18);

      // faint full curve
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,215,0,0.22)'; ctx.beginPath();
      for (let i = 0; i < curvePoints.length; i++) {
        const p = curvePoints[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // running highlight + football
      if (running) {
        const elapsed = (performance.now() - roundStart);
        const progress = Math.min(elapsed / roundDurationMs, 1);
        const idx = Math.floor(progress * (curvePoints.length - 1));
        const pos = curvePoints[Math.max(0, Math.min(curvePoints.length - 1, idx))];

        // highlight path
        ctx.lineWidth = 4; ctx.strokeStyle = '#ffd400'; ctx.beginPath();
        for (let i = 0; i <= idx; i++) {
          const p = curvePoints[i];
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // draw football exactly on the curve
        const curMult = getCurrentMult();
        const ballSize = Math.min(72, 26 + Math.log(Math.max(1, curMult)) * 12);
        if (ballImg.complete) ctx.drawImage(ballImg, pos.x - ballSize / 2, pos.y - ballSize / 2, ballSize, ballSize);
        else {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2); ctx.fill();
        }

        // multiplier label
        multDisplay.style.left = (pos.x + 18) + 'px';
        multDisplay.style.top = (pos.y - 28) + 'px';
        multDisplay.textContent = curMult.toFixed(2) + 'x';

        // auto-cashout
        processAuto();

        // crash check
        if (curMult >= crashMult || progress >= 0.999999) { onCrash(); }
      } else {
        // idle: ball at origin
        if (curvePoints.length > 0) {
          const p0 = curvePoints[0];
          multDisplay.style.left = (p0.x + 18) + 'px';
          multDisplay.style.top = (p0.y - 28) + 'px';
        }
        if (!pausedAfterCrash) multDisplay.textContent = '1.00x';
      }
    } catch (err) {
      console.error('Draw loop error', err);
    }
    requestAnimationFrame(draw);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // init
  resizeCanvas();
  renderHistory();
  setTimeout(() => {
    startRound();
    requestAnimationFrame(draw);
  }, 600);

  // presets
  document.querySelectorAll('.preset').forEach(b => {
    b.addEventListener('click', () => betInput.value = b.dataset.val);
  });
  document.getElementById('half').addEventListener('click', () => betInput.value = Math.max(1, Math.floor(Number(betInput.value || 1) / 2)));
  document.getElementById('double').addEventListener('click', () => betInput.value = Math.max(1, Math.floor(Number(betInput.value || 1) * 2)));
  document.getElementById('max').addEventListener('click', () => betInput.value = Math.max(1, Math.floor(balance)));
})();
