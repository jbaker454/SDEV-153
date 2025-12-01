/*

main code for circle game 
concept designe: -complete-
initial framework generation: -complete-
Review, Abstactions, and Bug fixes: -current-
--add player turn indicator
--hook up auto end turn
--hook up auto disable strengthen
--add player specific placement feature
--add error handling and type verification (potential strict typing)
Add Platform Assecibility: -pending-
Add Disability Assecibility: -pending-
account creation and Security: -pending-

*/ 

// CONFIG
const MAX_ENERGY = 200;
const ENERGY_PER_TURN = 50;
const START_ENERGY = 100;
const ENERGY_TO_RADIUS = 1 / 4; // px per energy unit
const ROTATION_PER_ENERGY = 1 / 50; // radians per energy (50 energy = 1 radian)
const ROTATION_ANIM_MS = 1350; // animation duration

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
const autoEndTurn = document.getElementById('autoEndTurn');
const autoDisableStrengthen = document.getElementById('autoDisableStrengthen');
const strengthenMode = document.getElementById('strengthenMode');
const logBox = document.getElementById('log');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const endTurnBtn = document.getElementById('endTurnBtn');



// Game state
let state = {
  players: {
    white: { energy: START_ENERGY },
    black: { energy: START_ENERGY }
  },
  current: 'white', // 'white' or 'black'
  circles: [], // {owner: 'white'|'black', r: radial distance from center (px), theta: angle (rad), radius: px}
  turnCount: 0,   // counts switches; initial 0
  history: [],
  energyUsed: 0,
};

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
function clearcanvas() {
  ctx.clearRect(0,0,W,H);
}

function drawCanvasBase() {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0,0, BOARD_RADIUS+6, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(-BOARD_RADIUS*0.3, -BOARD_RADIUS*0.3, BOARD_RADIUS*0.1, 0,0, BOARD_RADIUS);
  grd.addColorStop(0, 'rgba(120,140,160,0.03)');
  grd.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grd;
  ctx.fill();

  ctx.restore();
}

function drawCanvasBackgrounds() {
  ctx.save();
  ctx.translate(cx, cy);

  //white top
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, BOARD_RADIUS, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fill();

  //black bottom
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, BOARD_RADIUS, 0, Math.PI, false); 
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();

  //horizontal line
  ctx.beginPath();
  ctx.moveTo(-BOARD_RADIUS-6, 0);
  ctx.lineTo(BOARD_RADIUS+6, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

function drawCircles() {
  ctx.save();
  ctx.translate(cx, cy);
  
  for (const c of state.circles) {
    const { x, y } = polarToXY(c.r, c.theta);
    ctx.beginPath();
    ctx.arc(x - cx, y - cy, c.radius, 0, Math.PI*2);
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
  
  ctx.restore();
}

function drawCanvasTickMarks() {
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
}

function draw() {
  clearcanvas();
  drawCanvasBase();
  drawCanvasBackgrounds();
  drawCircles();
  drawCanvasTickMarks();
}

// UI updates
function updateUI() {
  const whiteEnergy = state.players.white.energy;
  const blackEnergy = state.players.black.energy;
  whiteBar.style.width = `${(whiteEnergy / MAX_ENERGY) * 100}%`;
  blackBar.style.width = `${(blackEnergy / MAX_ENERGY) * 100}%`;
  whiteEnergyText.textContent = `${whiteEnergy} / ${MAX_ENERGY}`;
  blackEnergyText.textContent = `${blackEnergy} / ${MAX_ENERGY}`;
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
  state.current = state.current === 'white' ? 'black' : 'white';
  state.turnCount++;
  if (state.turnCount >= 2) {
    state.players[state.current].energy = Math.min(MAX_ENERGY, state.players[state.current].energy + ENERGY_PER_TURN);
    log(`${state.current.toUpperCase()} gains +${ENERGY_PER_TURN} energy (now ${state.players[state.current].energy}).`);
  }
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

// check circle placement
function checkValidPlacement(player, energy, x, y) {
  if (actionDoneThisTurn) {
    log(`${player} already acted this turn. Press End Turn to animate rotation.`);
    return false;
  }
  if (energy <= 0 || energy > state.players[player].energy) {
    log(`Invalid energy spent by ${player} — action nullified.`);
    return false;
  }
  if (toPolar(x, y).r > BOARD_RADIUS - 6) {
    log(`${player} tried to place outside the board.`);
    return false;
  }
  const newRadius = Math.max(6, energy * ENERGY_TO_RADIUS);
  if (collidesOpponent(x, y, newRadius, player)) {
    log(`${player} cannot place, overlapping opponent's circle.`);
    return false;
  }
  return true;
}

// add circle into game state
function placeCircle(player, energy, x, y) {
  const pol = toPolar(x, y);
  const radius = Math.max(6, energy * ENERGY_TO_RADIUS);
  state.circles.push({
    owner: player,
    r: pol.r,
    theta: pol.theta,
    radius
  });
  log(`${player} placed a circle spending ${energy} energy.`);
}

// check strengthen action
function checkValidStrengthen(targetCircle, player, energy) {
  if (!targetCircle) {
    log('No target circle to strengthen.');
    return false;
  }
  if (targetCircle.owner !== player) {
    log(`${player} cannot strengthen opponent's circle.`);
    return false;
  }
  if (energy <= 0 || energy > state.players[player].energy) {
    log(`Invalid energy spent by ${player} — strengthen nullified.`);
    return false;
  }
  return true;
}

// add energy to circle
function strengthenCircle(targetCircle, player, energy) {
  const grow = Math.max(1, energy * ENERGY_TO_RADIUS);
  if (typeof targetCircle.radius !== 'number') targetCircle.radius = 6;
  targetCircle.radius += grow;
  
  log(`${player} strengthened their circle (+${grow.toFixed(1)} px) using ${energy} energy.`);
}

// apply click action onto canvas
function applyAction({ type, x, y, energy, targetCircle = null }) {
  const player = state.current;
  let storeState = state;
  storeState.pop();
  state.history.push(JSON.parse(JSON.stringify(storeState)));
  undoBtn.disabled = false;

  if (type === 'place') {
    if (checkValidPlacement(player, energy, x, y)) {
      placeCircle(player, energy, x, y);
    } else {
      state.history.pop();
      return;
    }
    
  } else if (type === 'strengthen') {
    if (checkValidStrengthen(targetCircle, player, energy)) {
      strengthenCircle(targetCircle, player, energy);
    } else {
      state.history.pop();
      return;
    }
  }

  state.energyUsed = energy;
  state.players[player].energy -= energy;
  actionDoneThisTurn = true;
  
  updateUI();
  draw();
}

// update circle thetas
function applyRotations() {
  for (const c of state.circles) {
    c.theta = (c.theta + state.energyUsed*ROTATION_PER_ENERGY) % (2*Math.PI)
  }
}

// End turn
function endTurn() {
  if (!actionDoneThisTurn) return;
  endTurnBtn.disabled = true;
  applyRotations();
  nextTurn();
  updateUI();
  draw();
  log('Turn ended.');
  endTurnBtn.disabled = false;
}

// Undo
function undo() {
  if (state.history.length === 0) return;
  const last = state.history.pop();
  // restore
  state = last;
  // clear pending rotations (safe)
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
    history: [],
    energyUsed: 0
  };
  rimLeftVisual = 0;
  rimRightVisual = 0;
  actionDoneThisTurn = false;
  log('Game reset.');
  updateUI();
  draw();
}

// Events
spendRange.addEventListener('input', () => {
  spendValue.textContent = spendRange.value
});

// -buttons
endTurnBtn.addEventListener('click', () => {
  endTurn();
});
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', resetGame);

// -handle clicks
canvas.addEventListener('click', (ev) => {
  if (actionDoneThisTurn) {
    log('Action already taken this turn — press End Turn (or Undo).');
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  const player = state.current;
  const spend = parseInt(spendRange.value, 10);

  if (strengthenMode.checked) {
    // find circle under click
    const c = findCircleAt(x, y);
    if (!c) {
      log(`${player} clicked strengthen mode but no circle found.`);
      return;
    }
    if (c.owner !== player) {
      log(`${player} cannot strengthen opponent's circle.`);
      return;
    }
    // apply strengthen
    applyAction({ type: 'strengthen', x, y, energy: spend, targetCircle: c });
  } else {
    // place
    applyAction({ type: 'place', x, y, energy: spend });
  }
});

// Init
updateUI();
draw();
log('Game started. White goes first with 100 energy. Choose energy then click the board to act. After acting press End Turn.');
