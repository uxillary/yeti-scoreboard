const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");

const githubConfig = {
  owner: "your-owner",
  repo: "your-repo",
  branch: "main",
  token: "your-token",
};

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
    const response = await fetch("scores.json");
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

syncButton.addEventListener("click", async () => {
  const { owner, repo, branch, token } = githubConfig;
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

    const combined = existing.concat(localScores);
    const unique = Array.from(
      new Map(combined.map((s) => [`${s.name}|${s.score}`, s])).values()
    );
    const encoded = btoa(JSON.stringify(unique, null, 2));

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/scores.json`,
      {
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
      }
    );

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
