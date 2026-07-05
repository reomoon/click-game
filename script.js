const CHOICES = {
  rock: { emoji: "✊", beats: "scissors" },
  scissors: { emoji: "✌️", beats: "paper" },
  paper: { emoji: "🖐️", beats: "rock" },
};

const myHandEl = document.getElementById("myHand");
const cpuHandEl = document.getElementById("cpuHand");
const resultEl = document.getElementById("resultMessage");
const myScoreEl = document.getElementById("myScore");
const cpuScoreEl = document.getElementById("cpuScore");
const drawScoreEl = document.getElementById("drawScore");
const resetBtn = document.getElementById("resetBtn");

let score = { win: 0, lose: 0, draw: 0 };

function loadScore() {
  const saved = localStorage.getItem("rps-score");
  if (saved) {
    score = JSON.parse(saved);
    updateScoreboard();
  }
}

function saveScore() {
  localStorage.setItem("rps-score", JSON.stringify(score));
}

function updateScoreboard() {
  myScoreEl.textContent = score.win;
  cpuScoreEl.textContent = score.lose;
  drawScoreEl.textContent = score.draw;
}

function randomChoice() {
  const keys = Object.keys(CHOICES);
  return keys[Math.floor(Math.random() * keys.length)];
}

function judge(mine, cpu) {
  if (mine === cpu) return "draw";
  return CHOICES[mine].beats === cpu ? "win" : "lose";
}

function playRound(myChoice) {
  const cpuChoice = randomChoice();
  const outcome = judge(myChoice, cpuChoice);

  myHandEl.textContent = CHOICES[myChoice].emoji;
  cpuHandEl.textContent = CHOICES[cpuChoice].emoji;

  [myHandEl, cpuHandEl].forEach((el) => {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  });

  resultEl.classList.remove("win", "lose", "draw");

  if (outcome === "win") {
    resultEl.textContent = "🎉 이겼어요!";
    resultEl.classList.add("win");
    score.win++;
  } else if (outcome === "lose") {
    resultEl.textContent = "😢 졌어요!";
    resultEl.classList.add("lose");
    score.lose++;
  } else {
    resultEl.textContent = "🤝 비겼어요!";
    resultEl.classList.add("draw");
    score.draw++;
  }

  updateScoreboard();
  saveScore();
}

document.querySelectorAll(".choice-btn").forEach((btn) => {
  btn.addEventListener("click", () => playRound(btn.dataset.choice));
});

resetBtn.addEventListener("click", () => {
  score = { win: 0, lose: 0, draw: 0 };
  updateScoreboard();
  saveScore();
  myHandEl.textContent = "❓";
  cpuHandEl.textContent = "❓";
  resultEl.textContent = "점수가 초기화됐어요!";
  resultEl.classList.remove("win", "lose", "draw");
});

loadScore();
