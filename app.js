let appState = readState();
const STORAGE_KEY = "math-arena-state-v1";
const PLAYER_ID_KEY = "math-arena-player-id";
const ROOM_ID_KEY = "math-arena-room-id";

const ui = {
  authCard: document.getElementById("authCard"),
  lobbyCard: document.getElementById("lobbyCard"),
  roomCard: document.getElementById("roomCard"),
  gameCard: document.getElementById("gameCard"),
  leaderboardCard: document.getElementById("leaderboardCard"),
  historyCard: document.getElementById("historyCard"),
  playerBadge: document.getElementById("playerBadge"),
  loginForm: document.getElementById("loginForm"),
  playerNameInput: document.getElementById("playerNameInput"),
  difficultySelect: document.getElementById("difficultySelect"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinCodeInput: document.getElementById("joinCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomList: document.getElementById("roomList"),
  roomMeta: document.getElementById("roomMeta"),
  roomPlayersList: document.getElementById("roomPlayersList"),
  startMatchBtn: document.getElementById("startMatchBtn"),
  matchStatus: document.getElementById("matchStatus"),
  questionBox: document.getElementById("questionBox"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  scoreList: document.getElementById("scoreList"),
  leaderboardList: document.getElementById("leaderboardList"),
  historyList: document.getElementById("historyList")
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    appState = readState();
    render();
  }
});

function init() {
  bindEvents();
  render();
}

function bindEvents() {
  ui.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = ui.playerNameInput.value.trim();
    if (!name) return;
    loginPlayer(name);
  });

  ui.createRoomBtn.addEventListener("click", () => {
    if (!getCurrentPlayer()) {
      alert("Please enter your name first.");
      return;
    }
    createRoom(ui.difficultySelect.value);
  });

  ui.joinRoomBtn.addEventListener("click", () => {
    if (!getCurrentPlayer()) {
      alert("Please enter your name first.");
      return;
    }
    const code = ui.joinCodeInput.value.trim().toUpperCase();
    if (!code) {
      alert("Enter a room code.");
      return;
    }
    joinRoom(code);
  });

  ui.startMatchBtn.addEventListener("click", () => {
    const room = getCurrentRoom();
    if (!room) return;
    startMatch(room.id);
  });

  ui.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = ui.answerInput.value.trim();
    if (!value) return;
    submitAnswer(value);
    ui.answerInput.value = "";
  });
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return JSON.parse(raw);
  } catch (error) {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    players: {},
    rooms: {}
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  render();
}

function getCurrentPlayerId() {
  return localStorage.getItem(PLAYER_ID_KEY) || null;
}

function setCurrentPlayerId(playerId) {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
}

function setCurrentRoomId(roomId) {
  if (roomId) {
    localStorage.setItem(ROOM_ID_KEY, roomId);
  } else {
    localStorage.removeItem(ROOM_ID_KEY);
  }
}

function getCurrentPlayer() {
  const playerId = getCurrentPlayerId();
  if (!playerId) return null;
  return appState.players[playerId] || null;
}

function getCurrentRoomId() {
  return localStorage.getItem(ROOM_ID_KEY) || null;
}

function getCurrentRoom() {
  const roomId = getCurrentRoomId();
  if (!roomId) return null;
  return appState.rooms[roomId] || null;
}

function loginPlayer(name) {
  let playerId = getCurrentPlayerId();
  if (!playerId || !appState.players[playerId]) {
    playerId = createPlayer(name);
    setCurrentPlayerId(playerId);
  } else {
    appState.players[playerId].name = name;
  }

  ui.playerNameInput.value = name;
  saveState();
}

function createPlayer(name) {
  const id = `player_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  appState.players[id] = {
    id,
    name,
    rating: 1000,
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    bestStreak: 0,
    currentStreak: 0,
    matchHistory: []
  };
  return id;
}

function createRoom(difficulty) {
  const player = getCurrentPlayer();
  if (!player) return;

  const roomId = generateRoomCode();
  appState.rooms[roomId] = {
    id: roomId,
    hostId: player.id,
    difficulty,
    status: "waiting",
    targetScore: 20,
    players: [player.id],
    winnerId: null,
    createdAt: Date.now(),
    currentQuestion: null,
    game: null
  };

  setCurrentRoomId(roomId);
  saveState();
}

function joinRoom(roomCode) {
  const room = appState.rooms[roomCode];
  const player = getCurrentPlayer();
  if (!room || !player) return;
  if (room.status !== "waiting") {
    alert("This room is no longer accepting players.");
    return;
  }
  if (room.players.includes(player.id)) {
    setCurrentRoomId(room.id);
    saveState();
    return;
  }
  if (room.players.length >= 4) {
    alert("This room is full.");
    return;
  }

  room.players.push(player.id);
  setCurrentRoomId(room.id);
  saveState();
}

function startMatch(roomId) {
  const room = appState.rooms[roomId];
  const player = getCurrentPlayer();
  if (!room || !player) return;
  if (room.hostId !== player.id) {
    alert("Only the host can start the match.");
    return;
  }
  if (room.players.length < 2) {
    alert("At least 2 players are needed to start a match.");
    return;
  }

  room.status = "playing";
  room.winnerId = null;
  room.currentQuestion = buildQuestion(room.difficulty);
  room.game = {
    round: 1,
    players: {}
  };

  for (const playerId of room.players) {
    room.game.players[playerId] = {
      score: 0,
      correct: 0,
      streak: 0,
      answeredThisRound: false
    };
  }

  saveState();
}

function submitAnswer(rawValue) {
  const room = getCurrentRoom();
  const player = getCurrentPlayer();
  if (!room || !player || room.status !== "playing") return;
  if (!room.players.includes(player.id)) return;

  const playerGame = room.game?.players[player.id];
  if (!playerGame || playerGame.answeredThisRound) return;

  const parsed = Number(rawValue);
  const isCorrect = Number.isFinite(parsed) && Math.abs(parsed - room.currentQuestion.answer) < 0.000001;

  if (isCorrect) {
    playerGame.score += room.currentQuestion.points;
    playerGame.correct += 1;
    playerGame.streak += 1;
    const currentStreak = playerGame.streak;
    const playerRecord = appState.players[player.id];
    playerRecord.currentStreak = currentStreak;
    playerRecord.bestStreak = Math.max(playerRecord.bestStreak || 0, currentStreak);
  } else {
    playerGame.streak = 0;
  }

  playerGame.answeredThisRound = true;

  if (checkWinner(room, player.id)) {
    saveState();
    return;
  }

  const answeredPlayers = room.players.filter((pid) => room.game.players[pid].answeredThisRound);
  if (answeredPlayers.length === room.players.length) {
    advanceRound(room.id);
  }

  saveState();
}

function advanceRound(roomId) {
  const room = appState.rooms[roomId];
  if (!room || room.status !== "playing") return;

  room.game.round += 1;
  room.currentQuestion = buildQuestion(room.difficulty);
  for (const playerId of room.players) {
    room.game.players[playerId].answeredThisRound = false;
  }
}

function checkWinner(room, playerId) {
  const playerGame = room.game.players[playerId];
  if (!playerGame) return false;

  if (playerGame.score >= room.targetScore) {
    finishMatch(room.id, playerId);
    return true;
  }

  return false;
}

function finishMatch(roomId, winnerId) {
  const room = appState.rooms[roomId];
  if (!room) return;

  room.status = "finished";
  room.winnerId = winnerId;
  room.game = room.game || { players: {} };

  for (const playerId of room.players) {
    const playerRecord = appState.players[playerId];
    const score = room.game.players[playerId]?.score || 0;
    const didWin = playerId === winnerId;

    playerRecord.matchesPlayed += 1;
    playerRecord.currentStreak = didWin ? (playerRecord.currentStreak || 0) + 1 : 0;
    playerRecord.bestStreak = Math.max(playerRecord.bestStreak || 0, playerRecord.currentStreak);

    if (didWin) {
      playerRecord.wins += 1;
      playerRecord.rating += 50;
    } else {
      playerRecord.losses += 1;
      playerRecord.rating = Math.max(0, playerRecord.rating - 20);
    }

    const entry = {
      roomId: room.id,
      difficulty: room.difficulty,
      result: didWin ? "Win" : "Loss",
      score,
      timestamp: Date.now(),
      opponent: winnerId
    };

    playerRecord.matchHistory.unshift(entry);
    if (playerRecord.matchHistory.length > 8) {
      playerRecord.matchHistory.pop();
    }
  }
}

function buildQuestion(difficulty) {
  const config = {
    easy: { max: 12, ops: ["+", "-"] },
    medium: { max: 25, ops: ["+", "-", "*"] },
    hard: { max: 50, ops: ["+", "-", "*", "/"] }
  };

  const level = config[difficulty] || config.easy;
  const op = level.ops[Math.floor(Math.random() * level.ops.length)];
  let a = rand(1, level.max);
  let b = rand(1, level.max);
  let answer = 0;
  let prompt = "";

  if (op === "+") {
    answer = a + b;
    prompt = `${a} + ${b}`;
  }

  if (op === "-") {
    if (a < b) [a, b] = [b, a];
    answer = a - b;
    prompt = `${a} - ${b}`;
  }

  if (op === "*") {
    a = rand(2, level.max / 2);
    b = rand(2, level.max / 2);
    answer = a * b;
    prompt = `${a} * ${b}`;
  }

  if (op === "/") {
    b = rand(2, 10);
    answer = rand(2, 12);
    a = answer * b;
    prompt = `${a} / ${b}`;
  }

  return {
    prompt,
    answer,
    points: op === "*" ? 3 : op === "/" ? 4 : 2
  };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRankLabel(rating) {
  if (rating >= 2000) return "Diamond";
  if (rating >= 1700) return "Platinum";
  if (rating >= 1400) return "Gold";
  if (rating >= 1100) return "Silver";
  return "Bronze";
}

function render() {
  const player = getCurrentPlayer();
  const room = getCurrentRoom();

  ui.authCard.classList.toggle("hidden", Boolean(player));
  ui.lobbyCard.classList.toggle("hidden", !player);
  ui.roomCard.classList.toggle("hidden", !player || !room);
  ui.gameCard.classList.toggle("hidden", !player || !room);
  ui.leaderboardCard.classList.toggle("hidden", !player);
  ui.historyCard.classList.toggle("hidden", !player);

  if (player) {
    const rank = getRankLabel(player.rating);
    ui.playerBadge.textContent = `${player.name} • ${rank}`;
    ui.playerNameInput.value = player.name;
  }

  renderRoomList();
  renderRoom();
  renderGame();
  renderLeaderboard();
  renderHistory();
}

function renderRoomList() {
  const player = getCurrentPlayer();
  if (!player) {
    ui.roomList.innerHTML = "";
    return;
  }

  const rooms = Object.values(appState.rooms)
    .filter((room) => room.status === "waiting")
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!rooms.length) {
    ui.roomList.innerHTML = "<li class='room-item'><strong>No open rooms</strong><small>Create one to start a match.</small></li>";
    return;
  }

  ui.roomList.innerHTML = rooms
    .map((room) => `
      <li class="room-item">
        <strong>${room.id}</strong>
        <small>${room.players.length}/4 players • ${room.difficulty}</small>
        <small>Host: ${appState.players[room.hostId]?.name || "Unknown"}</small>
      </li>
    `)
    .join("");
}

function renderRoom() {
  const room = getCurrentRoom();
  const player = getCurrentPlayer();
  if (!room || !player) {
    ui.roomMeta.textContent = "No room selected";
    ui.roomPlayersList.innerHTML = "";
    return;
  }

  const hostName = appState.players[room.hostId]?.name || "Unknown";
  ui.roomMeta.textContent = `Room ${room.id} • Difficulty: ${room.difficulty} • Target: ${room.targetScore} • Host: ${hostName}`;

  ui.roomPlayersList.innerHTML = room.players
    .map((playerId) => {
      const record = appState.players[playerId];
      return `
        <li class="score-item">
          <strong>${record.name}${playerId === room.hostId ? " (Host)" : ""}</strong>
          <small>Rating: ${record.rating}</small>
        </li>
      `;
    })
    .join("");

  ui.startMatchBtn.disabled = room.hostId !== player.id || room.status !== "waiting" || room.players.length < 2;
  ui.startMatchBtn.textContent = room.status === "waiting" ? "Start match" : room.status === "playing" ? "Match running" : "Match ended";
}

function renderGame() {
  const room = getCurrentRoom();
  const player = getCurrentPlayer();
  if (!room || !player) {
    ui.matchStatus.textContent = "Waiting for a match";
    ui.questionBox.textContent = "Waiting...";
    ui.scoreList.innerHTML = "";
    return;
  }

  if (room.status === "waiting") {
    ui.matchStatus.textContent = "Room ready";
    ui.questionBox.textContent = "Waiting for host";
  }

  if (room.status === "finished") {
    const winner = appState.players[room.winnerId];
    ui.matchStatus.textContent = winner ? `${winner.name} wins!` : "Match finished";
    ui.questionBox.textContent = "Match over";
  }

  if (room.status === "playing") {
    ui.matchStatus.textContent = `Round ${room.game.round} • ${room.difficulty}`;
    const currentQuestion = room.currentQuestion;
    if (currentQuestion) {
      ui.questionBox.textContent = currentQuestion.prompt;
    }
  }

  if (!room.game) {
    ui.scoreList.innerHTML = "";
    return;
  }

  ui.scoreList.innerHTML = room.players
    .map((playerId) => {
      const record = appState.players[playerId];
      const playerGame = room.game.players[playerId];
      return `
        <li class="score-item">
          <strong>${record.name}</strong>
          <small>Score: ${playerGame.score} • Correct: ${playerGame.correct}</small>
        </li>
      `;
    })
    .join("");
}

function renderLeaderboard() {
  const player = getCurrentPlayer();
  if (!player) {
    ui.leaderboardList.innerHTML = "";
    return;
  }

  const players = Object.values(appState.players).sort((a, b) => b.rating - a.rating);
  ui.leaderboardList.innerHTML = players
    .map((entry, index) => `
      <li class="leaderboard-item">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="rank-badge">${index + 1}</span>
          <div>
            <strong>${entry.name}</strong>
            <div class="tag">${getRankLabel(entry.rating)}</div>
          </div>
        </div>
        <strong>${entry.rating}</strong>
      </li>
    `)
    .join("");
}

function renderHistory() {
  const player = getCurrentPlayer();
  if (!player) {
    ui.historyList.innerHTML = "";
    return;
  }

  const history = player.matchHistory || [];
  if (!history.length) {
    ui.historyList.innerHTML = "<li class='history-item'><strong>No matches yet</strong><small>Start a room and play rounds to track your progress.</small></li>";
    return;
  }

  ui.historyList.innerHTML = history
    .slice(0, 6)
    .map((entry) => `
      <li class="history-item">
        <strong>${entry.result} • ${entry.difficulty}</strong>
        <small>Score: ${entry.score} • ${new Date(entry.timestamp).toLocaleString()}</small>
      </li>
    `)
    .join("");
}

function getPlayerNameFromId(playerId) {
  return appState.players[playerId]?.name || "Unknown";
}
