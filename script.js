const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 500;

let multiplier = 1.00;
let crashPoint = getRandomCrash();
let gameRunning = false;
let startTime = 0;
let betAmount = 1;
let history = [];
let ballX = 0;
let ballY = canvas.height - 50;

// Bet controls
function setBet(amount) {
    betAmount = amount;
    document.getElementById("betAmount").innerText = betAmount;
}
function halfBet() { setBet(Math.max(1, betAmount / 2)); }
function doubleBet() { setBet(betAmount * 2); }
function maxBet() { setBet(100); }

function placeBet() {
    if (gameRunning) return;
    resetGame();
    gameRunning = true;
    startTime = Date.now();
    document.getElementById("placeBetBtn").disabled = true;
    document.getElementById("cashOutBtn").disabled = false;
}

function cashOut() {
    alert(`Cashed out at ${multiplier.toFixed(2)}x!`);
    gameRunning = false;
    document.getElementById("placeBetBtn").disabled = false;
    document.getElementById("cashOutBtn").disabled = true;
}

function resetGame() {
    multiplier = 1.00;
    ballX = 0;
    crashPoint = getRandomCrash();
}

function getRandomCrash() {
    // More realistic distribution
    const r = Math.random();
    if (r < 0.6) return (1 + Math.random() * 2).toFixed(2); // mostly low
    if (r < 0.85) return (2 + Math.random() * 3).toFixed(2); // medium
    return (5 + Math.random() * 10).toFixed(2); // rare big
}

function drawAxes() {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;

    // Y axis
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, canvas.height - 30);
    ctx.stroke();

    // X axis
    ctx.beginPath();
    ctx.moveTo(50, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAxes();

    if (gameRunning) {
        const elapsed = Date.now() - startTime;
        multiplier = 1 + Math.pow(elapsed / 2000, 1.5); // Slow growth
        if (multiplier >= crashPoint) {
            multiplier = parseFloat(crashPoint);
            gameRunning = false;
            history.unshift(`${multiplier.toFixed(2)}x`);
            if (history.length > 8) history.pop();
            document.getElementById("placeBetBtn").disabled = false;
            document.getElementById("cashOutBtn").disabled = true;
        }
        ballX = 50 + (multiplier - 1) * 80; // move horizontally
    }

    // Draw yellow curve
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, canvas.height - 30);
    ctx.lineTo(ballX, ballY - (multiplier * 5)); // small upward slope
    ctx.stroke();

    // Draw football
    const img = new Image();
    img.src = "https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg";
    ctx.drawImage(img, ballX - 10, ballY - (multiplier * 5) - 10, 20, 20);

    // Draw multiplier text
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(multiplier.toFixed(2) + "x", ballX + 30, ballY - (multiplier * 5));

    // Update history bar
    const historyDiv = document.getElementById("history");
    historyDiv.innerHTML = history.map(m => `<div>${m}</div>`).join("");
}

setInterval(drawGame, 60);
