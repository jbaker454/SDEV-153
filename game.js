const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let circles = [];
let playerEnergy = { white: 100, black: 100 };
let currentPlayer = "white";
let rotation = 0;
let targetRotation = 0;
let isAnimating = false;
let ghost = null;

function updateTurnIndicator() {
  const div = document.getElementById("turnIndicator");
  div.textContent = currentPlayer.toUpperCase() + "'s TURN";
}

updateTurnIndicator();

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 250;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();

  circles.forEach(c => {
    ctx.beginPath();
    ctx.fillStyle = c.player === "white" ? "white" : "black";
    ctx.globalAlpha = 0.8;
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  if (ghost) {
    ctx.beginPath();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = currentPlayer === "white" ? "white" : "black";
    ctx.arc(ghost.x, ghost.y, ghost.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - canvas.width / 2;
  const y = e.clientY - rect.top - canvas.height / 2;

  if (!onCorrectSide(x, y)) {
    ghost = null;
    drawBoard();
    return;
  }

  let radius = Math.min(playerEnergy[currentPlayer], 200) / 4;
  ghost = { x, y, radius };

  drawBoard();
});

canvas.addEventListener("click", () => {
  if (!ghost) return;

  let energyUsed = ghost.radius * 4;
  if (energyUsed > playerEnergy[currentPlayer]) return;

  let strengthen = document.getElementById("strengthenMode").checked;
  if (strengthen) {
    let target = circles.find(c => dist(c.x, c.y, ghost.x, ghost.y) < c.radius);
    if (target && target.player === currentPlayer) {
      target.radius += ghost.radius;
      playerEnergy[currentPlayer] -= energyUsed;
    }
  } else {
    circles.push({ x: ghost.x, y: ghost.y, radius: ghost.radius, player: currentPlayer });
    playerEnergy[currentPlayer] -= energyUsed;
  }

  let rotAmount = energyUsed * (Math.PI * 2) / 100;
  targetRotation += rotAmount;
  animateRotation();

  ghost = null;

  if (document.getElementById("autoDisableStrengthen").checked)
    document.getElementById("strengthenMode").checked = false;

  if (document.getElementById("autoEndTurn").checked)
    setTimeout(endTurn, 400);

  drawBoard();
});

function animateRotation() {
  if (isAnimating) return;
  isAnimating = true;

  function step() {
    let diff = targetRotation - rotation;
    if (Math.abs(diff) < 0.001) {
      rotation = targetRotation;
      isAnimating = false;
      return;
    }

    rotation += diff * 0.12;
    drawBoard();
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function endTurn() {
  currentPlayer = currentPlayer === "white" ? "black" : "white";
  playerEnergy[currentPlayer] = Math.min(200, playerEnergy[currentPlayer] + 50);
  updateTurnIndicator();
  drawBoard();
}

document.getElementById("endTurnBtn").onclick = endTurn;

function onCorrectSide(x, y) {
  return currentPlayer === "white" ? y > 0 : y < 0;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

drawBoard();
