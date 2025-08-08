// Continuous Aviator-like demo
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let DPR = window.devicePixelRatio || 1;

// Responsive canvas
function resize() {
  const wrapWidth = Math.min(1100, Math.max(320, window.innerWidth * 0.86));
  const height = window.innerWidth < 720 ? 320 : 420;
  canvas.style.width = wrapWidth + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.floor(wrapWidth * DPR);
  canvas.height = Math.floor(height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildCurve();
}
window.addEventListener('resize', resize);

// UI elements
const historyEl = document.getElementById('history');
const multDisplay = document.getElementById('mult-display');
const balanceEl = document.getElementById('balance');
const roundStateEl = document.getElementById('round-state');
const roundNumEl = document.getElementById('round-num');

const betValueEl = document.getElementById('betValue');
const placeBtn = document.getElementById('placeBtn');
const cashBtn = document.getElementById('cashBtn');

let balance = 1000;
balanceEl.textContent = balance.toFixed(2);

// preload ball image
const ballImg = new Image();
ballImg.crossOrigin = 'anonymous';
ballImg.src = 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg';

// game state (continuous rounds)
let round = 0;
let roundStart = 0;
let crashMultiplier = 1.0;
let growthBase = 0.28;         // controls speed (kept slow)
let running = false;
let pausedAfterCrash = false;
let roundDuration = 0;         // seconds until crash based on chosen crashMultiplier

// rendering curve & axis
let curve = []; // points {x,y} in canvas coordinates (CSS px)
const leftPad = 60;
const bottomPad = 40;

function buildCurve(){
  curve = [];
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;
  const baseY = H - bottomPad;
  const scale = Math.max(220, W / 3.5);
  // x from 0..W-leftPad
  for(let x = 0; x <= W - leftPad; x += 1){
    // curve shape formula (log style) - vertical in px
    const y = baseY - Math.log(1 + x / scale) * 78;
    curve.push({x: leftPad + x, y});
  }
}

// realistic random crash generator (heavy tail, mostly small, sometimes large)
function chooseCrash(){
  const r = Math.random();
  if (r < 0.62) {
    // common: 1.00 - 2.50
    return +(1 + Math.random() * 1.5).toFixed(2);
  } else if (r < 0.9) {
    // medium: 2.5 - 8
    return +(2.5 + Math.random() * 5.5).toFixed(2);
  } else {
    // rare big tail: use power-law-ish heavy tail
    const tail = Math.pow(1 / (1 - Math.random()), 0.7);
    return +Math.min(200, 6 + tail).toFixed(2);
  }
}

// compute crash time (seconds) from chosen crashMultiplier using growthBase
function computeCrashTime(mult){
  // mult = exp(growthBase * t)  => t = ln(mult) / growthBase
  return Math.log(Math.max(1.0001, mult)) / growthBase;
}

// round lifecycle
function startRound(){
  round++;
  roundStart = performance.now();
  crashMultiplier = chooseCrash();
  roundDuration = computeCrashTime(crashMultiplier) * 1000; // ms
  running = true;
  pausedAfterCrash = false;
  roundStateEl.textContent = 'running';
  roundNumEl.textContent = round;
  // clear active bets for this round (we keep bets in activeBets array)
  activeBets = [];
}
function endRoundCrash(curMult){
  // push crash to history, show state, briefly pause then next round
  addHistory(curMult, 'crash');
  running = false;
  pausedAfterCrash = true;
  roundStateEl.textContent = 'crashed';
  multDisplay.textContent = `💥 ${curMult.toFixed(2)}x`;
  cashBtn.disabled = true;
  setTimeout(()=> {
    // short pause and start new round
    pausedAfterCrash = false;
    startRound();
  }, 1500);
}

// history UI
let history = [];
function addHistory(val, kind='crash'){
  history.unshift(val);
  if(history.length > 12) history.pop();
  renderHistory();
}
function renderHistory(){
  historyEl.innerHTML = '';
  history.forEach(v => {
    const span = document.createElement('div');
    span.className = 'h-item ' + (v >= 2 ? 'h-green' : 'h-red');
    span.textContent = v.toFixed(2) + 'x';
    historyEl.appendChild(span);
  });
}

// active bets for the *current round* (objects: {id, amount, cashed:false, cashedAt:null})
let activeBets = [];
let myBetIdCounter = 0;
let currentPlacedAmount = 1;
betValueEl.textContent = currentPlacedAmount;

// UI wiring for bet amount buttons
document.querySelectorAll('.amt').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const a = btn.dataset.amt;
    const action = btn.dataset.action;
    if (a) {
      currentPlacedAmount = Number(a);
    } else if (action === 'half'){
      currentPlacedAmount = Math.max(1, Math.floor(currentPlacedAmount/2));
    } else if (action === 'double'){
      currentPlacedAmount = currentPlacedAmount * 2;
    } else if (action === 'max'){
      currentPlacedAmount = Math.min(99999, Math.floor(balance)); // cap
    }
    betValueEl.textContent = currentPlacedAmount;
  });
});

placeBtn.addEventListener('click', ()=>{
  // placing a bet attaches it to the current running round
  if (balance < currentPlacedAmount) {
    alert('Not enough balance');
    return;
  }
  // lock amount from balance immediately (simulate placed bet)
  balance -= currentPlacedAmount;
  balanceEl.textContent = balance.toFixed(2);

  const bet = {
    id: ++myBetIdCounter,
    amount: currentPlacedAmount,
    cashed: false,
    cashedAt: null,
    round: round
  };
  activeBets.push(bet);
  // allow cash out button
  cashBtn.disabled = false;
});
cashBtn.addEventListener('click', ()=>{
  // cash out all active (not yet cashed) bets at current multiplier
  if (!running) return;
  const currentMultiplier = getCurrentMultiplier();
  let totalPayout = 0;
  activeBets.forEach(b => {
    if (!b.cashed){
      b.cashed = true;
      b.cashedAt = currentMultiplier;
      const payout = b.amount * currentMultiplier;
      totalPayout += payout;
    }
  });
  if (totalPayout > 0){
    balance += totalPayout;
    balanceEl.textContent = balance.toFixed(2);
    // record payouts into history as cashouts (optional)
    addHistory(currentMultiplier, 'cash');
  }
  // disable cash until next place
  cashBtn.disabled = true;
});

// get multiplier at current time (smooth)
function getCurrentMultiplier(){
  if (!running) return 1.00;
  const elapsed = (performance.now() - roundStart) / 1000; // s
  // smooth growth: slow early then slight acceleration
  const mult = Math.exp(growthBase * elapsed) ; // exponential, growthBase small
  return Math.max(1.0, mult);
}

// drawing: axes, ticks (x-axis moving), curve leading edge, ball
function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width / DPR, canvas.height / DPR);
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;

  // background panel (rounded)
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  roundRect(ctx, 0, 0, W, H, 8);
  ctx.fill();

  // draw Y axis (fixed)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(leftPad - 10, 12);
  ctx.lineTo(leftPad - 10, H - bottomPad + 6);
  ctx.stroke();

  // draw X axis (fixed baseline) but ticks will move
  ctx.beginPath();
  ctx.moveTo(leftPad - 10, H - bottomPad);
  ctx.lineTo(W - 12, H - bottomPad);
  ctx.stroke();

  // moving tick marks on X axis -> offset by progress so they appear to move left as ball advances
  const tickSpacing = 60; // px
  // compute shift according to current multiplier progress (so ticks slide as ball moves)
  const progressX = getProgressX(); // px from origin
  const shift = progressX % tickSpacing;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for(let tx = leftPad - shift; tx < W; tx += tickSpacing){
    ctx.beginPath();
    ctx.moveTo(tx, H - bottomPad - 6);
    ctx.lineTo(tx, H - bottomPad + 6);
    ctx.stroke();
  }

  // draw baseline origin label
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.fillText('0', leftPad - 20, H - bottomPad + 18);

  // draw full faint curve (base)
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,215,0,0.25)';
  ctx.beginPath();
  for(let i=0;i<curve.length;i++){
    const p = curve[i];
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // if running, compute multiplier and current position on curve
  if (running){
    const curMult = getCurrentMultiplier();

    // determine how far along curve to draw/highlight using multiplier mapping
    // map multiplier -> xPixels: use inverse of curve generation (approx): we used x increment = 1 px for curve
    // compute ideal x offset proportional to ln(mult)
    // earlier crashTime = ln(mult)/growthBase ; posX approx = (elapsed/crashTime) * curve.length
    const elapsed = (performance.now() - roundStart);
    const progress = Math.min(elapsed / roundDuration, 1.0); // 0..1
    const posIndex = Math.floor(progress * (curve.length - 1));
    const pos = curve[Math.max(0, Math.min(curve.length - 1, posIndex))];

    // highlight path up to pos
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffd400';
    ctx.beginPath();
    for(let i=0;i<=posIndex;i++){
      const p = curve[i];
      if (i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // draw ball
    const ballSize = 36;
    if (ballImg.complete){
      ctx.drawImage(ballImg, pos.x - ballSize/2, pos.y - ballSize/2, ballSize, ballSize);
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2);
      ctx.fill();
    }

    // show multiplier near ball
    multDisplay.style.left = (pos.x + 18) + 'px';
    multDisplay.style.top = (pos.y - 28) + 'px';
    multDisplay.textContent = curMult.toFixed(2) + 'x';

    // check for crash
    if (curMult >= crashMultiplier || progress >= 0.9999){
      // crash occurs
      endRoundCrash(crashMultiplier);
    }
  } else {
    // idle/paused state - show ball at origin with small idle segment
    const p = curve[0];
    multDisplay.style.left = (p.x + 18) + 'px';
    multDisplay.style.top = (p.y - 28) + 'px';
    if (!pausedAfterCrash) multDisplay.textContent = '1.00x';
  }

  requestAnimationFrame(draw);
}

function getProgressX(){
  if (!running) return 0;
  const elapsed = (performance.now() - roundStart);
  const progress = Math.min(elapsed / roundDuration, 1.0);
  // map progress to pixels along curve length
  return progress * (curve.length - 1);
}

// utility roundRect
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// start first round with small delay so UI loads
resize();
renderHistory();
let initialDelay = 600;
setTimeout(()=> {
  startRound();
  // main draw loop
  requestAnimationFrame(draw);
}, initialDelay);

// auto-new-round when crashed: implemented in endRoundCrash -> startRound after delay

// expose a slow debug start if needed
// helper: if a player places a bet while not running, allow it to be queued (we will still start new rounds autonomy above)

// update UI round state periodically
setInterval(()=>{
  document.getElementById('round-state').textContent = running ? 'running' : (pausedAfterCrash ? 'crashed' : 'idle');
}, 300);

// small autosave (not necessary in demo)
