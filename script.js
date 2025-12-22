/*

main code for circle game 
concept designe: -complete-
initial framework generation: -complete-
Review, Abstactions, and Bug fixes: -current-
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
const ROTATION_PER_ENERGY = 1 / 50; // radians per energy (50 energy = 1 radian)
const DefualtBoardRadius = 400; //px

// Canvas setup (moved into a class so size can be changed at runtime)
// width, height, cx, cy, BOARD_RADIUS, BOARD_RADIUS_Percent
class BoardCanvas {
  constructor(selector = '#board') {
    this.selector = selector;
    this.canvas = document.querySelector(this.selector);
    if (!this.canvas) throw new Error(`Canvas not found: ${selector}`);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.updateDerived();
  }

  updateDerived() {
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.BOARD_RADIUS = Math.min(this.width, this.height) * 0.43;
    this.BOARD_RADIUS_Percent = this.BOARD_RADIUS / DefualtBoardRadius;
  }

  // setup(width, height) — call to change the canvas pixel dimensions at runtime
  setup(width, height) {
    if (typeof width === 'number') {
      this.canvas.width = width;
      this.width = width;
    }
    if (typeof height === 'number') {
      this.canvas.height = height;
      this.height = height;
    }
    // refresh context and derived values
    this.ctx = this.canvas.getContext('2d');
    this.updateDerived();
    return this;
  }

  // convenience alias
  resize(width, height) { return this.setup(width, height); }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }
}

// instantiate canvas
const boardCanvas = new BoardCanvas('#board');
const canvas = boardCanvas.canvas;
const ctx = boardCanvas.ctx;

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
const State_Template = {
  players: {
    white: { energy: START_ENERGY },
    black: { energy: START_ENERGY }
  },
  current: 'white', // 'white' or 'black'
  circles: [], // {owner: 'white'|'black',
    // r: radial distance from center (radius%), 
    // theta: angle (rad), 
    // energy: circleEnergy}
  turnCount: 0, 
  history: [],  // {player, action, energyUsed, targetCircle}
  energyUsed: 0,
};

let state = JSON.parse(JSON.stringify(State_Template));

let actionDoneThisTurn = false;

// Helper logging
function log(msg) {
  const time = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.textContent = `[${time}] ${msg}`;
  logBox.prepend(el);
}

// Utilities
function XYToPolar(x, y) {
  const dx = x - boardCanvas.cx;
  const dy = y - boardCanvas.cy;
  const r = Math.sqrt(dx*dx + dy*dy);
  let theta = Math.atan2(dy, dx);
  if (theta < 0) theta += Math.PI * 2;
  return { rPercent: r / boardCanvas.BOARD_RADIUS, theta };
}

function polarToXY(rPercent, theta) {
  return { x: boardCanvas.cx + rPercent * boardCanvas.BOARD_RADIUS * Math.cos(theta), y: boardCanvas.cy + rPercent * boardCanvas.BOARD_RADIUS * Math.sin(theta) };
}

function energyToRadius(energy) {
  return (Math.max(6, Math.sqrt(energy / Math.PI) )* boardCanvas.BOARD_RADIUS_Percent);
}

function disableButtons() {
  endTurnBtn.disabled = true;
  resetBtn.disabled = true;
  undoBtn.disabled = true;
}

function enableButtons() {
  endTurnBtn.disabled = !actionDoneThisTurn;
  resetBtn.disabled = false;
  undoBtn.disabled = state.history.length === 0;
}

// Drawing
function drawCanvasBase() {
  let ctx = boardCanvas.ctx;
  let BOARD_RADIUS = boardCanvas.BOARD_RADIUS;

  ctx.save();
  ctx.translate(boardCanvas.cx, boardCanvas.cy);

  ctx.beginPath();
  ctx.arc(0,0, BOARD_RADIUS+6, 0, Math.PI*2);
  const grd = ctx.createRadialGradient(-BOARD_RADIUS*0.3, -BOARD_RADIUS*0.3, BOARD_RADIUS*0.1, 0,0, BOARD_RADIUS);
  grd.addColorStop(0, 'rgba(120,140,160,0.03)');
  grd.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grd;
  ctx.fill();

  ctx.restore();
}

function drawBoardBackground() {
  let ctx = boardCanvas.ctx;
  let BOARD_RADIUS = boardCanvas.BOARD_RADIUS;

  ctx.save();
  ctx.translate(boardCanvas.cx, boardCanvas.cy);

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
  const ctx = boardCanvas.ctx;
  ctx.save();
  ctx.translate(boardCanvas.cx, boardCanvas.cy);

  for (const c of state.circles) {
    const { x, y } = polarToXY(c.r, c.theta);
    ctx.beginPath();
    const circleRadius = energyToRadius(c.energy);
    ctx.arc(x - boardCanvas.cx, y - boardCanvas.cy, circleRadius, 0, Math.PI * 2);
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
    log(`Circle placed at (${x.toFixed(0)},${y.toFixed(0)}) with ${c.energy} energy.`);
  }

  ctx.restore();
}

function drawCanvasTickMarks() {
  const ctx = boardCanvas.ctx;
  const BOARD_RADIUS = boardCanvas.BOARD_RADIUS;

  ctx.save();
  ctx.translate(boardCanvas.cx, boardCanvas.cy);

  const ticks = 48;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const inner = BOARD_RADIUS - 8;
    const outer = BOARD_RADIUS + 4;
    const ix = inner * Math.cos(a);
    const iy = inner * Math.sin(a);
    const ox = outer * Math.cos(a);
    const oy = outer * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ox, oy);
    if (iy < 0) {
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function draw() {
  boardCanvas.clear();
  drawCanvasBase();
  drawBoardBackground();
  drawCircles();
  drawCanvasTickMarks();
}

// UI updates (not the canvas/board)
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
  enableButtons();
}

// Next-turn energy grant logic
function nextTurn() {
  state.current = state.current === 'white' ? 'black' : 'white';
  state.turnCount++;
  let energyToAdd = 0;
  if (state.turnCount >= 2) {
    energyToAdd = Math.min(ENERGY_PER_TURN, MAX_ENERGY - state.players[state.current].energy);
    state.players[state.current].energy = state.players[state.current].energy + energyToAdd;
    log(`${state.current.toUpperCase()} gains +${energyToAdd} energy (now ${state.players[state.current].energy}).`);
  }
  actionDoneThisTurn = false;
  updateUI();
  draw();
}

// Collision check: will new circle (at x,y with energy) overlap any opponent circle?
function collidesOpponent(x, y, energy, owner) {
  const newRadius = energyToRadius(energy);
  for (const c of state.circles) {
    if (c.owner !== owner) {
      const { x: circleX, y: circleY } = polarToXY(c.r, c.theta);
      const dx = circleX - x;
      const dy = circleY - y;
      const dist = Math.hypot(dx, dy);
      const circleRadius = energyToRadius(c.energy);
      if (dist < (circleRadius + newRadius) - 0.5) return true;
    }
  }
  return false;
}

// find circle at x,y for strengthen mode
function findCircleAt(x, y) {
  for (let i = state.circles.length - 1; i >= 0; i--) {
    const c = state.circles[i];
    const { x: circleX, y: circleY } = polarToXY(c.r, c.theta);
    const dist = Math.hypot(circleX - x, circleY - y);
    const circleRadius = energyToRadius(c.energy);
    if (dist <= circleRadius + 6) return c;
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
  const pol = XYToPolar(x, y);
  const pixelR = pol.rPercent * boardCanvas.BOARD_RADIUS;
  if (pixelR > boardCanvas.BOARD_RADIUS - 6) {
    log(`${player} tried to place outside the board.`);
    return false;
  }
  if (collidesOpponent(x, y, energy, player)) {
    log(`${player} cannot place, overlapping opponent's circle.`);
    return false;
  }
  return true;
}

// add circle into game state
function placeCircle(player, energy, x, y) {
  const pol = XYToPolar(x, y);
  state.circles.push({
    owner: player,
    r: pol.rPercent,
    theta: pol.theta,
    energy: energy
  });

  
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
function strengthenCircle(targetCircle, energy) {
  if (typeof targetCircle.energy !== 'number') targetCircle.energy = 1;
  const grow = Math.max(1, energy);
  targetCircle.energy += grow;
  return grow;  // return grow so applyAction can use it
}

// update circle thetas
function applyRotations(energyUsed=state.energyUsed) {
  for (const c of state.circles) {
    c.theta = (c.theta + energyUsed*ROTATION_PER_ENERGY) % (2*Math.PI)
  }
}

// End turn
function endTurn() {
  if (!actionDoneThisTurn) {
    log('an action must be taken to end turn.');
    return;
  }
    
  endTurnBtn.disabled = true;
  applyRotations();
  nextTurn();
  updateUI();
  draw();
  if (autoDisableStrengthen.checked) strengthenMode.checked = false;
  log('Turn ended.');
  endTurnBtn.disabled = false;
}

// apply click action onto canvas
function applyAction({ type, x, y, energy, targetCircle = null }) {
  const player = state.current;

  if (type === 'place') {
    if (checkValidPlacement(player, energy, x, y)) {
      placeCircle(player, energy, x, y);
      state.history.push({player: player, action: "place", energyUsed: energy});
      log(`${player} placed a circle spending ${energy} energy.`);
    } else {
      return;
    }
    
  } else if (type === 'strengthen') {
    if (checkValidStrengthen(targetCircle, player, energy)) {
      const grow = strengthenCircle(targetCircle, energy);
      state.history.push({player: player, action: "strengthen", energyUsed: energy, targetCircle: targetCircle});
      log(`${player} strengthened their circle (+${grow.toFixed(1)} energy) using ${energy} energy.`);
    } else {
      return;
    }
  }

  state.energyUsed = energy;
  state.players[player].energy -= energy;
  actionDoneThisTurn = true;
  
  
  updateUI();
  draw();
  enableButtons();
  if (autoEndTurn.checked) {
    endTurn();
  }
}

// Undo
function undo() {
  if (state.history.length === 0) return;
  const lastAction = state.history.pop();

  if (lastAction.action === 'place') {
    state.circles.pop();
  } else if (lastAction.action === 'strengthen') {
    if (lastAction.targetCircle) {
      lastAction.targetCircle.energy -= lastAction.energyUsed;
    }
  }
  // reverse rotations by subtracting
  for (const c of state.circles) {
    c.theta = (c.theta - lastAction.energyUsed * ROTATION_PER_ENERGY + Math.PI * 2) % (Math.PI * 2);
  }
  state.players[lastAction.player].energy += lastAction.energyUsed;
  actionDoneThisTurn = false;
  updateUI();
  draw();
  log('Undo performed.');
  undoBtn.disabled = state.history.length === 0;
}

// Reset
function resetGame() {
  state = JSON.parse(JSON.stringify(State_Template));
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
endTurnBtn.addEventListener('click', endTurn);
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
