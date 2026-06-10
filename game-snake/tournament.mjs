// Hybrid vs Monte Carlo 2 tournament. Deterministic: same results every run.
// Usage: node tournament.mjs
// Exits 0 iff Hybrid meets the success bar (more duel wins than losses AND
// clears at least one board solo that Monte Carlo 2 does not).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const shared = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/)[1];

const harness = new Function(`${shared}
function playGame(levelName, role1, role2, cap) {
  const env = new GameEnvironment(gameStateCreate(levelName, role1, role2));
  env.reset();
  const bots = { player1: botForRole(role1), player2: botForRole(role2) };
  while (env.gameState.numberOfSteps < cap && env.stepControlMode !== "reachedTheEnd") {
    const gs = env.gameState;
    for (const [key, opp] of [["player1", "player2"], ["player2", "player1"]]) {
      if (!playerIsBot(gs[key]) || !playerIsAlive(gs[key]) || gs[key].pendingMovement !== "dontMove") continue;
      bots[key] = bots[key].compute(gsLevel(gs), gs[key], gs[opp], gs.foodPosition);
      env.setPendingMovement(key, bots[key].plannedMovement, bots[key].plannedPath);
    }
    env.step({ player1: "dontMove", player2: "dontMove" });
  }
  return env.gameState;
}

// Winner of a duel state: outlive the opponent; both dead or step cap →
// longer snake wins; equal → draw.
function duelWinner(gs) {
  const a1 = playerIsAlive(gs.player1), a2 = playerIsAlive(gs.player2);
  if (a1 && !a2) return "player1";
  if (a2 && !a1) return "player2";
  const l1 = bodyLength(gs.player1.snakeBody), l2 = bodyLength(gs.player2.snakeBody);
  if (l1 > l2) return "player1";
  if (l2 > l1) return "player2";
  return "draw";
}

return { playGame, duelWinner, helpers: { playerIsAlive, bodyLength, getLevel, LEVEL_NAMES } };
`)();

const { playGame, duelWinner, helpers } = harness;
const { playerIsAlive, bodyLength, getLevel, LEVEL_NAMES } = helpers;

const HY = "botHybrid", MC = "botMonteCarlo";
let wins = 0, losses = 0, draws = 0;
const duelRows = [];

console.log("=== Duels: Hybrid vs Monte Carlo 2 (12 levels x 2 seats) ===");
for (const levelName of LEVEL_NAMES) {
  for (const hybridSeat of ["player1", "player2"]) {
    const [role1, role2] = hybridSeat === "player1" ? [HY, MC] : [MC, HY];
    const t0 = Date.now();
    const gs = playGame(levelName, role1, role2, 2000);
    const winner = duelWinner(gs);
    const outcome = winner === "draw" ? "draw" : winner === hybridSeat ? "win" : "loss";
    if (outcome === "win") wins++; else if (outcome === "loss") losses++; else draws++;
    const hybridLen = bodyLength(gs[hybridSeat].snakeBody);
    const mcLen = bodyLength(gs[hybridSeat === "player1" ? "player2" : "player1"].snakeBody);
    duelRows.push({ levelName, hybridSeat, outcome, steps: gs.numberOfSteps, hybridLen, mcLen });
    console.log(
      `${levelName.padEnd(9)} hybrid as ${hybridSeat}  ${outcome.padEnd(4)}  ` +
      `steps ${String(gs.numberOfSteps).padStart(4)}  len ${hybridLen} vs ${mcLen}  (${Date.now() - t0}ms)`);
  }
}
console.log(`\nDuel total: Hybrid ${wins} wins / ${losses} losses / ${draws} draws\n`);

console.log("=== Solo: foods eaten in 1500 steps (board size in cells) ===");
const soloRows = [];
for (const levelName of LEVEL_NAMES) {
  const cells = getLevel(levelName).emptyPositionArray.length;
  const result = {};
  for (const [label, role] of [["hybrid", HY], ["mc2", MC]]) {
    const gs = playGame(levelName, role, "none", 1500);
    const len = bodyLength(gs.player1.snakeBody);
    const cleared = gs.player1.causesOfDeath.includes("noMoreFood");
    const died = !playerIsAlive(gs.player1) && !cleared;
    result[label] = { len, cleared, died, cause: gs.player1.causesOfDeath.join("+") || "alive" };
  }
  soloRows.push({ levelName, cells, ...result });
  const fmt = (r) => `len ${String(r.len).padStart(3)}${r.cleared ? " CLEARED" : r.died ? ` died(${r.cause})` : ""}`;
  console.log(`${levelName.padEnd(9)} (${String(cells).padStart(3)} cells)  hybrid: ${fmt(result.hybrid)}   mc2: ${fmt(result.mc2)}`);
}

const hybridClears = soloRows.filter((r) => r.hybrid.cleared && !r.mc2.cleared).length;
const soloBetter = soloRows.filter((r) => r.hybrid.len > r.mc2.len).length;
console.log(`\nSolo: Hybrid longer on ${soloBetter}/12 levels; cleared ${hybridClears} board(s) MC2 didn't.`);

const pass = wins > losses && hybridClears >= 1;
console.log(`\nSuccess bar (${wins} > ${losses} wins AND >=1 exclusive clear): ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
