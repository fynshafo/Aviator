let multiplier = 1.00;
let interval = setInterval(() => {
  multiplier += 0.01;
  document.getElementById("multiplier").innerText = multiplier.toFixed(2) + "x";
}, 100);

document.getElementById("cashout").onclick = () => {
  clearInterval(interval);
  alert("You cashed out at " + multiplier.toFixed(2) + "x");
};
