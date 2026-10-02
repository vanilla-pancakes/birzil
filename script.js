// Three stages:
//   1. Countdown to the wedding (2 Oct 2026, 10:00 PM, Pakistan time)
//   2. "It happened": a second countdown to the celebration (3 Oct, 2:00 AM)
//   3. The celebration (fireworks), then a quiet "married since" clock
//
// Preview helpers (add to the address bar to test):
//   ?preview=15          -> stage 1 ends in 15s, stage 2 lasts 25s, then finale
//   ?preview=15&gap=40   -> same, but stage 2 lasts 40s
//   ?stage2              -> jump straight into the second countdown (25s)
//   ?finale              -> jump straight to the celebration
const params = new URLSearchParams(window.location.search);
const previewSeconds = Number(params.get("preview"));
const HOUR = 3600 * 1000;

let weddingTime = new Date("2026-10-02T22:00:00+05:00").getTime();
let celebrationTime = new Date("2026-10-03T02:00:00+05:00").getTime();
if (previewSeconds > 0) {
  weddingTime = Date.now() + previewSeconds * 1000;
  celebrationTime = weddingTime + (Number(params.get("gap")) || 25) * 1000;
} else if (params.has("stage2")) {
  weddingTime = Date.now() - 4 * HOUR;
  celebrationTime = Date.now() + 25 * 1000;
} else if (params.has("finale")) {
  weddingTime = Date.now() - 4 * HOUR;
  celebrationTime = 0;
}

const hero = document.querySelector(".hero");
const title = document.getElementById("page-title");
const subtitle = document.querySelector(".subtitle");
const loveNote = document.getElementById("loveNote");
const replayLink = document.getElementById("replayFinale");
const units = {
  days: document.querySelector('[data-unit="days"]'),
  hours: document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};

const pad = (value, length = 2) => String(value).padStart(length, "0");
let stage = 1;

function updateUnit(unit, value) {
  const element = units[unit];

  if (element.textContent === value) {
    return;
  }

  element.textContent = value;
  element.classList.remove("tick");
  element.closest(".time-card").classList.remove("card-tick");
  void element.offsetWidth;
  element.classList.add("tick");
  element.closest(".time-card").classList.add("card-tick");
}

function showTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  updateUnit("days", String(Math.floor(totalSeconds / 86400)));
  updateUnit("hours", pad(Math.floor((totalSeconds % 86400) / 3600)));
  updateUnit("minutes", pad(Math.floor((totalSeconds % 3600) / 60)));
  updateUnit("seconds", pad(totalSeconds % 60));
}

function swapScreen() {
  hero.classList.remove("swap");
  void hero.offsetWidth;
  hero.classList.add("swap");
}

// Stage 2 headline: "It happened!!!" with bouncing marks and a waddling penguin.
function setExcitedTitle() {
  title.textContent = "";
  title.setAttribute("aria-label", "It happened!!!");

  // "It happened!!!" always stays on one line; the penguin may wrap below it.
  const main = document.createElement("span");
  main.className = "headline-main";

  const word = document.createElement("span");
  word.className = "pop-word";
  word.textContent = "It happened";
  main.append(word);

  for (let i = 0; i < 3; i += 1) {
    const bang = document.createElement("span");
    bang.className = "bang";
    bang.setAttribute("aria-hidden", "true");
    bang.style.setProperty("--i", String(i));
    bang.textContent = "!";
    main.append(bang);
  }
  title.append(main);

  const penguin = document.createElement("span");
  penguin.className = "penguin-icon";
  penguin.setAttribute("aria-hidden", "true");
  penguin.textContent = "\u{1F427}";
  title.append(" ", penguin);
}

// Faint penguins scattered evenly behind the page (a seeded shuffle, so the
// pattern looks the same every visit and never clumps).
let penguinLayer = null;
function addPenguinWatermarks() {
  if (penguinLayer) return;
  let seed = 7;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  penguinLayer = document.createElement("div");
  penguinLayer.className = "penguin-layer";
  penguinLayer.setAttribute("aria-hidden", "true");

  const narrow = window.innerWidth < 640;
  const cols = narrow ? 3 : 6;
  const rows = narrow ? 6 : 4;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (rand() < 0.18) continue; // leave a few gaps so it feels airy
      const p = document.createElement("span");
      p.textContent = "\u{1F427}";
      p.style.left = `${((c + 0.5 + (rand() - 0.5) * 0.7) / cols) * 100}%`;
      p.style.top = `${((r + 0.5 + (rand() - 0.5) * 0.7) / rows) * 100}%`;
      p.style.fontSize = `${Math.round(30 + rand() * 38)}px`;
      p.style.setProperty("--rot", `${Math.round((rand() - 0.5) * 50)}deg`);
      p.style.setProperty("--o", (0.08 + rand() * 0.07).toFixed(2));
      p.style.animationDelay = `${(-rand() * 8).toFixed(2)}s`;
      p.style.animationDuration = `${(6 + rand() * 4).toFixed(2)}s`;
      penguinLayer.append(p);
    }
  }
  document.body.prepend(penguinLayer);
}

function removePenguinWatermarks() {
  if (!penguinLayer) return;
  const layer = penguinLayer;
  penguinLayer = null;
  layer.classList.add("leaving");
  setTimeout(() => layer.remove(), 1500);
}

// Stage 2 (after 10:00 PM): "It happened!!!"
function enterStageTwo() {
  stage = 2;
  document.body.classList.add("stage-two");
  setExcitedTitle();
  subtitle.textContent = "You are my wife now, Irza.";
  loveNote.textContent = "Let\u2019s celebrate this in";
  addPenguinWatermarks();
  swapScreen();
}

// Stage 3 (the celebration, then the quiet "married since" screen).
function enterStageThree() {
  stage = 3;
  document.body.classList.remove("stage-two");
  document.body.classList.add("stage-three");
  title.removeAttribute("aria-label");
  title.textContent = "Bazil & Irza";
  subtitle.textContent = "are married since";
  loveNote.textContent = "";
  replayLink.hidden = false;
  removePenguinWatermarks();
  swapScreen();
  if (window.Finale) window.Finale.play();
}

function tick() {
  const now = Date.now();

  if (stage === 3) {
    showTime(now - weddingTime);
    return;
  }

  if (now >= celebrationTime) {
    enterStageThree();
    showTime(now - weddingTime);
    return;
  }

  if (now >= weddingTime) {
    if (stage === 1) enterStageTwo();
    const distance = celebrationTime - now;
    showTime(distance);
    // The last ten seconds: the sky darkens and the numbers take over.
    if (distance <= 10000 && window.Finale) {
      window.Finale.countdown(Math.ceil(distance / 1000));
    }
    return;
  }

  const distance = weddingTime - now;
  showTime(distance);
  loveNote.textContent = `${Math.floor(distance / 86400000)} days until I get to call you my home.`;
}

if (window.Finale) {
  // Closing the celebration leaves the quiet "married since" screen behind.
  window.Finale.onClose = () => {
    if (stage === 3) swapScreen();
  };
}

if (replayLink) {
  replayLink.addEventListener("click", () => {
    if (window.Finale) window.Finale.play();
  });
}

tick();
setInterval(tick, 250);
