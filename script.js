const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");

let scores = [];

function getRepoDetails() {
  const owner = window.location.hostname.split(".")[0];
  let repo = window.location.pathname.split("/")[1];
  if (!repo) repo = `${owner}.github.io`;
  return { owner, repo };
}

function getToken() {
  let token = localStorage.getItem("github_token");
  if (!token) {
    token = prompt("Enter GitHub token:");
    if (token) {
      localStorage.setItem("github_token", token);
    }
  }
  return token;
}

function dedupe(arr) {
  const map = new Map();
  arr.forEach(({ name, score }) => {
    map.set(`${name}-${score}`, { name, score });
  });
  return Array.from(map.values());
}

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
    scores = dedupe(remoteScores.concat(localScores));
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
  const token = getToken();
  if (!token) {
    syncStatus.textContent = "Token required.";
    return;
  }

  const localScores = JSON.parse(localStorage.getItem("scores") || "[]");
  if (localScores.length === 0) {
    syncStatus.textContent = "No local scores to sync.";
    return;
  }

  const { owner, repo } = getRepoDetails();
  const branch = "main";

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

    const updated = dedupe(existing.concat(localScores));
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
