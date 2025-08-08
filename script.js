/**
 * Global configuration for the scoreboard.
 */
const CONFIG = {
  WORKER_URL: "https://yeti-kv-sync.anonymity.workers.dev",
  ADMIN_KEY: "yeti_38ksL9Q2mA!",
  TOP_N: 10,
  COOLDOWN_MS: 4000,
};

console.log("⚠ Using hardcoded admin key — scoreboard is not secure.");

// DOM elements
const form = document.getElementById("scoreForm");
const nameInput = document.getElementById("name");
const scoreInput = document.getElementById("score");
const submitBtn = form.querySelector("button[type='submit']");
const leaderboard = document.getElementById("leaderboard");
const toggleBtn = document.getElementById("toggleBtn");
const lastUpdatedEl = document.getElementById("lastUpdated");
const syncBtn = document.getElementById("syncBtn");
const banner = document.getElementById("banner");
const statusMessage = document.getElementById("status-message");

let scores = [];
let showAll = false;
let cooldownTimer;
let currentTop;

function showStatus(message, type = "info") {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = type;
  statusMessage.classList.add("show");
  clearTimeout(statusMessage._timeout);
  statusMessage._timeout = setTimeout(() => {
    statusMessage.classList.remove("show");
  }, 4000);
}

function launchConfetti() {
  if (typeof confetti !== "function") return;
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { x: 0.5, y: 0 },
    ticks: 150,
  });
}

function showBanner(message) {
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}
function hideBanner() {
  if (!banner) return;
  banner.classList.add("hidden");
}

async function validateSetup() {
  const valid = CONFIG.WORKER_URL.endsWith(".workers.dev");
  if (!valid) {
    console.error("Invalid Worker URL", CONFIG.WORKER_URL);
    showBanner(
      "Worker unreachable. Check CONFIG.WORKER_URL and Cloudflare deployment."
    );
    return;
  }
  try {
    await fetch(CONFIG.WORKER_URL, {
      method: "GET",
      headers: {
        "x-api-key": CONFIG.ADMIN_KEY,
        "Content-Type": "application/json",
      },
    });
    hideBanner();
  } catch (err) {
    console.error("Worker unreachable", err);
    showBanner(
      "Worker unreachable. Check CONFIG.WORKER_URL and Cloudflare deployment."
    );
  }
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join("");
}
function colorFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${h % 360},70%,70%)`;
}

function displayScore(score) {
  return score % 1 === 0 ? score.toString() : score.toFixed(1);
}

function updateLeaderboard(data = scores) {
  leaderboard.innerHTML = "";
  const me = localStorage.getItem("playerName") || "";
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const limit = showAll ? sorted.length : CONFIG.TOP_N;

  const newTop = sorted[0] ? sorted[0].name : undefined;
  if (currentTop && newTop && newTop !== currentTop) {
    launchConfetti();
  }
  currentTop = newTop;

  sorted.slice(0, limit).forEach((entry, index) => {
    const li = document.createElement("li");
    li.classList.add("fade-in");
    if (entry.name === me) li.classList.add("me");

    const rank =
      index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${
        index + 1
      }`;

    const rankSpan = document.createElement("span");
    rankSpan.textContent = rank;

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.backgroundColor = colorFromName(entry.name);
    avatar.textContent = getInitials(entry.name);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = entry.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "score";
    scoreSpan.textContent = displayScore(entry.score);

    li.append(rankSpan, avatar, nameSpan, scoreSpan);

    if (index === 0) {
      const trophy = document.createElement("span");
      trophy.textContent = "\ud83c\udfc6"; // trophy emoji
      li.appendChild(trophy);
    }

    if (entry.delta && entry.delta > 0) {
      const deltaSpan = document.createElement("span");
      deltaSpan.className = "delta";
      deltaSpan.textContent = `+${displayScore(entry.delta)}`;
      li.appendChild(deltaSpan);
      delete entry.delta;
    }

    if (entry.updated) {
      li.classList.add("score-updated");
      li.addEventListener("animationend", () =>
        li.classList.remove("score-updated")
      );
      delete entry.updated;
    }

    leaderboard.appendChild(li);
  });

  if (toggleBtn) {
    toggleBtn.textContent = showAll ? "Collapse" : "Show all";
    toggleBtn.classList.toggle("hidden", sorted.length <= CONFIG.TOP_N);
  }
}

async function loadScores() {
  try {
    const res = await fetch(CONFIG.WORKER_URL, {
      headers: {
        "x-api-key": CONFIG.ADMIN_KEY,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    scores = Array.isArray(data)
      ? data.map((s) => ({ ...s, score: parseFloat(s.score) }))
      : [];
    localStorage.setItem("scores", JSON.stringify(scores));
    if (lastUpdatedEl) {
      const t = new Date();
      lastUpdatedEl.textContent = `Last updated: ${t.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    updateLeaderboard(scores);
  } catch (err) {
    console.error("Unable to load scores from KV", err);
    const cached = localStorage.getItem("scores");
    if (cached) {
      scores = JSON.parse(cached).map((s) => ({ ...s, score: parseFloat(s.score) }));
      updateLeaderboard(scores);
    }
  }
}

async function syncScores() {
  const localScores = JSON.parse(localStorage.getItem("scores") || "[]").map(
    (s) => ({ ...s, score: parseFloat(s.score) })
  );
  showStatus("Syncing scores...", "info");
  try {
    const res = await fetch(CONFIG.WORKER_URL, {
      method: "POST",
      headers: {
        "x-api-key": CONFIG.ADMIN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(localScores),
    });
    const text = await res.text();
    if (res.ok) {
      showStatus("Scores synced successfully ✅", "success");
    } else {
      console.error("Sync failed", res.status, text);
      showStatus(
        `Sync failed: ${res.status} ${text || res.statusText}`,
        "error"
      );
    }
  } catch (err) {
    console.error("Sync failed", err);
    showStatus(`Sync failed: ${err.message}`, "error");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const score = parseFloat(scoreInput.value);
  if (!name || isNaN(score)) return;

  const existing = scores.find((s) => s.name === name);
  if (existing) {
    if (score > existing.score) {
      existing.delta = parseFloat((score - existing.score).toFixed(1));
      existing.score = score;
      existing.updated = true;
    } else {
      existing.delta = 0;
    }
  } else {
    scores.push({ name, score, delta: 0, updated: true });
  }

  localStorage.setItem("scores", JSON.stringify(scores));
  localStorage.setItem("playerName", name);
  updateLeaderboard(scores);
  showStatus("Score submitted!", "success");

  form.reset();
  nameInput.value = name;

  let remaining = CONFIG.COOLDOWN_MS / 1000;
  submitBtn.disabled = true;
  submitBtn.textContent = `Wait (${remaining})`;
  cooldownTimer = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      submitBtn.textContent = `Wait (${remaining})`;
    } else {
      clearInterval(cooldownTimer);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }, 1000);
});

toggleBtn.addEventListener("click", () => {
  showAll = !showAll;
  updateLeaderboard();
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    syncScores();
  }
});

syncBtn.addEventListener("click", syncScores);

nameInput.value = localStorage.getItem("playerName") || "";

validateSetup();
loadScores();
