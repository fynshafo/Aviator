const canvas = document.getElementById("curveCanvas");
const ctx = canvas.getContext("2d");
const multiplierDisplay = document.getElementById("multiplier");
const ball = document.getElementById("ball");
const historyDiv = document.getElementById("history");

let multiplier = 1.00;
let running = false;
let crashPoint = 0;
let t = 0;
let betAmount = 1;
let history = [];

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

function moveBall() {
  const y = Math.pow(1.02, t / 10);
  ball.style.left = `${t}px`;
  ball.style.top = `${canvas.height - y * 20 - 20}px`;
}

function updateHistory(val) {
  history.unshift(val);
  if (history.length > 10) history.pop();
  historyDiv.innerHTML = "";
  history.forEach(num => {
    const div = document.createElement("div");
    div.textContent = num + "x";
    div.classList.add("history-item");
    if (num < 2) div.classList.add("low");
    else if (num < 10) div.classList.add("medium");
    else div.classList.add("high");
    historyDiv.appendChild(div);
  });
}

function startGame() {
  running = true;
  crashPoint = (Math.random() * 15 + 1).toFixed(2);
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
  moveBall();

  if (multiplier >= crashPoint) {
    multiplierDisplay.textContent = "💥 Crash at " + crashPoint + "x";
    running = false;
    updateHistory(parseFloat(crashPoint));
    return;
  }
  requestAnimationFrame(update);
}

document.getElementById("startBtn").onclick = startGame;
document.getElementById("cashOutBtn").onclick = () => {
  if (running) {
    running = false;
    multiplierDisplay.textContent = "✅ Cashed out at " + multiplier.toFixed(2) + "x";
    updateHistory(parseFloat(multiplier.toFixed(2)));
  }
};

// Bet amount buttons
document.querySelectorAll(".bet-amt").forEach(btn => {
  btn.onclick = () => {
    if (btn.dataset.amt) {
      betAmount = parseFloat(btn.dataset.amt);
    } else if (btn.id === "half") {
      betAmount /= 2;
    } else if (btn.id === "double") {
      betAmount *= 2;
    } else if (btn.id === "max") {
      betAmount = 100; // example max
    }
    console.log("Bet set to:", betAmount);
  };
});
