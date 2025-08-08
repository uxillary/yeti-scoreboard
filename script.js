/**
 * Global configuration for the scoreboard.
 */
const CONFIG = {
  WORKER_URL: "https://yeti-kv-sync.anonymity.workers.dev",
  ADMIN_KEY_STORAGE: "yeti_admin_key",
};

// DOM elements
const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncBtn = document.getElementById("syncBtn");
const banner = document.getElementById("banner");
const adminPanel = document.getElementById("adminPanel");
const adminKeyInput = document.getElementById("adminKey");
const saveAdminKeyBtn = document.getElementById("saveAdminKey");

let scores = [];

/**
 * Display a warning banner.
 */
function showBanner(message) {
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}

/**
 * Validate initial configuration and admin key.
 */
function validateSetup() {
  const urlPattern = /^https:\/\/[\w.-]+\.workers\.dev\/?$/;
  if (!urlPattern.test(CONFIG.WORKER_URL)) {
    console.error("Invalid Worker URL", CONFIG.WORKER_URL);
    showBanner(`Invalid Worker URL: ${CONFIG.WORKER_URL}`);
  }
  if (!localStorage.getItem(CONFIG.ADMIN_KEY_STORAGE)) {
    console.log(
      "Admin key not set. Press Ctrl+Shift+K to open Admin panel and save key."
    );
  }
}

/**
 * Check if the Worker URL is reachable.
 */
async function healthCheck() {
  try {
    await fetch(CONFIG.WORKER_URL, { method: "GET" });
  } catch (err) {
    showBanner(
      `Worker URL unreachable. Check CONFIG.WORKER_URL (${CONFIG.WORKER_URL}) and Cloudflare deployment.`
    );
  }
}

/**
 * Update leaderboard with medal icons.
 */
function updateLeaderboard() {
  leaderboard.innerHTML = "";
  scores
    .sort((a, b) => b.score - a.score)
    .forEach(({ name, score }, index) => {
      const li = document.createElement("li");
      let medal = "";
      if (index === 0) medal = "🥇 ";
      else if (index === 1) medal = "🥈 ";
      else if (index === 2) medal = "🥉 ";
      li.textContent = `${medal}${name}: ${score}`;
      leaderboard.appendChild(li);
    });
}

/**
 * Load scores from Cloudflare KV.
 */
async function loadScores() {
  try {
    const res = await fetch(CONFIG.WORKER_URL, { method: "GET" });
    const data = await res.json();
    scores = Array.isArray(data) ? data : [];
    localStorage.setItem("scores", JSON.stringify(scores));
  } catch (err) {
    console.error("Unable to load scores from KV", err);
    if (err instanceof TypeError) {
      showBanner(
        "If testing from a different origin, temporarily set ALLOWED_ORIGIN='*' in Worker variables or test from the live Pages URL."
      );
    }
    scores = JSON.parse(localStorage.getItem("scores") || "[]");
  }
  updateLeaderboard();
}

/**
 * Sync local scores to KV (admin only).
 */
async function syncScores() {
  const adminKey = localStorage.getItem(CONFIG.ADMIN_KEY_STORAGE) || "";
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
      throw new Error(text || res.statusText);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      showBanner(
        "If testing from a different origin, temporarily set ALLOWED_ORIGIN='*' in Worker variables or test from the live Pages URL."
      );
    }
    alert(`❌ Sync failed: ${err.message}`);
  }
}

// Add score via form
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const score = parseInt(document.getElementById("score").value, 10);
  if (name && !isNaN(score)) {
    scores.push({ name, score });
    localStorage.setItem("scores", JSON.stringify(scores));
    updateLeaderboard();
    form.reset();
  }
});

// Reveal admin panel with Ctrl+Shift+K
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
    adminPanel.classList.toggle("hidden");
  }
});

// Save admin key
saveAdminKeyBtn.addEventListener("click", () => {
  const value = adminKeyInput.value.trim();
  localStorage.setItem(CONFIG.ADMIN_KEY_STORAGE, value);
  alert("Admin key saved.");
  adminPanel.classList.add("hidden");
});

// Wire sync button
syncBtn.addEventListener("click", syncScores);

// Startup sequence
validateSetup();
healthCheck();
loadScores();
