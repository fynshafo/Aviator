const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let footballImg = new Image();
footballImg.src = "https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg";

let curvePoints = [];
let t = 0;
let multiplier = 1.0;
let running = false;
let betAmount = 0;
let history = [];

// Generate a smooth curve path
for (let x = 0; x <= 800; x += 5) {
    let y = 350 - (Math.log(x + 1) * 50); // curve shape
    curvePoints.push({ x, y });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw yellow curve
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    for (let i = 1; i < curvePoints.length; i++) {
        ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
    }
    ctx.stroke();

    if (running) {
        let pos = curvePoints[t];
        ctx.drawImage(footballImg, pos.x - 25, pos.y - 25, 50, 50);

        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.fillText(multiplier.toFixed(2) + "x", pos.x + 40, pos.y);

        t += 1;
        multiplier += 0.02;

        if (t >= curvePoints.length) {
            endRound();
        }
    }
}

function updateHistory(value) {
    history.unshift(value.toFixed(2) + "x");
    if (history.length > 8) history.pop();

    let bar = document.getElementById("history-bar");
    bar.innerHTML = "";
    history.forEach(val => {
        let span = document.createElement("span");
        span.innerText = val;
        span.className = parseFloat(val) > 2 ? "green" : "red";
        bar.appendChild(span);
    });
}

function placeBet() {
    if (!running) {
        t = 0;
        multiplier = 1.0;
        running = true;
    }
}

function cashOut() {
    if (running) {
        alert(`Cashed out at ${multiplier.toFixed(2)}x with ₹${(betAmount * multiplier).toFixed(2)}`);
        endRound();
    }
}

function endRound() {
    running = false;
    updateHistory(multiplier);
}

function setBet(amount) {
    betAmount = amount;
}

function halfBet() {
    betAmount = Math.max(1, betAmount / 2);
}

function doubleBet() {
    betAmount *= 2;
}

function maxBet() {
    betAmount = 100;
}

setInterval(draw, 30);
