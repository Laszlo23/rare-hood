/** Tile stealth simulation for Rare Hood. Rewards stay outside this module. */

export type Vec = Readonly<{ x: number; y: number }>;
export type Facing = "down" | "up" | "left" | "right";
export type BeamHue = "cyan" | "amber" | "magenta";

export type GuardDef = Readonly<{
  routes: readonly (readonly Vec[])[];
  speed: number;
  beamLength: number;
  beamHalf: number;
  rerouteEvery: number;
  hue: BeamHue;
}>;

export type Level = Readonly<{
  id: number;
  name: string;
  blurb: string;
  enterLabel: string;
  payout: number;
  limit: number;
  rows: readonly string[];
  spawn: Vec;
  exit: Vec;
  pouches: readonly Vec[];
  guards: readonly GuardDef[];
}>;

export type CatchCause = "beam" | "bump" | "clock";

export type CatchReport = {
  cause: CatchCause;
  hue: BeamHue | null;
  sneaking: boolean;
  looking: boolean;
  pouchesLeft: number;
  clock: number;
  limit: number;
};

export type DutyMode = "go" | "look" | "back";

export type GuardDuty = {
  mode: DutyMode;
  path: Vec[];
  cursor: number;
  look: number;
  base: number;
};

export type Guard = {
  x: number;
  y: number;
  facing: number;
  routeIndex: number;
  cursor: number;
  dir: 1 | -1;
  rerouteIn: number;
  speed: number;
  beamLength: number;
  beamHalf: number;
  rerouteEvery: number;
  hue: BeamHue;
  routes: Vec[][];
  duty: GuardDuty | null;
};

export type CoinFlight = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dur: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
};

export type Sim = {
  level: Level;
  x: number;
  y: number;
  facing: Facing;
  side: "left" | "right";
  walking: boolean;
  frame: number;
  anim: number;
  alert: number;
  alertLatch: boolean;
  taken: boolean[];
  guards: Guard[];
  particles: Particle[];
  shake: number;
  time: number;
  clock: number;
  hurryLatch: boolean;
  caught: boolean;
  catch: CatchReport | null;
  escaped: boolean;
  purse: number;
  flight: CoinFlight | null;
  aim: Vec | null;
  aimGuard: number;
  lure: Vec | null;
  lureLife: number;
  spotted: boolean;
};

export type Input = {
  x: number;
  y: number;
  sneak: boolean;
  steal: boolean;
  aim: Vec | null;
  throwCoin: boolean;
};

export type StepResult = Readonly<{
  stole: boolean;
  caught: boolean;
  escaped: boolean;
  alerted: boolean;
  hurried: boolean;
  threw: boolean;
  called: boolean;
}>;

const CASTLE_LIMITS = [90, 75, 62, 52, 44] as const;

export function castleLimit(levelId: number): number {
  const limit = CASTLE_LIMITS[levelId - 1];
  if (limit === undefined) throw new Error(`No clock for castle ${levelId}.`);
  return limit;
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function speedBonus(secondsLeft: number): number {
  return Math.floor(Math.max(0, secondsLeft) / 10);
}

export function catchTitle(report: CatchReport): string {
  switch (report.cause) {
    case "beam":
      return "The beam filled";
    case "bump":
      return "You touched a guard";
    case "clock":
      return "The clock ran out";
    default: {
      const never: never = report.cause;
      return never;
    }
  }
}

export function catchLine(report: CatchReport): string {
  const hue = report.hue ?? "nearest";
  switch (report.cause) {
    case "bump":
      if (report.looking) return `The ${hue} guard was checking your coin, and you stepped into them.`;
      return `You walked into the ${hue} guard. The beam never had to finish filling.`;
    case "beam":
      if (report.looking && report.sneaking) return `The ${hue} guard came to look. Sneaking slowed that beam, and it still filled the meter.`;
      if (report.looking) return `The ${hue} guard came to look, and their beam stayed on you until the meter filled.`;
      if (report.sneaking) return `The ${hue} beam stayed on you. Sneaking only slows the meter, and it still filled.`;
      return `The ${hue} beam held you in the open until the alert meter filled.`;
    case "clock":
      if (report.pouchesLeft === 0) return "Every pouch was already yours. The gate was still ahead when the clock hit zero.";
      if (report.pouchesLeft === 1) return "One pouch was still in the castle when the clock hit zero.";
      return `${report.pouchesLeft} pouches were still in the castle when the clock hit zero.`;
    default: {
      const never: never = report.cause;
      return never;
    }
  }
}

const THROW_RANGE = 5.4;
const HEAR_RANGE = 7.4;
const LOOK_TIME = 1.8;

const PLAYER_RADIUS = 0.18;
const STEAL_REACH = 0.92;
const EXIT_REACH = 0.62;
const GUARD_TOUCH = 0.42;

export function cell(col: number, row: number): Vec {
  return { x: col + 0.5, y: row + 0.5 };
}

export function solidChar(ch: string | undefined): boolean {
  return ch === "#" || ch === "P" || ch === "C";
}

export function solidAt(rows: readonly string[], x: number, y: number): boolean {
  const col = Math.floor(x);
  const row = Math.floor(y);
  const line = rows[row];
  if (!line || col < 0 || col >= line.length) return true;
  return solidChar(line[col]);
}

export function blocked(rows: readonly string[], x: number, y: number, radius = PLAYER_RADIUS): boolean {
  const points: readonly Vec[] = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ];
  return points.some(point => solidAt(rows, point.x, point.y));
}

export function rayHit(rows: readonly string[], x: number, y: number, angle: number, maxDist: number): Vec {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const steps = Math.max(1, Math.ceil(maxDist / 0.1));
  let px = x;
  let py = y;
  for (let i = 1; i <= steps; i += 1) {
    const dist = (maxDist * i) / steps;
    const nx = x + dx * dist;
    const ny = y + dy * dist;
    if (solidAt(rows, nx, ny)) return { x: px, y: py };
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

export function guardSees(rows: readonly string[], guard: Guard, x: number, y: number): boolean {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05 || dist > guard.beamLength) return false;
  let delta = Math.atan2(dy, dx) - guard.facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) > guard.beamHalf) return false;
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (solidAt(rows, guard.x + dx * t, guard.y + dy * t)) return false;
  }
  return true;
}

function samePoint(a: Vec, b: Vec): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

function segmentClear(rows: readonly string[], a: Vec, b: Vec): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (solidAt(rows, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

function faceGuard(guard: Guard) {
  const target = guard.routes[guard.routeIndex]?.[guard.cursor];
  if (!target) return;
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  if (Math.hypot(dx, dy) > 0.001) guard.facing = Math.atan2(dy, dx);
}

function arrive(guard: Guard) {
  const route = guard.routes[guard.routeIndex];
  if (!route) return;
  const next = guard.cursor + guard.dir;
  if (next >= 0 && next < route.length) {
    guard.cursor = next;
    faceGuard(guard);
    return;
  }
  if (guard.dir === 1) {
    guard.dir = -1;
    guard.cursor = Math.max(0, route.length - 2);
    faceGuard(guard);
    return;
  }
  guard.dir = 1;
  if (guard.rerouteIn <= 0 && guard.routes.length > 1) {
    guard.routeIndex = (guard.routeIndex + 1) % guard.routes.length;
    guard.rerouteIn = guard.rerouteEvery;
  }
  const chosen = guard.routes[guard.routeIndex];
  guard.cursor = chosen && chosen.length > 1 ? 1 : 0;
  faceGuard(guard);
}

export function coinsFor(levelId: number): number {
  return 2 + Math.min(3, levelId);
}

export function landingSpot(rows: readonly string[], from: Vec, to: Vec): Vec | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.55) return null;
  const reach = Math.min(dist, THROW_RANGE);
  const steps = Math.max(1, Math.ceil(reach / 0.12));
  let last: Vec | null = null;
  for (let i = 1; i <= steps; i += 1) {
    const point = { x: from.x + (dx / dist) * ((reach * i) / steps), y: from.y + (dy / dist) * ((reach * i) / steps) };
    if (solidAt(rows, point.x, point.y)) break;
    last = point;
  }
  return last;
}

export function hearer(guards: readonly Guard[], spot: Vec): number {
  let best = -1;
  let bestDist = HEAR_RANGE;
  guards.forEach((guard, index) => {
    const dist = Math.hypot(guard.x - spot.x, guard.y - spot.y);
    if (dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function pathBetween(rows: readonly string[], from: Vec, to: Vec): Vec[] {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  if (width < 1) return [];
  const key = (col: number, row: number) => row * width + col;
  const start = key(Math.floor(from.x), Math.floor(from.y));
  const goal = key(Math.floor(to.x), Math.floor(to.y));
  const previous = new Map<number, number>();
  const queue = [start];
  previous.set(start, -1);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined || current === goal) break;
    const col = current % width;
    const row = Math.floor(current / width);
    const nextCells = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];
    for (const [nextCol, nextRow] of nextCells) {
      if (nextCol === undefined || nextRow === undefined) continue;
      if (nextCol < 0 || nextRow < 0 || nextCol >= width || nextRow >= height) continue;
      const nextKey = key(nextCol, nextRow);
      if (previous.has(nextKey)) continue;
      if (solidChar(rows[nextRow]?.[nextCol])) continue;
      previous.set(nextKey, current);
      queue.push(nextKey);
    }
  }
  if (!previous.has(goal)) return [];
  const points: Vec[] = [];
  let cursor = goal;
  while (cursor !== -1) {
    points.push(cell(cursor % width, Math.floor(cursor / width)));
    cursor = previous.get(cursor) ?? -1;
  }
  points.reverse();
  if (points.length > 0) {
    points[0] = { x: from.x, y: from.y };
    points[points.length - 1] = { x: to.x, y: to.y };
  }
  return points;
}

function nearestStop(guard: Guard): Vec {
  const route = guard.routes[guard.routeIndex] ?? [];
  let best = route[0] ?? { x: guard.x, y: guard.y };
  let bestDist = Infinity;
  let bestIndex = 0;
  route.forEach((point, index) => {
    const dist = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (dist < bestDist) {
      best = point;
      bestDist = dist;
      bestIndex = index;
    }
  });
  guard.cursor = bestIndex;
  return best;
}

function sendGuard(rows: readonly string[], guard: Guard, spot: Vec) {
  const path = pathBetween(rows, { x: guard.x, y: guard.y }, spot);
  if (path.length < 2) {
    guard.duty = { mode: "look", path: [], cursor: 0, look: 0, base: guard.facing };
    return;
  }
  guard.duty = { mode: "go", path, cursor: 1, look: 0, base: guard.facing };
}

function followPath(guard: Guard, dt: number, hurry: number): boolean {
  const duty = guard.duty;
  if (!duty) return true;
  const target = duty.path[duty.cursor];
  if (!target) return true;
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.08) {
    guard.x = target.x;
    guard.y = target.y;
    duty.cursor += 1;
    return duty.cursor >= duty.path.length;
  }
  guard.facing = Math.atan2(dy, dx);
  const step = guard.speed * hurry * dt;
  if (dist <= step) {
    guard.x = target.x;
    guard.y = target.y;
    duty.cursor += 1;
    return duty.cursor >= duty.path.length;
  }
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  return false;
}

function updateDuty(rows: readonly string[], guard: Guard, dt: number) {
  const duty = guard.duty;
  if (!duty) return;
  if (duty.mode === "go") {
    if (followPath(guard, dt, 1.25)) {
      duty.mode = "look";
      duty.look = 0;
      duty.base = guard.facing;
    }
    return;
  }
  if (duty.mode === "look") {
    duty.look += dt;
    guard.facing = duty.base + Math.sin(duty.look * 3.2) * 0.95;
    if (duty.look >= LOOK_TIME) {
      const stop = nearestStop(guard);
      const path = pathBetween(rows, { x: guard.x, y: guard.y }, stop);
      duty.mode = "back";
      duty.path = path;
      duty.cursor = path.length > 1 ? 1 : 0;
      duty.base = guard.facing;
    }
    return;
  }
  if (followPath(guard, dt, 1)) {
    guard.duty = null;
    faceGuard(guard);
  }
}

function moveGuard(guard: Guard, dt: number) {
  guard.rerouteIn = Math.max(0, guard.rerouteIn - dt);
  const route = guard.routes[guard.routeIndex];
  const target = route?.[guard.cursor];
  if (!target) return;
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) {
    arrive(guard);
    return;
  }
  guard.facing = Math.atan2(dy, dx);
  const step = guard.speed * dt;
  if (dist <= step) {
    guard.x = target.x;
    guard.y = target.y;
    arrive(guard);
    return;
  }
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
}

function spawnSparks(sim: Sim, x: number, y: number) {
  const colors = ["#ffd24a", "#fff1a8", "#ff4fd8", "#7af7ff"];
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    sim.particles.push({
      x, y,
      vx: Math.cos(angle) * 2.4,
      vy: Math.sin(angle) * 2.4,
      life: 0.45,
      max: 0.45,
      color: colors[i % colors.length] ?? "#ffd24a",
    });
  }
}

export function createSim(level: Level): Sim {
  const guards = level.guards.map(def => {
    const routes = def.routes.map(route => route.map(point => ({ x: point.x, y: point.y })));
    const home = routes[0]?.[0] ?? level.spawn;
    const guard: Guard = {
      x: home.x,
      y: home.y,
      facing: 0,
      routeIndex: 0,
      cursor: (routes[0]?.length ?? 0) > 1 ? 1 : 0,
      dir: 1,
      rerouteIn: def.rerouteEvery,
      speed: def.speed,
      beamLength: def.beamLength,
      beamHalf: def.beamHalf,
      rerouteEvery: def.rerouteEvery,
      hue: def.hue,
      routes,
      duty: null,
    };
    faceGuard(guard);
    return guard;
  });
  return {
    level,
    x: level.spawn.x,
    y: level.spawn.y,
    facing: "down",
    side: "right",
    walking: false,
    frame: 0,
    anim: 0,
    alert: 0,
    alertLatch: false,
    taken: level.pouches.map(() => false),
    guards,
    particles: [],
    shake: 0,
    time: 0,
    clock: level.limit,
    hurryLatch: false,
    caught: false,
    catch: null,
    escaped: false,
    purse: coinsFor(level.id),
    flight: null,
    aim: null,
    aimGuard: -1,
    lure: null,
    lureLife: 0,
    spotted: false,
  };
}

function facingStep(facing: Facing): Vec {
  switch (facing) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    default: {
      const never: never = facing;
      return never;
    }
  }
}

export function step(sim: Sim, input: Input, dt: number, reducedMotion: boolean): StepResult {
  const empty: StepResult = { stole: false, caught: false, escaped: false, alerted: false, hurried: false, threw: false, called: false };
  if (sim.caught || sim.escaped) return empty;
  const frame = Math.min(0.05, Math.max(0, dt));
  sim.time += frame;
  sim.shake = Math.max(0, sim.shake - frame);
  for (const particle of sim.particles) {
    particle.life -= frame;
    particle.x += particle.vx * frame;
    particle.y += particle.vy * frame;
    particle.vy += 1.4 * frame;
  }
  sim.particles = sim.particles.filter(particle => particle.life > 0);

  const rows = sim.level.rows;
  sim.clock = Math.max(0, sim.clock - frame);
  let hurried = false;
  if (!sim.hurryLatch && sim.clock <= 10 && sim.clock > 0) {
    sim.hurryLatch = true;
    hurried = true;
  }
  const speed = (input.sneak ? 1.45 : 2.7) * frame;
  const prevX = sim.x;
  const prevY = sim.y;
  const nx = sim.x + input.x * speed;
  const ny = sim.y + input.y * speed;
  if (!blocked(rows, nx, sim.y)) sim.x = nx;
  if (!blocked(rows, sim.x, ny)) sim.y = ny;
  if ((input.x !== 0 || input.y !== 0) && sim.x === prevX && sim.y === prevY) {
    const cx = Math.floor(sim.x) + 0.5;
    const cy = Math.floor(sim.y) + 0.5;
    const tx = sim.x + Math.sign(cx - sim.x) * 0.05;
    const ty = sim.y + Math.sign(cy - sim.y) * 0.05;
    if (!blocked(rows, tx, sim.y)) sim.x = tx;
    if (!blocked(rows, sim.x, ty)) sim.y = ty;
  }
  sim.walking = Math.hypot(sim.x - prevX, sim.y - prevY) > 0.0001;
  if (Math.abs(input.x) > Math.abs(input.y) && Math.abs(input.x) > 0.01) {
    sim.facing = input.x > 0 ? "right" : "left";
    sim.side = sim.facing;
  } else if (input.y > 0.01) sim.facing = "down";
  else if (input.y < -0.01) sim.facing = "up";
  if (sim.walking) {
    sim.anim += frame * 10;
    sim.frame = Math.floor(sim.anim) % 8;
  } else if (reducedMotion) sim.frame = 0;
  else sim.frame = Math.floor(sim.time * 1.5) % 8;

  const aimTarget = input.aim ?? {
    x: sim.x + facingStep(sim.facing).x * THROW_RANGE,
    y: sim.y + facingStep(sim.facing).y * THROW_RANGE,
  };
  sim.aim = input.aim || input.throwCoin ? landingSpot(rows, { x: sim.x, y: sim.y }, aimTarget) : null;
  sim.aimGuard = sim.aim ? hearer(sim.guards, sim.aim) : -1;
  let threw = false;
  let called = false;
  if (input.throwCoin) {
    input.throwCoin = false;
    const spot = sim.aim;
    if (spot && sim.purse > 0 && !sim.flight) {
      sim.purse -= 1;
      const dist = Math.hypot(spot.x - sim.x, spot.y - sim.y);
      sim.flight = { fromX: sim.x, fromY: sim.y, toX: spot.x, toY: spot.y, t: 0, dur: 0.22 + dist * 0.07 };
      threw = true;
    }
  }
  if (sim.flight) {
    sim.flight.t += frame / sim.flight.dur;
    if (sim.flight.t >= 1) {
      const spot = { x: sim.flight.toX, y: sim.flight.toY };
      sim.flight = null;
      sim.lure = spot;
      sim.lureLife = 2.2;
      if (!reducedMotion) spawnSparks(sim, spot.x, spot.y);
      const guard = sim.guards[hearer(sim.guards, spot)];
      if (guard) {
        sendGuard(rows, guard, spot);
        called = true;
      }
    }
  }
  sim.lureLife = Math.max(0, sim.lureLife - frame);
  if (sim.lureLife === 0) sim.lure = null;

  for (const guard of sim.guards) {
    if (guard.duty) updateDuty(rows, guard, frame);
    else moveGuard(guard, frame);
  }

  let stole = false;
  if (input.steal) {
    input.steal = false;
    let best = -1;
    let bestDist = STEAL_REACH;
    sim.level.pouches.forEach((pouch, index) => {
      if (sim.taken[index]) return;
      const dist = Math.hypot(pouch.x - sim.x, pouch.y - sim.y);
      if (dist <= bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    if (best >= 0) {
      sim.taken[best] = true;
      stole = true;
      const pouch = sim.level.pouches[best];
      if (pouch && !reducedMotion) spawnSparks(sim, pouch.x, pouch.y);
    }
  }

  let bestRate = 0;
  let seen: Guard | null = null;
  for (const guard of sim.guards) {
    if (!guardSees(rows, guard, sim.x, sim.y)) continue;
    const dist = Math.hypot(guard.x - sim.x, guard.y - sim.y);
    const closeness = 1 - dist / guard.beamLength;
    const rate = (0.55 + closeness * 1.15) * (input.sneak ? 0.62 : 1);
    if (rate > bestRate) {
      bestRate = rate;
      seen = guard;
    }
  }
  if (bestRate > 0) sim.alert = Math.min(1, sim.alert + bestRate * frame);
  else sim.alert = Math.max(0, sim.alert - 0.42 * frame);

  let alerted = false;
  if (sim.alert >= 0.62 && !sim.alertLatch) {
    sim.alertLatch = true;
    sim.spotted = true;
    alerted = true;
  } else if (sim.alert < 0.2) sim.alertLatch = false;

  let bumped: Guard | null = null;
  let bumpDist = GUARD_TOUCH;
  for (const guard of sim.guards) {
    const dist = Math.hypot(guard.x - sim.x, guard.y - sim.y);
    if (dist < bumpDist) {
      bumped = guard;
      bumpDist = dist;
    }
  }
  const looted = sim.taken.every(Boolean);
  const atExit = Math.hypot(sim.level.exit.x - sim.x, sim.level.exit.y - sim.y) <= EXIT_REACH;
  if (looted && atExit) {
    sim.escaped = true;
    return { stole, caught: false, escaped: true, alerted, hurried, threw, called };
  }
  const watcher = bumped ?? seen;
  if (bumped || sim.alert >= 1) {
    sim.caught = true;
    sim.shake = reducedMotion ? 0 : 0.35;
    sim.catch = {
      cause: bumped ? "bump" : "beam",
      hue: watcher?.hue ?? null,
      sneaking: input.sneak,
      looking: watcher?.duty !== null && watcher?.duty !== undefined,
      pouchesLeft: pouchesLeft(sim),
      clock: sim.clock,
      limit: sim.level.limit,
    };
    return { stole, caught: true, escaped: false, alerted, hurried, threw, called };
  }
  if (sim.clock <= 0) {
    sim.caught = true;
    sim.catch = {
      cause: "clock",
      hue: null,
      sneaking: input.sneak,
      looking: false,
      pouchesLeft: pouchesLeft(sim),
      clock: 0,
      limit: sim.level.limit,
    };
    return { stole, caught: true, escaped: false, alerted, hurried, threw, called };
  }
  return { stole, caught: false, escaped: false, alerted, hurried, threw, called };
}

export const QUIET_BONUS = 3;

export function pouchesLeft(sim: Sim): number {
  return sim.taken.filter(taken => !taken).length;
}

export function nearPouch(sim: Sim): boolean {
  return sim.level.pouches.some((pouch, index) => !sim.taken[index] && Math.hypot(pouch.x - sim.x, pouch.y - sim.y) <= STEAL_REACH);
}

function flood(rows: readonly string[], col: number, row: number): Set<string> {
  const seen = new Set<string>();
  const queue: { col: number; row: number }[] = [{ col, row }];
  while (queue.length) {
    const next = queue.pop();
    if (!next) break;
    const key = `${next.col},${next.row}`;
    if (seen.has(key)) continue;
    const ch = rows[next.row]?.[next.col];
    if (ch === undefined || solidChar(ch)) continue;
    seen.add(key);
    queue.push(
      { col: next.col + 1, row: next.row },
      { col: next.col - 1, row: next.row },
      { col: next.col, row: next.row + 1 },
      { col: next.col, row: next.row - 1 },
    );
  }
  return seen;
}

export function validateLevels(levels: readonly Level[]): void {
  const payouts = levels.map(level => level.payout);
  const guards = levels.map(level => level.guards.length);
  const limits = levels.map(level => level.limit);
  if (payouts.join() !== "5,8,12,16,24") throw new Error(`Unexpected payouts: ${payouts.join()}`);
  if (guards.join() !== "1,2,3,3,4") throw new Error(`Unexpected guard counts: ${guards.join()}`);
  if (limits.join() !== CASTLE_LIMITS.join()) throw new Error(`Unexpected clocks: ${limits.join()}`);
  for (const level of levels) {
    const width = level.rows[0]?.length ?? 0;
    if (width < 8 || level.rows.length < 8) throw new Error(`${level.name} is too small.`);
    for (const row of level.rows) {
      if (row.length !== width) throw new Error(`${level.name} has a row of length ${row.length}, expected ${width}.`);
    }
    const marks = { S: 0, E: 0, $: 0 };
    for (const row of level.rows) {
      for (const ch of row) {
        if (ch === "S" || ch === "E" || ch === "$") marks[ch] += 1;
      }
    }
    if (marks.S !== 1 || marks.E !== 1 || marks.$ < 1) {
      throw new Error(`${level.name} needs one spawn, one exit, and at least one pouch.`);
    }
    if (level.pouches.length !== marks.$) throw new Error(`${level.name} pouch list does not match the map.`);
    const startCol = Math.floor(level.spawn.x);
    const startRow = Math.floor(level.spawn.y);
    const reached = flood(level.rows, startCol, startRow);
    const exitKey = `${Math.floor(level.exit.x)},${Math.floor(level.exit.y)}`;
    if (!reached.has(exitKey)) throw new Error(`${level.name} exit is sealed off from the spawn.`);
    for (const pouch of level.pouches) {
      const key = `${Math.floor(pouch.x)},${Math.floor(pouch.y)}`;
      if (!reached.has(key)) throw new Error(`${level.name} pouch at ${key} is unreachable.`);
    }
    if (blocked(level.rows, level.spawn.x, level.spawn.y)) throw new Error(`${level.name} spawn is inside a wall.`);
    for (const [index, guard] of level.guards.entries()) {
      if (guard.routes.length < 2) throw new Error(`${level.name} guard ${index + 1} needs two routes.`);
      const home = guard.routes[0]?.[0];
      if (!home) throw new Error(`${level.name} guard ${index + 1} has an empty route.`);
      for (const route of guard.routes) {
        if (route.length < 2) throw new Error(`${level.name} guard ${index + 1} has a short route.`);
        if (!samePoint(route[0], home)) throw new Error(`${level.name} guard ${index + 1} routes must share a home.`);
        for (let i = 1; i < route.length; i += 1) {
          const from = route[i - 1];
          const to = route[i];
          if (!from || !to || !segmentClear(level.rows, from, to)) {
            throw new Error(`${level.name} guard ${index + 1} route hits a wall near ${to?.x},${to?.y}.`);
          }
        }
      }
    }
  }
}
