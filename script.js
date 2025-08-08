const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const workerUrl = "https://yeti-sync.<subdomain>.workers.dev";

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
  const apiKey = localStorage.getItem("yeti_admin_key");

  if (localScores.length === 0) {
    alert("❌ Sync failed: no local scores");
    return;
  }
  if (!apiKey) {
    alert("❌ Sync failed: missing API key");
    return;
  }

  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ scores: localScores, mode: "merge" }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }

    localStorage.removeItem("scores");
    await loadScores();
    alert("✅ Synced!");
  } catch (err) {
    alert(`❌ Sync failed: ${err.message}`);
  }
}

syncButton.addEventListener("click", syncScores);

loadScores();
