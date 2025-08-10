/**
 * Global configuration for the scoreboard.
 */
const CONFIG = {
  WORKER_URL: "https://yeti-kv-sync.anonymity.workers.dev",
  ADMIN_KEY: "yeti_38ksL9Q2mA!",
  TOP_N: 10,
  COOLDOWN_MS: 4000,
  REFRESH_MS: 60000,
};

console.log("⚠ Using hardcoded admin key — scoreboard is not secure.");

// DOM elements
const form = document.getElementById("scoreForm");
const nameInput = document.getElementById("name");
const scoreInput = document.getElementById("score");
const submitBtn = document.getElementById("submitBtn");
const leaderboard = document.getElementById("leaderboard");
const toggleBtn = document.getElementById("toggleBtn");
const lastUpdatedEl = document.getElementById("lastUpdated");
const syncBtn = document.getElementById("syncBtn");
const banner = document.getElementById("banner");
const statusEl = document.getElementById("status");

let scores = [];
let showAll = false;
let cooldownTimer;
let previousLeaderName;

// simple score formatter
const fmt = (s) => (s % 1 === 0 ? String(s) : s.toFixed(1));

/**
 * Display status messages without popups.
 */
function setStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = type + " show";
  clearTimeout(statusEl._timeout);
  statusEl._timeout = setTimeout(() => {
    statusEl.classList.remove("show");
  }, 4000);
}

// toggle spinner inside buttons
function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("loading", loading);
}

function launchConfetti() {
  if (typeof confetti !== "function") return;
  confetti({
    particleCount: 160,
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

function updateLeaderboard(data = scores) {
  leaderboard.innerHTML = "";
  const me = localStorage.getItem("playerName") || "";
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const limit = showAll ? sorted.length : CONFIG.TOP_N;

  // determine ties
  const ties = new Set();
  sorted.forEach((e, i) => {
    if (i > 0 && e.score === sorted[i - 1].score) {
      ties.add(e.name);
      ties.add(sorted[i - 1].name);
    }
  });

  sorted.slice(0, limit).forEach((entry, index) => {
    const li = document.createElement("li");
    li.classList.add("fade-in");
    if (index === 0) li.classList.add("first");
    if (entry.name === me) li.classList.add("me");

    const rank =
      index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${
        index + 1
      }`;

    // icons column
    const icons = document.createElement("div");
    icons.className = "icons";

    const rankSpan = document.createElement("span");
    rankSpan.textContent = rank;

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.backgroundColor = colorFromName(entry.name);
    avatar.textContent = getInitials(entry.name);

    icons.append(rankSpan, avatar);

    // name + delta
    const nameWrap = document.createElement("div");
    nameWrap.className = "namewrap";

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = entry.name;
    if (ties.has(entry.name)) {
      const tie = document.createElement("span");
      tie.className = "tie-badge";
      tie.textContent = "tie";
      nameSpan.appendChild(tie);
    }

    const deltaSlot = document.createElement("span");
    deltaSlot.className = "delta-slot";
    const deltaFx = document.createElement("span");
    deltaFx.className = "delta-fx";
    deltaFx.setAttribute("aria-hidden", "true");
    deltaSlot.appendChild(deltaFx);

    nameWrap.append(nameSpan, deltaSlot);

    // score column
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "score";

    const scoreNum = document.createElement("span");
    scoreNum.className = "score-num";
    scoreNum.textContent = fmt(entry.score);
    scoreDiv.appendChild(scoreNum);

    if (index === 0) {
      const trophy = document.createElement("span");
      trophy.className = "trophy";
      trophy.textContent = "🏆";
      scoreDiv.appendChild(trophy);
    }

    li.append(icons, nameWrap, scoreDiv);

    if (entry.delta && entry.delta > 0) {
      deltaFx.textContent = `+${fmt(entry.delta)}`;
      deltaFx.classList.remove("show");
      setTimeout(() => {
        deltaFx.classList.add("show");
      }, 500);
      deltaFx.addEventListener(
        "animationend",
        () => {
          deltaFx.classList.remove("show");
          deltaFx.textContent = "";
        },
        { once: true }
      );
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
    const newScores = Array.isArray(data)
      ? data.map((s) => ({ ...s, score: parseFloat(s.score) }))
      : [];

    // diff against existing scores
    const oldMap = new Map(scores.map((s) => [s.name, s.score]));
    newScores.forEach((s) => {
      const prev = oldMap.get(s.name);
      if (prev === undefined || prev !== s.score) s.updated = true;
    });

    scores = newScores;
    localStorage.setItem("scores", JSON.stringify(scores));
    if (lastUpdatedEl) {
      const t = new Date();
      lastUpdatedEl.textContent = `Last updated: ${t.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    updateLeaderboard(scores);
    checkLeaderChange(scores);
  } catch (err) {
    console.error("Unable to load scores from KV", err);
    const cached = localStorage.getItem("scores");
    if (cached) {
      scores = JSON.parse(cached).map((s) => ({ ...s, score: parseFloat(s.score) }));
      updateLeaderboard(scores);
    }
  }
}

/**
 * POST the current scores array to the Worker.
 */
async function postScores(data) {
  const res = await fetch(CONFIG.WORKER_URL, {
    method: "POST",
    headers: {
      "x-api-key": CONFIG.ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}

async function syncScores() {
  setStatus("Syncing...", "info");
  setLoading(syncBtn, true);
  try {
    await postScores(scores);
    setStatus("Scores synced ✅", "success");
    checkLeaderChange(scores);
  } catch (err) {
    console.error("Sync failed", err);
    setStatus(`Sync failed: ${err.message}`, "error");
  } finally {
    setLoading(syncBtn, false);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const scoreStr = scoreInput.value.trim();
  const score = parseFloat(scoreStr);
  const valid = /^\d{1,4}(\.\d)?$/.test(scoreStr);
  if (!name || !valid || isNaN(score) || score < 0 || score > 2000) {
    setStatus("Invalid input", "error");
    scoreInput.focus();
    return;
  }

  const prev = scores.map((s) => ({ ...s }));
  const existing = scores.find((s) => s.name === name);
  if (existing) {
    if (score > existing.score) {
      existing.delta = parseFloat(fmt(score - existing.score));
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

  setStatus("Syncing...", "info");
  setLoading(submitBtn, true);
  try {
    await postScores(scores);
    setStatus("Scores synced ✅", "success");
    checkLeaderChange(scores);
  } catch (err) {
    console.error("Submit failed", err);
    scores = prev;
    localStorage.setItem("scores", JSON.stringify(scores));
    updateLeaderboard(scores);
    setStatus(`Sync failed: ${err.message}`, "error");
  } finally {
    setLoading(submitBtn, false);
    form.reset();
    nameInput.value = name;
    scoreInput.focus();
    startCooldown();
  }
});

function startCooldown() {
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
}

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
  setInterval(loadScores, CONFIG.REFRESH_MS);

function checkLeaderChange(data) {
  const leader = data[0] ? data[0].name : undefined;
  if (previousLeaderName && leader && leader !== previousLeaderName) {
    launchConfetti();
  }
  previousLeaderName = leader;
}
