let multiplier = 1.00;
let multiplierElement = document.getElementById('multiplier');
let ball = document.querySelector('.ball');
let animationFrame;
let balance = 1097;
let betPlaced = false;
let betAmount = 0;

function setBet(amount) {
    document.getElementById('bet-amount').value = amount;
}

function placeBet() {
    betAmount = parseInt(document.getElementById('bet-amount').value);
    if (betAmount > 0 && betAmount <= balance) {
        balance -= betAmount;
        document.getElementById('balance').innerText = `Bal: ₹${balance} Rnd: 1`;
        betPlaced = true;
        startRound();
    }
}

function cashOut() {
    if (betPlaced) {
        let winnings = betAmount * multiplier;
        balance += winnings;
        document.getElementById('balance').innerText = `Bal: ₹${balance.toFixed(2)} Rnd: 1`;
        stopRound();
    }
}

function startRound() {
    multiplier = 1.00;
    let startTime = null;
    let moveDistance = 200; // px to move left-right

    function gameLoop(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / 1000; // seconds elapsed

        // Increase multiplier
        multiplier += 0.01;
        multiplierElement.innerText = multiplier.toFixed(2) + 'x';

        // Ball horizontal animation synced with multiplier
        let offsetX = Math.sin(progress * 2) * moveDistance / 2;
        ball.style.transform = `translateX(${offsetX}px)`;

        animationFrame = requestAnimationFrame(gameLoop);
    }

    animationFrame = requestAnimationFrame(gameLoop);
}

function stopRound() {
    cancelAnimationFrame(animationFrame);
    betPlaced = false;
}
