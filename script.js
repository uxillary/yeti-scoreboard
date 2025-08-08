const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");
const WORKER_URL = "https://yeti-sync.uxillary.workers.dev";

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
    const response = await fetch("scores.json", { cache: "no-store" });
    const remoteScores = await response.json();
    const localScores = JSON.parse(localStorage.getItem("scores") || "[]");
    const combined = remoteScores.concat(localScores);
    scores = Array.from(
      new Map(combined.map((s) => [`${s.name}|${s.score}`, s])).values()
    );
    updateLeaderboard();
  } catch (err) {
    console.error("Unable to load scores.json", err);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const score = parseInt(document.getElementById("score").value, 10);
  if (name && !isNaN(score)) {
    const entry = { name, score };
    scores.push(entry);
    const localScores = JSON.parse(localStorage.getItem("scores") || "[]");
    localScores.push(entry);
    localStorage.setItem("scores", JSON.stringify(localScores));
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
  if (localScores.length === 0) {
    alert("\u274C Sync failed: no local scores to sync");
    return;
  }

  try {
    syncStatus.textContent = "Syncing...";
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ scores: localScores, mode: "merge" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      console.error("Upload failed", res.status, data);
      throw new Error(data.error || `Upload failed: ${res.status}`);
    }
    localStorage.removeItem("scores");
    await loadScores();
    syncStatus.textContent = "Synced!";
    alert("\u2705 Synced!");
  } catch (err) {
    console.error("Sync failed", err);
    syncStatus.textContent = `Failed to update: ${err.message}`;
  }
}

syncButton.addEventListener("click", syncScores);

loadScores();
