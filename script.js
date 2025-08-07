const form = document.getElementById("scoreForm");
const leaderboard = document.getElementById("leaderboard");
const scores = JSON.parse(localStorage.getItem("scores") || "[]");

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

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const score = parseInt(document.getElementById("score").value);
  if (name && !isNaN(score)) {
    scores.push({ name, score });
    localStorage.setItem("scores", JSON.stringify(scores));
    updateLeaderboard();
    form.reset();
  }
});

updateLeaderboard();
