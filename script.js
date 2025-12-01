// script.js — updated to address reported bugs
// Put alongside index.html and open index.html in browser.

// CONFIG
const MAX_ENERGY = 200;
const ENERGY_PER_TURN = 50;
const START_ENERGY = 100;
const ENERGY_TO_RADIUS = 1 / 4; // px per energy unit
const ROTATION_PER_ENERGY = 1 / 50; // radians per energy (50 energy = 1 radian)
const ROTATION_ANIM_MS = 700; // animation duration

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
const endTurnBtn = document.getElementById('endTurnBtn');

spendRange.addEventListener('input', () => spendValue.textContent = spendRange.value);

// Game state
let state = {
  players: {
    white: { energy: START_ENERGY },
    black: { energy: START_ENERGY }
  },
  current: 'white', // 'white' or 'black'
  circles: [], // {owner: 'white'|'black', r: radial distance from center (px), theta: angle (rad), radius: px}
  turnCount: 0,   // counts switches; initial 0
  history: []
};

// Pending rotation (queued this turn). Rotations are always counterclockwise (positive).
let pendingRotations = { left: 0, right: 0 };

// Visual rim rotation state (for animation)
let rimLeftVisual = 0;
let rimRightVisual = 0;

// Whether action has been taken this turn (one action per turn)
let actionDoneThisTurn = false;

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

  // background circle base
  ctx.beginPath();
  ctx.arc(0,0, BOARD_RADIUS+6, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(-BOARD_RADIUS*0.3, -BOARD_RADIUS*0.3, BOARD_RADIUS*0.1, 0,0, BOARD_RADIUS);
  grd.addColorStop(0, 'rgba(120,140,160,0.03)');
  grd.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grd;
  ctx.fill();

  // draw halves: top black, bottom white (subtle)
  // top half (theta: 0..PI) – in canvas coordinates, angle  -Math.PI/2..Math.PI/2 maps differently; we draw semicircles:
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, BOARD_RADIUS, Math.PI, 0, false); // top half from PI to 0
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, BOARD_RADIUS, 0, Math.PI, false); // bottom half 0..PI
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();

  // horizontal dividing line
  ctx.beginPath();
  ctx.moveTo(-BOARD_RADIUS-6, 0);
  ctx.lineTo(BOARD_RADIUS+6, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  // draw circles in insertion order (no sort) for performance
  for (const c of state.circles) {
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

  // rim ticks (visual) — rotate according to visual rotation values
  drawHalfRim();
}

function drawHalfRim() {
  ctx.save();
  ctx.translate(cx, cy);

  const ticks = 48;
  // top half (theta in [0, PI]) — visually use rimRightVisual (top)
  ctx.save();
  ctx.rotate(rimRightVisual);
  for (let i=0;i<ticks/2;i++) {
    const a = Math.PI * (i/(ticks/2)) - Math.PI/2; // span top half
    const inner = BOARD_RADIUS - 8;
    const outer = BOARD_RADIUS + 4;
    ctx.beginPath();
    ctx.moveTo(inner*Math.cos(a), inner*Math.sin(a));
    ctx.lineTo(outer*Math.cos(a), outer*Math.sin(a));
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // bottom half (theta in [PI, 2PI]) — visually use rimLeftVisual (bottom)
  ctx.save();
  ctx.rotate(rimLeftVisual);
  for (let i=0;i<ticks/2;i++) {
    const a = Math.PI + Math.PI * (i/(ticks/2)) - Math.PI/2;
    const inner = BOARD_RADIUS - 8;
    const outer = BOARD_RADIUS + 4;
    ctx.beginPath();
    ctx.moveTo(inner*Math.cos(a), inner*Math.sin(a));
    ctx.lineTo(outer*Math.cos(a), outer*Math.sin(a));
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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
  endTurnBtn.disabled = !actionDoneThisTurn;
}

// Next-turn energy grant logic
function nextTurn() {
  // Switch player
  state.current = state.current === 'white' ? 'black' : 'white';
  // increment turnCount to track how many switches happened
  state.turnCount++;
  // Only grant energy starting after the first full swap (so both started at START_ENERGY)
  // That means grant energy when turnCount >= 2
  if (state.turnCount >= 2) {
    state.players[state.current].energy = Math.min(MAX_ENERGY, state.players[state.current].energy + ENERGY_PER_TURN);
    log(`${state.current.toUpperCase()} gains +${ENERGY_PER_TURN} energy (now ${state.players[state.current].energy}).`);
  }
  // reset per-turn variables
  actionDoneThisTurn = false;
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
  for (let i = state.circles.length - 1; i >= 0; i--) {
    const c = state.circles[i];
    const { x: cxC, y: cyC } = polarToXY(c.r, c.theta);
    const dx = cxC - x;
    const dy = cyC - y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist <= c.radius + 6) return c;
  }
  return null;
}

// Make an action (place new or strengthen)
// Now: action queues rotation (pendingRotations) and sets actionDoneThisTurn = true
function applyAction({ type, x, y, energy, targetCircle = null }) {
  const actor = state.current;
  if (actionDoneThisTurn) {
    log(`${actor} already acted this turn. Press End Turn to animate rotation.`);
    return;
  }

  if (energy <= 0 || energy > state.players[actor].energy) {
    log(`Invalid energy spend by ${actor}`);
    return;
  }

  // snapshot for undo
  state.history.push(JSON.parse(JSON.stringify(state)));
  undoBtn.disabled = false;

  const deltaAngle = energy * ROTATION_PER_ENERGY; // radians (positive => counterclockwise)

  if (type === 'place') {
    // placement must be within board
    const pol = toPolar(x, y);
    if (pol.r > BOARD_RADIUS - 6) {
      log(`${actor} tried to place outside the board.`);
      // revert history push
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

    // add circle in polar coords (theta stores current angle; rotation not applied yet)
    state.circles.push({
      owner: actor,
      r: pol.r,
      theta: pol.theta,
      radius: newRadius
    });

    // queue rotation for the half where this circle sits
    if (pol.theta < Math.PI) {
      // bottom half (theta < π) -> bottom is white side in our coordinate mapping; treat as left/bottom half in pendingRotations.left
      pendingRotations.left += deltaAngle;
    } else {
      pendingRotations.right += deltaAngle;
    }

    state.players[actor].energy -= energy;
    log(`${actor} placed a circle spending ${energy} energy. Radius ${newRadius.toFixed(1)} px. Queued rotation ${(deltaAngle).toFixed(2)} rad.`);
  } else if (type === 'strengthen') {
    if (!targetCircle) {
      log('No target circle to strengthen.');
      state.history.pop();
      return;
    }
    if (targetCircle.owner !== actor) {
      log(`${actor} cannot strengthen opponent's circle.`);
      state.history.pop();
      return;
    }
    // increase its radius immediately
    const grow = Math.max(1, energy * ENERGY_TO_RADIUS);
    targetCircle.radius += grow;

    // queue rotation based on the circle's current theta
    if (targetCircle.theta < Math.PI) pendingRotations.left += deltaAngle;
    else pendingRotations.right += deltaAngle;

    state.players[actor].energy -= energy;
    log(`${actor} strengthened their circle (+${grow.toFixed(1)} px) using ${energy} energy. Queued rotation ${(deltaAngle).toFixed(2)} rad.`);
  }

  // mark that player has used their action — they must press End Turn to finalize rotation
  actionDoneThisTurn = true;
  updateUI();
  draw();
}

// Apply queued rotations with an animation, then update circle thetas once
function animateAndApplyRotations() {
  if (!actionDoneThisTurn) return;
  if (pendingRotations.left === 0 && pendingRotations.right === 0) {
    // nothing to rotate — just end the turn
    pendingRotations.left = 0;
    pendingRotations.right = 0;
    nextTurn();
    return;
  }

  endTurnBtn.disabled = true;
  // animate from current rim visuals to target values (add pending rotations)
  const startLeft = rimLeftVisual;
  const startRight = rimRightVisual;
  const targetLeft = rimLeftVisual + pendingRotations.left;
  const targetRight = rimRightVisual + pendingRotations.right;
  const start = performance.now();

  function step(now) {
    const t = Math.min(1, (now - start) / ROTATION_ANIM_MS);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // smoothish ease
    rimLeftVisual = startLeft + (targetLeft - startLeft) * ease;
    rimRightVisual = startRight + (targetRight - startRight) * ease;
    draw();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // finalize: update each circle theta once (cheaper)
      const leftDelta = pendingRotations.left;
      const rightDelta = pendingRotations.right;
      for (const c of state.circles) {
        if (c.theta < Math.PI) {
          c.theta = (c.theta + leftDelta) % (2*Math.PI);
          if (c.theta < 0) c.theta += 2*Math.PI;
        } else {
          c.theta = (c.theta + rightDelta) % (2*Math.PI);
          if (c.theta < 0) c.theta += 2*Math.PI;
        }
      }

      // clear pending rotations and allow next turn
      pendingRotations.left = 0;
      pendingRotations.right = 0;

      // ensure visual rotation values are normalized
      rimLeftVisual = (rimLeftVisual) % (2*Math.PI);
      rimRightVisual = (rimRightVisual) % (2*Math.PI);

      draw();

      // finalize turn switch AFTER rotation applied
      nextTurn();
      endTurnBtn.disabled = true;
    }
  }

  requestAnimationFrame(step);
}

// Undo
function undo() {
  if (state.history.length === 0) return;
  const last = state.history.pop();
  // restore
  state = last;
  // clear pending rotations (safe)
  pendingRotations.left = 0;
  pendingRotations.right = 0;
  actionDoneThisTurn = false;
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
  pendingRotations.left = 0;
  pendingRotations.right = 0;
  rimLeftVisual = 0;
  rimRightVisual = 0;
  actionDoneThisTurn = false;
  log('Game reset.');
  updateUI();
  draw();
}

// Handle clicks
canvas.addEventListener('click', (ev) => {
  if (actionDoneThisTurn) {
    log('Action already taken this turn — press End Turn to animate rotation (or Undo).');
    return;
  }
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

// Buttons
endTurnBtn.addEventListener('click', () => {
  animateAndApplyRotations();
});
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', resetGame);

// Init
updateUI();
draw();
log('Game started. White goes first with 100 energy. Choose energy then click the board to act. After acting press End Turn to animate the rotation.');
