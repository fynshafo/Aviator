/* Continuous Aviator with football, origin-starting curve, realistic RNG,
   history chips colored (red/yellow/green), betting & auto-cashout.
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let DPR = window.devicePixelRatio || 1;

// DOM
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

// init balance
let balance = 1000;
balanceEl.textContent = balance.toFixed(2);

// football PNG (transparent) - can be replaced with your own hosted PNG
const ballUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Soccer_ball_transparent.png';
const ballImg = new Image();
ballImg.crossOrigin = 'anonymous';
ballImg.src = ballUrl;

// responsive canvas
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

// curve & axes params
const leftPad = 60;
const bottomPad = 40;
let curvePoints = [];

// build the curve array each round (x in pixels from origin to right)
function buildCurve() {
  curvePoints = [];
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;
  const baseY = H - bottomPad;
  // scale chosen to match reference curve shape
  const scale = Math.max(220, (W - leftPad) / 3.2);
  for (let x = 0; x <= W - leftPad; x += 1) {
    // log / exponential shape - starts from origin (0,0)
    const y = baseY - Math.log(1 + x / scale) * 92;
    curvePoints.push({ x: leftPad + x, y });
  }
}

// RNG: realistic heavy-tail; allows very large multipliers rarely
function chooseCrashMultiplier() {
  const r = Math.random();
  if (r < 0.40) {
    // frequent low crashes 1.00 - 1.99
    return +(1 + Math.random() * 0.99).toFixed(2);
  } else if (r < 0.75) {
    // medium 2 - 10
    return +(2 + Math.random() * 8).toFixed(2);
  } else if (r < 0.92) {
    // big 10 - 60
    return +(10 + Math.random() * 50).toFixed(2);
  } else {
    // rare huge tail (power-law-like), clamp to 1000
    const tail = Math.pow(1 / (1 - Math.random()), 0.9);
    return +Math.min(1000, 50 + tail * 10).toFixed(2);
  }
}

// growth tuning
const growthBase = 0.22; // tuned for slow start + acceleration similar to reference
function multToTime(mult) { return Math.log(Math.max(1.0001, mult)) / growthBase; }
function timeToMult(t) { return Math.exp(growthBase * t); }

// game state
let round = 0;
let roundStart = 0;
let crashMult = 1;
let roundDurationMs = 0;
let running = false;
let pausedAfterCrash = false;
let history = [];

// bets (simple demo: player only)
let activeBets = [];
let betIdCounter = 0;

// UI history rendering
function addHistoryValue(v) {
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

// round lifecycle
function startRound() {
  round++;
  roundStart = performance.now();
  crashMult = chooseCrashMultiplier();
  roundDurationMs = multToTime(crashMult) * 1000;
  running = true;
  pausedAfterCrash = false;
  activeBets = activeBets.filter(b => b.cashed); // keep already cashed only
  roundStateEl.textContent = 'running';
  roundNumEl.textContent = round;
  cashBtn.disabled = activeBets.length === 0;
}
function handleCrash() {
  running = false;
  pausedAfterCrash = true;
  roundStateEl.textContent = 'crashed';
  multDisplay.textContent = `💥 ${crashMult.toFixed(2)}x`;
  // lost bets remain deducted
  addHistoryValue(crashMult);
  cashBtn.disabled = true;
  setTimeout(() => {
    pausedAfterCrash = false;
    multDisplay.textContent = '1.00x';
    startRound();
  }, 1800);
}

// bets & cashout
placeBtn.addEventListener('click', () => {
  const amt = Math.max(1, Math.floor(Number(betInput.value) || 1));
  if (balance < amt) { alert('Not enough balance'); return; }
  balance -= amt;
  balanceEl.textContent = balance.toFixed(2);
  const bet = { id: ++betIdCounter, amount: amt, roundPlaced: round, cashed: false, cashAt: null };
  activeBets.push(bet);
  cashBtn.disabled = false;
});
cashBtn.addEventListener('click', () => {
  if (!running) return;
  const curMult = getCurrentMult();
  let payout = 0;
  activeBets.forEach(b => {
    if (!b.cashed) { b.cashed = true; b.cashAt = curMult; payout += b.amount * curMult; }
  });
  if (payout > 0) {
    balance += payout;
    balanceEl.textContent = balance.toFixed(2);
    addHistoryValue(curMult);
  }
  cashBtn.disabled = true;
});

// auto cashout
function processAutoCashout() {
  if (!running || !autoToggle.checked) return;
  const target = Math.max(1.01, Number(autoInput.value) || 1.01);
  const cur = getCurrentMult();
  if (cur >= target) {
    let payout = 0;
    activeBets.forEach(b => {
      if (!b.cashed) { b.cashed = true; b.cashAt = cur; payout += b.amount * cur; }
    });
    if (payout > 0) { balance += payout; balanceEl.textContent = balance.toFixed(2); addHistoryValue(cur); }
    cashBtn.disabled = true;
  }
}

// multiplier getter
function getCurrentMult() {
  if (!running) return 1.0;
  const elapsed = (performance.now() - roundStart) / 1000; // s
  return Math.max(1.0, timeToMult(elapsed));
}

// drawing
function draw() {
  ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;

  // background
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  roundRect(ctx, 0, 0, W, H, 8); ctx.fill();

  // Y axis (fixed)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(leftPad - 10, 12); ctx.lineTo(leftPad - 10, H - bottomPad + 8); ctx.stroke();

  // X baseline
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

  // running highlight and ball
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

    // draw football (scale with multiplier slightly)
    const curMult = getCurrentMult();
    const ballSize = Math.min(72, 26 + Math.log(Math.max(1, curMult)) * 12);
    if (ballImg.complete) {
      ctx.drawImage(ballImg, pos.x - ballSize/2, pos.y - ballSize/2, ballSize, ballSize);
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, Math.PI*2); ctx.fill();
    }

    // update multiplier label near ball
    multDisplay.style.left = (pos.x + 18) + 'px';
    multDisplay.style.top = (pos.y - 28) + 'px';
    multDisplay.textContent = curMult.toFixed(2) + 'x';

    // auto cashout
    processAutoCashout();

    // crash check
    if (curMult >= crashMult || progress >= 0.999999) {
      handleCrash();
    }
  } else {
    // idle show ball at origin
    const p0 = curvePoints[0];
    multDisplay.style.left = (p0.x + 18) + 'px';
    multDisplay.style.top = (p0.y - 28) + 'px';
    if (!pausedAfterCrash) multDisplay.textContent = '1.00x';
  }

  requestAnimationFrame(draw);
}

// progress index for tick shift
function getProgressIndex() {
  if (!running) return 0;
  const elapsed = (performance.now() - roundStart);
  const progress = Math.min(elapsed / roundDurationMs, 1);
  return progress * (curvePoints.length - 1);
}

// helpers
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// init
resizeCanvas();
renderHistory();

// start
setTimeout(()=>{ startRound(); requestAnimationFrame(draw); }, 600);

// presets handlers
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', ()=> betInput.value = b.dataset.val));
document.getElementById('half').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(Number(betInput.value || 1) / 2)));
document.getElementById('double').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(Number(betInput.value || 1) * 2)));
document.getElementById('max').addEventListener('click', ()=> betInput.value = Math.max(1, Math.floor(balance)));
