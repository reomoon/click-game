const DURATION = 30;
const MILESTONE = 100;
const MILESTONE_2 = 200;
const DODGE_CHANCE = 0.1;
const DECOY_CHANCE = 0.04;
const BOMB_HIDE_MS = 2222;
const COIN_REWARD_INTERVAL = 50;
const COIN_REWARD_AMOUNT = 10;
const GATE_MILESTONE = 100;
const GATE_COST = 100;

const arena = document.getElementById("arena");
const clickBtn = document.getElementById("clickBtn");
const gateBtn = document.getElementById("gateBtn");
const timeLeftEl = document.getElementById("timeLeft");
const clickCountEl = document.getElementById("clickCount");
const bestScoreEl = document.getElementById("bestScore");
const coinCountEl = document.getElementById("coinCount");
const resultEl = document.getElementById("resultMessage");
const fireworksLayer = document.getElementById("fireworks");

let running = false;
let clicks = 0;
let endTime = 0;
let rafId = null;
let decoysActive = false;
let buttonHidden = false;
let bombTimeoutId = null;
let gateActive = false;
let best = Number(localStorage.getItem("cps-best")) || 0;
let coins = Number(localStorage.getItem("cps-coins")) || 0;

bestScoreEl.textContent = best;
coinCountEl.textContent = coins;

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, duration, { type = "sine", volume = 0.2, delay = 0, endFreq = null } = {}) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startTime = ctx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), startTime + duration);
  }

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playClickSound() {
  playTone(700, 0.06, { type: "square", volume: 0.12 });
}

function playCoinSound() {
  playTone(880, 0.09, { type: "triangle", volume: 0.18 });
  playTone(1318, 0.12, { type: "triangle", volume: 0.16, delay: 0.07 });
}

function playFanfareSound() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    playTone(freq, 0.16, { type: "triangle", volume: 0.18, delay: i * 0.09 });
  });
}

function playBombSound() {
  playTone(180, 0.5, { type: "sawtooth", volume: 0.3, endFreq: 30 });
  playTone(90, 0.4, { type: "square", volume: 0.2, endFreq: 20, delay: 0.03 });
}

function playGateSuccessSound() {
  [659, 784, 988, 1318].forEach((freq, i) => {
    playTone(freq, 0.14, { type: "sine", volume: 0.2, delay: i * 0.06 });
  });
}

function playErrorBuzz() {
  playTone(160, 0.18, { type: "sawtooth", volume: 0.2, endFreq: 90 });
}

function spawnRipple(button, clientX, clientY) {
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "tap-ripple";
  ripple.style.left = `${clientX - rect.left}px`;
  ripple.style.top = `${clientY - rect.top}px`;
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function addCoins(amount) {
  coins += amount;
  localStorage.setItem("cps-coins", String(coins));
  coinCountEl.textContent = coins;
  playCoinSound();
  if (gateActive) {
    updateGateAvailability();
  }
}

function updateGateAvailability() {
  gateBtn.classList.toggle("insufficient", coins < GATE_COST);
}

function openGate() {
  gateActive = true;
  clickBtn.style.visibility = "hidden";
  gateBtn.classList.add("visible");
  updateGateAvailability();
}

function closeGate() {
  gateActive = false;
  gateBtn.classList.remove("visible", "insufficient", "shake");
}

function moveButtonRandomly() {
  const arenaRect = arena.getBoundingClientRect();
  const maxLeft = arenaRect.width - clickBtn.offsetWidth;
  const maxTop = arenaRect.height - clickBtn.offsetHeight;
  const left = Math.random() * Math.max(0, maxLeft);
  const top = Math.random() * Math.max(0, maxTop);
  clickBtn.style.left = `${left}px`;
  clickBtn.style.top = `${top}px`;
}

function centerButton() {
  const arenaRect = arena.getBoundingClientRect();
  clickBtn.style.left = `${(arenaRect.width - clickBtn.offsetWidth) / 2}px`;
  clickBtn.style.top = `${(arenaRect.height - clickBtn.offsetHeight) / 2}px`;
}

function placeInQuadrant(el, quadrantIndex) {
  const arenaRect = arena.getBoundingClientRect();
  const halfW = arenaRect.width / 2;
  const halfH = arenaRect.height / 2;
  const qx = quadrantIndex % 2;
  const qy = quadrantIndex < 2 ? 0 : 1;
  const maxLeft = Math.max(0, halfW - el.offsetWidth);
  const maxTop = Math.max(0, halfH - el.offsetHeight);
  el.style.left = `${qx * halfW + Math.random() * maxLeft}px`;
  el.style.top = `${qy * halfH + Math.random() * maxTop}px`;
}

function shuffledQuadrants() {
  const positions = [0, 1, 2, 3];
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions;
}

function spawnDecoys() {
  const positions = shuffledQuadrants();
  placeInQuadrant(clickBtn, positions[0]);

  for (let i = 0; i < 3; i++) {
    const decoy = document.createElement("button");
    decoy.className = "click-btn running decoy-btn";
    decoy.textContent = clickBtn.textContent;
    arena.appendChild(decoy);
    placeInQuadrant(decoy, positions[i + 1]);
    decoy.addEventListener("click", (e) => {
      spawnRipple(decoy, e.clientX, e.clientY);
      triggerBomb();
    });
  }

  decoysActive = true;
}

function clearDecoys() {
  arena.querySelectorAll(".decoy-btn").forEach((el) => el.remove());
  decoysActive = false;
}

function spawnBombEffect() {
  const overlay = document.createElement("div");
  overlay.className = "eruption-overlay";
  overlay.style.animationDuration = `${BOMB_HIDE_MS}ms`;

  const emoji = document.createElement("div");
  emoji.className = "eruption-emoji";
  emoji.style.animationDuration = `${BOMB_HIDE_MS}ms`;
  emoji.textContent = "🌋";
  overlay.appendChild(emoji);
  document.body.appendChild(overlay);

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.8;
  const spread = Math.max(window.innerWidth, window.innerHeight);
  const lavaColors = ["#ff4500", "#ff8c00", "#ffd700", "#b22222", "#5c3a21"];
  for (let i = 0; i < 60; i++) {
    const particle = document.createElement("div");
    particle.className = "lava-particle";
    particle.style.animationDuration = `${BOMB_HIDE_MS * 0.6}ms`;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const distance = 80 + Math.random() * spread * 0.7;
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.background = lavaColors[Math.floor(Math.random() * lavaColors.length)];
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    overlay.appendChild(particle);
  }

  document.body.classList.remove("erupting");
  void document.body.offsetWidth;
  document.body.classList.add("erupting");

  setTimeout(() => overlay.remove(), BOMB_HIDE_MS);
}

function triggerBomb() {
  clearDecoys();
  spawnBombEffect();
  playBombSound();
  buttonHidden = true;
  clickBtn.style.visibility = "hidden";

  if (bombTimeoutId) clearTimeout(bombTimeoutId);
  bombTimeoutId = setTimeout(() => {
    bombTimeoutId = null;
    buttonHidden = false;
    if (running) {
      clickBtn.style.visibility = "visible";
      moveButtonRandomly();
    }
  }, BOMB_HIDE_MS);
}

function spawnFireworks() {
  const colors = ["#ff6f61", "#ffd166", "#06d6a0", "#118ab2", "#ef476f"];
  const bursts = 3;

  for (let b = 0; b < bursts; b++) {
    const originX = Math.random() * window.innerWidth;
    const originY = Math.random() * window.innerHeight * 0.6 + 40;

    for (let i = 0; i < 24; i++) {
      const particle = document.createElement("div");
      particle.className = "firework-particle";
      const angle = (Math.PI * 2 * i) / 24;
      const distance = 60 + Math.random() * 60;
      particle.style.left = `${originX}px`;
      particle.style.top = `${originY}px`;
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      fireworksLayer.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove());
    }
  }
}

function tick() {
  const remaining = Math.max(0, (endTime - Date.now()) / 1000);
  timeLeftEl.textContent = remaining.toFixed(1);

  if (remaining <= 0) {
    endGame();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function startGame() {
  running = true;
  clicks = 1;
  clickCountEl.textContent = clicks;
  clickCountEl.classList.remove("milestone", "milestone-2");
  resultEl.textContent = "";
  resultEl.classList.remove("new-record");
  clickBtn.textContent = "👆 Click!";
  clickBtn.classList.add("running");
  if (bombTimeoutId) {
    clearTimeout(bombTimeoutId);
    bombTimeoutId = null;
  }
  buttonHidden = false;
  closeGate();
  clickBtn.style.visibility = "visible";
  clearDecoys();
  centerButton();
  endTime = Date.now() + DURATION * 1000;
  rafId = requestAnimationFrame(tick);
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);
  timeLeftEl.textContent = "0.0";
  clickBtn.textContent = "다시 도전하기";
  clickBtn.classList.remove("running");
  clickBtn.style.left = "";
  clickBtn.style.top = "";
  clickBtn.style.visibility = "visible";
  if (bombTimeoutId) {
    clearTimeout(bombTimeoutId);
    bombTimeoutId = null;
  }
  buttonHidden = false;
  closeGate();
  clearDecoys();

  const cps = (clicks / DURATION).toFixed(1);
  let message = `${clicks}번 클릭! (초당 ${cps}회)`;

  if (clicks > best) {
    best = clicks;
    localStorage.setItem("cps-best", String(best));
    bestScoreEl.textContent = best;
    message += " 🎉 신기록!";
    resultEl.classList.add("new-record");
  }

  resultEl.textContent = message;
}

clickBtn.addEventListener("click", (e) => {
  if (!running) {
    startGame();
    spawnRipple(clickBtn, e.clientX, e.clientY);
    return;
  }

  spawnRipple(clickBtn, e.clientX, e.clientY);

  if (decoysActive) {
    clearDecoys();
  }

  playClickSound();
  clicks++;
  clickCountEl.textContent = clicks;

  if (clicks % COIN_REWARD_INTERVAL === 0) {
    addCoins(COIN_REWARD_AMOUNT);
  }

  if (clicks === MILESTONE) {
    clickCountEl.classList.add("milestone");
    spawnFireworks();
    playFanfareSound();
  }

  if (clicks === MILESTONE_2) {
    clickCountEl.classList.remove("milestone");
    clickCountEl.classList.add("milestone-2");
    spawnFireworks();
    playFanfareSound();
  }

  if (clicks === GATE_MILESTONE) {
    openGate();
    return;
  }

  if (Math.random() < DECOY_CHANCE) {
    spawnDecoys();
  } else if (Math.random() < DODGE_CHANCE) {
    moveButtonRandomly();
  }
});

gateBtn.addEventListener("click", (e) => {
  spawnRipple(gateBtn, e.clientX, e.clientY);

  if (coins < GATE_COST) {
    playErrorBuzz();
    gateBtn.classList.remove("shake");
    void gateBtn.offsetWidth;
    gateBtn.classList.add("shake");
    return;
  }

  coins -= GATE_COST;
  localStorage.setItem("cps-coins", String(coins));
  coinCountEl.textContent = coins;
  playGateSuccessSound();
  closeGate();
  clickBtn.style.visibility = "visible";
  moveButtonRandomly();
});
