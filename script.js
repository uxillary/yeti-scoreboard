/**
 * Global configuration for the scoreboard.
 */
const CONFIG = {
  WORKER_URL: "https://yeti-kv-sync.anonymity.workers.dev",
  ADMIN_KEY_STORAGE: "yeti_admin_key",
  TOP_N: 10,
  COOLDOWN_MS: 4000,
};

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
const adminPanel = document.getElementById("adminPanel");
const adminKeyInput = document.getElementById("adminKey");
const saveAdminKeyBtn = document.getElementById("saveAdminKey");

let scores = [];
let showAll = false;
let cooldownTimer;

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
    await fetch(CONFIG.WORKER_URL, { method: "GET" });
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
    scoreSpan.textContent = entry.score;

    li.append(rankSpan, avatar, nameSpan, scoreSpan);

    if (entry.delta && entry.delta > 0) {
      const deltaSpan = document.createElement("span");
      deltaSpan.className = "delta";
      deltaSpan.textContent = `+${entry.delta}`;
      li.appendChild(deltaSpan);
      delete entry.delta;
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
    const res = await fetch(CONFIG.WORKER_URL);
    const data = await res.json();
    scores = Array.isArray(data) ? data : [];
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
      scores = JSON.parse(cached);
      updateLeaderboard(scores);
    }
  }
}

async function syncScores() {
  const adminKey = (localStorage.getItem(CONFIG.ADMIN_KEY_STORAGE) || "").trim();
  if (!adminKey) {
    alert("Admin key not set. Press Ctrl+Shift+K to open Admin panel.");
    return;
  }
  const localScores = JSON.parse(localStorage.getItem("scores") || "[]");
  try {
    const res = await fetch(CONFIG.WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": adminKey,
      },
      body: JSON.stringify(localScores),
    });
    const text = await res.text();
    if (res.ok) {
      alert(`✅ Synced to KV! Total: ${localScores.length}`);
    } else {
      console.error("Sync failed", res.status, text);
      alert(`❌ Sync failed: ${res.status} ${text || res.statusText}`);
    }
  } catch (err) {
    console.error("Sync failed", err);
    alert(`❌ Sync failed: ${err.message}`);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const score = parseInt(scoreInput.value, 10);
  if (!name || isNaN(score)) return;

  const existing = scores.find((s) => s.name === name);
  if (existing) {
    if (score > existing.score) {
      existing.delta = score - existing.score;
      existing.score = score;
    } else {
      existing.delta = 0;
    }
  } else {
    scores.push({ name, score, delta: 0 });
  }

  localStorage.setItem("scores", JSON.stringify(scores));
  localStorage.setItem("playerName", name);
  updateLeaderboard(scores);

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
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
    const hidden = adminPanel.style.display === "none";
    adminPanel.style.display = hidden ? "flex" : "none";
    if (hidden) {
      adminKeyInput.value =
        localStorage.getItem(CONFIG.ADMIN_KEY_STORAGE) || "";
      adminKeyInput.focus();
    }
  }
  if (e.ctrlKey && e.key === "Enter") {
    syncScores();
  }
});

saveAdminKeyBtn.addEventListener("click", () => {
  const value = adminKeyInput.value.trim();
  localStorage.setItem(CONFIG.ADMIN_KEY_STORAGE, value);
  alert("Admin key saved.");
  adminPanel.style.display = "none";
});

syncBtn.addEventListener("click", syncScores);

nameInput.value = localStorage.getItem("playerName") || "";

validateSetup();
loadScores();
