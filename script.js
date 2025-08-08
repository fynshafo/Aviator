const canvas = document.getElementById("curveCanvas");
const ctx = canvas.getContext("2d");
const multiplierDisplay = document.getElementById("multiplier");

let multiplier = 1.00;
let running = false;
let crashPoint = 0;
let t = 0;

function drawCurve() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  for (let x = 0; x < t; x++) {
    const y = Math.pow(1.02, x / 10);
    ctx.lineTo(x, canvas.height - y * 20);
  }
  ctx.stroke();
}

function startGame() {
  running = true;
  crashPoint = (Math.random() * 8 + 1).toFixed(2); // Random crash between 1x and 9x
  multiplier = 1.00;
  t = 0;
  update();
}

function update() {
  if (!running) return;
  t += 2;
  multiplier *= 1.01;
  multiplierDisplay.textContent = multiplier.toFixed(2) + "x";
  drawCurve();

  if (multiplier >= crashPoint) {
    multiplierDisplay.textContent = "💥 Crash at " + crashPoint + "x";
    running = false;
    return;
  }
  requestAnimationFrame(update);
}

document.getElementById("startBtn").onclick = startGame;
document.getElementById("cashOutBtn").onclick = () => {
  if (running) {
    running = false;
    multiplierDisplay.textContent = "✅ Cashed out at " + multiplier.toFixed(2) + "x";
  }
};
