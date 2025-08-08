const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncBtn = document.getElementById("syncBtn");
const WORKER_URL = "https://yeti-kv-sync.uxillary.workers.dev";

let scores = [];

function updateLeaderboard() {
  leaderboard.innerHTML = "";
  scores
    .sort((a, b) => b.score - a.score)
    .forEach(({ name, score }) => {
      const li = document.createElement("li");
      li.textContent = `${name}: ${score}`;
      leaderboard.appendChild(li);
    });
}

async function loadScores() {
  try {
    const res = await fetch(WORKER_URL, { cache: "no-store" });
    const data = await res.json();
    scores = Array.isArray(data) ? data : [];
    localStorage.setItem("scores", JSON.stringify(scores));
  } catch (err) {
    console.error("Unable to load scores from KV", err);
    scores = JSON.parse(localStorage.getItem("scores") || "[]");
  }
  updateLeaderboard();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const score = parseInt(document.getElementById("score").value, 10);
  if (name && !isNaN(score)) {
    const entry = { name, score };
    scores.push(entry);
    localStorage.setItem("scores", JSON.stringify(scores));
    updateLeaderboard();
    form.reset();
  }
});

async function syncScores() {
  const apiKey = localStorage.getItem("yeti_admin_key");
  const localScores = JSON.parse(localStorage.getItem("scores") || "[]");

  if (!apiKey) {
    alert("\u274C Sync failed: missing API key");
    return;
  }

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(localScores),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    alert(`\u2705 Synced to KV! Total: ${localScores.length}`);
  } catch (err) {
    alert(`\u274C Sync failed: ${err.message}`);
  }
}

syncBtn.addEventListener("click", syncScores);

loadScores();

