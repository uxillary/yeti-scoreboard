const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");

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
  const localScores = JSON.parse(localStorage.getItem("scores") || "[]");

  if (localScores.length === 0) {
    syncStatus.textContent = "No local scores to sync.";
    return;
  }

  syncStatus.textContent = "Uploading...";
  try {
    const res = await fetch("https://<worker_url>", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "<ADMIN_SECRET>",
      },
      body: JSON.stringify(localScores),
    });
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {}
    if (!res.ok || !data.success) {
      console.error("Upload failed", res.status, text);
      throw new Error(data.error || `Upload failed: ${res.status} ${text}`);
    }
    localStorage.removeItem("scores");
    await loadScores();
    syncStatus.textContent = "Upload successful";
  } catch (err) {
    console.error("Sync failed", err);
    syncStatus.textContent = `Failed to update: ${err.message}`;
  }
}

syncButton.addEventListener("click", syncScores);

loadScores();
