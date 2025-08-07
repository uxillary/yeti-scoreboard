const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");

const ownerInput = document.getElementById("owner");
const repoInput = document.getElementById("repo");
const branchInput = document.getElementById("branch");
const tokenInput = document.getElementById("token");
const modeSelect = document.getElementById("mode");

let scores = [];

// Load stored config values
[
  { el: ownerInput, key: "github_owner" },
  { el: repoInput, key: "github_repo" },
  { el: branchInput, key: "github_branch", defaultValue: "main" },
  { el: tokenInput, key: "github_token" },
  { el: modeSelect, key: "github_mode", defaultValue: "merge" },
].forEach(({ el, key, defaultValue }) => {
  const stored = localStorage.getItem(key) || defaultValue || "";
  if (stored) {
    el.value = stored;
  }
  el.addEventListener("input", () => {
    localStorage.setItem(key, el.value);
  });
});

// Blur token field when filled for basic obfuscation
tokenInput.addEventListener("blur", () => {
  if (tokenInput.value) tokenInput.style.filter = "blur(5px)";
});
tokenInput.addEventListener("focus", () => {
  tokenInput.style.filter = "none";
});
if (tokenInput.value) tokenInput.style.filter = "blur(5px)";

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
    const response = await fetch("scores.json");
    const remoteScores = await response.json();
    const localScores = JSON.parse(localStorage.getItem("scores") || "[]");
    scores = remoteScores.concat(localScores);
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

syncButton.addEventListener("click", async () => {
  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const branch = branchInput.value.trim();
  const token = tokenInput.value.trim();
  const mode = modeSelect.value;
  const localScores = JSON.parse(localStorage.getItem("scores") || "[]");

  if (!owner || !repo || !branch || !token) {
    syncStatus.textContent = "Missing GitHub configuration.";
    return;
  }
  if (localScores.length === 0) {
    syncStatus.textContent = "No local scores to sync.";
    return;
  }

  syncStatus.textContent = "Uploading...";
  try {
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/scores.json?ref=${branch}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `token ${token}` },
    });

    let existing = [];
    let sha;
    if (getRes.ok) {
      const file = await getRes.json();
      existing = JSON.parse(atob(file.content));
      sha = file.sha;
    } else if (getRes.status !== 404) {
      throw new Error("Failed to fetch scores.json");
    }

    const updated = mode === "merge" ? existing.concat(localScores) : localScores;
    const encoded = btoa(JSON.stringify(updated, null, 2));

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/scores.json`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        message: "Update scores.json from Yeti Scoreboard",
        content: encoded,
        sha,
        branch,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || "Failed to update");
    }

    syncStatus.textContent = "Upload successful";
  } catch (err) {
    console.error(err);
    syncStatus.textContent = `Failed to update: ${err.message}`;
  }
});

loadScores();
