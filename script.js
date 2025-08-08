// Smooth Aviator script — drop into script.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bigMult = document.getElementById('big-mult');
const historyBar = document.getElementById('history-bar');

let DPR = window.devicePixelRatio || 1;

// Responsive canvas sizing
function resizeCanvas() {
  const wrap = document.getElementById('game-wrap');
  const styles = getComputedStyle(wrap);
  const padding = parseFloat(styles.paddingLeft || 14) * 2;
  const width = Math.min(1100, Math.max(600, window.innerWidth * 0.86));
  const height = 420;

  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.floor(width * DPR);
  canvas.height = Math.floor(height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // place big multiplier initially top-left in middle area (will reposition each frame)
  bigMult.style.left = `${wrap.offsetLeft + width * 0.5}px`;
  bigMult.style.top = `${wrap.offsetTop + height * 0.30}px`;
  buildCurvePoints();
}
window.addEventListener('resize', resizeCanvas);

// Curve points
let curvePoints = [];
function buildCurvePoints(){
  curvePoints = [];
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;
  const baseY = H - 48;
  const scale = W / 3.5; // influences curvature
  for(let x = 0; x <= W; x += 1){
    // steep early, flatten later: y = baseY - log(1 + x/scale)*factor
    const y = baseY - Math.log(1 + x / scale) * 78;
    curvePoints.push({x,y});
  }
}

// Preload ball image
const ballImg = new Image();
ballImg.crossOrigin = 'anonymous';
ballImg.src = 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg';

// Game variables
let running = false;
let startTime = 0;
let crashMultiplier = 1.0;
let growthRate = 0.6; // higher = faster growth
let crashTime = 1.0;
let betAmount = 1;
let history = []; // store numbers
const MAX_HISTORY = 10;

// UI elements
const betValueEl = document.getElementById('bet-value');
const placeBtn = document.getElementById('place-btn');
const cashBtn = document.getElementById('cash-btn');

// helpers
function chooseCrashMultiplier() {
  // simple skewed distribution: small crashes are common, big crashes rarer
  const r = Math.random();
  // power transform to skew to low values; scale to max ~40
  const val = 1 + Math.pow(1 / (1 - r), 0.35); // -> heavy tail
  // clamp to reasonable max and round
  return Number(Math.min(val, 60).toFixed(2));
}

function updateHistory(val, type='crash') {
  // val is numeric multiplier
  history.unshift(Number(val));
  if(history.length > MAX_HISTORY) history.pop();
  renderHistory();
}

function renderHistory(){
  historyBar.innerHTML = '';
  history.forEach(v => {
    const span = document.createElement('span');
    span.className = 'item ' + (v >= 2.0 ? 'green' : 'red');
    span.textContent = v.toFixed(2) + 'x';
    historyBar.appendChild(span);
  });
}

// Enable/disable UI
function setRunningState(state){
  running = state;
  placeBtn.disabled = state;
  cashBtn.disabled = !state;
  // visual change via [disabled] style
}

// Start a round
function placeBet(){
  if(running) return;
  if(!betAmount || betAmount <= 0) betAmount = 1;
  // choose crash multiplier and compute crash time based on growthRate
  crashMultiplier = chooseCrashMultiplier();
  crashTime = Math.log(crashMultiplier) / growthRate; // seconds
  startTime = performance.now();
  setRunningState(true);
  requestAnimationFrame(loop);
}

// Cash out
function cashOut(){
  if(!running) return;
  // compute current multiplier at this moment
  const elapsed = (performance.now() - startTime) / 1000;
  const current = Math.exp(growthRate * Math.max(0, elapsed));
  updateHistory(Number(current.toFixed(2)), 'cash');
  setRunningState(false);
  // show quick message (you can hook this into your bot/payment)
  bigMult.textContent = `✅ ${current.toFixed(2)}x`;
  // short visual pause then reset display
  setTimeout(()=> bigMult.textContent = '1.00x', 900);
}

// End round due to crash
function roundCrash(){
  updateHistory(crashMultiplier, 'crash');
  setRunningState(false);
  bigMult.textContent = `💥 ${crashMultiplier.toFixed(2)}x`;
  setTimeout(()=> bigMult.textContent = '1.00x', 1100);
}

// Main animation loop
function loop(now){
  // draw background and curve
  ctx.clearRect(0,0, canvas.width / DPR, canvas.height / DPR);
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;

  // background fill area (rounded)
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  roundRect(ctx, 0, 0, W, H, 8);
  ctx.fill();

  // Draw base (dim) curve
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,215,0,0.35)';
  ctx.beginPath();
  for(let i=0;i<curvePoints.length;i++){
    const p = curvePoints[i];
    if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
  }
  ctx.stroke();

  if(!running){
    // idle: draw small left segment so it doesn't look empty
    drawIdleSegment();
    requestAnimationFrame(()=>{}); // keep canvas responsive in case of resize
    return;
  }

  const elapsed = (now - startTime) / 1000;
  const mult = Math.exp(growthRate * elapsed); // exponential growth
  bigMult.textContent = mult.toFixed(2) + 'x';

  // compute progress (0..1) relative to crashTime
  const progress = Math.min(elapsed / crashTime, 1);
  const posX = progress * (W - 1);
  // index & interpolation
  const idxF = posX;
  const i0 = Math.floor(idxF);
  const i1 = Math.min(i0 + 1, curvePoints.length - 1);
  const frac = idxF - i0;
  const p0 = curvePoints[i0] || curvePoints[0];
  const p1 = curvePoints[i1] || p0;
  const ballX = p0.x + (p1.x - p0.x) * frac;
  const ballY = p0.y + (p1.y - p0.y) * frac;

  // highlight path up to current pos
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffd400';
  ctx.beginPath();
  ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
  for(let i=1;i<=Math.floor(posX) && i<curvePoints.length;i++){
    ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
  }
  // final tiny segment smoothing
  ctx.lineTo(ballX, ballY);
  ctx.stroke();

  // draw the ball (scale slightly with multiplier)
  const ballSize = Math.min(56, 32 + Math.log(Math.max(1, mult)) * 12);
  if(ballImg.complete){
    ctx.drawImage(ballImg, ballX - ballSize/2, ballY - ballSize/2, ballSize, ballSize);
  } else {
    // fallback circle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 12, 0, Math.PI*2);
    ctx.fill();
  }

  // place the big multiplier near the ball (offset)
  bigMult.style.left = Math.max(40, ballX + canvas.offsetLeft + 24) + 'px';
  bigMult.style.top = Math.max(16, ballY + canvas.offsetTop - 10) + 'px';

  // check crash
  if(mult >= crashMultiplier || progress >= 1){
    roundCrash();
    return;
  }

  requestAnimationFrame(loop);
}

// draw small idle yellow segment on left so it doesn't look empty
function drawIdleSegment(){
  const p = curvePoints;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffd400';
  ctx.beginPath();
  for(let i=0;i<Math.min(30,p.length);i++){
    if(i===0) ctx.moveTo(p[i].x,p[i].y); else ctx.lineTo(p[i].x,p[i].y);
  }
  ctx.stroke();
}

// utility round rect
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// ----- UI wiring -----
document.querySelectorAll('.bet-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const amt = btn.dataset.amt;
    const action = btn.dataset.action;
    if(amt){
      betAmount = Number(amt);
    } else if(action === 'half'){
      betAmount = Math.max(1, (betAmount || 1)/2);
    } else if(action === 'double'){
      betAmount = Math.max(1, (betAmount || 1)*2);
    } else if(action === 'max'){
      betAmount = 100; // adjust to your user's max
    }
    betValueEl.textContent = betAmount;
  });
});

placeBtn.addEventListener('click', placeBet);
cashBtn.addEventListener('click', cashOut);

// init
resizeCanvas();
renderHistory();
setRunningState(false);
