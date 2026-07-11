const weddingTime = new Date("2026-10-02T22:00:00+05:00").getTime();
const countdown = document.getElementById("countdown");
const weddingDay = document.getElementById("weddingDay");
const loveNote = document.getElementById("loveNote");
const units = {
  days: document.querySelector('[data-unit="days"]'),
  hours: document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};

const pad = (value, length = 2) => String(value).padStart(length, "0");

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

function showWeddingDay() {
  countdown.hidden = true;
  weddingDay.hidden = false;
  document.body.classList.add("is-wedding-day");
}

function updateCountdown() {
  const distance = weddingTime - Date.now();

  if (distance <= 0) {
    showWeddingDay();
    return;
  }

  const totalSeconds = Math.floor(distance / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  updateUnit("days", String(days));
  updateUnit("hours", pad(hours));
  updateUnit("minutes", pad(minutes));
  updateUnit("seconds", pad(seconds));
  loveNote.textContent = `${days} days until I get to call you my home.`;
}

updateCountdown();
setInterval(updateCountdown, 1000);
