// script.js
// Two-player circular energy board game
// Put alongside index.html and open index.html in browser.

// CONFIG (tweak as needed)
const MAX_ENERGY = 200;
const ENERGY_PER_TURN = 50;
const START_ENERGY = 100;
const ENERGY_TO_RADIUS = 1 / 4; // radius increase (px) per energy unit: radius += energy * ENERGY_TO_RADIUS
const ROTATION_PER_ENERGY = 1 / 50; // radians per energy -> 50 energy = 1 radian

// Canvas setup
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const cx = W / 2;
const cy = H / 2;
const BOARD_RADIUS = Math.min(W, H) * 0.43;

// UI elements
const whiteBar = document.getElementById('whiteBar');
const blackBar = document.getElementById('blackBar');
const whiteEnergyText = document.getElementById('whiteEnergyText');
const blackEnergyText = document.getElementById('blackEnergyText');
const currentPlayerLabel = document.getElementById('currentPlayer');
const spendRange = document.getElementById('spendRange');
const spendValue = document.getElementById('spendValue');
const strengthenMode = document.getElementById('strengthenMode');
const logBox = document.getElementById('log');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');

spendRange.addEventListener('input', () => spendValue.textContent = spendRange.value);

// Game state
let state = {
  players: {
    white: { energy: START_ENERGY },
    black: { energy: START_ENERGY }
  },
  current: 'white', // 'white' or 'black'
  circles: [], // {owner: 'white'|'black', r: radial distance from center (px), theta: angle (rad), radius: px}
  turnCount: 0,
  history: []
};

// Helper logging
function log(msg) {
  const time = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.textContent = `[${time}] ${msg}`;
  logBox.prepend(el);
}

// Utilities
function toPolar(x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx*dx + dy*dy);
  let theta = Math.atan2(dy, dx);
  if (theta < 0) theta += Math.PI * 2;
  return { r, theta };
}
function polarToXY(r, theta) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

// Drawing
function draw() {
  ctx.clearRect(0,0,W,H);

  // board base
  ctx.save();
  ctx.translate(cx, cy);

  // background circle
  ctx.beginPath();
  ctx.arc(0,0, BOARD_RADIUS+6, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(-BOARD_RADIUS*0.3, -BOARD_RADIUS*0.3, BOARD_RADIUS*0.1, 0,0, BOARD_RADIUS);
  grd.addColorStop(0, 'rgba(120,140,160,0.03)');
  grd.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grd;
  ctx.fill();

  // draw dividing line (visual)
  ctx.beginPath();
  ctx.moveTo(0, -BOARD_RADIUS-6);
  ctx.lineTo(0, BOARD_RADIUS+6);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // draw circles (convert polar to xy)
  // draw opponent circles with subtle border for visibility
  for (const c of state.circles.slice().sort((a,b)=>a.radius-b.radius)) {
    const { x, y } = polarToXY(c.r, c.theta);
    ctx.beginPath();
    ctx.arc(x, y, c.radius, 0, Math.PI*2);
    if (c.owner === 'white') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.95)';
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // rim showing halves (subtle rotating visual: draw small ticks to represent rotation)
  drawHalfRim();
}

// Draw rim ticks showing rotation of halves (purely visual)
let rimTicks = 60;
let leftRotation = 0;
let rightRotation = 0;
function drawHalfRim() {
  // compute average theta of circles on each half to derive a small visual rotation indicator.
  ctx.save();
  ctx.translate(cx, cy);

  // left half ticks (theta in [0,PI))
  ctx.save();
  ctx.rotate(leftRotation);
  for (let i=0;i<rimTicks/2;i++) {
    const a = (i/(rimTicks/2)) * Math.PI - Math.PI/2;
    const inner = BOARD_RADIUS - 8;
    const outer = BOARD_RADIUS + 4;
    ctx.beginPath();
    ctx.moveTo(inner*Math.cos(a), inner*Math.sin(a));
    ctx.lineTo(outer*Math.cos(a), outer*Math.sin(a));
    ctx.strokeStyle = 'rgba(125,220,191,0.06)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // right half ticks (theta in [PI,2PI))
  ctx.save();
  ctx.rotate(rightRotation);
  for (let i=0;i<rimTicks/2;i++) {
    const a = Math.PI + (i/(rimTicks/2)) * Math.PI - Math.PI/2;
    const inner = BOARD_RADIUS - 8;
    const outer = BOARD_RADIUS + 4;
    ctx.beginPath();
    ctx.moveTo(inner*Math.cos(a), inner*Math.sin(a));
    ctx.lineTo(outer*Math.cos(a), outer*Math.sin(a));
    ctx.strokeStyle = 'rgba(96,165,250,0.04)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

// UI updates
function updateUI() {
  const we = state.players.white.energy;
  const be = state.players.black.energy;
  whiteBar.style.width = `${(we / MAX_ENERGY) * 100}%`;
  blackBar.style.width = `${(be / MAX_ENERGY) * 100}%`;
  whiteEnergyText.textContent = `${we} / ${MAX_ENERGY}`;
  blackEnergyText.textContent = `${be} / ${MAX_ENERGY}`;
  currentPlayerLabel.textContent = state.current.charAt(0).toUpperCase() + state.current.slice(1);
  spendRange.max = Math.max(1, state.players[state.current].energy);
  if (parseInt(spendRange.value) > state.players[state.current].energy) {
    spendRange.value = Math.max(1, state.players[state.current].energy);
    spendValue.textContent = spendRange.value;
  }
  undoBtn.disabled = state.history.length === 0;
}

// Turn logic: start next player's turn (adds energy)
function nextTurn() {
  state.current = state.current === 'white' ? 'black' : 'white';
  state.turnCount++;
  // add energy
  state.players[state.current].energy = Math.min(MAX_ENERGY, state.players[state.current].energy + ENERGY_PER_TURN);
  log(`${state.current.toUpperCase()} gains +${ENERGY_PER_TURN} energy (now ${state.players[state.current].energy}).`);
  updateUI();
  draw();
}

// Collision check: will new circle (at x,y with newRadius) overlap any opponent circle?
function collidesOpponent(x, y, newRadius, owner) {
  for (const c of state.circles) {
    if (c.owner !== owner) {
      const { x: cxC, y: cyC } = polarToXY(c.r, c.theta);
      const dx = cxC - x;
      const dy = cyC - y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < (c.radius + newRadius) - 0.5) return true;
    }
  }
  return false;
}

// Find circle at a click (x,y) within tolerance
function findCircleAt(x, y) {
  for (const c of state.circles.slice().reverse()) {
    const { x: cxC, y: cyC } = polarToXY(c.r, c.theta);
    const dx = cxC - x;
    const dy = cyC - y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist <= c.radius + 6) return c;
  }
  return null;
}

// Make an action (place new or strengthen)
function applyAction({ type, x, y, energy, targetCircle = null }) {
  // snapshot for undo
  state.history.push(JSON.parse(JSON.stringify(state)));
  undoBtn.disabled = false;

  const actor = state.current;
  if (energy <= 0 || energy > state.players[actor].energy) {
    log(`Invalid energy spend by ${actor}`);
    return;
  }

  const deltaAngle = energy * ROTATION_PER_ENERGY; // radians

  if (type === 'place') {
    // placement must be within board
    const pol = toPolar(x, y);
    if (pol.r > BOARD_RADIUS - 6) {
      log(`${actor} tried to place outside the board.`);
      state.history.pop();
      return;
    }
    // compute new visual radius
    const newRadius = Math.max(6, energy * ENERGY_TO_RADIUS);

    if (collidesOpponent(x, y, newRadius, actor)) {
      log(`${actor} cannot place overlapping opponent circle.`);
      state.history.pop();
      return;
    }

    // add circle in polar coords
    state.circles.push({
      owner: actor,
      r: pol.r,
      theta: pol.theta,
      radius: newRadius
    });

    // rotate the half where this circle sits: find which half it belongs (theta < PI => left half)
    if (pol.theta < Math.PI) {
      // left half rotates positive
      leftRotation += deltaAngle;
      // move angular positions of circles in that half
      for (const c of state.circles) {
        if (c.theta < Math.PI) c.theta = (c.theta + deltaAngle) % (2*Math.PI);
      }
    } else {
      rightRotation -= deltaAngle;
      for (const c of state.circles) {
        if (c.theta >= Math.PI) c.theta = (c.theta - deltaAngle + 2*Math.PI) % (2*Math.PI);
      }
    }

    state.players[actor].energy -= energy;
    log(`${actor} placed a circle spending ${energy} energy. Radius ${newRadius.toFixed(1)} px. Rotated half by ${(deltaAngle).toFixed(2)} rad.`);
  } else if (type === 'strengthen') {
    if (!targetCircle) {
      log('No target circle to strengthen.');
      state.history.pop();
      return;
    }
    // increase its radius
    const grow = Math.max(1, energy * ENERGY_TO_RADIUS);
    targetCircle.radius += grow;

    // rotation still applies based on where the circle current theta is
    if (targetCircle.theta < Math.PI) {
      leftRotation += deltaAngle;
      for (const c of state.circles) { if (c.theta < Math.PI) c.theta = (c.theta + deltaAngle) % (2*Math.PI); }
    } else {
      rightRotation -= deltaAngle;
      for (const c of state.circles) { if (c.theta >= Math.PI) c.theta = (c.theta - deltaAngle + 2*Math.PI) % (2*Math.PI); }
    }

    state.players[actor].energy -= energy;
    log(`${actor} strengthened their circle (+${grow.toFixed(1)} px) using ${energy} energy. Rotated half by ${(deltaAngle).toFixed(2)} rad.`);
  }

  updateUI();
  draw();

  // end of action: next player's turn
  nextTurn();
}

// Undo
function undo() {
  if (state.history.length === 0) return;
  const last = state.history.pop();
  // restore
  state = last;
  updateUI();
  draw();
  log('Undo performed.');
  undoBtn.disabled = state.history.length === 0;
}

// Reset
function resetGame() {
  state = {
    players: { white: { energy: START_ENERGY }, black: { energy: START_ENERGY } },
    current: 'white',
    circles: [],
    turnCount: 0,
    history: []
  };
  leftRotation = 0;
  rightRotation = 0;
  log('Game reset.');
  updateUI();
  draw();
}

// Handle clicks
canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  const actor = state.current;
  const spend = parseInt(spendRange.value, 10);

  if (strengthenMode.checked) {
    // find circle under click
    const c = findCircleAt(x, y);
    if (!c) {
      log(`${actor} clicked strengthen mode but no circle found.`);
      return;
    }
    if (c.owner !== actor) {
      log(`${actor} cannot strengthen opponent's circle.`);
      return;
    }
    // apply strengthen
    applyAction({ type: 'strengthen', x, y, energy: spend, targetCircle: c });
  } else {
    // place
    applyAction({ type: 'place', x, y, energy: spend });
  }
});

// Initialize
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', resetGame);

updateUI();
draw();
log('Game started. White goes first with 100 energy. Choose energy then click the board to act.');
